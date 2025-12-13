"""
Workflow Compiler - Transform YAML definitions to LangGraph StateGraph.

This module compiles validated YAML workflow definitions into executable
LangGraph StateGraph instances, ready for workflow execution.
"""

from __future__ import annotations

import time
from pathlib import Path
from typing import Any, Callable, Dict, List, Literal, Optional, Sequence, Union

from langchain_core.messages import HumanMessage
from langchain_core.tools import BaseTool
from langgraph.checkpoint.memory import MemorySaver
from langgraph.graph import END, StateGraph

from faber.accessibility.loader import (
    WorkflowValidationError,
    load_workflow,
    resolve_references,
)
from faber.accessibility.schemas import Phase, WorkflowSchema
from faber.agents.base import FaberAgentConfig, NativeMiddleware, _get_model
from faber.workflows.state import FaberPhaseResult, FaberState


# Tool registry - maps tool names to tool functions
_TOOL_REGISTRY: Dict[str, BaseTool] = {}


def _init_tool_registry() -> None:
    """Initialize the tool registry with all available tools."""
    global _TOOL_REGISTRY

    if _TOOL_REGISTRY:
        return  # Already initialized

    # Import tools
    from faber.tools import (
        fetch_issue,
        create_issue,
        classify_work_type,
        create_issue_comment,
        close_issue,
        search_issues,
        get_current_branch,
        create_branch,
        generate_branch_name,
        git_commit,
        git_push,
        create_pull_request,
        create_specification,
        get_specification,
        validate_specification,
        get_refinement_questions,
        log_info,
        log_error,
        log_phase_start,
        log_phase_end,
    )

    _TOOL_REGISTRY = {
        # Work tools
        "fetch_issue": fetch_issue,
        "create_issue": create_issue,
        "classify_work_type": classify_work_type,
        "create_issue_comment": create_issue_comment,
        "close_issue": close_issue,
        "search_issues": search_issues,
        # Repo tools
        "get_current_branch": get_current_branch,
        "create_branch": create_branch,
        "generate_branch_name": generate_branch_name,
        "git_commit": git_commit,
        "git_push": git_push,
        "create_pull_request": create_pull_request,
        # Spec tools
        "create_specification": create_specification,
        "get_specification": get_specification,
        "validate_specification": validate_specification,
        "get_refinement_questions": get_refinement_questions,
        # Log tools
        "log_info": log_info,
        "log_error": log_error,
        "log_phase_start": log_phase_start,
        "log_phase_end": log_phase_end,
    }


def get_tool_by_name(name: str) -> BaseTool:
    """Get a tool by name from the registry.

    Args:
        name: Tool name (e.g., "fetch_issue", "create_branch")

    Returns:
        Tool function

    Raises:
        WorkflowValidationError: If tool not found
    """
    _init_tool_registry()

    if name not in _TOOL_REGISTRY:
        available = ", ".join(sorted(_TOOL_REGISTRY.keys()))
        raise WorkflowValidationError(
            f"Unknown tool '{name}'. Available tools: {available}"
        )

    return _TOOL_REGISTRY[name]


def get_tools_by_names(names: List[str]) -> List[BaseTool]:
    """Get multiple tools by name.

    Args:
        names: List of tool names

    Returns:
        List of tool functions
    """
    return [get_tool_by_name(name) for name in names]


class WorkflowCompiler:
    """Compile YAML workflow definitions to LangGraph StateGraph.

    This class transforms a validated WorkflowSchema into an executable
    LangGraph StateGraph with:
    - Phase nodes that invoke agents with tools
    - Conditional edges for retry logic
    - Checkpointing support
    """

    def __init__(self, workflow_path: Union[str, Path]) -> None:
        """Initialize the compiler with a workflow YAML file.

        Args:
            workflow_path: Path to the workflow YAML file
        """
        self.workflow_path = Path(workflow_path)
        self.schema = load_workflow(workflow_path)
        self._context = self._build_context()

    def _build_context(self) -> Dict[str, Any]:
        """Build context dictionary for variable resolution."""
        return {
            "models": self.schema.models.model_dump(),
            "config": self.schema.config.model_dump(),
        }

    def _resolve_model(self, model_ref: Optional[str]) -> str:
        """Resolve a model reference to actual model string.

        Args:
            model_ref: Model string or $reference

        Returns:
            Resolved model string (e.g., "anthropic:claude-sonnet-4-20250514")
        """
        if model_ref is None:
            return self._context["models"]["default"]

        if model_ref.startswith("$"):
            resolved = resolve_references(model_ref, self._context, "model")
            return resolved

        return model_ref

    def _create_agent_for_phase(self, phase: Phase) -> NativeMiddleware:
        """Create an agent for a workflow phase.

        Args:
            phase: Phase configuration

        Returns:
            Configured NativeMiddleware agent
        """
        # Resolve model
        model_str = self._resolve_model(phase.model)
        model = _get_model(model_str)

        # Get tools
        tools = get_tools_by_names(phase.tools) if phase.tools else []

        # Build system prompt
        system_prompt = self._build_system_prompt(phase)

        # Create agent config
        config = FaberAgentConfig(
            name=f"{phase.name}-agent",
            description=phase.description,
            system_prompt=system_prompt,
            tools=tools,
            model=model_str,
            human_approval=phase.human_approval,
            max_iterations=phase.max_iterations,
        )

        return NativeMiddleware(config=config, model=model)

    def _build_system_prompt(self, phase: Phase) -> str:
        """Build the system prompt for a phase agent.

        Args:
            phase: Phase configuration

        Returns:
            System prompt string
        """
        lines = [
            f"You are the {phase.name} agent in the FABER workflow.",
            f"Phase: {phase.name}",
        ]

        if phase.description:
            lines.append(f"Description: {phase.description}")

        if phase.tools:
            lines.append(f"Available tools: {', '.join(phase.tools)}")

        if phase.outputs:
            lines.append(f"Expected outputs: {', '.join(phase.outputs)}")

        return "\n".join(lines)

    def _create_node_function(
        self,
        phase_name: str,
        agent: NativeMiddleware,
        phase: Phase,
    ) -> Callable[[FaberState], Dict[str, Any]]:
        """Create a node function for a workflow phase.

        Args:
            phase_name: Name of the phase
            agent: Agent to invoke
            phase: Phase configuration

        Returns:
            Async node function for the StateGraph
        """

        async def node_fn(state: FaberState) -> Dict[str, Any]:
            """Execute the phase."""
            start_time = time.time()

            try:
                # Build input context from state
                input_context = self._build_input_context(phase, state)

                # Invoke agent
                result = await agent.invoke(
                    [HumanMessage(content=f"Execute {phase_name} phase for work item "
                                 f"#{state['work_id']}. {input_context}")],
                )

                # Extract output
                messages = result.get("messages", [])
                output = messages[-1].content if messages else ""

                duration_ms = int((time.time() - start_time) * 1000)

                return {
                    "current_phase": phase_name,
                    "completed_phases": state.get("completed_phases", []) + [phase_name],
                    "phase_results": {
                        **state.get("phase_results", {}),
                        phase_name: FaberPhaseResult(
                            phase=phase_name,
                            status="completed",
                            duration_ms=duration_ms,
                            output={"summary": output[:500]},
                        ),
                    },
                    "messages": result.get("messages", []),
                }

            except Exception as e:
                return {
                    "current_phase": phase_name,
                    "error": str(e),
                    "error_phase": phase_name,
                    "phase_results": {
                        **state.get("phase_results", {}),
                        phase_name: FaberPhaseResult(
                            phase=phase_name,
                            status="failed",
                            error=str(e),
                        ),
                    },
                }

        return node_fn

    def _build_input_context(self, phase: Phase, state: FaberState) -> str:
        """Build input context string from phase inputs and state.

        Args:
            phase: Phase configuration
            state: Current workflow state

        Returns:
            Context string for the agent
        """
        if not phase.inputs:
            return ""

        context_parts = []

        for input_ref in phase.inputs:
            if input_ref.startswith("$"):
                # Try to resolve from state or config
                parts = input_ref[1:].split(".")
                if parts[0] == "config":
                    value = resolve_references(input_ref, self._context, "input")
                    context_parts.append(f"{'.'.join(parts[1:])}: {value}")
                else:
                    # Phase output reference - look in state
                    phase_name = parts[0]
                    if phase_name in state.get("phase_results", {}):
                        phase_result = state["phase_results"][phase_name]
                        context_parts.append(f"{phase_name} result: {phase_result}")

        if context_parts:
            return "Context: " + "; ".join(context_parts)
        return ""

    def _create_retry_condition(
        self,
        retry_phase: str,
        max_retries: int,
        next_phase: str,
    ) -> Callable[[FaberState], str]:
        """Create a conditional function for retry logic.

        Args:
            retry_phase: Phase to retry on failure
            max_retries: Maximum number of retries
            next_phase: Phase to proceed to on success

        Returns:
            Function that returns "retry" or "continue"
        """

        def should_retry(state: FaberState) -> str:
            if state.get("evaluation_result") == "GO":
                return "continue"
            elif state.get("retry_count", 0) < max_retries:
                # Increment retry count in state
                return "retry"
            else:
                return "continue"

        return should_retry

    def _get_checkpointer(self):
        """Get the appropriate checkpointer based on config."""
        # For now, use memory saver
        # TODO: Support sqlite, postgres, redis from config
        return MemorySaver()

    def compile(self) -> StateGraph:
        """Compile the workflow to a LangGraph StateGraph.

        Returns:
            Compiled StateGraph ready for execution
        """
        # Create StateGraph
        workflow = StateGraph(FaberState)

        # Create agents and nodes for each phase
        phases = self.schema.phases
        agents: Dict[str, NativeMiddleware] = {}

        for phase in phases:
            agent = self._create_agent_for_phase(phase)
            agents[phase.name] = agent

            node_fn = self._create_node_function(phase.name, agent, phase)
            workflow.add_node(phase.name, node_fn)

        # Add edges
        for i, phase in enumerate(phases):
            if i < len(phases) - 1:
                next_phase = phases[i + 1]

                # Check for retry configuration
                if phase.on_failure:
                    retry_phase = phase.on_failure.retry_phase
                    max_retries = phase.on_failure.max_retries

                    # Resolve max_retries if it's a reference
                    if isinstance(max_retries, str) and max_retries.startswith("$"):
                        max_retries = resolve_references(
                            max_retries, self._context, "on_failure.max_retries"
                        )

                    retry_condition = self._create_retry_condition(
                        retry_phase, int(max_retries), next_phase.name
                    )

                    workflow.add_conditional_edges(
                        phase.name,
                        retry_condition,
                        {
                            "retry": retry_phase,
                            "continue": next_phase.name,
                        },
                    )
                else:
                    workflow.add_edge(phase.name, next_phase.name)
            else:
                # Last phase goes to END
                workflow.add_edge(phase.name, END)

        # Set entry point
        workflow.set_entry_point(phases[0].name)

        # Compile with checkpointing
        checkpointer = self._get_checkpointer()
        return workflow.compile(checkpointer=checkpointer)


def compile_workflow(path: Union[str, Path]) -> StateGraph:
    """Convenience function to compile a workflow from path.

    Args:
        path: Path to workflow YAML file

    Returns:
        Compiled StateGraph
    """
    compiler = WorkflowCompiler(path)
    return compiler.compile()
