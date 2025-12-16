"""
FABER Accessibility Layer.

This module provides tooling to make LangGraph-powered workflows accessible
to developers of all skill levels through declarative YAML definitions.

Key components:
- schemas: Pydantic models for YAML validation
- loader: YAML loading with validation and error handling
- compiler: YAML to LangGraph StateGraph compilation
"""

from faber.accessibility.schemas import (
    WorkflowSchema,
    Phase,
    Step,
    ModelConfig,
    WorkflowConfig,
    Trigger,
    WorkflowHooks,
)
from faber.accessibility.loader import (
    load_workflow,
    WorkflowValidationError,
)
from faber.accessibility.compiler import (
    WorkflowCompiler,
    compile_workflow,
)

__all__ = [
    # Schemas
    "WorkflowSchema",
    "Phase",
    "Step",
    "ModelConfig",
    "WorkflowConfig",
    "Trigger",
    "WorkflowHooks",
    # Loader
    "load_workflow",
    "WorkflowValidationError",
    # Compiler
    "WorkflowCompiler",
    "compile_workflow",
]
