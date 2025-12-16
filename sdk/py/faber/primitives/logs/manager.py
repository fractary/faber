"""
LogManager - Framework-agnostic workflow logging.

Provides structured logging for FABER workflows with support for
multiple output formats and destinations.
"""

from __future__ import annotations

import json
import os
from dataclasses import asdict, dataclass, field
from datetime import datetime
from enum import Enum
from pathlib import Path
from typing import Any, Optional


class LogLevel(Enum):
    """Log levels for FABER workflows."""

    DEBUG = "debug"
    INFO = "info"
    WARNING = "warning"
    ERROR = "error"
    CRITICAL = "critical"


class FaberPhase(Enum):
    """FABER workflow phases."""

    FRAME = "frame"
    ARCHITECT = "architect"
    BUILD = "build"
    EVALUATE = "evaluate"
    RELEASE = "release"
    UNKNOWN = "unknown"


@dataclass
class LogEntry:
    """A single log entry."""

    timestamp: str
    level: str
    phase: str
    message: str
    workflow_id: Optional[str] = None
    work_id: Optional[str] = None
    agent: Optional[str] = None
    tool: Optional[str] = None
    duration_ms: Optional[int] = None
    metadata: dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> dict[str, Any]:
        """Convert to dictionary."""
        return {k: v for k, v in asdict(self).items() if v is not None}

    def to_json(self) -> str:
        """Convert to JSON string."""
        return json.dumps(self.to_dict())

    def to_human(self) -> str:
        """Convert to human-readable string."""
        parts = [
            f"[{self.timestamp}]",
            f"[{self.level.upper()}]",
            f"[{self.phase}]",
        ]
        if self.agent:
            parts.append(f"[{self.agent}]")
        if self.tool:
            parts.append(f"[tool:{self.tool}]")
        parts.append(self.message)
        if self.duration_ms:
            parts.append(f"({self.duration_ms}ms)")
        return " ".join(parts)


@dataclass
class WorkflowLog:
    """Complete log for a workflow execution."""

    workflow_id: str
    work_id: Optional[str]
    started_at: str
    ended_at: Optional[str] = None
    status: str = "running"  # running | completed | failed | cancelled
    current_phase: str = "unknown"
    entries: list[LogEntry] = field(default_factory=list)
    summary: dict[str, Any] = field(default_factory=dict)

    def add_entry(self, entry: LogEntry) -> None:
        """Add a log entry."""
        self.entries.append(entry)

    def to_dict(self) -> dict[str, Any]:
        """Convert to dictionary."""
        return {
            "workflow_id": self.workflow_id,
            "work_id": self.work_id,
            "started_at": self.started_at,
            "ended_at": self.ended_at,
            "status": self.status,
            "current_phase": self.current_phase,
            "entries": [e.to_dict() for e in self.entries],
            "summary": self.summary,
        }


class LogManager:
    """Framework-agnostic workflow logging.

    Provides structured logging for FABER workflows without
    any LangChain dependencies.
    """

    def __init__(self, config: Optional[dict[str, Any]] = None) -> None:
        """Initialize LogManager with optional config."""
        self.config = config or self._load_config()
        self.logs_dir = Path(self.config.get("logs_dir", ".faber/logs"))
        self.logs_dir.mkdir(parents=True, exist_ok=True)

        self._current_workflow: Optional[WorkflowLog] = None
        self._phase_start_times: dict[str, datetime] = {}

    def _load_config(self) -> dict[str, Any]:
        """Load configuration."""
        return {
            "logs_dir": os.getenv("FABER_LOGS_DIR", ".faber/logs"),
            "log_level": os.getenv("FABER_LOG_LEVEL", "info"),
            "format": os.getenv("FABER_LOG_FORMAT", "json"),  # json | human
            "retention_days": int(os.getenv("FABER_LOG_RETENTION_DAYS", "30")),
        }

    def _get_timestamp(self) -> str:
        """Get current timestamp in ISO format."""
        return datetime.now().isoformat()

    def _should_log(self, level: LogLevel) -> bool:
        """Check if we should log at this level."""
        levels = ["debug", "info", "warning", "error", "critical"]
        config_level = self.config.get("log_level", "info")
        return levels.index(level.value) >= levels.index(config_level)

    # =========================================================================
    # Workflow Lifecycle
    # =========================================================================

    def start_workflow(
        self,
        workflow_id: str,
        work_id: Optional[str] = None,
    ) -> WorkflowLog:
        """Start logging a new workflow.

        Args:
            workflow_id: Unique workflow identifier
            work_id: Associated work item ID

        Returns:
            WorkflowLog object
        """
        self._current_workflow = WorkflowLog(
            workflow_id=workflow_id,
            work_id=work_id,
            started_at=self._get_timestamp(),
        )

        self.log(
            LogLevel.INFO,
            FaberPhase.UNKNOWN,
            f"Workflow started: {workflow_id}",
            metadata={"work_id": work_id},
        )

        return self._current_workflow

    def end_workflow(
        self,
        status: str = "completed",
        summary: Optional[dict[str, Any]] = None,
    ) -> Optional[WorkflowLog]:
        """End the current workflow.

        Args:
            status: Final status (completed, failed, cancelled)
            summary: Optional summary data

        Returns:
            Completed WorkflowLog object
        """
        if not self._current_workflow:
            return None

        self._current_workflow.ended_at = self._get_timestamp()
        self._current_workflow.status = status
        self._current_workflow.summary = summary or {}

        self.log(
            LogLevel.INFO,
            FaberPhase.UNKNOWN,
            f"Workflow {status}: {self._current_workflow.workflow_id}",
            metadata=summary,
        )

        # Save workflow log
        self._save_workflow_log(self._current_workflow)

        workflow = self._current_workflow
        self._current_workflow = None
        return workflow

    def _save_workflow_log(self, workflow: WorkflowLog) -> None:
        """Save workflow log to file."""
        log_file = self.logs_dir / f"{workflow.workflow_id}.json"
        with open(log_file, "w") as f:
            json.dump(workflow.to_dict(), f, indent=2)

    # =========================================================================
    # Phase Tracking
    # =========================================================================

    def start_phase(self, phase: FaberPhase) -> None:
        """Mark the start of a FABER phase.

        Args:
            phase: The phase starting
        """
        self._phase_start_times[phase.value] = datetime.now()

        if self._current_workflow:
            self._current_workflow.current_phase = phase.value

        self.log(
            LogLevel.INFO,
            phase,
            f"Phase started: {phase.value}",
        )

    def end_phase(
        self,
        phase: FaberPhase,
        status: str = "completed",
        result: Optional[dict[str, Any]] = None,
    ) -> Optional[int]:
        """Mark the end of a FABER phase.

        Args:
            phase: The phase ending
            status: Phase status (completed, failed, skipped)
            result: Optional result data

        Returns:
            Duration in milliseconds
        """
        duration_ms = None
        if phase.value in self._phase_start_times:
            start = self._phase_start_times.pop(phase.value)
            duration_ms = int((datetime.now() - start).total_seconds() * 1000)

        self.log(
            LogLevel.INFO,
            phase,
            f"Phase {status}: {phase.value}",
            duration_ms=duration_ms,
            metadata=result,
        )

        return duration_ms

    # =========================================================================
    # Logging Methods
    # =========================================================================

    def log(
        self,
        level: LogLevel,
        phase: FaberPhase,
        message: str,
        agent: Optional[str] = None,
        tool: Optional[str] = None,
        duration_ms: Optional[int] = None,
        metadata: Optional[dict[str, Any]] = None,
    ) -> Optional[LogEntry]:
        """Log a message.

        Args:
            level: Log level
            phase: FABER phase
            message: Log message
            agent: Agent name (if applicable)
            tool: Tool name (if applicable)
            duration_ms: Duration in milliseconds
            metadata: Additional metadata

        Returns:
            LogEntry if logged, None if filtered
        """
        if not self._should_log(level):
            return None

        entry = LogEntry(
            timestamp=self._get_timestamp(),
            level=level.value,
            phase=phase.value,
            message=message,
            workflow_id=self._current_workflow.workflow_id if self._current_workflow else None,
            work_id=self._current_workflow.work_id if self._current_workflow else None,
            agent=agent,
            tool=tool,
            duration_ms=duration_ms,
            metadata=metadata or {},
        )

        if self._current_workflow:
            self._current_workflow.add_entry(entry)

        # Output based on format
        output_format = self.config.get("format", "json")
        if output_format == "json":
            print(entry.to_json())
        else:
            print(entry.to_human())

        return entry

    def debug(self, phase: FaberPhase, message: str, **kwargs: Any) -> Optional[LogEntry]:
        """Log debug message."""
        return self.log(LogLevel.DEBUG, phase, message, **kwargs)

    def info(self, phase: FaberPhase, message: str, **kwargs: Any) -> Optional[LogEntry]:
        """Log info message."""
        return self.log(LogLevel.INFO, phase, message, **kwargs)

    def warning(self, phase: FaberPhase, message: str, **kwargs: Any) -> Optional[LogEntry]:
        """Log warning message."""
        return self.log(LogLevel.WARNING, phase, message, **kwargs)

    def error(self, phase: FaberPhase, message: str, **kwargs: Any) -> Optional[LogEntry]:
        """Log error message."""
        return self.log(LogLevel.ERROR, phase, message, **kwargs)

    def critical(self, phase: FaberPhase, message: str, **kwargs: Any) -> Optional[LogEntry]:
        """Log critical message."""
        return self.log(LogLevel.CRITICAL, phase, message, **kwargs)

    # =========================================================================
    # Tool/Agent Logging
    # =========================================================================

    def log_tool_call(
        self,
        phase: FaberPhase,
        tool_name: str,
        input_data: dict[str, Any],
        output_data: Optional[dict[str, Any]] = None,
        duration_ms: Optional[int] = None,
        error: Optional[str] = None,
    ) -> LogEntry:
        """Log a tool invocation.

        Args:
            phase: FABER phase
            tool_name: Name of the tool
            input_data: Tool input
            output_data: Tool output (if successful)
            duration_ms: Duration in milliseconds
            error: Error message (if failed)

        Returns:
            LogEntry
        """
        level = LogLevel.ERROR if error else LogLevel.DEBUG
        message = f"Tool {'failed' if error else 'called'}: {tool_name}"

        metadata = {"input": input_data}
        if output_data:
            metadata["output"] = output_data
        if error:
            metadata["error"] = error

        return self.log(
            level,
            phase,
            message,
            tool=tool_name,
            duration_ms=duration_ms,
            metadata=metadata,
        )

    def log_agent_action(
        self,
        phase: FaberPhase,
        agent_name: str,
        action: str,
        details: Optional[dict[str, Any]] = None,
    ) -> LogEntry:
        """Log an agent action.

        Args:
            phase: FABER phase
            agent_name: Name of the agent
            action: Action taken
            details: Additional details

        Returns:
            LogEntry
        """
        return self.log(
            LogLevel.INFO,
            phase,
            f"Agent action: {action}",
            agent=agent_name,
            metadata=details,
        )

    # =========================================================================
    # Query Methods
    # =========================================================================

    def get_workflow_log(self, workflow_id: str) -> Optional[WorkflowLog]:
        """Get a workflow log by ID.

        Args:
            workflow_id: Workflow identifier

        Returns:
            WorkflowLog if found
        """
        log_file = self.logs_dir / f"{workflow_id}.json"
        if not log_file.exists():
            return None

        with open(log_file) as f:
            data = json.load(f)

        return WorkflowLog(
            workflow_id=data["workflow_id"],
            work_id=data.get("work_id"),
            started_at=data["started_at"],
            ended_at=data.get("ended_at"),
            status=data.get("status", "unknown"),
            current_phase=data.get("current_phase", "unknown"),
            entries=[LogEntry(**e) for e in data.get("entries", [])],
            summary=data.get("summary", {}),
        )

    def list_workflow_logs(
        self,
        status: Optional[str] = None,
        work_id: Optional[str] = None,
        limit: int = 50,
    ) -> list[WorkflowLog]:
        """List workflow logs.

        Args:
            status: Filter by status
            work_id: Filter by work ID
            limit: Maximum results

        Returns:
            List of WorkflowLog objects
        """
        logs = []
        for log_file in sorted(self.logs_dir.glob("*.json"), reverse=True)[:limit]:
            try:
                workflow = self.get_workflow_log(log_file.stem)
                if workflow:
                    if status and workflow.status != status:
                        continue
                    if work_id and workflow.work_id != work_id:
                        continue
                    logs.append(workflow)
            except Exception:
                continue

        return logs
