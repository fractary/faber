"""
LangChain @tool wrappers for LogManager.

These tools provide LangChain-compatible interfaces to workflow
logging without containing business logic.
"""

from __future__ import annotations

from typing import Any, Optional

from langchain_core.tools import tool

from faber.primitives.logs.manager import FaberPhase, LogLevel, LogManager

# Singleton instance - lazy loaded
_log_manager: Optional[LogManager] = None


def get_log_manager() -> LogManager:
    """Get or create LogManager singleton."""
    global _log_manager
    if _log_manager is None:
        _log_manager = LogManager()
    return _log_manager


def _parse_phase(phase: str) -> FaberPhase:
    """Parse phase string to enum."""
    try:
        return FaberPhase(phase.lower())
    except ValueError:
        return FaberPhase.UNKNOWN


@tool
def log_info(
    phase: str,
    message: str,
    agent: Optional[str] = None,
    metadata: Optional[dict[str, Any]] = None,
) -> dict[str, Any]:
    """Log an informational message.

    Use this tool to log progress, status updates, and other informational messages
    during workflow execution.

    Args:
        phase: FABER phase - "frame", "architect", "build", "evaluate", or "release"
        message: Log message
        agent: Optional agent name
        metadata: Optional additional metadata

    Returns:
        Log entry details including timestamp and message.
    """
    entry = get_log_manager().info(
        _parse_phase(phase),
        message,
        agent=agent,
        metadata=metadata,
    )
    return entry.to_dict() if entry else {"logged": False, "reason": "filtered by log level"}


@tool
def log_error(
    phase: str,
    message: str,
    agent: Optional[str] = None,
    error_details: Optional[dict[str, Any]] = None,
) -> dict[str, Any]:
    """Log an error message.

    Use this tool to log errors encountered during workflow execution.

    Args:
        phase: FABER phase - "frame", "architect", "build", "evaluate", or "release"
        message: Error message
        agent: Optional agent name
        error_details: Optional error details (exception info, stack trace, etc.)

    Returns:
        Log entry details including timestamp and message.
    """
    metadata = error_details or {}
    entry = get_log_manager().error(
        _parse_phase(phase),
        message,
        agent=agent,
        metadata=metadata,
    )
    return entry.to_dict() if entry else {"logged": False, "reason": "filtered by log level"}


@tool
def log_warning(
    phase: str,
    message: str,
    agent: Optional[str] = None,
    metadata: Optional[dict[str, Any]] = None,
) -> dict[str, Any]:
    """Log a warning message.

    Use this tool to log warnings about potential issues or non-critical problems.

    Args:
        phase: FABER phase - "frame", "architect", "build", "evaluate", or "release"
        message: Warning message
        agent: Optional agent name
        metadata: Optional additional metadata

    Returns:
        Log entry details including timestamp and message.
    """
    entry = get_log_manager().warning(
        _parse_phase(phase),
        message,
        agent=agent,
        metadata=metadata,
    )
    return entry.to_dict() if entry else {"logged": False, "reason": "filtered by log level"}


@tool
def log_phase_start(phase: str) -> dict[str, Any]:
    """Mark the start of a FABER phase.

    Use this tool when beginning a new phase of the FABER workflow.
    This starts timing and updates the workflow state.

    Args:
        phase: FABER phase starting - "frame", "architect", "build", "evaluate", or "release"

    Returns:
        Confirmation with phase and timestamp.
    """
    faber_phase = _parse_phase(phase)
    get_log_manager().start_phase(faber_phase)
    return {
        "phase": phase,
        "status": "started",
        "timestamp": get_log_manager()._get_timestamp(),
    }


@tool
def log_phase_end(
    phase: str,
    status: str = "completed",
    result: Optional[dict[str, Any]] = None,
) -> dict[str, Any]:
    """Mark the end of a FABER phase.

    Use this tool when completing a phase of the FABER workflow.
    This records timing and optional results.

    Args:
        phase: FABER phase ending - "frame", "architect", "build", "evaluate", or "release"
        status: Phase completion status - "completed", "failed", or "skipped"
        result: Optional result data from the phase

    Returns:
        Confirmation with phase, status, and duration.
    """
    faber_phase = _parse_phase(phase)
    duration_ms = get_log_manager().end_phase(faber_phase, status, result)
    return {
        "phase": phase,
        "status": status,
        "duration_ms": duration_ms,
        "timestamp": get_log_manager()._get_timestamp(),
    }


@tool
def log_tool_usage(
    phase: str,
    tool_name: str,
    input_data: dict[str, Any],
    output_data: Optional[dict[str, Any]] = None,
    duration_ms: Optional[int] = None,
    error: Optional[str] = None,
) -> dict[str, Any]:
    """Log a tool invocation.

    Use this tool to record tool usage during workflow execution.
    Useful for debugging and observability.

    Args:
        phase: FABER phase - "frame", "architect", "build", "evaluate", or "release"
        tool_name: Name of the tool that was called
        input_data: Input parameters passed to the tool
        output_data: Output returned by the tool (if successful)
        duration_ms: How long the tool call took in milliseconds
        error: Error message if the tool failed

    Returns:
        Log entry details.
    """
    entry = get_log_manager().log_tool_call(
        _parse_phase(phase),
        tool_name,
        input_data,
        output_data,
        duration_ms,
        error,
    )
    return entry.to_dict() if entry else {"logged": False}


@tool
def get_workflow_log(workflow_id: str) -> dict[str, Any]:
    """Get a workflow log by ID.

    Use this tool to retrieve the complete log for a workflow execution.

    Args:
        workflow_id: Workflow identifier

    Returns:
        Complete workflow log with entries and summary.
    """
    log = get_log_manager().get_workflow_log(workflow_id)
    if log:
        return log.to_dict()
    return {"error": f"Workflow log not found: {workflow_id}"}


@tool
def list_workflow_logs(
    status: Optional[str] = None,
    work_id: Optional[str] = None,
    limit: int = 20,
) -> list[dict[str, Any]]:
    """List workflow logs.

    Use this tool to find workflow logs with optional filtering.

    Args:
        status: Filter by status - "running", "completed", "failed", "cancelled"
        work_id: Filter by work item ID
        limit: Maximum results (default: 20)

    Returns:
        List of workflow logs with summary information.
    """
    logs = get_log_manager().list_workflow_logs(status, work_id, limit)
    return [
        {
            "workflow_id": log.workflow_id,
            "work_id": log.work_id,
            "status": log.status,
            "started_at": log.started_at,
            "ended_at": log.ended_at,
            "entry_count": len(log.entries),
        }
        for log in logs
    ]


# Export all log tools
LOG_TOOLS = [
    log_info,
    log_error,
    log_warning,
    log_phase_start,
    log_phase_end,
    log_tool_usage,
    get_workflow_log,
    list_workflow_logs,
]
