"""
FABER - AI-assisted development workflows powered by LangGraph.

FABER (Frame, Architect, Build, Evaluate, Release) provides enterprise-grade
workflow orchestration for AI-assisted software development.
"""

__version__ = "0.1.0"

# Workflow graph primitives (for advanced users)
from faber.workflows.graph import create_faber_workflow, run_faber_workflow
from faber.workflows.state import FaberState

# Public API (recommended for most users)
from faber.api import (
    # Workflow functions
    run_workflow,
    run_workflow_sync,
    list_workflows,
    view_workflow,
    # Config functions
    init_config,
    load_config,
    validate_config,
    # Types
    WorkflowOptions,
    WorkflowResult,
    WorkflowStatus,
    AutonomyLevel,
    WorkflowSummary,
    ConfigResult,
    # Exceptions
    FaberError,
    ConfigError,
    WorkflowError,
)

__all__ = [
    # Version
    "__version__",
    # Public API (recommended)
    "run_workflow",
    "run_workflow_sync",
    "list_workflows",
    "view_workflow",
    "init_config",
    "load_config",
    "validate_config",
    "WorkflowOptions",
    "WorkflowResult",
    "WorkflowStatus",
    "AutonomyLevel",
    "WorkflowSummary",
    "ConfigResult",
    "FaberError",
    "ConfigError",
    "WorkflowError",
    # Advanced/Internal
    "create_faber_workflow",
    "run_faber_workflow",
    "FaberState",
]
