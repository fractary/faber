"""Configuration management API."""

from pathlib import Path
from typing import Optional

import yaml

from faber.api.exceptions import ConfigError
from faber.api.types import ConfigResult


def init_config(
    path: Optional[Path] = None,
    force: bool = False,
) -> ConfigResult:
    """Initialize FABER configuration.

    Args:
        path: Directory for .faber/config.yaml (default: cwd)
        force: Overwrite existing config

    Returns:
        ConfigResult with operation status
    """
    if path is None:
        path = Path.cwd()

    config_dir = path / ".faber"
    config_file = config_dir / "config.yaml"

    if config_file.exists() and not force:
        return ConfigResult(
            success=False,
            path=str(config_file),
            error=f"Configuration already exists at {config_file}. Use force=True to overwrite.",
        )

    config_dir.mkdir(parents=True, exist_ok=True)

    # Default config (extracted from cli/main.py init())
    default_config = {
        "workflow": {
            "autonomy": "assisted",
            "max_retries": 3,
            "models": {
                "frame": "anthropic:claude-3-5-haiku-20241022",
                "architect": "anthropic:claude-sonnet-4-20250514",
                "build": "anthropic:claude-sonnet-4-20250514",
                "evaluate": "anthropic:claude-sonnet-4-20250514",
                "release": "anthropic:claude-3-5-haiku-20241022",
            },
            "human_approval": {
                "architect": True,
                "release": True,
            },
            "approval": {
                "notify_channels": ["cli"],
                "response_channels": ["cli"],
                "timeout_minutes": 60,
            },
            "checkpointing": {
                "backend": "sqlite",
                "sqlite": {
                    "path": ".faber/checkpoints.db",
                },
            },
            "cost": {
                "budget_limit_usd": 10.0,
                "warning_threshold": 0.8,
                "require_approval_at": 0.9,
            },
        },
        "work": {
            "platform": "github",
        },
        "repo": {
            "platform": "github",
            "default_branch": "main",
        },
        "observability": {
            "langsmith": {
                "enabled": True,
                "project": "faber-workflows",
            },
        },
    }

    try:
        with open(config_file, "w") as f:
            yaml.dump(default_config, f, default_flow_style=False, sort_keys=False)

        return ConfigResult(
            success=True,
            path=str(config_file),
            message=f"Created configuration at {config_file}",
        )
    except Exception as e:
        return ConfigResult(
            success=False,
            error=f"Failed to create config: {e}",
        )


def load_config(path: Optional[Path] = None) -> dict:
    """Load FABER configuration.

    Args:
        path: Path to config file or directory containing .faber/

    Returns:
        Configuration dictionary

    Raises:
        ConfigError: If config not found or invalid
    """
    from faber.workflows.config import load_workflow_config

    try:
        config = load_workflow_config(path)
        # Convert to dict for API consumers
        # This is simplified - full implementation would convert all dataclass fields
        return {
            "autonomy": config.autonomy,
            "max_retries": config.max_retries,
            "budget_limit_usd": config.cost.budget_limit_usd,
            # Add other fields as needed
        }
    except FileNotFoundError as e:
        raise ConfigError(f"Configuration not found: {e}")
    except Exception as e:
        raise ConfigError(f"Invalid configuration: {e}")


def validate_config(config: dict) -> list[str]:
    """Validate configuration dictionary.

    Args:
        config: Configuration to validate

    Returns:
        List of validation errors (empty if valid)
    """
    errors = []

    # Validate required top-level keys
    if "workflow" not in config:
        errors.append("Missing 'workflow' section")

    # Validate workflow section
    if workflow := config.get("workflow"):
        if "autonomy" in workflow:
            valid_autonomy = ["assisted", "guarded", "autonomous"]
            if workflow["autonomy"] not in valid_autonomy:
                errors.append(
                    f"Invalid autonomy level: {workflow['autonomy']}. "
                    f"Must be one of: {', '.join(valid_autonomy)}"
                )

        if "max_retries" in workflow:
            if not isinstance(workflow["max_retries"], int) or workflow["max_retries"] < 0:
                errors.append("max_retries must be a non-negative integer")

    return errors
