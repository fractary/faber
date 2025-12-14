"""
Tool Executor - Execute tools based on their implementation type.

Supports:
- Bash: Execute shell commands with sandboxing
- Python: Call Python functions dynamically
- HTTP: Make HTTP requests
"""

from __future__ import annotations

import asyncio
import importlib
import json
import logging
import re
import shlex
import subprocess
from abc import ABC, abstractmethod
from typing import Any, Dict, Optional

import httpx

from faber.definitions.schemas import ToolDefinition

logger = logging.getLogger(__name__)


class ToolExecutionError(Exception):
    """Raised when tool execution fails."""

    pass


class ToolExecutor(ABC):
    """Base class for tool executors."""

    def __init__(self, tool_def: ToolDefinition):
        """Initialize executor with tool definition."""
        self.tool_def = tool_def

    @abstractmethod
    async def execute(self, parameters: Dict[str, Any]) -> Dict[str, Any]:
        """Execute the tool with given parameters."""
        pass

    def _validate_parameters(self, parameters: Dict[str, Any]) -> None:
        """Validate parameters against tool definition.

        Args:
            parameters: Parameters to validate

        Raises:
            ToolExecutionError: If validation fails
        """
        for param_name, param_def in self.tool_def.parameters.items():
            # Check required parameters
            if param_def.required and param_name not in parameters:
                raise ToolExecutionError(
                    f"Required parameter missing: {param_name}"
                )

            # Use default if not provided
            if param_name not in parameters and param_def.default is not None:
                parameters[param_name] = param_def.default

            # Validate enum values
            if (
                param_name in parameters
                and param_def.enum is not None
                and parameters[param_name] not in param_def.enum
            ):
                raise ToolExecutionError(
                    f"Invalid value for {param_name}: {parameters[param_name]}. "
                    f"Must be one of: {param_def.enum}"
                )

    def _substitute_parameters(
        self, template: str, parameters: Dict[str, Any]
    ) -> str:
        """Substitute ${param} placeholders in template.

        Args:
            template: Template string with ${param} placeholders
            parameters: Parameters to substitute

        Returns:
            String with substituted values (properly escaped for shell safety)
        """
        import shlex

        result = template

        for key, value in parameters.items():
            # Convert value to string
            str_value = str(value) if value is not None else ""

            # Escape value to prevent command injection
            # shlex.quote() ensures the value is treated as a single token
            escaped_value = shlex.quote(str_value)

            # Replace ${key} with escaped value
            result = result.replace(f"${{{key}}}", escaped_value)

        return result


# ============================================================================
# Bash Executor
# ============================================================================


class BashToolExecutor(ToolExecutor):
    """Execute bash commands with sandboxing."""

    async def execute(self, parameters: Dict[str, Any]) -> Dict[str, Any]:
        """Execute bash command.

        Args:
            parameters: Tool parameters

        Returns:
            Dict with status, output, error

        Raises:
            ToolExecutionError: If execution fails
        """
        # Validate parameters
        self._validate_parameters(parameters)

        # Get command and sandbox config
        bash_impl = self.tool_def.implementation.bash
        if not bash_impl:
            raise ToolExecutionError("Bash implementation not found")

        command = bash_impl.command
        sandbox = bash_impl.sandbox or {}

        # Substitute parameters
        command = self._substitute_parameters(command, parameters)

        # Check sandbox
        if sandbox.get("enabled", True):
            self._validate_command_sandbox(command, sandbox)

        # Execute command
        try:
            result = await asyncio.create_subprocess_shell(
                command,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
                env=self._build_environment(sandbox),
            )

            # Wait for completion with timeout
            timeout = sandbox.get("max_execution_time", 300)
            max_output = sandbox.get("max_output_size", 1048576)  # 1MB

            try:
                # SECURITY: Read output with size limit to prevent memory exhaustion
                # Use asyncio tasks to read both streams concurrently with limits
                async def read_limited(stream, limit):
                    """Read up to limit bytes from stream."""
                    chunks = []
                    total = 0
                    while True:
                        # Read in 4KB chunks
                        chunk = await stream.read(4096)
                        if not chunk:
                            break
                        chunks.append(chunk)
                        total += len(chunk)
                        if total >= limit:
                            # Drain remaining output to prevent blocking
                            await stream.read()
                            break
                    return b"".join(chunks)[:limit]

                stdout_task = asyncio.create_task(read_limited(result.stdout, max_output))
                stderr_task = asyncio.create_task(read_limited(result.stderr, max_output))

                # Wait for both streams with timeout
                stdout, stderr = await asyncio.wait_for(
                    asyncio.gather(stdout_task, stderr_task),
                    timeout=timeout
                )

                # Wait for process to complete
                await result.wait()

            except asyncio.TimeoutError:
                result.kill()
                # SECURITY: Wait for process to fully terminate to avoid zombie processes
                await result.wait()
                raise ToolExecutionError(
                    f"Command timed out after {timeout} seconds"
                )

            # Decode output (already truncated during read)
            stdout_str = stdout.decode("utf-8", errors="replace")
            stderr_str = stderr.decode("utf-8", errors="replace")

            return {
                "status": "success" if result.returncode == 0 else "failure",
                "exit_code": result.returncode,
                "stdout": stdout_str,
                "stderr": stderr_str,
            }

        except Exception as e:
            logger.error(f"Bash execution error: {e}")
            raise ToolExecutionError(f"Failed to execute bash command: {e}")

    def _validate_command_sandbox(
        self, command: str, sandbox: Dict[str, Any]
    ) -> None:
        """Validate command against sandbox allowlist.

        Args:
            command: Command to validate
            sandbox: Sandbox configuration

        Raises:
            ToolExecutionError: If command not allowed
        """
        # SECURITY: Check for dangerous shell operators that could bypass sandbox
        # These operators allow command substitution, chaining, or file access
        # which could be used to execute arbitrary code or access sensitive data
        dangerous_operators = [
            "$(",  # Command substitution
            "`",   # Command substitution (backticks)
            "<(",  # Process substitution
            ">(",  # Process substitution
            "&&",  # Command chaining
            "||",  # Command chaining
            ";",   # Command separator
            "|",   # Pipe (could chain to dangerous commands)
            ">",   # Redirect (could overwrite files)
            "<",   # Redirect (could read sensitive files)
        ]

        for operator in dangerous_operators:
            if operator in command:
                raise ToolExecutionError(
                    f"Dangerous shell operator '{operator}' detected in command. "
                    f"Shell operators are not allowed in sandboxed tools for security. "
                    f"Use simple commands only or disable sandbox if you control the input."
                )

        # Extract base command (first word after shell operators)
        try:
            # Simple extraction - get first executable name
            tokens = shlex.split(command)
            if not tokens:
                return

            base_cmd = tokens[0].split("/")[-1]  # Remove path

            # Check allowlist
            allowlist = sandbox.get("allowlisted_commands", [])
            if allowlist and base_cmd not in allowlist:
                raise ToolExecutionError(
                    f"Command '{base_cmd}' not in allowlist. "
                    f"Allowed commands: {allowlist}"
                )

        except ValueError as e:
            # Shell syntax error
            raise ToolExecutionError(f"Invalid shell syntax: {e}")

    def _build_environment(self, sandbox: Dict[str, Any]) -> Optional[Dict[str, str]]:
        """Build environment variables for command.

        Args:
            sandbox: Sandbox configuration

        Returns:
            Environment dict or None
        """
        import os

        # Start with minimal environment
        env = {}

        # Add allowlisted env vars
        allowed_vars = sandbox.get("env_vars", [])
        for var in allowed_vars:
            if var in os.environ:
                env[var] = os.environ[var]

        return env if env else None


# ============================================================================
# Python Executor
# ============================================================================


class PythonToolExecutor(ToolExecutor):
    """Execute Python functions dynamically."""

    async def execute(self, parameters: Dict[str, Any]) -> Dict[str, Any]:
        """Execute Python function.

        Args:
            parameters: Tool parameters

        Returns:
            Function result (dict or converted to dict)

        Raises:
            ToolExecutionError: If execution fails
        """
        # Validate parameters
        self._validate_parameters(parameters)

        # Get Python implementation
        python_impl = self.tool_def.implementation.python
        if not python_impl:
            raise ToolExecutionError("Python implementation not found")

        # SECURITY: Validate module is from allowed namespaces
        # Prevent importing dangerous built-in modules like os, sys, subprocess
        allowed_module_prefixes = [
            "custom_tools.",     # Project-specific custom tools
            "faber.tools.",      # Faber built-in tools
            "faber.primitives.", # Faber primitives
        ]

        if not any(python_impl.module.startswith(prefix) for prefix in allowed_module_prefixes):
            raise ToolExecutionError(
                f"Module '{python_impl.module}' is not in allowed namespaces. "
                f"Only modules starting with {allowed_module_prefixes} are allowed "
                f"for security. This prevents importing dangerous built-in modules "
                f"like os, sys, or subprocess."
            )

        try:
            # Import module
            module = importlib.import_module(python_impl.module)

            # Get function
            if not hasattr(module, python_impl.function):
                raise ToolExecutionError(
                    f"Function '{python_impl.function}' not found in "
                    f"module '{python_impl.module}'"
                )

            func = getattr(module, python_impl.function)

            # SECURITY: Basic validation that it's actually a callable
            if not callable(func):
                raise ToolExecutionError(
                    f"'{python_impl.function}' in module '{python_impl.module}' "
                    f"is not callable"
                )

            # Call function
            # Support both sync and async functions
            if asyncio.iscoroutinefunction(func):
                result = await func(**parameters)
            else:
                # Run sync function in executor to avoid blocking
                loop = asyncio.get_event_loop()
                result = await loop.run_in_executor(None, lambda: func(**parameters))

            # Convert result to dict if needed
            if not isinstance(result, dict):
                result = {"result": result}

            return result

        except ImportError as e:
            raise ToolExecutionError(
                f"Failed to import module '{python_impl.module}': {e}"
            )
        except Exception as e:
            logger.error(f"Python execution error: {e}")
            raise ToolExecutionError(f"Failed to execute Python function: {e}")


# ============================================================================
# HTTP Executor
# ============================================================================


class HTTPToolExecutor(ToolExecutor):
    """Execute HTTP requests."""

    async def execute(self, parameters: Dict[str, Any]) -> Dict[str, Any]:
        """Execute HTTP request.

        Args:
            parameters: Tool parameters

        Returns:
            Dict with status_code, headers, body

        Raises:
            ToolExecutionError: If request fails
        """
        # Validate parameters
        self._validate_parameters(parameters)

        # Get HTTP implementation
        http_impl = self.tool_def.implementation.http
        if not http_impl:
            raise ToolExecutionError("HTTP implementation not found")

        # Substitute parameters in URL
        url = self._substitute_parameters(http_impl.url, parameters)

        # SECURITY: Validate URL scheme to prevent SSRF attacks
        from urllib.parse import urlparse
        parsed_url = urlparse(url)

        # Only allow http and https
        if parsed_url.scheme not in ["http", "https"]:
            raise ToolExecutionError(
                f"Invalid URL scheme '{parsed_url.scheme}'. "
                f"Only http and https are allowed for security."
            )

        # SECURITY: Block private IP ranges to prevent SSRF
        import ipaddress

        hostname = parsed_url.hostname
        if hostname:
            try:
                # Check if hostname is an IP address
                ip = ipaddress.ip_address(hostname)
                if ip.is_private or ip.is_loopback or ip.is_link_local:
                    raise ToolExecutionError(
                        f"Access to private/internal IP address '{hostname}' is blocked "
                        f"for security (SSRF protection). Only public hosts are allowed."
                    )
            except ValueError:
                # Hostname is not an IP, it's a domain name
                # Block localhost and common internal domains
                blocked_hosts = ["localhost", "127.0.0.1", "::1", "0.0.0.0"]
                if hostname.lower() in blocked_hosts or hostname.endswith(".local"):
                    raise ToolExecutionError(
                        f"Access to internal hostname '{hostname}' is blocked "
                        f"for security (SSRF protection)."
                    )

        # Substitute parameters in headers
        headers = {}
        if http_impl.headers:
            for key, value_template in http_impl.headers.items():
                headers[key] = self._substitute_parameters(value_template, parameters)

        # Substitute parameters in body
        body = None
        if http_impl.body_template:
            body_str = self._substitute_parameters(http_impl.body_template, parameters)
            # Try to parse as JSON
            try:
                body = json.loads(body_str)
            except json.JSONDecodeError:
                # Use as plain text
                body = body_str

        # SECURITY: Set response size limit to prevent memory exhaustion
        max_response_size = 10 * 1024 * 1024  # 10MB default

        # Make request
        try:
            async with httpx.AsyncClient() as client:
                response = await client.request(
                    method=http_impl.method,
                    url=url,
                    headers=headers if headers else None,
                    json=body if isinstance(body, dict) else None,
                    content=body if isinstance(body, str) else None,
                    timeout=30.0,
                )

                # SECURITY: Check response size before reading
                content_length = response.headers.get("content-length")
                if content_length and int(content_length) > max_response_size:
                    raise ToolExecutionError(
                        f"Response size ({content_length} bytes) exceeds maximum "
                        f"allowed size ({max_response_size} bytes)"
                    )

                # Parse response (with size limit enforced by httpx)
                try:
                    response_body = response.json()
                except json.JSONDecodeError:
                    # Read text with size limit
                    response_body = response.text[:max_response_size]

                return {
                    "status_code": response.status_code,
                    "headers": dict(response.headers),
                    "body": response_body,
                }

        except httpx.RequestError as e:
            raise ToolExecutionError(f"HTTP request failed: {e}")
        except Exception as e:
            logger.error(f"HTTP execution error: {e}")
            raise ToolExecutionError(f"Failed to execute HTTP request: {e}")


# ============================================================================
# Factory
# ============================================================================


def create_tool_executor(tool_def: ToolDefinition) -> ToolExecutor:
    """Create appropriate executor for tool definition.

    Args:
        tool_def: Tool definition

    Returns:
        ToolExecutor instance

    Raises:
        ValueError: If implementation type not supported
    """
    if tool_def.implementation.type == "bash":
        return BashToolExecutor(tool_def)
    elif tool_def.implementation.type == "python":
        return PythonToolExecutor(tool_def)
    elif tool_def.implementation.type == "http":
        return HTTPToolExecutor(tool_def)
    else:
        raise ValueError(
            f"Unsupported implementation type: {tool_def.implementation.type}"
        )
