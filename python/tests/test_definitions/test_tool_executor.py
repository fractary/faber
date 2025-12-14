"""Tests for tool executor (sandbox enforcement)."""

import pytest

from faber.definitions.schemas import (
    BashImplementation,
    ToolDefinition,
    ToolImplementation,
    ToolParameter,
)
from faber.definitions.tool_executor import (
    BashToolExecutor,
    ToolExecutionError,
    create_tool_executor,
)


class TestBashToolExecutor:
    """Test bash tool executor."""

    def test_parameter_substitution(self):
        """Test that parameters are substituted correctly."""
        tool_def = ToolDefinition(
            name="test-echo",
            description="Echo test",
            parameters={
                "message": ToolParameter(
                    type="string", description="Message", required=True
                )
            },
            implementation=ToolImplementation(
                type="bash",
                bash=BashImplementation(
                    command="echo ${message}",
                    sandbox={"enabled": False},  # Disable sandbox for simple test
                ),
            ),
        )

        executor = BashToolExecutor(tool_def)
        result = executor._substitute_parameters(
            tool_def.implementation.bash.command, {"message": "hello"}
        )

        # shlex.quote() wraps in single quotes
        assert "'hello'" in result

    def test_command_injection_prevention(self):
        """Test that command injection is prevented by shlex.quote()."""
        tool_def = ToolDefinition(
            name="test-injection",
            description="Test injection prevention",
            parameters={
                "input": ToolParameter(
                    type="string", description="Input", required=True
                )
            },
            implementation=ToolImplementation(
                type="bash",
                bash=BashImplementation(
                    command="echo ${input}",
                    sandbox={"enabled": False},
                ),
            ),
        )

        executor = BashToolExecutor(tool_def)

        # Attempt injection with semicolon
        malicious_input = "test; rm -rf /"
        result = executor._substitute_parameters(
            tool_def.implementation.bash.command, {"input": malicious_input}
        )

        # shlex.quote() should escape the entire string as single token
        # The semicolon should be quoted and treated as literal text
        assert ";" in result  # Semicolon exists
        assert "rm" in result  # But as part of quoted string
        # Verify it's properly quoted (whole thing in single quotes)
        assert "'test; rm -rf /'" in result

    def test_sandbox_validation_rejects_unlisted_commands(self):
        """Test that sandbox rejects commands not in allowlist."""
        tool_def = ToolDefinition(
            name="test-sandbox",
            description="Test sandbox",
            parameters={},
            implementation=ToolImplementation(
                type="bash",
                bash=BashImplementation(
                    command="rm -rf /",
                    sandbox={
                        "enabled": True,
                        "allowlisted_commands": ["echo", "cat"],
                    },
                ),
            ),
        )

        executor = BashToolExecutor(tool_def)

        with pytest.raises(
            ToolExecutionError, match="Command 'rm' not in allowlist"
        ):
            executor._validate_command_sandbox(
                "rm -rf /", tool_def.implementation.bash.sandbox
            )

    def test_sandbox_validation_allows_listed_commands(self):
        """Test that sandbox allows commands in allowlist."""
        tool_def = ToolDefinition(
            name="test-sandbox",
            description="Test sandbox",
            parameters={},
            implementation=ToolImplementation(
                type="bash",
                bash=BashImplementation(
                    command="echo hello",
                    sandbox={
                        "enabled": True,
                        "allowlisted_commands": ["echo"],
                    },
                ),
            ),
        )

        executor = BashToolExecutor(tool_def)

        # Should not raise
        executor._validate_command_sandbox(
            "echo hello", tool_def.implementation.bash.sandbox
        )

    @pytest.mark.asyncio
    async def test_bash_executor_executes_simple_command(self):
        """Test that bash executor can execute simple commands."""
        tool_def = ToolDefinition(
            name="test-exec",
            description="Test execution",
            parameters={},
            implementation=ToolImplementation(
                type="bash",
                bash=BashImplementation(
                    command="echo 'test output'",
                    sandbox={"enabled": False},
                ),
            ),
        )

        executor = BashToolExecutor(tool_def)
        result = await executor.execute({})

        assert result["status"] == 0
        assert "test output" in result["stdout"]

    @pytest.mark.asyncio
    async def test_bash_executor_with_parameters(self):
        """Test bash executor with parameter substitution."""
        tool_def = ToolDefinition(
            name="test-params",
            description="Test with parameters",
            parameters={
                "text": ToolParameter(
                    type="string", description="Text to echo", required=True
                )
            },
            implementation=ToolImplementation(
                type="bash",
                bash=BashImplementation(
                    command="echo ${text}",
                    sandbox={"enabled": False},
                ),
            ),
        )

        executor = BashToolExecutor(tool_def)
        result = await executor.execute({"text": "hello world"})

        assert result["status"] == 0
        assert "hello world" in result["stdout"]


class TestToolExecutorFactory:
    """Test tool executor factory."""

    def test_create_bash_executor(self):
        """Test creating bash tool executor."""
        tool_def = ToolDefinition(
            name="test",
            description="Test",
            parameters={},
            implementation=ToolImplementation(
                type="bash",
                bash=BashImplementation(command="echo test", sandbox={}),
            ),
        )

        executor = create_tool_executor(tool_def)
        assert isinstance(executor, BashToolExecutor)
