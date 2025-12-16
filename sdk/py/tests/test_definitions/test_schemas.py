"""Tests for definition schemas (Pydantic validators)."""

import pytest
from pydantic import ValidationError

from faber.definitions.schemas import (
    AgentDefinition,
    BashImplementation,
    CachingConfig,
    CachingSource,
    LLMConfig,
    ToolDefinition,
    ToolImplementation,
    ToolParameter,
)


class TestLLMConfig:
    """Test LLM configuration validation."""

    def test_valid_llm_config(self):
        """Test valid LLM configuration."""
        config = LLMConfig(
            provider="anthropic",
            model="claude-sonnet-4-20250514",
            temperature=0.5,
            max_tokens=2048,
        )
        assert config.provider == "anthropic"
        assert config.model == "claude-sonnet-4-20250514"
        assert config.temperature == 0.5
        assert config.max_tokens == 2048

    def test_empty_model_name_fails(self):
        """Test that empty model name is rejected."""
        with pytest.raises(ValidationError, match="model must not be empty"):
            LLMConfig(provider="anthropic", model="", temperature=0.0)

    def test_temperature_bounds(self):
        """Test temperature validation bounds."""
        # Valid boundaries
        LLMConfig(provider="anthropic", model="test", temperature=0.0)
        LLMConfig(provider="anthropic", model="test", temperature=1.0)

        # Invalid boundaries
        with pytest.raises(ValidationError):
            LLMConfig(provider="anthropic", model="test", temperature=-0.1)
        with pytest.raises(ValidationError):
            LLMConfig(provider="anthropic", model="test", temperature=1.1)


class TestCachingSource:
    """Test caching source validation."""

    def test_file_source_valid(self):
        """Test valid file cache source."""
        source = CachingSource(
            type="file", path=".fractary/docs/STANDARDS.md", label="Standards"
        )
        assert source.type == "file"
        assert source.path == ".fractary/docs/STANDARDS.md"

    def test_file_source_missing_path_fails(self):
        """Test that file source without path fails."""
        with pytest.raises(ValidationError, match="path is required"):
            CachingSource(type="file", label="Standards")

    def test_glob_source_valid(self):
        """Test valid glob cache source."""
        source = CachingSource(
            type="glob", pattern=".fractary/templates/*.py", label="Templates"
        )
        assert source.type == "glob"
        assert source.pattern == ".fractary/templates/*.py"

    def test_glob_source_missing_pattern_fails(self):
        """Test that glob source without pattern fails."""
        with pytest.raises(ValidationError, match="pattern is required"):
            CachingSource(type="glob", label="Templates")

    def test_inline_source_valid(self):
        """Test valid inline cache source."""
        source = CachingSource(
            type="inline", content="Sample content", label="Inline"
        )
        assert source.type == "inline"
        assert source.content == "Sample content"

    def test_inline_source_missing_content_fails(self):
        """Test that inline source without content fails."""
        with pytest.raises(ValidationError, match="content is required"):
            CachingSource(type="inline", label="Inline")

    def test_codex_source_valid(self):
        """Test valid codex cache source."""
        source = CachingSource(
            type="codex",
            uri="codex://org/project/standards.md",
            label="Standards",
        )
        assert source.type == "codex"
        assert source.uri == "codex://org/project/standards.md"

    def test_codex_source_missing_uri_fails(self):
        """Test that codex source without URI fails."""
        with pytest.raises(ValidationError, match="uri is required"):
            CachingSource(type="codex", label="Standards")

    def test_codex_source_invalid_uri_fails(self):
        """Test that codex source with invalid URI fails."""
        with pytest.raises(ValidationError, match="must start with codex://"):
            CachingSource(
                type="codex", uri="http://example.com/doc", label="Standards"
            )


class TestAgentDefinition:
    """Test agent definition validation."""

    def test_minimal_agent_definition(self):
        """Test minimal valid agent definition."""
        agent = AgentDefinition(
            name="test-agent",
            description="Test agent",
            llm=LLMConfig(provider="anthropic", model="claude-sonnet-4-20250514"),
            system_prompt="You are a test agent.",
        )
        assert agent.name == "test-agent"
        assert agent.description == "Test agent"
        assert len(agent.tools) == 0
        assert agent.caching is None

    def test_agent_with_caching(self):
        """Test agent with caching configuration."""
        agent = AgentDefinition(
            name="cached-agent",
            description="Agent with caching",
            llm=LLMConfig(provider="anthropic", model="claude-sonnet-4-20250514"),
            system_prompt="You are a cached agent.",
            caching=CachingConfig(
                enabled=True,
                cache_sources=[
                    CachingSource(
                        type="file",
                        path=".fractary/docs/STANDARDS.md",
                        label="Standards",
                    )
                ],
            ),
        )
        assert agent.caching.enabled is True
        assert len(agent.caching.cache_sources) == 1


class TestToolDefinition:
    """Test tool definition validation."""

    def test_bash_tool_definition(self):
        """Test valid bash tool definition."""
        tool = ToolDefinition(
            name="test-tool",
            description="Test tool",
            parameters={
                "input": ToolParameter(
                    type="string", description="Input value", required=True
                )
            },
            implementation=ToolImplementation(
                type="bash",
                bash=BashImplementation(
                    command="echo ${input}",
                    sandbox={"enabled": True, "allowlisted_commands": ["echo"]},
                ),
            ),
        )
        assert tool.name == "test-tool"
        assert tool.implementation.type == "bash"
        assert tool.implementation.bash.command == "echo ${input}"

    def test_bash_tool_missing_command_fails(self):
        """Test that bash tool without command fails."""
        with pytest.raises(ValidationError, match="command is required"):
            ToolImplementation(
                type="bash", bash=BashImplementation(command="", sandbox={})
            )
