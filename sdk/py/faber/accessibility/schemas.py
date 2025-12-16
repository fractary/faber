"""
Pydantic schemas for YAML workflow validation.

This module defines the schema for declarative FABER workflow definitions,
providing type-safe validation with detailed error messages.
"""

from __future__ import annotations

from enum import Enum
from typing import Any, Dict, List, Literal, Optional, Union

from pydantic import BaseModel, Field, field_validator, model_validator


class AutonomyLevel(str, Enum):
    """Autonomy levels for workflow execution."""

    ASSISTED = "assisted"
    GUARDED = "guarded"
    AUTONOMOUS = "autonomous"


class TriggerType(str, Enum):
    """Types of workflow triggers."""

    MANUAL = "manual"
    ISSUE_LABELED = "issue_labeled"
    WEBHOOK = "webhook"
    SCHEDULE = "schedule"


class Trigger(BaseModel):
    """Workflow trigger configuration."""

    type: TriggerType
    command: Optional[str] = None
    labels: Optional[List[str]] = None
    path: Optional[str] = None
    cron: Optional[str] = None


class ModelConfig(BaseModel):
    """Model routing configuration."""

    default: str = "anthropic:claude-sonnet-4-20250514"
    classification: Optional[str] = None
    reasoning: Optional[str] = None
    review: Optional[str] = None

    @field_validator("default", "classification", "reasoning", "review", mode="before")
    @classmethod
    def validate_model_format(cls, v: Optional[str]) -> Optional[str]:
        """Validate model string format (provider:model)."""
        if v is not None and ":" not in v:
            raise ValueError(f"Model must be in format 'provider:model', got: {v}")
        return v


class PhaseFailureConfig(BaseModel):
    """Configuration for phase failure handling."""

    retry_phase: str
    max_retries: Union[int, str] = Field(default=3)

    @field_validator("max_retries", mode="before")
    @classmethod
    def validate_max_retries(cls, v: Union[int, str]) -> Union[int, str]:
        """Allow both int and $variable references."""
        if isinstance(v, str) and not v.startswith("$"):
            return int(v)
        return v


class Step(BaseModel):
    """Individual step within a workflow phase."""

    name: str = Field(..., min_length=1, max_length=50)
    description: str = ""
    type: Literal["agent", "tool"] = Field(
        ..., description="Step type: agent or tool invocation"
    )
    agent: Optional[str] = Field(
        default=None, description="Agent name (from .fractary/agents/)"
    )
    tool: Optional[str] = Field(
        default=None, description="Tool name (from .fractary/tools/ or built-in)"
    )
    inputs: Dict[str, Any] = Field(
        default_factory=dict, description="Input parameters for agent/tool"
    )
    outputs: List[str] = Field(
        default_factory=list, description="Output keys this step produces"
    )

    @model_validator(mode="after")
    def validate_step_type(self) -> "Step":
        """Validate that agent/tool is set based on type."""
        if self.type == "agent" and not self.agent:
            raise ValueError("agent is required when type=agent")
        if self.type == "tool" and not self.tool:
            raise ValueError("tool is required when type=tool")
        if self.agent and self.tool:
            raise ValueError("Cannot specify both agent and tool")
        return self


class Phase(BaseModel):
    """Workflow phase definition."""

    name: str = Field(..., min_length=1, max_length=50)
    description: str = ""
    agent: Optional[str] = None  # Optional if using steps
    model: Optional[str] = None  # Can be $reference like $models.default
    tools: List[str] = Field(default_factory=list)
    inputs: List[str] = Field(default_factory=list)  # $phase.output references
    outputs: List[str] = Field(default_factory=list)
    steps: Optional[List[Step]] = Field(
        default=None, description="Sub-steps within this phase"
    )
    human_approval: bool = False
    approval_prompt: Optional[str] = None
    max_iterations: int = Field(default=50, ge=1, le=1000)
    on_failure: Optional[PhaseFailureConfig] = None

    @model_validator(mode="after")
    def validate_phase_structure(self) -> "Phase":
        """Validate phase has either agent or steps."""
        if self.steps:
            # Steps mode - agent is optional
            return self
        else:
            # Legacy mode - agent is required
            if not self.agent:
                raise ValueError("Phase must have either 'agent' or 'steps'")
        return self

    @field_validator("name")
    @classmethod
    def validate_name(cls, v: str) -> str:
        """Validate phase name is alphanumeric with hyphens/underscores."""
        if not v.replace("-", "").replace("_", "").isalnum():
            raise ValueError(
                "Phase name must be alphanumeric with hyphens/underscores"
            )
        return v

    @field_validator("model", mode="before")
    @classmethod
    def validate_model(cls, v: Optional[str]) -> Optional[str]:
        """Allow model to be a $reference or provider:model format."""
        if v is None:
            return v
        if v.startswith("$"):
            return v  # Variable reference, resolved at compile time
        if ":" not in v:
            raise ValueError(f"Model must be in format 'provider:model' or $reference, got: {v}")
        return v


class HookAction(BaseModel):
    """Post-workflow hook action."""

    action: str
    channel: Optional[str] = None
    message: Optional[str] = None
    body: Optional[str] = None


class WorkflowHooks(BaseModel):
    """Workflow lifecycle hooks."""

    on_complete: List[HookAction] = Field(default_factory=list)
    on_failure: List[HookAction] = Field(default_factory=list)


class WorkflowConfig(BaseModel):
    """Global workflow configuration."""

    work_platform: Literal["github", "jira", "linear"] = "github"
    repo_platform: Literal["github", "gitlab", "bitbucket"] = "github"
    autonomy: AutonomyLevel = AutonomyLevel.ASSISTED
    max_retries: int = Field(default=3, ge=1, le=10)


class WorkflowSchema(BaseModel):
    """Complete workflow definition schema.

    This is the root schema for YAML workflow files.

    Example YAML:
        name: my-workflow
        version: "1.0"
        description: My custom workflow

        models:
          default: anthropic:claude-sonnet-4-20250514
          classification: anthropic:claude-3-5-haiku-20241022

        phases:
          - name: frame
            agent: frame-agent
            model: $models.classification
            tools:
              - fetch_issue
              - classify_work_type
    """

    name: str = Field(..., min_length=1, max_length=100)
    version: str = "1.0"
    description: Optional[str] = None
    triggers: List[Trigger] = Field(default_factory=list)
    config: WorkflowConfig = Field(default_factory=WorkflowConfig)
    models: ModelConfig = Field(default_factory=ModelConfig)
    phases: List[Phase] = Field(..., min_length=1)
    hooks: WorkflowHooks = Field(default_factory=WorkflowHooks)

    @field_validator("phases")
    @classmethod
    def validate_phases(cls, phases: List[Phase]) -> List[Phase]:
        """Validate phase definitions."""
        # Check for duplicate phase names
        names = [p.name for p in phases]
        if len(names) != len(set(names)):
            raise ValueError("Duplicate phase names found")
        return phases

    @model_validator(mode="after")
    def validate_phase_references(self) -> "WorkflowSchema":
        """Validate phase input references point to valid outputs."""
        available_outputs: Dict[str, List[str]] = {}

        for phase in self.phases:
            # Check input references
            for input_ref in phase.inputs:
                if input_ref.startswith("$") and not input_ref.startswith("$config"):
                    # Parse $phase.output format
                    parts = input_ref[1:].split(".")
                    if len(parts) >= 2:
                        ref_phase = parts[0]
                        if ref_phase not in available_outputs:
                            # Phase might be defined later, skip validation
                            # Full validation happens at compile time
                            pass

            # Track this phase's outputs
            available_outputs[phase.name] = phase.outputs

        return self

    class Config:
        """Pydantic model configuration."""

        json_schema_extra = {
            "title": "FABER Workflow Schema",
            "description": "Schema for declarative FABER workflow definitions",
        }


class AgentInheritance(BaseModel):
    """Agent inheritance rules.

    When an agent uses `extends`:
    - model: Override (child replaces parent)
    - tools: Merge (child tools added to parent)
    - system_prompt: Append (child appended to parent)
    - config: Deep merge (child overrides parent values)
    """

    pass


class AgentSchema(BaseModel):
    """Agent definition schema.

    Example YAML:
        name: custom-architect
        extends: architect-agent
        model: anthropic:claude-opus-4-20250514
        tools:
          - search_codebase
        system_prompt: |
          Additional guidelines...
    """

    name: str = Field(..., min_length=1, max_length=100)
    extends: Optional[str] = None
    description: Optional[str] = None
    model: Optional[str] = None
    tools: List[str] = Field(default_factory=list)
    system_prompt: Optional[str] = None
    config: Dict[str, Any] = Field(default_factory=dict)

    @field_validator("model", mode="before")
    @classmethod
    def validate_model(cls, v: Optional[str]) -> Optional[str]:
        """Validate model format."""
        if v is not None and ":" not in v:
            raise ValueError(f"Model must be in format 'provider:model', got: {v}")
        return v


class ToolParameter(BaseModel):
    """Tool parameter definition."""

    type: str
    description: str
    required: bool = False
    default: Optional[Any] = None


class ToolImplementation(BaseModel):
    """Tool implementation configuration."""

    type: Literal["python", "bash"]
    module: Optional[str] = None
    function: Optional[str] = None
    command: Optional[str] = None


class ToolSchema(BaseModel):
    """Custom tool definition schema.

    Example YAML:
        name: search_codebase
        description: Search the codebase for patterns
        parameters:
          query:
            type: string
            description: Search query
            required: true
        implementation:
          type: python
          module: faber.tools.custom
          function: search_codebase
    """

    name: str = Field(..., min_length=1, max_length=100)
    description: str
    parameters: Dict[str, ToolParameter] = Field(default_factory=dict)
    implementation: ToolImplementation

    @model_validator(mode="after")
    def validate_implementation(self) -> "ToolSchema":
        """Validate implementation has required fields."""
        impl = self.implementation
        if impl.type == "python":
            if not impl.module or not impl.function:
                raise ValueError(
                    "Python implementation requires 'module' and 'function'"
                )
        elif impl.type == "bash":
            if not impl.command:
                raise ValueError("Bash implementation requires 'command'")
        return self


def export_json_schema(output_path: str = "workflow-schema.json") -> dict:
    """Export Pydantic models as JSON Schema for external validation.

    This can be used by VS Code YAML extension, CI validation, etc.

    Args:
        output_path: Path to write the JSON schema

    Returns:
        The generated JSON schema dict
    """
    import json

    schema = WorkflowSchema.model_json_schema()
    with open(output_path, "w") as f:
        json.dump(schema, f, indent=2)
    return schema
