"""
FABER - AI-assisted development workflows powered by LangGraph.

FABER (Frame, Architect, Build, Evaluate, Release) provides enterprise-grade
workflow orchestration for AI-assisted software development.
"""

__version__ = "0.1.0"

from faber.workflows.graph import create_faber_workflow, run_faber_workflow
from faber.workflows.state import FaberState

__all__ = [
    "__version__",
    "create_faber_workflow",
    "run_faber_workflow",
    "FaberState",
]
