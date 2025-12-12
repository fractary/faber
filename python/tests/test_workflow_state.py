"""Tests for workflow state."""

from __future__ import annotations

from faber.workflows.state import (
    FaberState,
    create_initial_state,
    is_phase_completed,
    set_error,
)


class TestFaberState:
    """Tests for FaberState operations."""

    def test_create_initial_state(self):
        """Test initial state creation."""
        state = create_initial_state(
            workflow_id="wf-123",
            work_id="456",
            budget_limit_usd=10.0,
        )

        assert state["workflow_id"] == "wf-123"
        assert state["work_id"] == "456"
        assert state["budget_limit_usd"] == 10.0
        assert state["current_phase"] == "frame"
        assert state["completed_phases"] == []
        assert state["retry_count"] == 0
        assert state["error"] is None

    def test_create_initial_state_defaults(self):
        """Test initial state with defaults."""
        state = create_initial_state(
            workflow_id="wf-123",
            work_id="456",
        )

        assert state["budget_limit_usd"] == 10.0
        assert state["current_phase"] == "frame"

    def test_is_phase_completed(self):
        """Test phase completion check."""
        state: FaberState = {
            "workflow_id": "wf-123",
            "work_id": "456",
            "current_phase": "build",
            "completed_phases": ["frame", "architect"],
            "retry_count": 0,
            "max_retries": 3,
            "budget_limit_usd": 10.0,
            "total_cost_usd": 0.0,
            "error": None,
            "error_phase": None,
        }

        assert is_phase_completed(state, "frame")
        assert is_phase_completed(state, "architect")
        assert not is_phase_completed(state, "build")
        assert not is_phase_completed(state, "evaluate")

    def test_set_error(self):
        """Test setting error state."""
        state: FaberState = {
            "workflow_id": "wf-123",
            "work_id": "456",
            "current_phase": "build",
            "completed_phases": ["frame", "architect"],
            "retry_count": 0,
            "max_retries": 3,
            "budget_limit_usd": 10.0,
            "total_cost_usd": 0.0,
            "error": None,
            "error_phase": None,
        }

        updated = set_error(state, "Build failed", "build")

        assert updated["error"] == "Build failed"
        assert updated["error_phase"] == "build"
        # Original state unchanged
        assert state["error"] is None
