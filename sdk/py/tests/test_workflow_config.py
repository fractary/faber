"""Tests for workflow configuration."""

from __future__ import annotations

import tempfile
from pathlib import Path

import pytest
import yaml

from faber.workflows.config import (
    ApprovalConfig,
    CheckpointConfig,
    CostConfig,
    PhaseConfig,
    WorkflowConfig,
    load_workflow_config,
)


class TestPhaseConfig:
    """Tests for PhaseConfig."""

    def test_default_values(self):
        """Test default phase configuration."""
        config = PhaseConfig()

        assert config.enabled is True
        assert config.model is None
        assert config.human_approval is False
        assert config.max_iterations == 10

    def test_custom_values(self):
        """Test custom phase configuration."""
        config = PhaseConfig(
            enabled=False,
            model="anthropic:claude-opus-4-20250514",
            human_approval=True,
            max_iterations=50,
        )

        assert config.enabled is False
        assert config.model == "anthropic:claude-opus-4-20250514"
        assert config.human_approval is True
        assert config.max_iterations == 50


class TestWorkflowConfig:
    """Tests for WorkflowConfig."""

    def test_default_values(self):
        """Test default workflow configuration."""
        config = WorkflowConfig()

        assert config.autonomy == "assisted"
        assert config.max_retries == 3
        assert "frame" in config.phases
        assert "architect" in config.phases
        assert "build" in config.phases
        assert "evaluate" in config.phases
        assert "release" in config.phases

    def test_default_models(self):
        """Test default model assignments."""
        config = WorkflowConfig()

        assert config.default_models["frame"] == "anthropic:claude-3-5-haiku-20241022"
        assert config.default_models["architect"] == "anthropic:claude-sonnet-4-20250514"
        assert config.default_models["build"] == "anthropic:claude-sonnet-4-20250514"

    def test_human_approval_phases(self):
        """Test default human approval checkpoints."""
        config = WorkflowConfig()

        assert config.phases["architect"].human_approval is True
        assert config.phases["release"].human_approval is True
        assert config.phases["frame"].human_approval is False
        assert config.phases["build"].human_approval is False

    def test_langsmith_project(self):
        """Test LangSmith project name."""
        config = WorkflowConfig()
        assert config.langsmith_project == "faber-workflows"


class TestCostConfig:
    """Tests for CostConfig."""

    def test_default_values(self):
        """Test default cost configuration."""
        config = CostConfig()

        assert config.budget_limit_usd == 10.0
        assert config.warning_threshold == 0.8
        assert config.require_approval_at == 0.9

    def test_custom_values(self):
        """Test custom cost configuration."""
        config = CostConfig(
            budget_limit_usd=50.0,
            warning_threshold=0.7,
            require_approval_at=0.85,
        )

        assert config.budget_limit_usd == 50.0
        assert config.warning_threshold == 0.7
        assert config.require_approval_at == 0.85


class TestLoadWorkflowConfig:
    """Tests for config loading."""

    def test_load_default_config(self):
        """Test loading default config when no file exists."""
        with tempfile.TemporaryDirectory() as tmpdir:
            # Change to temp directory
            original = Path.cwd()
            try:
                import os
                os.chdir(tmpdir)

                config = load_workflow_config()

                assert config.autonomy == "assisted"
                assert config.max_retries == 3
            finally:
                os.chdir(original)

    def test_load_from_file(self):
        """Test loading config from file."""
        with tempfile.TemporaryDirectory() as tmpdir:
            config_dir = Path(tmpdir) / ".faber"
            config_dir.mkdir()
            config_file = config_dir / "config.yaml"

            config_data = {
                "workflow": {
                    "autonomy": "autonomous",
                    "max_retries": 5,
                    "cost": {
                        "budget_limit_usd": 25.0,
                    },
                },
            }

            with open(config_file, "w") as f:
                yaml.dump(config_data, f)

            original = Path.cwd()
            try:
                import os
                os.chdir(tmpdir)

                config = load_workflow_config()

                assert config.autonomy == "autonomous"
                assert config.max_retries == 5
                assert config.cost.budget_limit_usd == 25.0
            finally:
                os.chdir(original)
