"""
FABER Public API - Programmatic interface for workflow execution.

This module provides the public API for the FABER SDK, designed for
use by @fractary/cli and other programmatic consumers.
"""

from faber.api.config import (
    init_config,
    load_config,
    validate_config,
)
from faber.api.exceptions import (
    ConfigError,
    FaberError,
    WorkflowError,
)
from faber.api.types import (
    AutonomyLevel,
    ConfigResult,
    WorkflowOptions,
    WorkflowResult,
    WorkflowSummary,
)
from faber.api.workflow import (
    cancel_workflow,
    list_workflows,
    run_workflow,
    run_workflow_streaming,
    run_workflow_sync,
    view_workflow,
)

__all__ = [
    # Workflow API
    "run_workflow",
    "run_workflow_sync",
    "run_workflow_streaming",
    "list_workflows",
    "view_workflow",
    "cancel_workflow",
    # Config API
    "init_config",
    "load_config",
    "validate_config",
    # Types
    "WorkflowOptions",
    "WorkflowResult",
    "AutonomyLevel",
    "WorkflowSummary",
    "ConfigResult",
    # Exceptions
    "FaberError",
    "ConfigError",
    "WorkflowError",
]
