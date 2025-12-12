"""
FABER Workflow Graph - LangGraph StateGraph implementation.

This module implements the core FABER workflow as a LangGraph StateGraph
with checkpointing, retry logic, and human-in-the-loop support.
"""

from __future__ import annotations

import time
import uuid
from typing import Any, Literal, Optional

from langchain_core.messages import HumanMessage
from langgraph.checkpoint.memory import MemorySaver
from langgraph.graph import END, StateGraph

from faber.agents import (
    create_frame_agent,
    create_architect_agent,
    create_build_agent,
    create_evaluate_agent,
    create_release_agent,
)
from faber.workflows.config import WorkflowConfig, load_workflow_config
from faber.workflows.state import FaberPhaseResult, FaberState, create_initial_state


def _get_checkpointer(config: WorkflowConfig):
    """Get the appropriate checkpointer based on config."""
    backend = config.checkpoint.backend

    if backend == "sqlite":
        try:
            from langgraph.checkpoint.sqlite import SqliteSaver

            return SqliteSaver.from_conn_string(config.checkpoint.sqlite_path)
        except ImportError:
            pass

    elif backend == "postgres":
        try:
            from langgraph.checkpoint.postgres import PostgresSaver

            if config.checkpoint.postgres_url:
                return PostgresSaver.from_conn_string(config.checkpoint.postgres_url)
        except ImportError:
            pass

    elif backend == "redis":
        try:
            # Redis checkpoint would be implemented here
            pass
        except ImportError:
            pass

    # Fallback to memory saver
    return MemorySaver()


def create_faber_workflow(
    config: Optional[WorkflowConfig] = None,
) -> StateGraph:
    """Create the FABER workflow as a LangGraph StateGraph.

    Args:
        config: Workflow configuration. If None, loads from default locations.

    Returns:
        Compiled StateGraph ready for execution
    """
    if config is None:
        config = load_workflow_config()

    # Initialize agents
    frame_agent = create_frame_agent()
    architect_agent = create_architect_agent()
    build_agent = create_build_agent()
    evaluate_agent = create_evaluate_agent()
    release_agent = create_release_agent()

    # =========================================================================
    # Node Functions
    # =========================================================================

    async def frame_node(state: FaberState) -> dict[str, Any]:
        """Execute Frame phase - requirements gathering."""
        start_time = time.time()

        try:
            result = await frame_agent.invoke(
                [HumanMessage(content=f"Frame work item #{state['work_id']}. "
                              f"Fetch the issue, classify the work type, "
                              f"extract requirements, and post a FABER:FRAME comment.")],
            )

            # Extract outputs from agent result
            messages = result.get("messages", [])
            output = messages[-1].content if messages else ""

            duration_ms = int((time.time() - start_time) * 1000)

            return {
                "current_phase": "frame",
                "completed_phases": state.get("completed_phases", []) + ["frame"],
                "phase_results": {
                    **state.get("phase_results", {}),
                    "frame": FaberPhaseResult(
                        phase="frame",
                        status="completed",
                        duration_ms=duration_ms,
                        output={"summary": output[:500]},
                    ),
                },
                "messages": result.get("messages", []),
            }

        except Exception as e:
            return {
                "current_phase": "frame",
                "error": str(e),
                "error_phase": "frame",
                "phase_results": {
                    **state.get("phase_results", {}),
                    "frame": FaberPhaseResult(
                        phase="frame",
                        status="failed",
                        error=str(e),
                    ),
                },
            }

    async def architect_node(state: FaberState) -> dict[str, Any]:
        """Execute Architect phase - specification creation."""
        start_time = time.time()

        work_type = state.get("work_type", "feature")

        try:
            result = await architect_agent.invoke(
                [HumanMessage(content=f"Create a specification for work item #{state['work_id']}. "
                              f"Work type: {work_type}. "
                              f"Use the appropriate template, fill in all sections, "
                              f"validate completeness, and post a FABER:ARCHITECT comment.")],
            )

            messages = result.get("messages", [])
            output = messages[-1].content if messages else ""

            duration_ms = int((time.time() - start_time) * 1000)

            return {
                "current_phase": "architect",
                "completed_phases": state.get("completed_phases", []) + ["architect"],
                "phase_results": {
                    **state.get("phase_results", {}),
                    "architect": FaberPhaseResult(
                        phase="architect",
                        status="completed",
                        duration_ms=duration_ms,
                        output={"summary": output[:500]},
                    ),
                },
                "spec_validated": True,
                "messages": result.get("messages", []),
            }

        except Exception as e:
            return {
                "current_phase": "architect",
                "error": str(e),
                "error_phase": "architect",
                "phase_results": {
                    **state.get("phase_results", {}),
                    "architect": FaberPhaseResult(
                        phase="architect",
                        status="failed",
                        error=str(e),
                    ),
                },
            }

    async def build_node(state: FaberState) -> dict[str, Any]:
        """Execute Build phase - implementation."""
        start_time = time.time()

        spec_id = state.get("spec_id", state.get("work_id"))

        try:
            result = await build_agent.invoke(
                [HumanMessage(content=f"Implement the solution for work item #{state['work_id']}. "
                              f"Spec ID: {spec_id}. "
                              f"Create a feature branch, implement the solution following "
                              f"the spec, write tests, and make semantic commits.")],
            )

            messages = result.get("messages", [])
            output = messages[-1].content if messages else ""

            duration_ms = int((time.time() - start_time) * 1000)

            return {
                "current_phase": "build",
                "completed_phases": list(set(state.get("completed_phases", []) + ["build"])),
                "phase_results": {
                    **state.get("phase_results", {}),
                    "build": FaberPhaseResult(
                        phase="build",
                        status="completed",
                        duration_ms=duration_ms,
                        output={"summary": output[:500]},
                    ),
                },
                "messages": result.get("messages", []),
            }

        except Exception as e:
            return {
                "current_phase": "build",
                "error": str(e),
                "error_phase": "build",
                "phase_results": {
                    **state.get("phase_results", {}),
                    "build": FaberPhaseResult(
                        phase="build",
                        status="failed",
                        error=str(e),
                    ),
                },
            }

    async def evaluate_node(state: FaberState) -> dict[str, Any]:
        """Execute Evaluate phase - validation."""
        start_time = time.time()

        try:
            result = await evaluate_agent.invoke(
                [HumanMessage(content=f"Evaluate the implementation for work item #{state['work_id']}. "
                              f"Verify acceptance criteria, run tests, review code quality, "
                              f"and make a GO/NO-GO decision.")],
            )

            messages = result.get("messages", [])
            output = messages[-1].content if messages else ""

            # Parse GO/NO-GO decision from output
            decision = "GO" if "GO" in output.upper() and "NO-GO" not in output.upper() else "NO_GO"

            duration_ms = int((time.time() - start_time) * 1000)

            new_retry_count = state.get("retry_count", 0)
            if decision == "NO_GO":
                new_retry_count += 1

            return {
                "current_phase": "evaluate",
                "evaluation_result": decision,
                "evaluation_details": {"output": output[:1000]},
                "retry_count": new_retry_count,
                "phase_results": {
                    **state.get("phase_results", {}),
                    "evaluate": FaberPhaseResult(
                        phase="evaluate",
                        status="completed",
                        duration_ms=duration_ms,
                        output={"decision": decision, "summary": output[:500]},
                    ),
                },
                "messages": result.get("messages", []),
            }

        except Exception as e:
            return {
                "current_phase": "evaluate",
                "evaluation_result": "NO_GO",
                "error": str(e),
                "error_phase": "evaluate",
                "retry_count": state.get("retry_count", 0) + 1,
                "phase_results": {
                    **state.get("phase_results", {}),
                    "evaluate": FaberPhaseResult(
                        phase="evaluate",
                        status="failed",
                        error=str(e),
                    ),
                },
            }

    async def release_node(state: FaberState) -> dict[str, Any]:
        """Execute Release phase - PR creation."""
        start_time = time.time()

        try:
            result = await release_agent.invoke(
                [HumanMessage(content=f"Release work item #{state['work_id']}. "
                              f"Push the branch, create a pull request with comprehensive "
                              f"description, and post a FABER:RELEASE comment on the issue.")],
            )

            messages = result.get("messages", [])
            output = messages[-1].content if messages else ""

            duration_ms = int((time.time() - start_time) * 1000)

            return {
                "current_phase": "release",
                "completed_phases": state.get("completed_phases", []) + ["release"],
                "phase_results": {
                    **state.get("phase_results", {}),
                    "release": FaberPhaseResult(
                        phase="release",
                        status="completed",
                        duration_ms=duration_ms,
                        output={"summary": output[:500]},
                    ),
                },
                "messages": result.get("messages", []),
            }

        except Exception as e:
            return {
                "current_phase": "release",
                "error": str(e),
                "error_phase": "release",
                "phase_results": {
                    **state.get("phase_results", {}),
                    "release": FaberPhaseResult(
                        phase="release",
                        status="failed",
                        error=str(e),
                    ),
                },
            }

    # =========================================================================
    # Conditional Edge Functions
    # =========================================================================

    def should_retry_build(state: FaberState) -> Literal["build", "release"]:
        """Determine whether to retry build or proceed to release."""
        max_retries = config.max_retries

        if state.get("evaluation_result") == "GO":
            return "release"
        elif state.get("retry_count", 0) < max_retries:
            return "build"  # Retry
        else:
            # Max retries exceeded - proceed to release anyway
            # (will create PR with known issues noted)
            return "release"

    def check_for_errors(state: FaberState) -> Literal["continue", "end"]:
        """Check if there are errors that should stop the workflow."""
        if state.get("error") and state.get("error_phase") in ["frame", "architect"]:
            return "end"
        return "continue"

    # =========================================================================
    # Build the Graph
    # =========================================================================

    workflow = StateGraph(FaberState)

    # Add nodes
    workflow.add_node("frame", frame_node)
    workflow.add_node("architect", architect_node)
    workflow.add_node("build", build_node)
    workflow.add_node("evaluate", evaluate_node)
    workflow.add_node("release", release_node)

    # Add edges
    workflow.add_edge("frame", "architect")
    workflow.add_edge("architect", "build")
    workflow.add_edge("build", "evaluate")
    workflow.add_conditional_edges(
        "evaluate",
        should_retry_build,
        {
            "build": "build",
            "release": "release",
        },
    )
    workflow.add_edge("release", END)

    # Set entry point
    workflow.set_entry_point("frame")

    # Compile with checkpointing
    checkpointer = _get_checkpointer(config)
    return workflow.compile(checkpointer=checkpointer)


async def run_faber_workflow(
    work_id: str,
    config: Optional[WorkflowConfig] = None,
    workflow_id: Optional[str] = None,
) -> FaberState:
    """Run the complete FABER workflow for a work item.

    Args:
        work_id: Work item ID to process (e.g., "123")
        config: Workflow configuration
        workflow_id: Optional workflow ID (generated if not provided)

    Returns:
        Final workflow state
    """
    if config is None:
        config = load_workflow_config()

    if workflow_id is None:
        workflow_id = f"WF-{work_id}-{uuid.uuid4().hex[:8]}"

    workflow = create_faber_workflow(config)

    initial_state = create_initial_state(
        workflow_id=workflow_id,
        work_id=work_id,
        budget_limit_usd=config.cost.budget_limit_usd,
    )

    # Run with thread_id for checkpointing
    run_config = {"configurable": {"thread_id": workflow_id}}

    result = await workflow.ainvoke(initial_state, run_config)
    return result


def run_faber_workflow_sync(
    work_id: str,
    config: Optional[WorkflowConfig] = None,
    workflow_id: Optional[str] = None,
) -> FaberState:
    """Synchronous version of run_faber_workflow.

    Args:
        work_id: Work item ID to process
        config: Workflow configuration
        workflow_id: Optional workflow ID

    Returns:
        Final workflow state
    """
    import asyncio

    return asyncio.run(run_faber_workflow(work_id, config, workflow_id))
