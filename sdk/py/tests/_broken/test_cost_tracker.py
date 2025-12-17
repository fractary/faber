"""Tests for cost tracking."""

from __future__ import annotations

import pytest

from faber.cost.tracker import (
    BudgetApprovalRequired,
    BudgetExceeded,
    CostConfig,
    CostTracker,
    ModelPricing,
)


class TestModelPricing:
    """Tests for ModelPricing."""

    def test_calculate_cost(self):
        """Test cost calculation."""
        pricing = ModelPricing(input_price=3.0, output_price=15.0)

        # 1M input + 1M output tokens
        cost = pricing.calculate_cost(1_000_000, 1_000_000)
        assert cost == 18.0  # $3 + $15

    def test_calculate_cost_small(self):
        """Test cost calculation for small usage."""
        pricing = ModelPricing(input_price=3.0, output_price=15.0)

        # 1000 input + 500 output tokens
        cost = pricing.calculate_cost(1000, 500)
        assert cost == pytest.approx(0.0105, rel=1e-3)


class TestCostTracker:
    """Tests for CostTracker."""

    def test_add_usage(self):
        """Test adding usage events."""
        tracker = CostTracker("test-workflow")

        event = tracker.add_usage(
            model="claude-sonnet-4-20250514",
            input_tokens=10000,
            output_tokens=5000,
            phase="frame",
        )

        assert event.model == "claude-sonnet-4-20250514"
        assert event.input_tokens == 10000
        assert event.output_tokens == 5000
        assert event.phase == "frame"
        assert event.cost_usd > 0

    def test_budget_exceeded(self):
        """Test budget exceeded exception."""
        config = CostConfig(budget_limit_usd=0.01)
        tracker = CostTracker("test-workflow", config)

        # Add usage that exceeds budget
        with pytest.raises(BudgetExceeded):
            tracker.add_usage(
                model="claude-sonnet-4-20250514",
                input_tokens=1_000_000,
                output_tokens=500_000,
            )

    def test_budget_approval_required(self):
        """Test approval required at threshold."""
        config = CostConfig(
            budget_limit_usd=1.0,
            require_approval_at=0.5,
        )
        tracker = CostTracker("test-workflow", config)

        # Add usage that triggers approval
        with pytest.raises(BudgetApprovalRequired):
            tracker.add_usage(
                model="claude-sonnet-4-20250514",
                input_tokens=500_000,
                output_tokens=100_000,
            )

    def test_approve_budget(self):
        """Test budget approval."""
        config = CostConfig(
            budget_limit_usd=1.0,
            require_approval_at=0.1,
        )
        tracker = CostTracker("test-workflow", config)
        tracker.approve_budget()

        # Should not raise after approval
        tracker.add_usage(
            model="claude-sonnet-4-20250514",
            input_tokens=100_000,
            output_tokens=50_000,
        )
        assert tracker.total_cost_usd > 0

    def test_get_summary(self):
        """Test cost summary."""
        tracker = CostTracker("test-workflow")

        tracker.add_usage(
            model="claude-sonnet-4-20250514",
            input_tokens=10000,
            output_tokens=5000,
            phase="frame",
        )
        tracker.add_usage(
            model="claude-3-5-haiku-20241022",
            input_tokens=5000,
            output_tokens=2000,
            phase="architect",
        )

        summary = tracker.get_summary()

        assert summary.events_count == 2
        assert summary.total_tokens == 22000
        assert summary.total_input_tokens == 15000
        assert summary.total_output_tokens == 7000
        assert "claude-sonnet-4-20250514" in summary.by_model
        assert "frame" in summary.by_phase

    def test_is_within_budget(self):
        """Test budget check."""
        config = CostConfig(budget_limit_usd=100.0)
        tracker = CostTracker("test-workflow", config)

        tracker.add_usage(
            model="claude-3-5-haiku-20241022",
            input_tokens=1000,
            output_tokens=500,
        )

        assert tracker.is_within_budget()

    def test_is_warning(self):
        """Test warning threshold."""
        config = CostConfig(
            budget_limit_usd=0.001,
            warning_threshold=0.5,
        )
        tracker = CostTracker("test-workflow", config)

        tracker.add_usage(
            model="claude-3-5-haiku-20241022",
            input_tokens=5000,
            output_tokens=2000,
        )

        assert tracker.is_warning()

    def test_reset(self):
        """Test tracker reset."""
        tracker = CostTracker("test-workflow")

        tracker.add_usage(
            model="claude-sonnet-4-20250514",
            input_tokens=10000,
            output_tokens=5000,
        )

        tracker.reset()

        assert tracker.total_cost_usd == 0.0
        assert tracker.total_tokens == 0
        assert len(tracker.events) == 0
