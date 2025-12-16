"""
YAML workflow loader with validation and error handling.

This module provides functions to load and validate YAML workflow definitions
using the Pydantic schemas defined in schemas.py.
"""

from __future__ import annotations

from pathlib import Path
from typing import Any, Dict, Optional, Union

import yaml
from pydantic import ValidationError

from faber.accessibility.schemas import AgentSchema, ToolSchema, WorkflowSchema


class WorkflowValidationError(Exception):
    """Exception raised when workflow validation fails.

    Attributes:
        message: Human-readable error message
        path: Path to the file that failed validation
        errors: List of validation error details
    """

    def __init__(
        self,
        message: str,
        path: Optional[Path] = None,
        errors: Optional[list] = None,
    ):
        self.message = message
        self.path = path
        self.errors = errors or []
        super().__init__(message)

    def __str__(self) -> str:
        return self.message


def _format_validation_errors(errors: list, path: Optional[Path] = None) -> str:
    """Format Pydantic validation errors into user-friendly messages.

    Args:
        errors: List of error dictionaries from Pydantic
        path: Optional path to the file being validated

    Returns:
        Formatted error message string
    """
    lines = []

    if path:
        lines.append(f"Invalid workflow at {path}:")
    else:
        lines.append("Invalid workflow definition:")

    for error in errors:
        # Build location string (e.g., "phases → 0 → name")
        loc = " → ".join(str(x) for x in error["loc"])
        msg = error["msg"]
        lines.append(f"  • {loc}: {msg}")

    return "\n".join(lines)


def load_workflow(path: Union[str, Path]) -> WorkflowSchema:
    """Load and validate a workflow YAML file.

    Args:
        path: Path to the workflow YAML file

    Returns:
        Validated WorkflowSchema instance

    Raises:
        WorkflowValidationError: If the YAML is invalid or doesn't match schema
        FileNotFoundError: If the file doesn't exist
    """
    path = Path(path)

    if not path.exists():
        raise FileNotFoundError(f"Workflow file not found: {path}")

    if not path.suffix.lower() in (".yaml", ".yml"):
        raise WorkflowValidationError(
            f"Expected .yaml or .yml file, got: {path.suffix}",
            path=path,
        )

    try:
        with open(path, "r", encoding="utf-8") as f:
            raw_config = yaml.safe_load(f)
    except yaml.YAMLError as e:
        raise WorkflowValidationError(
            f"YAML parsing error: {e}",
            path=path,
        )

    if raw_config is None:
        raise WorkflowValidationError(
            "Empty workflow file",
            path=path,
        )

    if not isinstance(raw_config, dict):
        raise WorkflowValidationError(
            f"Expected workflow to be a dictionary, got {type(raw_config).__name__}",
            path=path,
        )

    try:
        return WorkflowSchema(**raw_config)
    except ValidationError as e:
        formatted = _format_validation_errors(e.errors(), path)
        raise WorkflowValidationError(
            formatted,
            path=path,
            errors=e.errors(),
        )


def load_workflow_from_dict(data: Dict[str, Any]) -> WorkflowSchema:
    """Load and validate a workflow from a dictionary.

    Args:
        data: Workflow configuration dictionary

    Returns:
        Validated WorkflowSchema instance

    Raises:
        WorkflowValidationError: If the data doesn't match schema
    """
    try:
        return WorkflowSchema(**data)
    except ValidationError as e:
        formatted = _format_validation_errors(e.errors())
        raise WorkflowValidationError(
            formatted,
            errors=e.errors(),
        )


def load_agent(path: Union[str, Path]) -> AgentSchema:
    """Load and validate an agent YAML file.

    Args:
        path: Path to the agent YAML file

    Returns:
        Validated AgentSchema instance

    Raises:
        WorkflowValidationError: If the YAML is invalid
        FileNotFoundError: If the file doesn't exist
    """
    path = Path(path)

    if not path.exists():
        raise FileNotFoundError(f"Agent file not found: {path}")

    try:
        with open(path, "r", encoding="utf-8") as f:
            raw_config = yaml.safe_load(f)
    except yaml.YAMLError as e:
        raise WorkflowValidationError(
            f"YAML parsing error: {e}",
            path=path,
        )

    try:
        return AgentSchema(**raw_config)
    except ValidationError as e:
        formatted = _format_validation_errors(e.errors(), path)
        raise WorkflowValidationError(
            formatted,
            path=path,
            errors=e.errors(),
        )


def load_tools(path: Union[str, Path]) -> list[ToolSchema]:
    """Load and validate a tools YAML file.

    The tools file should have a 'tools' key containing a list of tool definitions.

    Args:
        path: Path to the tools YAML file

    Returns:
        List of validated ToolSchema instances

    Raises:
        WorkflowValidationError: If the YAML is invalid
        FileNotFoundError: If the file doesn't exist
    """
    path = Path(path)

    if not path.exists():
        raise FileNotFoundError(f"Tools file not found: {path}")

    try:
        with open(path, "r", encoding="utf-8") as f:
            raw_config = yaml.safe_load(f)
    except yaml.YAMLError as e:
        raise WorkflowValidationError(
            f"YAML parsing error: {e}",
            path=path,
        )

    if not isinstance(raw_config, dict) or "tools" not in raw_config:
        raise WorkflowValidationError(
            "Tools file must have a 'tools' key with a list of tool definitions",
            path=path,
        )

    tools = []
    for i, tool_data in enumerate(raw_config["tools"]):
        try:
            tools.append(ToolSchema(**tool_data))
        except ValidationError as e:
            formatted = _format_validation_errors(
                [{"loc": ("tools", i, *err["loc"]), "msg": err["msg"]} for err in e.errors()],
                path,
            )
            raise WorkflowValidationError(
                formatted,
                path=path,
                errors=e.errors(),
            )

    return tools


def resolve_references(
    value: Any,
    context: Dict[str, Any],
    path: str = "",
) -> Any:
    """Resolve $variable references in a value.

    Supports references like:
    - $models.default
    - $config.max_retries
    - $frame.issue (phase output references)

    Args:
        value: Value to resolve (may contain $references)
        context: Dictionary of available values to resolve against
        path: Current path for error messages

    Returns:
        Resolved value

    Raises:
        WorkflowValidationError: If a reference cannot be resolved
    """
    if isinstance(value, str) and value.startswith("$"):
        ref_path = value[1:].split(".")
        result = context

        for key in ref_path:
            if isinstance(result, dict):
                if key not in result:
                    raise WorkflowValidationError(
                        f"Cannot resolve reference '{value}' at {path}: key '{key}' not found"
                    )
                result = result[key]
            else:
                raise WorkflowValidationError(
                    f"Cannot resolve reference '{value}' at {path}: expected dict, got {type(result).__name__}"
                )

        return result

    elif isinstance(value, dict):
        return {k: resolve_references(v, context, f"{path}.{k}") for k, v in value.items()}

    elif isinstance(value, list):
        return [resolve_references(v, context, f"{path}[{i}]") for i, v in enumerate(value)]

    return value


def validate_workflow_references(workflow: WorkflowSchema) -> list[str]:
    """Validate all references in a workflow.

    Checks that:
    - Model references ($models.X) point to defined models
    - Config references ($config.X) point to defined config values
    - Phase input references ($phase.output) are valid

    Args:
        workflow: Workflow to validate

    Returns:
        List of warning messages (non-fatal issues)
    """
    warnings = []

    # Build context for validation
    context = {
        "models": workflow.models.model_dump(),
        "config": workflow.config.model_dump(),
    }

    # Track phase outputs
    phase_outputs: Dict[str, list] = {}

    for phase in workflow.phases:
        # Check model reference
        if phase.model and phase.model.startswith("$"):
            try:
                resolve_references(phase.model, context, f"phases.{phase.name}.model")
            except WorkflowValidationError as e:
                warnings.append(str(e))

        # Check input references
        for input_ref in phase.inputs:
            if input_ref.startswith("$") and not input_ref.startswith("$config"):
                parts = input_ref[1:].split(".")
                if len(parts) >= 2:
                    ref_phase = parts[0]
                    ref_output = parts[1] if len(parts) > 1 else None

                    if ref_phase not in phase_outputs:
                        warnings.append(
                            f"Phase '{phase.name}' references '{input_ref}' but phase '{ref_phase}' "
                            f"has not been defined yet"
                        )
                    elif ref_output and ref_output not in phase_outputs.get(ref_phase, []):
                        warnings.append(
                            f"Phase '{phase.name}' references '{input_ref}' but '{ref_output}' "
                            f"is not in {ref_phase}'s outputs"
                        )

        # Track this phase's outputs
        phase_outputs[phase.name] = phase.outputs

    return warnings
