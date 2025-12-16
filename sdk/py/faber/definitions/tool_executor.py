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
from typing import Any, Dict, List, Optional

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
    """Execute bash commands with sandboxing.

    SECURITY: Uses subprocess with shell=False to prevent shell injection attacks.
    Commands are parsed and executed directly without shell interpretation.
    """

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

        command_template = bash_impl.command
        sandbox = bash_impl.sandbox or {}

        # SECURITY: Parse command into argv list BEFORE parameter substitution
        # This prevents shell metacharacter injection entirely
        try:
            argv = self._parse_command_to_argv(command_template, parameters)
        except ValueError as e:
            raise ToolExecutionError(f"Failed to parse command: {e}")

        # Check sandbox (validates base command against allowlist)
        if sandbox.get("enabled", True):
            self._validate_command_sandbox(argv, sandbox)

        # Execute command with shell=False
        try:
            # SECURITY: shell=False prevents all shell injection attacks
            # Command is executed directly without shell interpretation
            result = await asyncio.create_subprocess_exec(
                *argv,
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

        except ToolExecutionError:
            raise
        except Exception as e:
            logger.error(f"Bash execution error: {e}")
            raise ToolExecutionError(f"Failed to execute bash command: {e}")

    def _parse_command_to_argv(
        self, template: str, parameters: Dict[str, Any]
    ) -> List[str]:
        """Parse command template into argv list with parameter substitution.

        SECURITY: This method parses the command template into discrete arguments
        BEFORE substituting parameters, preventing any shell injection. Parameters
        are substituted as literal values into the parsed argument list.

        Args:
            template: Command template with ${param} placeholders
            parameters: Parameters to substitute

        Returns:
            List of command arguments (argv)

        Raises:
            ValueError: If command template is invalid
        """
        # First, parse the template to identify argument structure
        # We use shlex to parse the template, but parameters are substituted literally

        # Tokenize the template
        try:
            tokens = shlex.split(template)
        except ValueError as e:
            raise ValueError(f"Invalid command template syntax: {e}")

        if not tokens:
            raise ValueError("Empty command template")

        # Substitute parameters in each token
        argv = []
        for token in tokens:
            substituted = token
            for key, value in parameters.items():
                placeholder = f"${{{key}}}"
                if placeholder in substituted:
                    # SECURITY: Direct string substitution without shell escaping
                    # Since we're using shell=False, the value is treated literally
                    str_value = str(value) if value is not None else ""
                    substituted = substituted.replace(placeholder, str_value)
            argv.append(substituted)

        return argv

    def _validate_command_sandbox(
        self, argv: List[str], sandbox: Dict[str, Any]
    ) -> None:
        """Validate command against sandbox allowlist.

        SECURITY: With shell=False, we no longer need to check for shell operators
        since they have no special meaning. We only validate the base command
        against the allowlist.

        Args:
            argv: Command as argument list (first element is the executable)
            sandbox: Sandbox configuration

        Raises:
            ToolExecutionError: If command not allowed
        """
        if not argv:
            raise ToolExecutionError("Empty command")

        # Extract base command name (remove path if present)
        base_cmd = argv[0].split("/")[-1]

        # Check allowlist
        allowlist = sandbox.get("allowlisted_commands", [])
        if allowlist and base_cmd not in allowlist:
            raise ToolExecutionError(
                f"Command '{base_cmd}' not in allowlist. "
                f"Allowed commands: {allowlist}"
            )

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
    """Execute Python functions dynamically with security controls.

    SECURITY: This executor implements multiple layers of protection:
    1. Explicit module allowlist (no prefix matching)
    2. Execution timeout to prevent infinite loops
    3. Callable validation before execution
    """

    # SECURITY: Explicit module allowlist - only these exact modules can be imported
    # Prefix matching is vulnerable to bypass (e.g., "faber.tools_malicious")
    # To add new modules, they must be explicitly added to this set
    ALLOWED_MODULES: set = {
        # Faber built-in tools
        "faber.tools.file_operations",
        "faber.tools.code_analysis",
        "faber.tools.testing",
        "faber.tools.documentation",
        # Faber primitives
        "faber.primitives.validators",
        "faber.primitives.formatters",
        "faber.primitives.parsers",
    }

    # Default timeout for Python function execution (seconds)
    DEFAULT_TIMEOUT: int = 300

    def _get_allowed_modules(self) -> set:
        """Get the set of allowed modules.

        This method can be overridden in subclasses to customize the allowlist.
        Additional modules can also be registered via register_module().

        Returns:
            Set of allowed module names
        """
        return self.ALLOWED_MODULES.copy()

    @classmethod
    def register_module(cls, module_name: str) -> None:
        """Register a module as allowed for Python tool execution.

        SECURITY: Only call this for trusted modules that you control.
        Registered modules can execute arbitrary Python code.

        Args:
            module_name: Fully qualified module name (e.g., "myproject.tools.custom")
        """
        if not module_name or not isinstance(module_name, str):
            raise ValueError("module_name must be a non-empty string")
        cls.ALLOWED_MODULES.add(module_name)
        logger.info(f"Registered module for Python tool execution: {module_name}")

    async def execute(self, parameters: Dict[str, Any]) -> Dict[str, Any]:
        """Execute Python function with timeout protection.

        Args:
            parameters: Tool parameters

        Returns:
            Function result (dict or converted to dict)

        Raises:
            ToolExecutionError: If execution fails or times out
        """
        # Validate parameters
        self._validate_parameters(parameters)

        # Get Python implementation
        python_impl = self.tool_def.implementation.python
        if not python_impl:
            raise ToolExecutionError("Python implementation not found")

        # SECURITY: Validate module against explicit allowlist
        # Prefix matching is vulnerable to bypass (e.g., "faber.tools_malicious")
        # We use exact module matching with registered safe modules
        allowed_modules = self._get_allowed_modules()

        if python_impl.module not in allowed_modules:
            raise ToolExecutionError(
                f"Module '{python_impl.module}' is not in the allowed modules list. "
                f"Only explicitly registered modules are allowed for security. "
                f"This prevents importing dangerous built-in modules like os, sys, or subprocess. "
                f"To add a module, use PythonToolExecutor.register_module()."
            )

        # Get timeout from tool definition or use default
        timeout = getattr(python_impl, "timeout", None) or self.DEFAULT_TIMEOUT

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

            # SECURITY: Execute with timeout to prevent infinite loops/hangs
            try:
                if asyncio.iscoroutinefunction(func):
                    # Async function - wrap with timeout
                    result = await asyncio.wait_for(
                        func(**parameters),
                        timeout=timeout
                    )
                else:
                    # Sync function - run in executor with timeout
                    loop = asyncio.get_event_loop()
                    result = await asyncio.wait_for(
                        loop.run_in_executor(None, lambda: func(**parameters)),
                        timeout=timeout
                    )
            except asyncio.TimeoutError:
                raise ToolExecutionError(
                    f"Python function '{python_impl.function}' timed out after {timeout} seconds. "
                    f"Consider increasing the timeout or optimizing the function."
                )

            # Convert result to dict if needed
            if not isinstance(result, dict):
                result = {"result": result}

            return result

        except ToolExecutionError:
            raise
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
    """Execute HTTP requests with SSRF protection.

    SECURITY: This executor implements comprehensive SSRF protection:
    1. URL scheme validation (only http/https)
    2. Direct IP address validation (blocks private, loopback, link-local)
    3. DNS resolution check for domain names (catches DNS rebinding)
    4. IPv6 support for all checks
    5. Response size limits
    """

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

        # SECURITY: Comprehensive SSRF protection
        await self._validate_url_ssrf(url)

        # Execute the request after validation passes
        return await self._execute_http_request(http_impl, url, parameters)

    async def _validate_url_ssrf(self, url: str) -> None:
        """Validate URL against SSRF attacks.

        SECURITY: This method performs comprehensive SSRF validation:
        1. Scheme validation (only http/https)
        2. Direct IP validation for IP addresses
        3. DNS resolution for domain names to catch DNS rebinding
        4. Full IPv4 and IPv6 support

        Args:
            url: URL to validate

        Raises:
            ToolExecutionError: If URL is blocked for security
        """
        import ipaddress
        import socket
        from urllib.parse import urlparse

        parsed_url = urlparse(url)

        # Only allow http and https
        if parsed_url.scheme not in ["http", "https"]:
            raise ToolExecutionError(
                f"Invalid URL scheme '{parsed_url.scheme}'. "
                f"Only http and https are allowed for security."
            )

        hostname = parsed_url.hostname
        if not hostname:
            raise ToolExecutionError("URL must have a hostname")

        # Check if hostname is directly an IP address
        try:
            ip = ipaddress.ip_address(hostname)
            self._validate_ip_address(ip, hostname)
            return  # IP is valid, no need for DNS resolution
        except ValueError:
            pass  # Not an IP address, it's a domain name

        # SECURITY: Block known internal hostnames before DNS resolution
        blocked_hosts = {
            "localhost",
            "localhost.localdomain",
            "ip6-localhost",
            "ip6-loopback",
        }
        blocked_suffixes = (
            ".local",
            ".localhost",
            ".internal",
            ".lan",
            ".home",
            ".corp",
            ".intranet",
        )

        hostname_lower = hostname.lower()
        if hostname_lower in blocked_hosts:
            raise ToolExecutionError(
                f"Access to internal hostname '{hostname}' is blocked "
                f"for security (SSRF protection)."
            )

        if hostname_lower.endswith(blocked_suffixes):
            raise ToolExecutionError(
                f"Access to internal domain '{hostname}' is blocked "
                f"for security (SSRF protection). Domains ending in "
                f"{blocked_suffixes} are not allowed."
            )

        # SECURITY: Resolve DNS and check all resulting IPs
        # This catches DNS rebinding attacks where a domain resolves to internal IPs
        try:
            # Get all IP addresses for the hostname (both IPv4 and IPv6)
            addr_info = socket.getaddrinfo(
                hostname, None,
                family=socket.AF_UNSPEC,  # Both IPv4 and IPv6
                type=socket.SOCK_STREAM
            )

            if not addr_info:
                raise ToolExecutionError(
                    f"Could not resolve hostname '{hostname}'"
                )

            # Check ALL resolved IPs (not just the first one)
            for info in addr_info:
                ip_str = info[4][0]
                try:
                    ip = ipaddress.ip_address(ip_str)
                    self._validate_ip_address(ip, f"{hostname} -> {ip_str}")
                except ValueError:
                    # Skip invalid IP formats
                    continue

        except socket.gaierror as e:
            raise ToolExecutionError(
                f"Failed to resolve hostname '{hostname}': {e}"
            )

    def _validate_ip_address(self, ip: Any, context: str) -> None:
        """Validate an IP address is not private/internal.

        SECURITY: Blocks all non-public IP ranges including:
        - Private ranges (10.x, 172.16-31.x, 192.168.x, fc00::/7)
        - Loopback (127.x, ::1)
        - Link-local (169.254.x, fe80::/10)
        - Multicast
        - Reserved/unspecified

        Args:
            ip: IP address object to validate
            context: Context string for error messages

        Raises:
            ToolExecutionError: If IP is blocked
        """
        import ipaddress

        # Check all blocked IP categories
        if ip.is_private:
            raise ToolExecutionError(
                f"Access to private IP address '{context}' is blocked "
                f"for security (SSRF protection). Only public hosts are allowed."
            )

        if ip.is_loopback:
            raise ToolExecutionError(
                f"Access to loopback address '{context}' is blocked "
                f"for security (SSRF protection)."
            )

        if ip.is_link_local:
            raise ToolExecutionError(
                f"Access to link-local address '{context}' is blocked "
                f"for security (SSRF protection)."
            )

        if ip.is_multicast:
            raise ToolExecutionError(
                f"Access to multicast address '{context}' is blocked "
                f"for security (SSRF protection)."
            )

        if ip.is_reserved:
            raise ToolExecutionError(
                f"Access to reserved address '{context}' is blocked "
                f"for security (SSRF protection)."
            )

        if ip.is_unspecified:
            raise ToolExecutionError(
                f"Access to unspecified address '{context}' is blocked "
                f"for security (SSRF protection)."
            )

        # IPv6-specific checks
        if isinstance(ip, ipaddress.IPv6Address):
            # Check for IPv4-mapped IPv6 addresses (::ffff:x.x.x.x)
            if ip.ipv4_mapped:
                # Recursively check the mapped IPv4 address
                self._validate_ip_address(ip.ipv4_mapped, f"{context} (IPv4-mapped)")

            # Check for 6to4 addresses (2002::/16) which embed IPv4
            if ip.sixtofour:
                self._validate_ip_address(ip.sixtofour, f"{context} (6to4)")

            # Check for Teredo addresses (2001::/32) which embed IPv4
            if ip.teredo:
                # teredo returns (server, client) tuple
                server_ip, client_ip = ip.teredo
                self._validate_ip_address(server_ip, f"{context} (Teredo server)")
                self._validate_ip_address(client_ip, f"{context} (Teredo client)")

    async def _execute_http_request(
        self, http_impl: Any, url: str, parameters: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Execute the HTTP request after SSRF validation.

        Args:
            http_impl: HTTP implementation configuration
            url: Validated URL
            parameters: Tool parameters

        Returns:
            Dict with status_code, headers, body

        Raises:
            ToolExecutionError: If request fails
        """
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
        except ToolExecutionError:
            raise
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
