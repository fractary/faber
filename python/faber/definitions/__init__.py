"""
Agent & Tool Definition System - DEPRECATED

⚠️  WARNING: This module is deprecated and will be removed in FABER v2.0.

Agent and tool definitions are now managed by @fractary/forge.

Migration Guide:
- Agent definitions: Use YAML format in .fractary/agents/
- Tool definitions: Use YAML format in .fractary/tools/
- Resolution: Use @fractary/forge AgentAPI and ToolAPI in TypeScript

For migration instructions, see:
https://github.com/fractary/faber/blob/main/docs/MIGRATION-FABER-FORGE.md

This module provides a universal, declarative format for defining custom agents
and tools that work across the Fractary ecosystem (SDK, CLI, FABER workflows,
and web dashboard).

Key components:
- schemas: Pydantic models for YAML validation
- registry: Discover and load definitions from .fractary/
- agent_factory: Create executable agents from YAML
- tool_executor: Execute tools (bash, python, http)
- api: High-level programmatic API
- converters: Migrate from Claude Code format
"""

import warnings

warnings.warn(
    "faber.definitions is deprecated and will be removed in v2.0. "
    "Agent and tool definitions are now managed by @fractary/forge. "
    "See migration guide: https://github.com/fractary/faber/blob/main/docs/MIGRATION-FABER-FORGE.md",
    DeprecationWarning,
    stacklevel=2
)

from faber.definitions.schemas import (
    AgentDefinition,
    ToolDefinition,
    LLMConfig,
    CachingConfig,
    CachingSource,
    ToolParameter,
    ToolImplementation,
)

__all__ = [
    "AgentDefinition",
    "ToolDefinition",
    "LLMConfig",
    "CachingConfig",
    "CachingSource",
    "ToolParameter",
    "ToolImplementation",
]
