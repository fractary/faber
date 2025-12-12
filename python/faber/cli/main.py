"""
FABER CLI - Main entry point.

Usage:
    faber run <work_id> [options]
    faber workflow list
    faber init
"""

from __future__ import annotations

import asyncio
from enum import Enum
from typing import Optional

import typer
from rich.console import Console
from rich.panel import Panel
from rich.progress import Progress, SpinnerColumn, TextColumn
from rich.table import Table

app = typer.Typer(
    name="faber",
    help="FABER - AI-assisted development workflows powered by LangGraph",
    no_args_is_help=True,
)

console = Console()


class Autonomy(str, Enum):
    """Autonomy levels for workflow execution."""

    ASSISTED = "assisted"
    GUARDED = "guarded"
    AUTONOMOUS = "autonomous"


@app.command()
def run(
    work_id: str = typer.Argument(..., help="Work item ID to process (e.g., 123, PROJ-456)"),
    autonomy: Autonomy = typer.Option(
        Autonomy.ASSISTED,
        "--autonomy", "-a",
        help="Autonomy level: assisted (pause for approval), guarded (warn only), autonomous (no stops)"
    ),
    max_retries: int = typer.Option(
        3,
        "--max-retries", "-r",
        help="Maximum retry attempts for Build→Evaluate cycle"
    ),
    skip_phase: Optional[list[str]] = typer.Option(
        None,
        "--skip-phase", "-s",
        help="Phases to skip (can be repeated)"
    ),
    trace: bool = typer.Option(
        True,
        "--trace/--no-trace",
        help="Enable LangSmith tracing"
    ),
    budget: Optional[float] = typer.Option(
        None,
        "--budget", "-b",
        help="Budget limit in USD (default: from config or 10.0)"
    ),
) -> None:
    """Run the FABER workflow for a work item.

    The FABER workflow consists of 5 phases:
    1. Frame - Gather requirements and classify work type
    2. Architect - Create detailed specification
    3. Build - Implement the solution
    4. Evaluate - Validate against spec (may retry Build)
    5. Release - Create PR and deliver

    Example:
        faber run 123 --autonomy assisted
        faber run PROJ-456 --max-retries 5 --no-trace
    """
    from faber.workflows.config import WorkflowConfig, load_workflow_config
    from faber.workflows.graph import run_faber_workflow_sync

    # Load and modify config
    config = load_workflow_config()
    config.autonomy = autonomy.value
    config.max_retries = max_retries

    if budget is not None:
        config.cost.budget_limit_usd = budget

    # Skip phases if specified
    if skip_phase:
        for phase in skip_phase:
            if phase in config.phases:
                config.phases[phase].enabled = False

    # Setup tracing
    if trace:
        _setup_tracing(config.langsmith_project)

    # Show startup info
    console.print(Panel(
        f"[bold]Work ID:[/bold] {work_id}\n"
        f"[bold]Autonomy:[/bold] {autonomy.value}\n"
        f"[bold]Max Retries:[/bold] {max_retries}\n"
        f"[bold]Budget:[/bold] ${config.cost.budget_limit_usd:.2f}\n"
        f"[bold]Tracing:[/bold] {'Enabled' if trace else 'Disabled'}",
        title="[bold green]🚀 FABER Workflow Starting[/bold green]",
        border_style="green",
    ))

    # Run workflow with progress
    with Progress(
        SpinnerColumn(),
        TextColumn("[progress.description]{task.description}"),
        console=console,
    ) as progress:
        task = progress.add_task("Running FABER workflow...", total=None)

        try:
            result = run_faber_workflow_sync(work_id, config)

            progress.update(task, description="Workflow complete!")

            # Show results
            _show_results(result)

        except KeyboardInterrupt:
            console.print("\n[yellow]Workflow cancelled by user[/yellow]")
            raise typer.Exit(1)
        except Exception as e:
            console.print(f"\n[red]Error: {e}[/red]")
            raise typer.Exit(1)


@app.command()
def init(
    force: bool = typer.Option(
        False,
        "--force", "-f",
        help="Overwrite existing configuration"
    ),
) -> None:
    """Initialize FABER configuration in the current directory.

    Creates .faber/config.yaml with default settings.
    """
    from pathlib import Path

    import yaml

    config_dir = Path.cwd() / ".faber"
    config_file = config_dir / "config.yaml"

    if config_file.exists() and not force:
        console.print(
            f"[yellow]Configuration already exists at {config_file}[/yellow]\n"
            "Use --force to overwrite."
        )
        raise typer.Exit(1)

    config_dir.mkdir(parents=True, exist_ok=True)

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

    with open(config_file, "w") as f:
        yaml.dump(default_config, f, default_flow_style=False, sort_keys=False)

    console.print(f"[green]✓ Created configuration at {config_file}[/green]")
    console.print("\nEdit this file to customize your FABER workflow settings.")


@app.command()
def version() -> None:
    """Show FABER version information."""
    from faber import __version__

    console.print(f"FABER version {__version__}")


# =========================================================================
# Workflow subcommands
# =========================================================================

workflow_app = typer.Typer(help="Workflow management commands")
app.add_typer(workflow_app, name="workflow")


@workflow_app.command("list")
def workflow_list(
    status: Optional[str] = typer.Option(
        None,
        "--status", "-s",
        help="Filter by status (running, completed, failed)"
    ),
    limit: int = typer.Option(
        20,
        "--limit", "-l",
        help="Maximum results"
    ),
) -> None:
    """List workflow executions."""
    from faber.primitives.logs.manager import LogManager

    log_manager = LogManager()
    logs = log_manager.list_workflow_logs(status=status, limit=limit)

    if not logs:
        console.print("[dim]No workflow logs found[/dim]")
        return

    table = Table(title="FABER Workflow Logs")
    table.add_column("Workflow ID", style="cyan")
    table.add_column("Work ID")
    table.add_column("Status")
    table.add_column("Started")
    table.add_column("Entries")

    for log in logs:
        status_style = {
            "completed": "green",
            "failed": "red",
            "running": "yellow",
            "cancelled": "dim",
        }.get(log.status, "white")

        table.add_row(
            log.workflow_id,
            log.work_id or "-",
            f"[{status_style}]{log.status}[/{status_style}]",
            log.started_at[:19] if log.started_at else "-",
            str(len(log.entries)),
        )

    console.print(table)


@workflow_app.command("view")
def workflow_view(
    workflow_id: str = typer.Argument(..., help="Workflow ID to view"),
) -> None:
    """View details of a workflow execution."""
    from faber.primitives.logs.manager import LogManager

    log_manager = LogManager()
    log = log_manager.get_workflow_log(workflow_id)

    if not log:
        console.print(f"[red]Workflow not found: {workflow_id}[/red]")
        raise typer.Exit(1)

    # Summary panel
    console.print(Panel(
        f"[bold]Workflow ID:[/bold] {log.workflow_id}\n"
        f"[bold]Work ID:[/bold] {log.work_id or 'N/A'}\n"
        f"[bold]Status:[/bold] {log.status}\n"
        f"[bold]Started:[/bold] {log.started_at}\n"
        f"[bold]Ended:[/bold] {log.ended_at or 'Running'}\n"
        f"[bold]Phase:[/bold] {log.current_phase}",
        title=f"[bold]Workflow: {workflow_id}[/bold]",
    ))

    # Entries table
    if log.entries:
        table = Table(title="Log Entries")
        table.add_column("Time", style="dim")
        table.add_column("Level")
        table.add_column("Phase")
        table.add_column("Message")

        for entry in log.entries[-20:]:  # Last 20 entries
            level_style = {
                "error": "red",
                "warning": "yellow",
                "info": "green",
                "debug": "dim",
            }.get(entry.level, "white")

            table.add_row(
                entry.timestamp[11:19],
                f"[{level_style}]{entry.level}[/{level_style}]",
                entry.phase,
                entry.message[:60] + "..." if len(entry.message) > 60 else entry.message,
            )

        console.print(table)


# =========================================================================
# Helper functions
# =========================================================================

def _setup_tracing(project_name: str) -> None:
    """Setup LangSmith tracing."""
    import os

    if not os.getenv("LANGSMITH_API_KEY"):
        console.print("[dim]LANGSMITH_API_KEY not set. Tracing disabled.[/dim]")
        return

    os.environ["LANGCHAIN_TRACING_V2"] = "true"
    os.environ["LANGCHAIN_PROJECT"] = project_name


def _show_results(state: dict) -> None:
    """Show workflow results."""
    # Determine overall status
    has_error = state.get("error") is not None
    status_text = "[red]Failed[/red]" if has_error else "[green]Completed[/green]"

    # Build summary
    summary = f"""[bold]Status:[/bold] {status_text}
[bold]Workflow ID:[/bold] {state.get('workflow_id', 'N/A')}
[bold]Work ID:[/bold] {state.get('work_id', 'N/A')}
[bold]Phases Completed:[/bold] {', '.join(state.get('completed_phases', []))}
"""

    if state.get("evaluation_result"):
        summary += f"[bold]Evaluation:[/bold] {state['evaluation_result']}\n"

    if state.get("retry_count", 0) > 0:
        summary += f"[bold]Retries:[/bold] {state['retry_count']}\n"

    if state.get("pr_url"):
        summary += f"[bold]PR URL:[/bold] {state['pr_url']}\n"

    if state.get("spec_path"):
        summary += f"[bold]Spec:[/bold] {state['spec_path']}\n"

    if state.get("branch_name"):
        summary += f"[bold]Branch:[/bold] {state['branch_name']}\n"

    if has_error:
        summary += f"\n[red]Error ({state.get('error_phase', 'unknown')}):[/red] {state['error']}"

    console.print(Panel(
        summary,
        title="[bold]FABER Workflow Results[/bold]",
        border_style="green" if not has_error else "red",
    ))


if __name__ == "__main__":
    app()
