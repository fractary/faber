"""Tests for definition registry (discovery and loading)."""

import tempfile
from pathlib import Path

import pytest
import yaml

from faber.definitions.registry import DefinitionRegistry, DefinitionNotFoundError


@pytest.fixture
def temp_project():
    """Create a temporary project directory with agent and tool definitions."""
    with tempfile.TemporaryDirectory() as tmpdir:
        project_root = Path(tmpdir)

        # Create .fractary directories
        agents_dir = project_root / ".fractary" / "agents"
        tools_dir = project_root / ".fractary" / "tools"
        agents_dir.mkdir(parents=True)
        tools_dir.mkdir(parents=True)

        # Create a sample agent
        agent_yaml = {
            "name": "test-agent",
            "description": "Test agent",
            "type": "agent",
            "llm": {"provider": "anthropic", "model": "claude-sonnet-4-20250514"},
            "system_prompt": "You are a test agent.",
            "tools": [],
            "tags": ["test"],
        }
        (agents_dir / "test-agent.yaml").write_text(yaml.dump(agent_yaml))

        # Create a sample tool
        tool_yaml = {
            "name": "test-tool",
            "description": "Test tool",
            "type": "tool",
            "parameters": {},
            "implementation": {"type": "bash", "bash": {"command": "echo test"}},
            "tags": ["test"],
        }
        (tools_dir / "test-tool.yaml").write_text(yaml.dump(tool_yaml))

        yield project_root


class TestDefinitionRegistry:
    """Test definition registry."""

    def test_registry_discovers_agents(self, temp_project):
        """Test that registry discovers agent definitions."""
        registry = DefinitionRegistry(project_root=temp_project)

        agents = registry.list_agents()
        assert len(agents) == 1
        assert agents[0].name == "test-agent"

    def test_registry_discovers_tools(self, temp_project):
        """Test that registry discovers tool definitions."""
        registry = DefinitionRegistry(project_root=temp_project)

        tools = registry.list_tools()
        assert len(tools) == 1
        assert tools[0].name == "test-tool"

    def test_get_agent_by_name(self, temp_project):
        """Test getting agent by name."""
        registry = DefinitionRegistry(project_root=temp_project)

        agent = registry.get_agent("test-agent")
        assert agent is not None
        assert agent.name == "test-agent"
        assert agent.description == "Test agent"

    def test_get_nonexistent_agent_returns_none(self, temp_project):
        """Test that getting nonexistent agent returns None."""
        registry = DefinitionRegistry(project_root=temp_project)

        agent = registry.get_agent("nonexistent")
        assert agent is None

    def test_get_agent_or_raise_success(self, temp_project):
        """Test get_agent_or_raise with existing agent."""
        registry = DefinitionRegistry(project_root=temp_project)

        agent = registry.get_agent_or_raise("test-agent")
        assert agent.name == "test-agent"

    def test_get_agent_or_raise_fails(self, temp_project):
        """Test get_agent_or_raise with nonexistent agent."""
        registry = DefinitionRegistry(project_root=temp_project)

        with pytest.raises(DefinitionNotFoundError, match="Agent not found"):
            registry.get_agent_or_raise("nonexistent")

    def test_get_tool_by_name(self, temp_project):
        """Test getting tool by name."""
        registry = DefinitionRegistry(project_root=temp_project)

        tool = registry.get_tool("test-tool")
        assert tool is not None
        assert tool.name == "test-tool"

    def test_list_agents_by_tags(self, temp_project):
        """Test filtering agents by tags."""
        registry = DefinitionRegistry(project_root=temp_project)

        agents = registry.list_agents(tags=["test"])
        assert len(agents) == 1

        agents = registry.list_agents(tags=["nonexistent"])
        assert len(agents) == 0

    def test_list_tools_by_tags(self, temp_project):
        """Test filtering tools by tags."""
        registry = DefinitionRegistry(project_root=temp_project)

        tools = registry.list_tools(tags=["test"])
        assert len(tools) == 1

        tools = registry.list_tools(tags=["nonexistent"])
        assert len(tools) == 0

    def test_registry_handles_missing_directories(self):
        """Test that registry handles missing .fractary directories gracefully."""
        with tempfile.TemporaryDirectory() as tmpdir:
            registry = DefinitionRegistry(project_root=Path(tmpdir))

            agents = registry.list_agents()
            assert len(agents) == 0

            tools = registry.list_tools()
            assert len(tools) == 0
