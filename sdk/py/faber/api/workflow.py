"""Workflow execution API."""

import asyncio
import os
import uuid
from pathlib import Path
from typing import AsyncIterator, Optional

from faber.api.exceptions import WorkflowError
from faber.api.types import (
    AutonomyLevel,
    WorkflowOptions,
    WorkflowResult,
    WorkflowStatus,
    WorkflowSummary,
)


async def run_workflow(
    work_id: str,
    options: Optional[WorkflowOptions] = None,
) -> WorkflowResult:
    """Run FABER workflow for a work item (async).

    Args:
        work_id: Work item ID (e.g., "123", "PROJ-456")
        options: Workflow configuration options

    Returns:
        WorkflowResult with execution details

    Raises:
        WorkflowError: If workflow execution fails
        ValueError: If input parameters are invalid
    """
    # Validate inputs
    if not work_id or not work_id.strip():
        raise ValueError("work_id cannot be empty")

    if options is None:
        options = WorkflowOptions()

    if options.max_retries < 0:
        raise ValueError(f"max_retries must be non-negative, got {options.max_retries}")

    if options.budget_usd is not None and options.budget_usd <= 0:
        raise ValueError(f"budget_usd must be positive, got {options.budget_usd}")

    from faber.workflows.config import WorkflowConfig, load_workflow_config
    from faber.workflows.state import create_initial_state

    # Load config
    config = load_workflow_config()
    config.autonomy = options.autonomy.value
    config.max_retries = options.max_retries

    if options.budget_usd is not None:
        config.cost.budget_limit_usd = options.budget_usd

    # Setup tracing
    if options.trace:
        _setup_tracing(config.langsmith_project)

    # Skip phases if specified
    if options.skip_phases:
        for phase in options.skip_phases:
            if phase in config.phases:
                config.phases[phase].enabled = False

    try:
        if options.workflow_path:
            # Use custom YAML workflow
            result = await _run_custom_workflow(work_id, options.workflow_path, config)
        else:
            # Use default workflow
            from faber.workflows.graph import create_faber_workflow

            graph = create_faber_workflow(config)

            workflow_id = f"WF-{work_id}-{uuid.uuid4().hex[:8]}"
            initial_state = create_initial_state(
                workflow_id=workflow_id,
                work_id=work_id,
                budget_limit_usd=config.cost.budget_limit_usd,
            )

            run_config = {"configurable": {"thread_id": workflow_id}}
            result = await graph.ainvoke(initial_state, run_config)

        # Convert state dict to WorkflowResult
        return _state_to_result(result)

    except WorkflowError:
        # Re-raise WorkflowError from _run_custom_workflow
        raise
    except (ValueError, TypeError, RuntimeError) as e:
        # Catch expected workflow execution errors
        raise WorkflowError(
            message=str(e),
            workflow_id=None,
            phase=None,
        )
    except Exception as e:
        # Catch unexpected errors but let system exceptions propagate
        # Note: KeyboardInterrupt and SystemExit inherit from BaseException,
        # not Exception, so they will propagate automatically
        raise WorkflowError(
            message=f"Unexpected error during workflow execution: {e}",
            workflow_id=None,
            phase=None,
        )


def run_workflow_sync(
    work_id: str,
    options: Optional[WorkflowOptions] = None,
) -> WorkflowResult:
    """Run FABER workflow for a work item (sync wrapper).

    Args:
        work_id: Work item ID
        options: Workflow configuration options

    Returns:
        WorkflowResult with execution details

    Raises:
        WorkflowError: If workflow execution fails
    """
    return asyncio.run(run_workflow(work_id, options))


async def run_workflow_streaming(
    work_id: str,
    options: Optional[WorkflowOptions] = None,
) -> AsyncIterator[dict]:
    """Run workflow with streaming progress updates.

    Yields:
        Progress updates as dictionaries with:
        - type: "phase_start", "phase_end", "progress", "approval_required", "complete"
        - phase: Current phase name
        - message: Human-readable status
        - data: Additional context
    """
    # This would be implemented with LangGraph streaming
    # For now, raise NotImplementedError
    raise NotImplementedError("Streaming API not yet implemented")


def list_workflows(
    status: Optional[str] = None,
    limit: int = 20,
) -> list[WorkflowSummary]:
    """List workflow executions.

    Args:
        status: Filter by status ("running", "completed", "failed")
        limit: Maximum results

    Returns:
        List of workflow summaries

    Raises:
        ValueError: If input parameters are invalid
    """
    # Validate inputs
    if limit <= 0:
        raise ValueError(f"limit must be positive, got {limit}")

    if status is not None:
        valid_statuses = ["running", "completed", "failed"]
        if status not in valid_statuses:
            raise ValueError(
                f"Invalid status '{status}'. Must be one of: {', '.join(valid_statuses)}"
            )

    from faber.primitives.logs.manager import LogManager

    log_manager = LogManager()
    logs = log_manager.list_workflow_logs(status=status, limit=limit)

    return [
        WorkflowSummary(
            workflow_id=log.workflow_id,
            work_id=log.work_id,
            status=WorkflowStatus(log.status),  # Convert string to enum
            started_at=log.started_at,
            ended_at=log.ended_at,
            current_phase=log.current_phase,
            entry_count=len(log.entries),
        )
        for log in logs
    ]


def view_workflow(workflow_id: str) -> Optional[dict]:
    """Get detailed workflow execution info.

    Args:
        workflow_id: Workflow execution ID

    Returns:
        Workflow details or None if not found
    """
    from faber.primitives.logs.manager import LogManager

    log_manager = LogManager()
    log = log_manager.get_workflow_log(workflow_id)

    if not log:
        return None

    return {
        "workflow_id": log.workflow_id,
        "work_id": log.work_id,
        "status": log.status,
        "started_at": log.started_at,
        "ended_at": log.ended_at,
        "current_phase": log.current_phase,
        "entries": [
            {
                "timestamp": entry.timestamp,
                "level": entry.level,
                "phase": entry.phase,
                "message": entry.message,
            }
            for entry in log.entries
        ],
    }


def cancel_workflow(workflow_id: str) -> bool:
    """Cancel a running workflow.

    Args:
        workflow_id: Workflow execution ID

    Returns:
        True if cancelled, False if not found/already complete
    """
    # This would require checkpoint interruption support
    # For now, raise NotImplementedError
    raise NotImplementedError("Workflow cancellation not yet implemented")


# =========================================================================
# Helper functions
# =========================================================================


def _setup_tracing(project_name: str) -> None:
    """Setup LangSmith tracing."""
    if not os.getenv("LANGSMITH_API_KEY"):
        return

    os.environ["LANGCHAIN_TRACING_V2"] = "true"
    os.environ["LANGCHAIN_PROJECT"] = project_name


async def _run_custom_workflow(
    work_id: str,
    workflow_path: str,
    config: "WorkflowConfig",
) -> dict:
    """Run a custom YAML workflow."""
    from faber.accessibility.compiler import WorkflowCompiler
    from faber.accessibility.loader import WorkflowValidationError
    from faber.workflows.state import create_initial_state

    try:
        compiler = WorkflowCompiler(Path(workflow_path))
        graph = compiler.compile()

        workflow_id = f"WF-{work_id}-{uuid.uuid4().hex[:8]}"
        initial_state = create_initial_state(
            workflow_id=workflow_id,
            work_id=work_id,
            budget_limit_usd=config.cost.budget_limit_usd,
        )

        run_config = {"configurable": {"thread_id": workflow_id}}
        result = await graph.ainvoke(initial_state, run_config)
        return result

    except WorkflowValidationError as e:
        raise WorkflowError(f"Workflow validation failed: {e}")
    except FileNotFoundError as e:
        raise WorkflowError(f"Workflow file not found: {e}")


def _state_to_result(state: dict) -> WorkflowResult:
    """Convert workflow state dict to WorkflowResult."""
    has_error = state.get("error") is not None

    return WorkflowResult(
        workflow_id=state.get("workflow_id", ""),
        work_id=state.get("work_id", ""),
        status=WorkflowStatus.FAILED if has_error else WorkflowStatus.COMPLETED,
        completed_phases=state.get("completed_phases", []),
        pr_url=state.get("pr_url"),
        spec_path=state.get("spec_path"),
        branch_name=state.get("branch_name"),
        error=state.get("error"),
        error_phase=state.get("error_phase"),
        retry_count=state.get("retry_count", 0),
        evaluation_result=state.get("evaluation_result"),
    )
