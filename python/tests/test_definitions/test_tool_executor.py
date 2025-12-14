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
    PythonToolExecutor,
    ToolExecutionError,
    create_tool_executor,
)


class TestBashToolExecutor:
    """Test bash tool executor."""

    def test_parse_command_to_argv(self):
        """Test that command templates are parsed into argv lists correctly."""
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
                    sandbox={"enabled": False},
                ),
            ),
        )

        executor = BashToolExecutor(tool_def)
        argv = executor._parse_command_to_argv(
            tool_def.implementation.bash.command, {"message": "hello world"}
        )

        # Should be ['echo', 'hello world'] - no shell escaping needed with shell=False
        assert argv == ["echo", "hello world"]

    def test_command_injection_prevention_with_shell_false(self):
        """Test that command injection is prevented by shell=False architecture.

        With shell=False, shell metacharacters like ; && || are passed literally
        to the command as arguments, not interpreted as shell operators.
        """
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
        argv = executor._parse_command_to_argv(
            tool_def.implementation.bash.command, {"input": malicious_input}
        )

        # With shell=False, the entire malicious input is just an argument to echo
        # It won't be interpreted as multiple commands
        assert argv == ["echo", "test; rm -rf /"]
        # The semicolon is just part of the string argument, not a command separator

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

        # _validate_command_sandbox now takes argv list
        with pytest.raises(
            ToolExecutionError, match="Command 'rm' not in allowlist"
        ):
            executor._validate_command_sandbox(
                ["rm", "-rf", "/"], tool_def.implementation.bash.sandbox
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

        # Should not raise - _validate_command_sandbox now takes argv list
        executor._validate_command_sandbox(
            ["echo", "hello"], tool_def.implementation.bash.sandbox
        )

    def test_sandbox_validation_empty_argv_raises(self):
        """Test that empty argv raises error."""
        tool_def = ToolDefinition(
            name="test-sandbox",
            description="Test sandbox",
            parameters={},
            implementation=ToolImplementation(
                type="bash",
                bash=BashImplementation(
                    command="echo test",
                    sandbox={"enabled": True},
                ),
            ),
        )

        executor = BashToolExecutor(tool_def)

        with pytest.raises(ToolExecutionError, match="Empty command"):
            executor._validate_command_sandbox([], {})

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

        assert result["status"] == "success"
        assert result["exit_code"] == 0
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

        assert result["status"] == "success"
        assert result["exit_code"] == 0
        assert "hello world" in result["stdout"]

    @pytest.mark.asyncio
    async def test_bash_executor_injection_safe(self):
        """Test that bash executor is safe against injection attempts."""
        tool_def = ToolDefinition(
            name="test-injection-exec",
            description="Test injection safety",
            parameters={
                "filename": ToolParameter(
                    type="string", description="Filename", required=True
                )
            },
            implementation=ToolImplementation(
                type="bash",
                bash=BashImplementation(
                    command="echo ${filename}",
                    sandbox={"enabled": False},
                ),
            ),
        )

        executor = BashToolExecutor(tool_def)
        # Try to inject a command - with shell=False this should be safe
        result = await executor.execute({"filename": "test; whoami"})

        assert result["status"] == "success"
        # The output should contain the literal string including semicolon
        assert "test; whoami" in result["stdout"]


class TestPythonToolExecutor:
    """Test Python tool executor security features."""

    def test_explicit_module_allowlist(self):
        """Test that only explicitly allowed modules can be used."""
        # Verify the allowlist is a set of exact module names
        assert isinstance(PythonToolExecutor.ALLOWED_MODULES, set)
        # Verify some expected modules are in the allowlist
        assert "faber.tools.file_operations" in PythonToolExecutor.ALLOWED_MODULES

    def test_register_module(self):
        """Test that modules can be registered."""
        # Save original state
        original_modules = PythonToolExecutor.ALLOWED_MODULES.copy()

        try:
            # Register a new module
            PythonToolExecutor.register_module("test.custom.module")
            assert "test.custom.module" in PythonToolExecutor.ALLOWED_MODULES
        finally:
            # Restore original state
            PythonToolExecutor.ALLOWED_MODULES = original_modules

    def test_register_module_validation(self):
        """Test that register_module validates input."""
        with pytest.raises(ValueError):
            PythonToolExecutor.register_module("")

        with pytest.raises(ValueError):
            PythonToolExecutor.register_module(None)


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
