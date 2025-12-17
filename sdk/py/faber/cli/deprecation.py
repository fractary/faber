"""Deprecation warnings for standalone faber CLI."""

from rich.console import Console
from rich.panel import Panel

console = Console(stderr=True)

DEPRECATION_MESSAGE = """
[yellow]⚠️  DEPRECATION WARNING[/yellow]

The standalone 'faber' command is deprecated and will be removed in v1.0.0.

Please use the unified Fractary CLI instead:

[cyan]  # Instead of:[/cyan]
  faber run 123 --autonomy assisted

[cyan]  # Use:[/cyan]
  fractary faber run 123 --autonomy assisted

[cyan]  # Install:[/cyan]
  npm install -g @fractary/cli

For more information, see: https://fractary.dev/migration
"""


def show_deprecation_warning() -> None:
    """Show deprecation warning to users."""
    console.print(
        Panel(
            DEPRECATION_MESSAGE.strip(),
            border_style="yellow",
            title="[bold yellow]Deprecation Notice[/bold yellow]",
        )
    )
    console.print()  # Add blank line
