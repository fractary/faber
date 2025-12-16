"""
Cost tracking for FABER workflows.

Provides budget tracking, limits, and approval workflows.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime
from typing import Any, Optional


class BudgetExceeded(Exception):
    """Raised when budget limit is exceeded."""

    pass


class BudgetApprovalRequired(Exception):
    """Raised when budget threshold requires approval."""

    pass


@dataclass
class ModelPricing:
    """Pricing information for a model (per 1M tokens)."""

    input_price: float  # USD per 1M input tokens
    output_price: float  # USD per 1M output tokens

    def calculate_cost(self, input_tokens: int, output_tokens: int) -> float:
        """Calculate cost for a usage event."""
        input_cost = (input_tokens / 1_000_000) * self.input_price
        output_cost = (output_tokens / 1_000_000) * self.output_price
        return input_cost + output_cost


# Default pricing for common models (as of early 2025)
DEFAULT_PRICING: dict[str, ModelPricing] = {
    # Anthropic
    "claude-opus-4-20250514": ModelPricing(input_price=15.0, output_price=75.0),
    "claude-sonnet-4-20250514": ModelPricing(input_price=3.0, output_price=15.0),
    "claude-3-5-haiku-20241022": ModelPricing(input_price=0.25, output_price=1.25),
    # OpenAI
    "gpt-4o": ModelPricing(input_price=2.50, output_price=10.0),
    "gpt-4o-mini": ModelPricing(input_price=0.15, output_price=0.60),
}


@dataclass
class CostConfig:
    """Configuration for cost tracking."""

    budget_limit_usd: float = 10.0
    warning_threshold: float = 0.8  # 80% of budget
    require_approval_at: float = 0.9  # 90% of budget
    pricing: dict[str, ModelPricing] = field(default_factory=lambda: DEFAULT_PRICING.copy())


@dataclass
class UsageEvent:
    """A single usage event."""

    timestamp: str
    model: str
    input_tokens: int
    output_tokens: int
    cost_usd: float
    phase: Optional[str] = None
    metadata: dict[str, Any] = field(default_factory=dict)


@dataclass
class CostSummary:
    """Summary of costs for a workflow."""

    total_tokens: int
    total_input_tokens: int
    total_output_tokens: int
    total_cost_usd: float
    by_model: dict[str, float]
    by_phase: dict[str, float]
    events_count: int
    budget_remaining: Optional[float] = None
    budget_percent_used: Optional[float] = None


class CostTracker:
    """Tracks and enforces cost budgets for FABER workflows.

    Monitors token usage, calculates costs, and enforces
    budget limits with approval workflows.
    """

    def __init__(
        self,
        workflow_id: str,
        config: Optional[CostConfig] = None,
    ) -> None:
        """Initialize cost tracker.

        Args:
            workflow_id: Workflow identifier
            config: Cost configuration
        """
        self.workflow_id = workflow_id
        self.config = config or CostConfig()

        self.events: list[UsageEvent] = []
        self.total_cost_usd: float = 0.0
        self.total_tokens: int = 0
        self.budget_approved: bool = False

    def add_usage(
        self,
        model: str,
        input_tokens: int,
        output_tokens: int,
        phase: Optional[str] = None,
        metadata: Optional[dict[str, Any]] = None,
    ) -> UsageEvent:
        """Record a usage event.

        Args:
            model: Model name/ID
            input_tokens: Number of input tokens
            output_tokens: Number of output tokens
            phase: FABER phase (optional)
            metadata: Additional metadata

        Returns:
            Created UsageEvent

        Raises:
            BudgetExceeded: If hard limit is exceeded
            BudgetApprovalRequired: If approval threshold is reached
        """
        # Calculate cost
        pricing = self.config.pricing.get(model)
        if pricing:
            cost = pricing.calculate_cost(input_tokens, output_tokens)
        else:
            # Default pricing if model not found
            cost = ((input_tokens + output_tokens) / 1_000_000) * 5.0  # ~$5/1M tokens

        event = UsageEvent(
            timestamp=datetime.now().isoformat(),
            model=model,
            input_tokens=input_tokens,
            output_tokens=output_tokens,
            cost_usd=cost,
            phase=phase,
            metadata=metadata or {},
        )

        self.events.append(event)
        self.total_cost_usd += cost
        self.total_tokens += input_tokens + output_tokens

        # Check budget limits
        self._check_budget()

        return event

    def _check_budget(self) -> None:
        """Check if budget limits are exceeded."""
        if self.config.budget_limit_usd <= 0:
            return  # No limit

        percent_used = self.total_cost_usd / self.config.budget_limit_usd

        if percent_used >= 1.0:
            raise BudgetExceeded(
                f"Budget exceeded: ${self.total_cost_usd:.2f} / "
                f"${self.config.budget_limit_usd:.2f}"
            )

        if percent_used >= self.config.require_approval_at and not self.budget_approved:
            raise BudgetApprovalRequired(
                f"Budget approval required at {self.config.require_approval_at * 100:.0f}%: "
                f"${self.total_cost_usd:.2f} / ${self.config.budget_limit_usd:.2f}"
            )

    def approve_budget(self) -> None:
        """Approve continuing despite budget threshold."""
        self.budget_approved = True

    def get_summary(self) -> CostSummary:
        """Get a summary of costs.

        Returns:
            CostSummary with aggregated data
        """
        by_model: dict[str, float] = {}
        by_phase: dict[str, float] = {}
        total_input = 0
        total_output = 0

        for event in self.events:
            by_model[event.model] = by_model.get(event.model, 0) + event.cost_usd
            if event.phase:
                by_phase[event.phase] = by_phase.get(event.phase, 0) + event.cost_usd
            total_input += event.input_tokens
            total_output += event.output_tokens

        budget_remaining = None
        budget_percent = None
        if self.config.budget_limit_usd > 0:
            budget_remaining = self.config.budget_limit_usd - self.total_cost_usd
            budget_percent = (self.total_cost_usd / self.config.budget_limit_usd) * 100

        return CostSummary(
            total_tokens=self.total_tokens,
            total_input_tokens=total_input,
            total_output_tokens=total_output,
            total_cost_usd=self.total_cost_usd,
            by_model=by_model,
            by_phase=by_phase,
            events_count=len(self.events),
            budget_remaining=budget_remaining,
            budget_percent_used=budget_percent,
        )

    def is_within_budget(self) -> bool:
        """Check if currently within budget.

        Returns:
            True if within budget limits
        """
        if self.config.budget_limit_usd <= 0:
            return True
        return self.total_cost_usd < self.config.budget_limit_usd

    def is_warning(self) -> bool:
        """Check if at warning threshold.

        Returns:
            True if at or above warning threshold
        """
        if self.config.budget_limit_usd <= 0:
            return False
        percent = self.total_cost_usd / self.config.budget_limit_usd
        return percent >= self.config.warning_threshold

    def reset(self) -> None:
        """Reset the tracker."""
        self.events = []
        self.total_cost_usd = 0.0
        self.total_tokens = 0
        self.budget_approved = False
