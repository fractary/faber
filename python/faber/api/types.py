"""Type definitions for FABER API."""

from dataclasses import dataclass, field
from enum import Enum
from typing import Optional


class AutonomyLevel(str, Enum):
    """Autonomy levels for workflow execution."""

    ASSISTED = "assisted"
    GUARDED = "guarded"
    AUTONOMOUS = "autonomous"


@dataclass
class WorkflowOptions:
    """Options for workflow execution."""

    workflow_path: Optional[str] = None
    autonomy: AutonomyLevel = AutonomyLevel.ASSISTED
    max_retries: int = 3
    skip_phases: Optional[list[str]] = None
    trace: bool = True
    budget_usd: Optional[float] = None


@dataclass
class WorkflowResult:
    """Result of workflow execution."""

    workflow_id: str
    work_id: str
    status: str  # "completed", "failed", "cancelled"
    completed_phases: list[str]
    pr_url: Optional[str] = None
    spec_path: Optional[str] = None
    branch_name: Optional[str] = None
    error: Optional[str] = None
    error_phase: Optional[str] = None
    retry_count: int = 0
    evaluation_result: Optional[str] = None

    def to_dict(self) -> dict:
        """Convert to dictionary for serialization."""
        return {
            "workflow_id": self.workflow_id,
            "work_id": self.work_id,
            "status": self.status,
            "completed_phases": self.completed_phases,
            "pr_url": self.pr_url,
            "spec_path": self.spec_path,
            "branch_name": self.branch_name,
            "error": self.error,
            "error_phase": self.error_phase,
            "retry_count": self.retry_count,
            "evaluation_result": self.evaluation_result,
        }


@dataclass
class WorkflowSummary:
    """Summary of a workflow execution for listing."""

    workflow_id: str
    work_id: Optional[str]
    status: str
    started_at: str
    ended_at: Optional[str]
    current_phase: str
    entry_count: int


@dataclass
class ConfigResult:
    """Result of configuration operation."""

    success: bool
    path: Optional[str] = None
    message: Optional[str] = None
    error: Optional[str] = None
