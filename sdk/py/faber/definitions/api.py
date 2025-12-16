"""
SDK Public API - High-level interface for using agents and tools.

Provides simple, user-friendly API for:
- Loading and invoking agents
- Loading and invoking tools
- Listing available definitions
"""

from __future__ import annotations

import logging
from pathlib import Path
from typing import Any, Dict, List, Optional

from faber.definitions.agent_factory import AgentFactory
from faber.definitions.registry import DefinitionRegistry, get_registry
from faber.definitions.schemas import AgentDefinition, ToolDefinition
from faber.definitions.tool_executor import create_tool_executor

logger = logging.getLogger(__name__)


class AgentAPI:
    """High-level API for using agents programmatically.

    Example:
        api = AgentAPI()

        # List agents
        agents = api.list_agents(tags=["data-engineering"])

        # Invoke an agent
        result = await api.invoke_agent(
            "my-agent",
            "Do something",
            context={"key": "value"}
        )
    """

    def __init__(self, project_root: Optional[Path | str] = None):
        """Initialize AgentAPI.

        Args:
            project_root: Project root directory (uses cwd if not provided)
        """
        if project_root:
            project_root = Path(project_root)

        self.registry = get_registry(project_root=project_root)
        self.factory = AgentFactory(registry=self.registry)

    def list_agents(self, tags: Optional[List[str]] = None) -> List[AgentDefinition]:
        """List all available agents.

        Args:
            tags: Optional tags to filter by (OR logic)

        Returns:
            List of AgentDefinitions
        """
        return self.registry.list_agents(tags=tags)

    def get_agent(self, name: str) -> Optional[AgentDefinition]:
        """Get agent definition by name.

        Args:
            name: Agent name

        Returns:
            AgentDefinition if found, None otherwise
        """
        return self.registry.get_agent(name)

    def load_agent(self, name: str) -> Any:
        """Load and instantiate an agent.

        Args:
            name: Agent name

        Returns:
            Executable agent (NativeMiddleware or CachedClaudeAgent)

        Raises:
            DefinitionNotFoundError: If agent not found
            AgentFactoryError: If agent creation fails
        """
        return self.factory.create_agent(name)

    async def invoke_agent(
        self,
        agent_name: str,
        task: str,
        context: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        """Load and invoke an agent in one call.

        Args:
            agent_name: Name of agent to invoke
            task: Task description or instruction
            context: Optional context dictionary

        Returns:
            Dict with output, messages, usage, etc.

        Example:
            result = await api.invoke_agent(
                "corthion-loader-engineer",
                "Create loader for claims.medical_claims",
                context={"dataset": "claims", "table": "medical_claims"}
            )
            print(result["output"])
        """
        # Load agent
        agent = self.load_agent(agent_name)

        # Build task message with context
        if context:
            context_str = "\n".join(f"- {k}: {v}" for k, v in context.items())
            full_task = f"Context:\n{context_str}\n\nTask: {task}"
        else:
            full_task = task

        # Invoke agent
        result = await agent.invoke(full_task)

        return result


class ToolAPI:
    """High-level API for using tools programmatically.

    Example:
        api = ToolAPI()

        # List tools
        tools = api.list_tools(tags=["infrastructure"])

        # Invoke a tool
        result = await api.invoke_tool(
            "terraform-deploy",
            environment="test",
            target="aws_glue_job.my_job"
        )
    """

    def __init__(self, project_root: Optional[Path | str] = None):
        """Initialize ToolAPI.

        Args:
            project_root: Project root directory (uses cwd if not provided)
        """
        if project_root:
            project_root = Path(project_root)

        self.registry = get_registry(project_root=project_root)

    def list_tools(self, tags: Optional[List[str]] = None) -> List[ToolDefinition]:
        """List all available tools.

        Args:
            tags: Optional tags to filter by (OR logic)

        Returns:
            List of ToolDefinitions
        """
        return self.registry.list_tools(tags=tags)

    def get_tool(self, name: str) -> Optional[ToolDefinition]:
        """Get tool definition by name.

        Args:
            name: Tool name

        Returns:
            ToolDefinition if found, None otherwise
        """
        return self.registry.get_tool(name)

    def load_tool(self, name: str):
        """Load and instantiate a tool.

        Args:
            name: Tool name

        Returns:
            ToolExecutor instance

        Raises:
            DefinitionNotFoundError: If tool not found
        """
        tool_def = self.registry.get_tool_or_raise(name)
        return create_tool_executor(tool_def)

    async def invoke_tool(self, tool_name: str, **kwargs) -> Dict[str, Any]:
        """Load and invoke a tool in one call.

        Args:
            tool_name: Name of tool to invoke
            **kwargs: Tool parameters

        Returns:
            Tool execution result

        Example:
            result = await api.invoke_tool(
                "terraform-deploy",
                environment="test",
                target="aws_glue_job.my_job",
                auto_approve=False
            )
            print(result["status"])
        """
        # Load tool
        tool = self.load_tool(tool_name)

        # Execute
        result = await tool.execute(kwargs)

        return result
