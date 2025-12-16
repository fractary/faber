"""
Definition Registry - Discover and load agent/tool definitions.

The registry scans .fractary/agents/ and .fractary/tools/ directories for YAML
files and loads them into validated Pydantic models.
"""

from __future__ import annotations

import logging
from pathlib import Path
from typing import Dict, List, Optional

import yaml
from pydantic import ValidationError

from faber.definitions.schemas import AgentDefinition, ToolDefinition

logger = logging.getLogger(__name__)


class DefinitionRegistryError(Exception):
    """Base exception for registry errors."""

    pass


class DefinitionNotFoundError(DefinitionRegistryError):
    """Raised when a definition is not found."""

    pass


class DefinitionValidationError(DefinitionRegistryError):
    """Raised when a definition fails validation."""

    pass


class DefinitionRegistry:
    """Registry for discovering and loading agent/tool definitions.

    Searches for definitions in:
    - .fractary/agents/*.yaml
    - .fractary/tools/*.yaml

    Example:
        registry = DefinitionRegistry()
        agent = registry.get_agent("my-agent")
        tool = registry.get_tool("my-tool")
    """

    def __init__(self, project_root: Optional[Path] = None):
        """Initialize the registry.

        Args:
            project_root: Project root directory (defaults to current working directory)
        """
        self.project_root = project_root or Path.cwd()
        self.agents_dir = self.project_root / ".fractary/agents"
        self.tools_dir = self.project_root / ".fractary/tools"

        self._agents: Dict[str, AgentDefinition] = {}
        self._tools: Dict[str, ToolDefinition] = {}

        # Auto-discover on init
        self.discover()

    def discover(self) -> None:
        """Discover all agents and tools in .fractary/ directories."""
        self._discover_agents()
        self._discover_tools()

    def _discover_agents(self) -> None:
        """Discover agents from .fractary/agents/*.yaml"""
        if not self.agents_dir.exists():
            logger.debug(f"Agents directory not found: {self.agents_dir}")
            return

        for yaml_file in self.agents_dir.glob("*.yaml"):
            try:
                agent = self._load_agent(yaml_file)
                self._agents[agent.name] = agent
                logger.debug(f"Loaded agent: {agent.name} from {yaml_file}")
            except Exception as e:
                logger.warning(f"Failed to load agent from {yaml_file}: {e}")

    def _discover_tools(self) -> None:
        """Discover tools from .fractary/tools/*.yaml"""
        if not self.tools_dir.exists():
            logger.debug(f"Tools directory not found: {self.tools_dir}")
            return

        for yaml_file in self.tools_dir.glob("*.yaml"):
            try:
                tool = self._load_tool(yaml_file)
                self._tools[tool.name] = tool
                logger.debug(f"Loaded tool: {tool.name} from {yaml_file}")
            except Exception as e:
                logger.warning(f"Failed to load tool from {yaml_file}: {e}")

    def _load_agent(self, path: Path) -> AgentDefinition:
        """Load and validate an agent definition.

        Args:
            path: Path to agent YAML file

        Returns:
            Validated AgentDefinition

        Raises:
            DefinitionValidationError: If YAML is invalid
        """
        try:
            with open(path) as f:
                raw = yaml.safe_load(f)

            if not raw:
                raise DefinitionValidationError(f"Empty YAML file: {path}")

            return AgentDefinition(**raw)

        except yaml.YAMLError as e:
            raise DefinitionValidationError(f"Invalid YAML in {path}: {e}")
        except ValidationError as e:
            # Format Pydantic errors nicely
            errors = []
            for error in e.errors():
                loc = " → ".join(str(x) for x in error["loc"])
                errors.append(f"  • {loc}: {error['msg']}")
            raise DefinitionValidationError(
                f"Invalid agent definition in {path}:\n" + "\n".join(errors)
            )

    def _load_tool(self, path: Path) -> ToolDefinition:
        """Load and validate a tool definition.

        Args:
            path: Path to tool YAML file

        Returns:
            Validated ToolDefinition

        Raises:
            DefinitionValidationError: If YAML is invalid
        """
        try:
            with open(path) as f:
                raw = yaml.safe_load(f)

            if not raw:
                raise DefinitionValidationError(f"Empty YAML file: {path}")

            return ToolDefinition(**raw)

        except yaml.YAMLError as e:
            raise DefinitionValidationError(f"Invalid YAML in {path}: {e}")
        except ValidationError as e:
            # Format Pydantic errors nicely
            errors = []
            for error in e.errors():
                loc = " → ".join(str(x) for x in error["loc"])
                errors.append(f"  • {loc}: {error['msg']}")
            raise DefinitionValidationError(
                f"Invalid tool definition in {path}:\n" + "\n".join(errors)
            )

    # ========================================================================
    # Public API - Retrieval
    # ========================================================================

    def get_agent(self, name: str) -> Optional[AgentDefinition]:
        """Get an agent by name.

        Args:
            name: Agent name

        Returns:
            AgentDefinition if found, None otherwise
        """
        return self._agents.get(name)

    def get_agent_or_raise(self, name: str) -> AgentDefinition:
        """Get an agent by name or raise error.

        Args:
            name: Agent name

        Returns:
            AgentDefinition

        Raises:
            DefinitionNotFoundError: If agent not found
        """
        agent = self.get_agent(name)
        if not agent:
            available = ", ".join(sorted(self._agents.keys())) or "none"
            raise DefinitionNotFoundError(
                f"Agent '{name}' not found. Available agents: {available}"
            )
        return agent

    def get_tool(self, name: str) -> Optional[ToolDefinition]:
        """Get a tool by name.

        Args:
            name: Tool name

        Returns:
            ToolDefinition if found, None otherwise
        """
        return self._tools.get(name)

    def get_tool_or_raise(self, name: str) -> ToolDefinition:
        """Get a tool by name or raise error.

        Args:
            name: Tool name

        Returns:
            ToolDefinition

        Raises:
            DefinitionNotFoundError: If tool not found
        """
        tool = self.get_tool(name)
        if not tool:
            available = ", ".join(sorted(self._tools.keys())) or "none"
            raise DefinitionNotFoundError(
                f"Tool '{name}' not found. Available tools: {available}"
            )
        return tool

    def list_agents(self, tags: Optional[List[str]] = None) -> List[AgentDefinition]:
        """List all agents, optionally filtered by tags.

        Args:
            tags: Optional list of tags to filter by (OR logic)

        Returns:
            List of AgentDefinitions
        """
        agents = list(self._agents.values())

        if tags:
            agents = [a for a in agents if any(tag in a.tags for tag in tags)]

        return sorted(agents, key=lambda a: a.name)

    def list_tools(self, tags: Optional[List[str]] = None) -> List[ToolDefinition]:
        """List all tools, optionally filtered by tags.

        Args:
            tags: Optional list of tags to filter by (OR logic)

        Returns:
            List of ToolDefinitions
        """
        tools = list(self._tools.values())

        if tags:
            tools = [t for t in tools if any(tag in t.tags for tag in tags)]

        return sorted(tools, key=lambda t: t.name)

    # ========================================================================
    # Public API - Persistence
    # ========================================================================

    def save_agent(self, agent: AgentDefinition) -> Path:
        """Save an agent definition to .fractary/agents/

        Args:
            agent: AgentDefinition to save

        Returns:
            Path where agent was saved
        """
        self.agents_dir.mkdir(parents=True, exist_ok=True)
        path = self.agents_dir / f"{agent.name}.yaml"

        with open(path, "w") as f:
            yaml.dump(
                agent.model_dump(exclude_none=True, mode="json"),
                f,
                sort_keys=False,
                default_flow_style=False,
            )

        # Update registry
        self._agents[agent.name] = agent
        logger.info(f"Saved agent: {agent.name} to {path}")

        return path

    def save_tool(self, tool: ToolDefinition) -> Path:
        """Save a tool definition to .fractary/tools/

        Args:
            tool: ToolDefinition to save

        Returns:
            Path where tool was saved
        """
        self.tools_dir.mkdir(parents=True, exist_ok=True)
        path = self.tools_dir / f"{tool.name}.yaml"

        with open(path, "w") as f:
            yaml.dump(
                tool.model_dump(exclude_none=True, mode="json"),
                f,
                sort_keys=False,
                default_flow_style=False,
            )

        # Update registry
        self._tools[tool.name] = tool
        logger.info(f"Saved tool: {tool.name} to {path}")

        return path

    def delete_agent(self, name: str) -> bool:
        """Delete an agent definition.

        Args:
            name: Agent name

        Returns:
            True if deleted, False if not found
        """
        if name not in self._agents:
            return False

        path = self.agents_dir / f"{name}.yaml"
        if path.exists():
            path.unlink()

        del self._agents[name]
        logger.info(f"Deleted agent: {name}")

        return True

    def delete_tool(self, name: str) -> bool:
        """Delete a tool definition.

        Args:
            name: Tool name

        Returns:
            True if deleted, False if not found
        """
        if name not in self._tools:
            return False

        path = self.tools_dir / f"{name}.yaml"
        if path.exists():
            path.unlink()

        del self._tools[name]
        logger.info(f"Deleted tool: {name}")

        return True

    # ========================================================================
    # Utility
    # ========================================================================

    def reload(self) -> None:
        """Reload all definitions from disk."""
        self._agents.clear()
        self._tools.clear()
        self.discover()

    def __repr__(self) -> str:
        return (
            f"DefinitionRegistry("
            f"agents={len(self._agents)}, "
            f"tools={len(self._tools)}, "
            f"root={self.project_root}"
            f")"
        )


# ============================================================================
# Global Singleton
# ============================================================================

_registry: Optional[DefinitionRegistry] = None


def get_registry(project_root: Optional[Path] = None) -> DefinitionRegistry:
    """Get the global definition registry.

    Args:
        project_root: Optional project root (uses cwd if not provided)

    Returns:
        DefinitionRegistry singleton
    """
    global _registry

    if _registry is None or (project_root and project_root != _registry.project_root):
        _registry = DefinitionRegistry(project_root=project_root)

    return _registry


def reset_registry() -> None:
    """Reset the global registry (useful for testing)."""
    global _registry
    _registry = None
