"""
Base adapter interface for approval channels.
"""

from __future__ import annotations

from abc import ABC, abstractmethod
from typing import Optional, TYPE_CHECKING

if TYPE_CHECKING:
    from faber.approval.queue import ApprovalRequest, ApprovalResponse


class ApprovalAdapter(ABC):
    """Abstract base class for approval channel adapters."""

    @property
    @abstractmethod
    def name(self) -> str:
        """Channel name (cli, github, web, slack)."""
        pass

    @abstractmethod
    async def send_notification(self, request: "ApprovalRequest") -> None:
        """Send a notification about a pending approval request.

        Args:
            request: The approval request to notify about
        """
        pass

    @abstractmethod
    async def poll_response(
        self,
        request: "ApprovalRequest",
    ) -> Optional["ApprovalResponse"]:
        """Poll for a response to an approval request.

        Args:
            request: The approval request to check

        Returns:
            ApprovalResponse if available, None otherwise
        """
        pass
