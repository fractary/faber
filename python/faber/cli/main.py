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
from pathlib import Path
from typing import Optional

import typer
from rich.console import Console
from rich.panel import Panel
from rich.progress import Progress, SpinnerColumn, TextColumn
from rich.table import Table

from faber.cli.deprecation import show_deprecation_warning

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
    workflow: Optional[Path] = typer.Option(
        None,
        "--workflow", "-w",
        help="Path to custom workflow YAML file",
        exists=True,
        dir_okay=False,
        resolve_path=True,
    ),
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

    Use --workflow to run a custom YAML workflow definition:
        faber run 123 --workflow .faber/workflows/custom.yaml

    Example:
        faber run 123 --autonomy assisted
        faber run PROJ-456 --max-retries 5 --no-trace
        faber run 123 --workflow my-workflow.yaml
    """
    show_deprecation_warning()

    from faber.api import (
        WorkflowError,
        WorkflowOptions,
        run_workflow_sync,
    )
    from faber.api.types import AutonomyLevel as ApiAutonomyLevel

    # Convert CLI autonomy to API type
    api_autonomy = ApiAutonomyLevel(autonomy.value)

    # Build options
    options = WorkflowOptions(
        workflow_path=str(workflow) if workflow else None,
        autonomy=api_autonomy,
        max_retries=max_retries,
        skip_phases=skip_phase or [],
        trace=trace,
        budget_usd=budget,
    )

    # Determine workflow source for display
    workflow_source = str(workflow) if workflow else "default"

    # Show startup info
    console.print(
        Panel(
            f"[bold]Work ID:[/bold] {work_id}\n"
            f"[bold]Workflow:[/bold] {workflow_source}\n"
            f"[bold]Autonomy:[/bold] {autonomy.value}\n"
            f"[bold]Max Retries:[/bold] {max_retries}\n"
            f"[bold]Budget:[/bold] ${budget if budget else 10.0:.2f}\n"
            f"[bold]Tracing:[/bold] {'Enabled' if trace else 'Disabled'}",
            title="[bold green]🚀 FABER Workflow Starting[/bold green]",
            border_style="green",
        )
    )

    # Run workflow with progress
    with Progress(
        SpinnerColumn(),
        TextColumn("[progress.description]{task.description}"),
        console=console,
    ) as progress:
        task = progress.add_task("Running FABER workflow...", total=None)

        try:
            result = run_workflow_sync(work_id, options)

            progress.update(task, description="Workflow complete!")

            # Show results
            _show_results_from_api(result)

        except KeyboardInterrupt:
            console.print("\n[yellow]Workflow cancelled by user[/yellow]")
            raise typer.Exit(1)
        except WorkflowError as e:
            console.print(f"\n[red]Error: {e.message}[/red]")
            raise typer.Exit(1)
        except Exception as e:
            console.print(f"\n[red]Error: {e}[/red]")
            raise typer.Exit(1)


def _run_custom_workflow(
    work_id: str,
    workflow_path: Path,
    config: "WorkflowConfig",
) -> dict:
    """Run a custom YAML workflow.

    Args:
        work_id: Work item ID
        workflow_path: Path to workflow YAML file
        config: Workflow configuration

    Returns:
        Final workflow state
    """
    import asyncio
    import uuid

    from faber.accessibility.compiler import WorkflowCompiler
    from faber.accessibility.loader import WorkflowValidationError
    from faber.workflows.state import create_initial_state

    try:
        # Compile the workflow
        console.print(f"[dim]Loading workflow from {workflow_path}...[/dim]")
        compiler = WorkflowCompiler(workflow_path)
        graph = compiler.compile()

        console.print(f"[dim]Workflow '{compiler.schema.name}' loaded with "
                     f"{len(compiler.schema.phases)} phases[/dim]")

        # Create initial state
        workflow_id = f"WF-{work_id}-{uuid.uuid4().hex[:8]}"
        initial_state = create_initial_state(
            workflow_id=workflow_id,
            work_id=work_id,
            budget_limit_usd=config.cost.budget_limit_usd,
        )

        # Run with thread_id for checkpointing
        run_config = {"configurable": {"thread_id": workflow_id}}

        # Execute
        result = asyncio.run(graph.ainvoke(initial_state, run_config))
        return result

    except WorkflowValidationError as e:
        console.print(f"[red]Workflow validation failed:[/red]\n{e}")
        raise typer.Exit(1)
    except FileNotFoundError as e:
        console.print(f"[red]Workflow file not found: {e}[/red]")
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
    show_deprecation_warning()

    from faber.api import init_config

    result = init_config(force=force)

    if result.success:
        console.print(f"[green]✓ {result.message}[/green]")
        console.print("\nEdit this file to customize your FABER workflow settings.")
    else:
        console.print(f"[yellow]{result.error}[/yellow]")
        if not force:
            console.print("Use --force to overwrite.")
        raise typer.Exit(1)


@app.command()
def version() -> None:
    """Show FABER version information."""
    show_deprecation_warning()

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
    show_deprecation_warning()

    from faber.api import list_workflows

    workflows = list_workflows(status=status, limit=limit)

    if not workflows:
        console.print("[dim]No workflow logs found[/dim]")
        return

    table = Table(title="FABER Workflow Logs")
    table.add_column("Workflow ID", style="cyan")
    table.add_column("Work ID")
    table.add_column("Status")
    table.add_column("Started")
    table.add_column("Entries")

    for wf in workflows:
        status_style = {
            "completed": "green",
            "failed": "red",
            "running": "yellow",
            "cancelled": "dim",
        }.get(wf.status, "white")

        table.add_row(
            wf.workflow_id,
            wf.work_id or "-",
            f"[{status_style}]{wf.status}[/{status_style}]",
            wf.started_at[:19] if wf.started_at else "-",
            str(wf.entry_count),
        )

    console.print(table)


@workflow_app.command("view")
def workflow_view(
    workflow_id: str = typer.Argument(..., help="Workflow ID to view"),
) -> None:
    """View details of a workflow execution."""
    show_deprecation_warning()

    from faber.api import view_workflow

    workflow = view_workflow(workflow_id)

    if not workflow:
        console.print(f"[red]Workflow not found: {workflow_id}[/red]")
        raise typer.Exit(1)

    # Summary panel
    console.print(
        Panel(
            f"[bold]Workflow ID:[/bold] {workflow['workflow_id']}\n"
            f"[bold]Work ID:[/bold] {workflow.get('work_id', 'N/A')}\n"
            f"[bold]Status:[/bold] {workflow['status']}\n"
            f"[bold]Started:[/bold] {workflow['started_at']}\n"
            f"[bold]Ended:[/bold] {workflow.get('ended_at', 'Running')}\n"
            f"[bold]Phase:[/bold] {workflow['current_phase']}",
            title=f"[bold]Workflow: {workflow_id}[/bold]",
        )
    )

    # Entries table
    if entries := workflow.get("entries"):
        table = Table(title="Log Entries")
        table.add_column("Time", style="dim")
        table.add_column("Level")
        table.add_column("Phase")
        table.add_column("Message")

        for entry in entries[-20:]:  # Last 20 entries
            level_style = {
                "error": "red",
                "warning": "yellow",
                "info": "green",
                "debug": "dim",
            }.get(entry["level"], "white")

            table.add_row(
                entry["timestamp"][11:19],
                f"[{level_style}]{entry['level']}[/{level_style}]",
                entry["phase"],
                entry["message"][:60] + "..." if len(entry["message"]) > 60 else entry["message"],
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


def _show_results_from_api(result: "WorkflowResult") -> None:
    """Show workflow results from API result object."""
    has_error = result.error is not None
    status_text = "[red]Failed[/red]" if has_error else "[green]Completed[/green]"

    # Build summary
    summary = f"""[bold]Status:[/bold] {status_text}
[bold]Workflow ID:[/bold] {result.workflow_id}
[bold]Work ID:[/bold] {result.work_id}
[bold]Phases Completed:[/bold] {', '.join(result.completed_phases)}
"""

    if result.evaluation_result:
        summary += f"[bold]Evaluation:[/bold] {result.evaluation_result}\n"

    if result.retry_count > 0:
        summary += f"[bold]Retries:[/bold] {result.retry_count}\n"

    if result.pr_url:
        summary += f"[bold]PR URL:[/bold] {result.pr_url}\n"

    if result.spec_path:
        summary += f"[bold]Spec:[/bold] {result.spec_path}\n"

    if result.branch_name:
        summary += f"[bold]Branch:[/bold] {result.branch_name}\n"

    if has_error:
        summary += f"\n[red]Error ({result.error_phase or 'unknown'}):[/red] {result.error}"

    console.print(
        Panel(
            summary,
            title="[bold]FABER Workflow Results[/bold]",
            border_style="green" if not has_error else "red",
        )
    )


if __name__ == "__main__":
    app()
