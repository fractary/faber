"""
Pydantic schemas for Agent & Tool definitions.

These models validate YAML files in .fractary/agents/ and .fractary/tools/
"""

from __future__ import annotations

from typing import Any, Dict, List, Literal, Optional, Union

from pydantic import BaseModel, Field, field_validator, model_validator


# ============================================================================
# LLM Configuration
# ============================================================================


class LLMConfig(BaseModel):
    """LLM configuration for an agent."""

    provider: Literal["anthropic", "openai", "google"] = Field(
        default="anthropic",
        description="LLM provider",
    )
    model: str = Field(
        ...,
        description="Model identifier (e.g., claude-sonnet-4-20250514)",
    )
    temperature: float = Field(
        default=0.0,
        ge=0.0,
        le=1.0,
        description="Temperature for sampling (0.0-1.0)",
    )
    max_tokens: int = Field(
        default=4096,
        ge=1,
        le=200000,
        description="Maximum tokens in response",
    )

    @field_validator("model")
    @classmethod
    def validate_model_name(cls, v: str) -> str:
        """Validate model name is not empty."""
        if not v or not v.strip():
            raise ValueError("model must not be empty")
        return v.strip()


# ============================================================================
# Prompt Caching
# ============================================================================


class CachingSource(BaseModel):
    """A source of cacheable content for prompt caching."""

    type: Literal["file", "glob", "inline", "codex"] = Field(
        ...,
        description="Type of caching source",
    )
    path: Optional[str] = Field(
        default=None,
        description="File path (for type=file)",
    )
    pattern: Optional[str] = Field(
        default=None,
        description="Glob pattern (for type=glob)",
    )
    content: Optional[str] = Field(
        default=None,
        description="Inline content (for type=inline)",
    )
    uri: Optional[str] = Field(
        default=None,
        description="Codex URI (for type=codex, e.g., codex://org/project/path)",
    )
    label: str = Field(
        ...,
        description="Label for this cached block",
    )

    @model_validator(mode="after")
    def validate_source_fields(self) -> CachingSource:
        """Validate that appropriate fields are set for each type."""
        if self.type == "file" and not self.path:
            raise ValueError("path is required for type=file")
        if self.type == "glob" and not self.pattern:
            raise ValueError("pattern is required for type=glob")
        if self.type == "inline" and not self.content:
            raise ValueError("content is required for type=inline")
        if self.type == "codex" and not self.uri:
            raise ValueError("uri is required for type=codex")
        if self.type == "codex" and self.uri and not self.uri.startswith("codex://"):
            raise ValueError("codex uri must start with codex://")
        return self


class CachingConfig(BaseModel):
    """Prompt caching configuration."""

    enabled: bool = Field(
        default=False,
        description="Enable prompt caching (Claude only)",
    )
    cache_sources: List[CachingSource] = Field(
        default_factory=list,
        description="Sources of cacheable content",
    )


# ============================================================================
# Tool Definitions
# ============================================================================


class ToolParameter(BaseModel):
    """Parameter definition for a tool."""

    type: str = Field(
        ...,
        description="Parameter type (string, integer, boolean, object, array)",
    )
    description: str = Field(
        ...,
        description="Parameter description",
    )
    required: bool = Field(
        default=False,
        description="Whether parameter is required",
    )
    default: Optional[Any] = Field(
        default=None,
        description="Default value if not provided",
    )
    enum: Optional[List[Any]] = Field(
        default=None,
        description="Allowed values (if restricted)",
    )
    properties: Optional[Dict[str, "ToolParameter"]] = Field(
        default=None,
        description="Nested properties (for type=object)",
    )

    @field_validator("type")
    @classmethod
    def validate_type(cls, v: str) -> str:
        """Validate parameter type."""
        valid_types = {"string", "integer", "number", "boolean", "object", "array"}
        if v not in valid_types:
            raise ValueError(
                f"Invalid parameter type: {v}. Must be one of {valid_types}"
            )
        return v


# Allow recursive ToolParameter
ToolParameter.model_rebuild()


class BashImplementation(BaseModel):
    """Bash script implementation for a tool."""

    command: str = Field(
        ...,
        description="Bash command to execute (supports ${param} substitution)",
    )
    sandbox: Optional[Dict[str, Any]] = Field(
        default=None,
        description="Sandbox configuration",
    )

    @field_validator("sandbox", mode="before")
    @classmethod
    def set_default_sandbox(cls, v: Optional[Dict[str, Any]]) -> Dict[str, Any]:
        """Set default sandbox configuration."""
        if v is None:
            return {
                "enabled": True,
                "allowlisted_commands": ["echo", "cat", "grep", "find"],
                "network_access": False,
                "max_execution_time": 300,
                "env_vars": [],
            }
        return v


class PythonImplementation(BaseModel):
    """Python function implementation for a tool."""

    module: str = Field(
        ...,
        description="Python module path (e.g., myproject.tools.custom)",
    )
    function: str = Field(
        ...,
        description="Function name to call",
    )

    @field_validator("module", "function")
    @classmethod
    def validate_not_empty(cls, v: str) -> str:
        """Validate field is not empty."""
        if not v or not v.strip():
            raise ValueError("Field must not be empty")
        return v.strip()


class HTTPImplementation(BaseModel):
    """HTTP API implementation for a tool."""

    method: Literal["GET", "POST", "PUT", "DELETE"] = Field(
        default="POST",
        description="HTTP method",
    )
    url: str = Field(
        ...,
        description="API endpoint URL (supports ${param} substitution)",
    )
    headers: Optional[Dict[str, str]] = Field(
        default=None,
        description="HTTP headers (supports ${param} substitution)",
    )
    body_template: Optional[str] = Field(
        default=None,
        description="Request body template (supports ${param} substitution)",
    )

    @field_validator("url")
    @classmethod
    def validate_url(cls, v: str) -> str:
        """Validate URL is not empty."""
        if not v or not v.strip():
            raise ValueError("url must not be empty")
        return v.strip()


class ToolImplementation(BaseModel):
    """Tool implementation configuration (one type must be specified)."""

    type: Literal["bash", "python", "http"] = Field(
        ...,
        description="Implementation type",
    )
    bash: Optional[BashImplementation] = Field(
        default=None,
        description="Bash implementation (if type=bash)",
    )
    python: Optional[PythonImplementation] = Field(
        default=None,
        description="Python implementation (if type=python)",
    )
    http: Optional[HTTPImplementation] = Field(
        default=None,
        description="HTTP implementation (if type=http)",
    )

    @model_validator(mode="after")
    def validate_implementation_type(self) -> ToolImplementation:
        """Validate that the correct implementation is provided."""
        if self.type == "bash" and not self.bash:
            raise ValueError("bash implementation is required for type=bash")
        if self.type == "python" and not self.python:
            raise ValueError("python implementation is required for type=python")
        if self.type == "http" and not self.http:
            raise ValueError("http implementation is required for type=http")
        return self


class ToolDefinition(BaseModel):
    """Complete tool definition schema."""

    name: str = Field(
        ...,
        min_length=1,
        max_length=100,
        description="Tool name (e.g., terraform-deploy)",
    )
    description: str = Field(
        ...,
        min_length=1,
        description="Tool description",
    )
    type: Literal["tool"] = Field(
        default="tool",
        description="Must be 'tool'",
    )

    # Parameters
    parameters: Dict[str, ToolParameter] = Field(
        default_factory=dict,
        description="Tool parameters",
    )

    # Implementation
    implementation: ToolImplementation = Field(
        ...,
        description="Tool implementation",
    )

    # Output schema (optional)
    output: Optional[Dict[str, Any]] = Field(
        default=None,
        description="Output schema (JSON Schema format)",
    )

    # Metadata
    version: str = Field(
        default="1.0",
        description="Tool version",
    )
    author: Optional[str] = Field(
        default=None,
        description="Tool author",
    )
    tags: List[str] = Field(
        default_factory=list,
        description="Tool tags for categorization",
    )

    @field_validator("name")
    @classmethod
    def validate_name(cls, v: str) -> str:
        """Validate tool name format."""
        # Allow alphanumeric, hyphens, underscores
        if not v.replace("-", "").replace("_", "").replace(":", "").isalnum():
            raise ValueError(
                "Tool name must contain only alphanumeric characters, hyphens, "
                "underscores, and colons"
            )
        return v

    class Config:
        json_schema_extra = {
            "title": "Tool Definition",
            "description": "Schema for declarative tool definitions",
        }


# ============================================================================
# Agent Definitions
# ============================================================================


class AgentDefinition(BaseModel):
    """Complete agent definition schema."""

    name: str = Field(
        ...,
        min_length=1,
        max_length=100,
        description="Agent name (e.g., corthion-loader-engineer)",
    )
    description: str = Field(
        ...,
        min_length=1,
        description="Agent description",
    )
    type: Literal["agent"] = Field(
        default="agent",
        description="Must be 'agent'",
    )

    # LLM configuration
    llm: LLMConfig = Field(
        ...,
        description="LLM configuration",
    )

    # System prompt
    system_prompt: str = Field(
        ...,
        min_length=1,
        description="System prompt for the agent",
    )

    # Tools
    tools: List[str] = Field(
        default_factory=list,
        description="Built-in tools this agent can use (by name)",
    )

    # Custom tools specific to this agent
    custom_tools: List[ToolDefinition] = Field(
        default_factory=list,
        description="Custom tools defined inline",
    )

    # Prompt caching
    caching: Optional[CachingConfig] = Field(
        default=None,
        description="Prompt caching configuration",
    )

    # Additional configuration
    config: Dict[str, Any] = Field(
        default_factory=dict,
        description="Additional agent configuration",
    )

    # Metadata
    version: str = Field(
        default="1.0",
        description="Agent version",
    )
    author: Optional[str] = Field(
        default=None,
        description="Agent author",
    )
    tags: List[str] = Field(
        default_factory=list,
        description="Agent tags for categorization",
    )

    @field_validator("name")
    @classmethod
    def validate_name(cls, v: str) -> str:
        """Validate agent name format."""
        # Allow alphanumeric, hyphens, underscores
        if not v.replace("-", "").replace("_", "").replace(":", "").isalnum():
            raise ValueError(
                "Agent name must contain only alphanumeric characters, hyphens, "
                "underscores, and colons"
            )
        return v

    class Config:
        json_schema_extra = {
            "title": "Agent Definition",
            "description": "Schema for declarative agent definitions",
        }


# ============================================================================
# Workflow Step Schema (for compiler)
# ============================================================================


class Step(BaseModel):
    """A single step within a workflow phase."""

    id: str = Field(
        ...,
        description="Step identifier (unique within phase)",
    )
    name: str = Field(
        ...,
        description="Human-readable step name",
    )
    description: Optional[str] = Field(
        default=None,
        description="Step description",
    )

    # Either agent OR tool (not both)
    agent: Optional[str] = Field(
        default=None,
        description="Agent name to invoke (references .fractary/agents/)",
    )
    tool: Optional[str] = Field(
        default=None,
        description="Tool name to invoke (references .fractary/tools/)",
    )

    # Inputs/outputs
    inputs: Dict[str, str] = Field(
        default_factory=dict,
        description="Input parameters (supports {variable} substitution)",
    )
    outputs: List[str] = Field(
        default_factory=list,
        description="Output variable names to capture",
    )

    @model_validator(mode="after")
    def validate_agent_or_tool(self) -> Step:
        """Validate that exactly one of agent or tool is specified."""
        if not self.agent and not self.tool:
            raise ValueError("Either 'agent' or 'tool' must be specified")
        if self.agent and self.tool:
            raise ValueError("Cannot specify both 'agent' and 'tool'")
        return self


# ============================================================================
# Utility Functions
# ============================================================================


def export_json_schema(
    schema_class: type[BaseModel],
    output_path: Optional[str] = None,
) -> Dict[str, Any]:
    """Export Pydantic model as JSON Schema.

    Args:
        schema_class: Pydantic model class to export
        output_path: Optional path to write JSON file

    Returns:
        JSON Schema dict
    """
    import json
    from pathlib import Path

    schema = schema_class.model_json_schema()

    if output_path:
        with open(Path(output_path), "w") as f:
            json.dump(schema, f, indent=2)

    return schema
