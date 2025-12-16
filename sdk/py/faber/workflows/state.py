"""
FABER State - TypedDict for LangGraph workflow state.

Defines the complete state schema for the FABER workflow,
including all phase inputs/outputs and control flow data.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Annotated, Any, Optional, TypedDict

from langgraph.graph.message import add_messages


@dataclass
class FaberPhaseResult:
    """Result from a FABER phase execution."""

    phase: str
    status: str  # completed | failed | skipped
    duration_ms: Optional[int] = None
    output: dict[str, Any] = field(default_factory=dict)
    error: Optional[str] = None


class FaberState(TypedDict, total=False):
    """State for FABER workflow graph.

    This TypedDict defines all state that flows through the FABER workflow.
    Uses LangGraph annotations for state updates.
    """

    # =========================================================================
    # Workflow Identification
    # =========================================================================
    workflow_id: str
    work_id: str

    # =========================================================================
    # Phase Tracking
    # =========================================================================
    current_phase: str  # frame | architect | build | evaluate | release
    completed_phases: list[str]
    phase_results: dict[str, FaberPhaseResult]

    # =========================================================================
    # Frame Phase Outputs
    # =========================================================================
    issue: Optional[dict[str, Any]]
    work_type: Optional[str]
    work_type_confidence: Optional[float]
    requirements: Optional[list[str]]
    dependencies: Optional[list[str]]
    blockers: Optional[list[str]]

    # =========================================================================
    # Architect Phase Outputs
    # =========================================================================
    spec_id: Optional[str]
    spec_path: Optional[str]
    spec_validated: bool
    spec_completeness: Optional[float]
    refinement_questions: Optional[list[str]]

    # =========================================================================
    # Build Phase Outputs
    # =========================================================================
    branch_name: Optional[str]
    commits: Annotated[list[str], lambda x, y: x + y]  # Accumulate commits
    files_modified: Optional[list[str]]
    tests_added: Optional[list[str]]

    # =========================================================================
    # Evaluate Phase Outputs
    # =========================================================================
    evaluation_result: Optional[str]  # GO | NO_GO
    evaluation_details: Optional[dict[str, Any]]
    acceptance_criteria_met: Optional[list[str]]
    acceptance_criteria_unmet: Optional[list[str]]
    issues_found: Optional[list[str]]
    retry_count: int

    # =========================================================================
    # Release Phase Outputs
    # =========================================================================
    pr_number: Optional[int]
    pr_url: Optional[str]
    pr_state: Optional[str]

    # =========================================================================
    # Human-in-the-Loop
    # =========================================================================
    awaiting_approval: bool
    approval_request: Optional[dict[str, Any]]
    approval_response: Optional[dict[str, Any]]

    # =========================================================================
    # Cost Tracking
    # =========================================================================
    total_tokens: int
    total_cost_usd: float
    budget_limit_usd: Optional[float]
    budget_approved: bool

    # =========================================================================
    # Error Handling
    # =========================================================================
    error: Optional[str]
    error_phase: Optional[str]
    should_retry: bool

    # =========================================================================
    # Messages (for LLM context)
    # =========================================================================
    messages: Annotated[list[dict[str, Any]], add_messages]


def create_initial_state(
    workflow_id: str,
    work_id: str,
    budget_limit_usd: Optional[float] = None,
) -> FaberState:
    """Create initial state for a FABER workflow.

    Args:
        workflow_id: Unique identifier for this workflow run
        work_id: Work item ID to process
        budget_limit_usd: Optional cost budget limit

    Returns:
        Initialized FaberState
    """
    return FaberState(
        # Identification
        workflow_id=workflow_id,
        work_id=work_id,
        # Phase tracking
        current_phase="",
        completed_phases=[],
        phase_results={},
        # Frame outputs
        issue=None,
        work_type=None,
        work_type_confidence=None,
        requirements=None,
        dependencies=None,
        blockers=None,
        # Architect outputs
        spec_id=None,
        spec_path=None,
        spec_validated=False,
        spec_completeness=None,
        refinement_questions=None,
        # Build outputs
        branch_name=None,
        commits=[],
        files_modified=None,
        tests_added=None,
        # Evaluate outputs
        evaluation_result=None,
        evaluation_details=None,
        acceptance_criteria_met=None,
        acceptance_criteria_unmet=None,
        issues_found=None,
        retry_count=0,
        # Release outputs
        pr_number=None,
        pr_url=None,
        pr_state=None,
        # Human-in-the-loop
        awaiting_approval=False,
        approval_request=None,
        approval_response=None,
        # Cost tracking
        total_tokens=0,
        total_cost_usd=0.0,
        budget_limit_usd=budget_limit_usd,
        budget_approved=False,
        # Error handling
        error=None,
        error_phase=None,
        should_retry=False,
        # Messages
        messages=[],
    )
