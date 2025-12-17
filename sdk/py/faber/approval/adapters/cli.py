"""
CLI adapter for approval queue.

Provides terminal-based approval prompts using Rich.
"""

from __future__ import annotations

import asyncio
from typing import Optional, TYPE_CHECKING

from rich.console import Console
from rich.panel import Panel
from rich.prompt import Prompt

from faber.approval.adapters.base import ApprovalAdapter

if TYPE_CHECKING:
    from faber.approval.queue import ApprovalRequest, ApprovalResponse


class CLIApprovalAdapter(ApprovalAdapter):
    """CLI-based approval adapter using Rich."""

    def __init__(self) -> None:
        self.console = Console()
        self._pending_input: dict[str, str] = {}

    @property
    def name(self) -> str:
        return "cli"

    async def send_notification(self, request: "ApprovalRequest") -> None:
        """Display approval request in terminal."""
        from faber.approval.queue import ApprovalResponse

        # Build options string
        options_str = " / ".join(request.options)

        # Create panel content
        content = f"""[bold]{request.question}[/bold]

[dim]Workflow:[/dim] {request.workflow_id}
[dim]Phase:[/dim] {request.phase}
[dim]Timeout:[/dim] {request.timeout_minutes} minutes

[dim]Options:[/dim] {options_str}
"""

        if request.context:
            content += "\n[dim]Context:[/dim]\n"
            for key, value in request.context.items():
                content += f"  • {key}: {value}\n"

        self.console.print(Panel(
            content,
            title="[bold yellow]🔄 Approval Required[/bold yellow]",
            border_style="yellow",
        ))

        # Get input in a non-blocking way
        # In a real implementation, this would use async input
        # For MVP, we'll use synchronous input
        try:
            response = Prompt.ask(
                "[bold]Your decision[/bold]",
                choices=request.options,
                default=request.options[0],
            )
            comment = Prompt.ask(
                "[dim]Comment (optional)[/dim]",
                default="",
            )

            self._pending_input[request.id] = f"{response}|{comment}"
        except (EOFError, KeyboardInterrupt):
            self._pending_input[request.id] = "reject|Cancelled by user"

    async def poll_response(
        self,
        request: "ApprovalRequest",
    ) -> Optional["ApprovalResponse"]:
        """Check for CLI response."""
        from faber.approval.queue import ApprovalResponse

        if request.id in self._pending_input:
            input_str = self._pending_input.pop(request.id)
            parts = input_str.split("|", 1)
            decision = parts[0]
            comment = parts[1] if len(parts) > 1 else None

            return ApprovalResponse(
                request_id=request.id,
                decision=decision,
                comment=comment if comment else None,
                responder="cli_user",
                channel="cli",
            )

        return None
