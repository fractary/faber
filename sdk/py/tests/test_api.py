"""Tests for FABER public API."""

import tempfile
from pathlib import Path
from unittest.mock import MagicMock, patch

import pytest

from faber.api import (
    AutonomyLevel,
    ConfigResult,
    WorkflowOptions,
    WorkflowResult,
    WorkflowStatus,
    init_config,
    list_workflows,
    load_config,
    run_workflow_sync,
    validate_config,
    view_workflow,
)
from faber.api.exceptions import ConfigError, WorkflowError


class TestConfigAPI:
    """Tests for configuration API."""

    def test_init_config_creates_default_config(self):
        """Test that init_config creates a default configuration file."""
        with tempfile.TemporaryDirectory() as tmpdir:
            result = init_config(Path(tmpdir))

            assert result.success is True
            assert result.path == str(Path(tmpdir) / ".faber" / "config.yaml")
            assert Path(tmpdir, ".faber", "config.yaml").exists()

    def test_init_config_fails_if_exists(self):
        """Test that init_config fails if config already exists."""
        with tempfile.TemporaryDirectory() as tmpdir:
            # Create config first time
            init_config(Path(tmpdir))

            # Try to create again without force
            result = init_config(Path(tmpdir))

            assert result.success is False
            assert "already exists" in result.error

    def test_init_config_force_overwrites(self):
        """Test that init_config with force=True overwrites existing config."""
        with tempfile.TemporaryDirectory() as tmpdir:
            # Create config first time
            init_config(Path(tmpdir))

            # Overwrite with force
            result = init_config(Path(tmpdir), force=True)

            assert result.success is True

    def test_load_config_returns_complete_dict(self):
        """Test that load_config returns all configuration fields."""
        with tempfile.TemporaryDirectory() as tmpdir:
            init_config(Path(tmpdir))

            config = load_config(Path(tmpdir) / ".faber" / "config.yaml")

            # Verify all required top-level keys
            assert "autonomy" in config
            assert "max_retries" in config
            assert "phases" in config
            assert "approval" in config
            assert "checkpoint" in config
            assert "cost" in config
            assert "langsmith_enabled" in config
            assert "langsmith_project" in config

            # Verify phase structure
            assert isinstance(config["phases"], dict)
            assert "frame" in config["phases"]
            assert "architect" in config["phases"]

    def test_load_config_raises_on_missing_file(self):
        """Test that load_config raises ConfigError for missing file."""
        with pytest.raises(ConfigError, match="Configuration not found"):
            load_config(Path("/nonexistent/path"))

    def test_validate_config_accepts_valid_config(self):
        """Test that validate_config accepts valid configuration."""
        config = {
            "workflow": {
                "autonomy": "assisted",
                "max_retries": 3,
            }
        }

        errors = validate_config(config)

        assert len(errors) == 0

    def test_validate_config_rejects_missing_workflow_section(self):
        """Test that validate_config rejects missing workflow section."""
        config = {}

        errors = validate_config(config)

        assert len(errors) > 0
        assert any("workflow" in err for err in errors)

    def test_validate_config_rejects_invalid_autonomy(self):
        """Test that validate_config rejects invalid autonomy level."""
        config = {
            "workflow": {
                "autonomy": "invalid",
            }
        }

        errors = validate_config(config)

        assert len(errors) > 0
        assert any("autonomy" in err for err in errors)

    def test_validate_config_rejects_negative_max_retries(self):
        """Test that validate_config rejects negative max_retries."""
        config = {
            "workflow": {
                "max_retries": -1,
            }
        }

        errors = validate_config(config)

        assert len(errors) > 0
        assert any("max_retries" in err for err in errors)


class TestWorkflowAPI:
    """Tests for workflow execution API."""

    def test_run_workflow_sync_validates_work_id(self):
        """Test that run_workflow_sync validates work_id."""
        with pytest.raises(ValueError, match="work_id cannot be empty"):
            run_workflow_sync("")

        with pytest.raises(ValueError, match="work_id cannot be empty"):
            run_workflow_sync("   ")

    def test_run_workflow_sync_validates_max_retries(self):
        """Test that run_workflow_sync validates max_retries."""
        options = WorkflowOptions(max_retries=-1)

        with pytest.raises(ValueError, match="max_retries must be non-negative"):
            run_workflow_sync("123", options)

    def test_run_workflow_sync_validates_budget_usd(self):
        """Test that run_workflow_sync validates budget_usd."""
        options = WorkflowOptions(budget_usd=0)

        with pytest.raises(ValueError, match="budget_usd must be positive"):
            run_workflow_sync("123", options)

        options = WorkflowOptions(budget_usd=-10)

        with pytest.raises(ValueError, match="budget_usd must be positive"):
            run_workflow_sync("123", options)

    def test_list_workflows_validates_limit(self):
        """Test that list_workflows validates limit parameter."""
        with pytest.raises(ValueError, match="limit must be positive"):
            list_workflows(limit=0)

        with pytest.raises(ValueError, match="limit must be positive"):
            list_workflows(limit=-1)

    def test_list_workflows_validates_status(self):
        """Test that list_workflows validates status parameter."""
        with pytest.raises(ValueError, match="Invalid status"):
            list_workflows(status="invalid")

    @patch("faber.primitives.logs.manager.LogManager")
    def test_list_workflows_returns_workflow_summaries(self, mock_log_manager):
        """Test that list_workflows returns list of WorkflowSummary."""
        # Mock the log manager
        mock_log = MagicMock()
        mock_log.workflow_id = "WF-123"
        mock_log.work_id = "123"
        mock_log.status = "completed"
        mock_log.started_at = "2025-01-01T00:00:00Z"
        mock_log.ended_at = "2025-01-01T00:10:00Z"
        mock_log.current_phase = "release"
        mock_log.entries = [1, 2, 3]

        mock_log_manager.return_value.list_workflow_logs.return_value = [mock_log]

        results = list_workflows(limit=10)

        assert len(results) == 1
        assert results[0].workflow_id == "WF-123"
        assert results[0].status == WorkflowStatus.COMPLETED
        assert results[0].entry_count == 3

    @patch("faber.primitives.logs.manager.LogManager")
    def test_view_workflow_returns_workflow_details(self, mock_log_manager):
        """Test that view_workflow returns workflow details."""
        # Mock the log manager
        mock_log = MagicMock()
        mock_log.workflow_id = "WF-123"
        mock_log.work_id = "123"
        mock_log.status = "completed"
        mock_log.started_at = "2025-01-01T00:00:00Z"
        mock_log.ended_at = "2025-01-01T00:10:00Z"
        mock_log.current_phase = "release"

        mock_entry = MagicMock()
        mock_entry.timestamp = "2025-01-01T00:00:00Z"
        mock_entry.level = "info"
        mock_entry.phase = "frame"
        mock_entry.message = "Starting workflow"
        mock_log.entries = [mock_entry]

        mock_log_manager.return_value.get_workflow_log.return_value = mock_log

        result = view_workflow("WF-123")

        assert result is not None
        assert result["workflow_id"] == "WF-123"
        assert result["status"] == "completed"
        assert len(result["entries"]) == 1

    @patch("faber.primitives.logs.manager.LogManager")
    def test_view_workflow_returns_none_for_missing_workflow(self, mock_log_manager):
        """Test that view_workflow returns None for missing workflow."""
        mock_log_manager.return_value.get_workflow_log.return_value = None

        result = view_workflow("WF-MISSING")

        assert result is None


class TestWorkflowOptions:
    """Tests for WorkflowOptions dataclass."""

    def test_default_values(self):
        """Test default WorkflowOptions values."""
        options = WorkflowOptions()

        assert options.workflow_path is None
        assert options.autonomy == AutonomyLevel.ASSISTED
        assert options.max_retries == 3
        assert options.skip_phases is None
        assert options.trace is True
        assert options.budget_usd is None

    def test_custom_values(self):
        """Test custom WorkflowOptions values."""
        options = WorkflowOptions(
            workflow_path="/path/to/workflow.yaml",
            autonomy=AutonomyLevel.AUTONOMOUS,
            max_retries=5,
            skip_phases=["evaluate"],
            trace=False,
            budget_usd=20.0,
        )

        assert options.workflow_path == "/path/to/workflow.yaml"
        assert options.autonomy == AutonomyLevel.AUTONOMOUS
        assert options.max_retries == 5
        assert options.skip_phases == ["evaluate"]
        assert options.trace is False
        assert options.budget_usd == 20.0


class TestWorkflowResult:
    """Tests for WorkflowResult dataclass."""

    def test_to_dict_converts_enum_to_string(self):
        """Test that to_dict converts status enum to string."""
        result = WorkflowResult(
            workflow_id="WF-123",
            work_id="123",
            status=WorkflowStatus.COMPLETED,
            completed_phases=["frame", "architect"],
        )

        result_dict = result.to_dict()

        assert result_dict["status"] == "completed"
        assert isinstance(result_dict["status"], str)
