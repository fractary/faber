"""
FABER Workflow Configuration.

Handles loading and validation of workflow configuration.
"""

from __future__ import annotations

import os
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Optional

import yaml


@dataclass
class PhaseConfig:
    """Configuration for a single FABER phase."""

    enabled: bool = True
    model: Optional[str] = None
    human_approval: bool = False
    max_iterations: int = 50
    timeout_seconds: Optional[int] = None


@dataclass
class ApprovalConfig:
    """Configuration for human-in-the-loop approval."""

    notify_channels: list[str] = field(default_factory=lambda: ["cli"])
    response_channels: list[str] = field(default_factory=lambda: ["cli"])
    timeout_minutes: int = 60


@dataclass
class CheckpointConfig:
    """Configuration for workflow checkpointing."""

    backend: str = "sqlite"  # sqlite | postgres | redis
    sqlite_path: str = ".faber/checkpoints.db"
    postgres_url: Optional[str] = None
    redis_url: Optional[str] = None
    redis_ttl_hours: int = 24


@dataclass
class CostConfig:
    """Configuration for cost control."""

    budget_limit_usd: float = 10.0
    warning_threshold: float = 0.8
    require_approval_at: float = 0.9


@dataclass
class WorkflowConfig:
    """Complete workflow configuration."""

    # General
    autonomy: str = "assisted"  # assisted | guarded | autonomous
    max_retries: int = 3

    # Phase-specific
    phases: dict[str, PhaseConfig] = field(default_factory=lambda: {
        "frame": PhaseConfig(model="anthropic:claude-3-5-haiku-20241022"),
        "architect": PhaseConfig(
            model="anthropic:claude-sonnet-4-20250514",
            human_approval=True,
        ),
        "build": PhaseConfig(
            model="anthropic:claude-sonnet-4-20250514",
            max_iterations=100,
        ),
        "evaluate": PhaseConfig(model="anthropic:claude-sonnet-4-20250514"),
        "release": PhaseConfig(
            model="anthropic:claude-3-5-haiku-20241022",
            human_approval=True,
        ),
    })

    # Human-in-the-loop
    approval: ApprovalConfig = field(default_factory=ApprovalConfig)

    # Checkpointing
    checkpoint: CheckpointConfig = field(default_factory=CheckpointConfig)

    # Cost control
    cost: CostConfig = field(default_factory=CostConfig)

    # Observability
    langsmith_enabled: bool = True
    langsmith_project: str = "faber-workflows"


def load_workflow_config(config_path: Optional[Path] = None) -> WorkflowConfig:
    """Load workflow configuration from file or defaults.

    Args:
        config_path: Path to config file. If None, searches standard locations.

    Returns:
        Loaded WorkflowConfig
    """
    if config_path is None:
        # Search standard locations
        search_paths = [
            Path.cwd() / ".faber" / "config.yaml",
            Path.cwd() / ".faber" / "config.yml",
            Path.cwd() / "faber.yaml",
            Path.cwd() / "faber.yml",
        ]
        for path in search_paths:
            if path.exists():
                config_path = path
                break

    if config_path is None or not config_path.exists():
        return WorkflowConfig()

    with open(config_path) as f:
        raw_config = yaml.safe_load(f) or {}

    return _parse_config(raw_config)


def _parse_config(raw: dict[str, Any]) -> WorkflowConfig:
    """Parse raw config dict into WorkflowConfig."""
    workflow_raw = raw.get("workflow", {})

    config = WorkflowConfig(
        autonomy=workflow_raw.get("autonomy", "assisted"),
        max_retries=workflow_raw.get("max_retries", 3),
    )

    # Parse phase configs
    models_raw = workflow_raw.get("models", {})
    human_approval_raw = workflow_raw.get("human_approval", {})

    for phase in ["frame", "architect", "build", "evaluate", "release"]:
        if phase in config.phases:
            if phase in models_raw:
                config.phases[phase].model = models_raw[phase]
            if phase in human_approval_raw:
                config.phases[phase].human_approval = human_approval_raw[phase]

    # Parse approval config
    approval_raw = workflow_raw.get("approval", {})
    config.approval = ApprovalConfig(
        notify_channels=approval_raw.get("notify_channels", ["cli"]),
        response_channels=approval_raw.get("response_channels", ["cli"]),
        timeout_minutes=approval_raw.get("timeout_minutes", 60),
    )

    # Parse checkpoint config
    checkpoint_raw = workflow_raw.get("checkpointing", {})
    config.checkpoint = CheckpointConfig(
        backend=checkpoint_raw.get("backend", "sqlite"),
        sqlite_path=checkpoint_raw.get("sqlite", {}).get("path", ".faber/checkpoints.db"),
        postgres_url=checkpoint_raw.get("postgres", {}).get("connection_string")
            or os.getenv("FABER_POSTGRES_URL"),
        redis_url=checkpoint_raw.get("redis", {}).get("url")
            or os.getenv("FABER_REDIS_URL"),
        redis_ttl_hours=checkpoint_raw.get("redis", {}).get("ttl_hours", 24),
    )

    # Parse cost config
    cost_raw = workflow_raw.get("cost", {})
    config.cost = CostConfig(
        budget_limit_usd=cost_raw.get("budget_limit_usd", 10.0),
        warning_threshold=cost_raw.get("warning_threshold", 0.8),
        require_approval_at=cost_raw.get("require_approval_at", 0.9),
    )

    # Parse observability
    obs_raw = raw.get("observability", {}).get("langsmith", {})
    config.langsmith_enabled = obs_raw.get("enabled", True)
    config.langsmith_project = obs_raw.get("project", "faber-workflows")

    return config
