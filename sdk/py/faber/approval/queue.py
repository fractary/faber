"""
Unified Approval Queue for FABER workflows.

Provides a central queue with adapters for multiple channels:
- CLI (terminal prompt)
- GitHub (@faber mentions)
- Web (WebSocket push)
- Slack (webhook)
"""

from __future__ import annotations

import asyncio
import uuid
from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum
from typing import Any, Optional

from faber.approval.adapters.base import ApprovalAdapter


class ApprovalStatus(Enum):
    """Status of an approval request."""

    PENDING = "pending"
    APPROVED = "approved"
    REJECTED = "rejected"
    TIMEOUT = "timeout"
    CANCELLED = "cancelled"


@dataclass
class ApprovalRequest:
    """A request for human approval."""

    id: str
    workflow_id: str
    phase: str
    question: str
    options: list[str] = field(default_factory=lambda: ["approve", "reject"])
    context: dict[str, Any] = field(default_factory=dict)
    created_at: str = field(default_factory=lambda: datetime.now().isoformat())
    timeout_minutes: int = 60
    status: ApprovalStatus = ApprovalStatus.PENDING

    @classmethod
    def create(
        cls,
        workflow_id: str,
        phase: str,
        question: str,
        options: Optional[list[str]] = None,
        context: Optional[dict[str, Any]] = None,
        timeout_minutes: int = 60,
    ) -> ApprovalRequest:
        """Create a new approval request."""
        return cls(
            id=f"APR-{uuid.uuid4().hex[:8]}",
            workflow_id=workflow_id,
            phase=phase,
            question=question,
            options=options or ["approve", "reject"],
            context=context or {},
            timeout_minutes=timeout_minutes,
        )


@dataclass
class ApprovalResponse:
    """Response to an approval request."""

    request_id: str
    decision: str  # approve | reject | revise
    comment: Optional[str] = None
    responder: Optional[str] = None
    channel: Optional[str] = None
    responded_at: str = field(default_factory=lambda: datetime.now().isoformat())


class ApprovalQueue:
    """Unified approval queue with multi-channel support.

    Sends notifications to configured channels and accepts
    responses from any configured response channel.
    """

    def __init__(
        self,
        notify_channels: Optional[list[str]] = None,
        response_channels: Optional[list[str]] = None,
        default_timeout_minutes: int = 60,
    ) -> None:
        """Initialize approval queue.

        Args:
            notify_channels: Channels to send notifications
            response_channels: Channels to accept responses from
            default_timeout_minutes: Default timeout for requests
        """
        self.notify_channels = notify_channels or ["cli"]
        self.response_channels = response_channels or ["cli"]
        self.default_timeout_minutes = default_timeout_minutes

        self._adapters: dict[str, ApprovalAdapter] = {}
        self._pending_requests: dict[str, ApprovalRequest] = {}
        self._responses: dict[str, ApprovalResponse] = {}

    def register_adapter(self, name: str, adapter: ApprovalAdapter) -> None:
        """Register a channel adapter.

        Args:
            name: Channel name (cli, github, web, slack)
            adapter: Adapter instance
        """
        self._adapters[name] = adapter

    async def request_approval(
        self,
        workflow_id: str,
        phase: str,
        question: str,
        options: Optional[list[str]] = None,
        context: Optional[dict[str, Any]] = None,
        timeout_minutes: Optional[int] = None,
    ) -> ApprovalResponse:
        """Request human approval.

        Sends notifications to all notify_channels and waits for
        a response from any response_channel.

        Args:
            workflow_id: Workflow ID
            phase: FABER phase requesting approval
            question: Question to ask the human
            options: Available options (default: approve/reject)
            context: Additional context
            timeout_minutes: Timeout in minutes

        Returns:
            ApprovalResponse with the decision
        """
        request = ApprovalRequest.create(
            workflow_id=workflow_id,
            phase=phase,
            question=question,
            options=options,
            context=context,
            timeout_minutes=timeout_minutes or self.default_timeout_minutes,
        )

        self._pending_requests[request.id] = request

        # Send notifications to all notify channels
        await self._send_notifications(request)

        # Wait for response from any response channel
        response = await self._wait_for_response(request)

        # Clean up
        del self._pending_requests[request.id]

        return response

    async def _send_notifications(self, request: ApprovalRequest) -> None:
        """Send notifications to all configured channels."""
        for channel in self.notify_channels:
            if channel in self._adapters:
                try:
                    await self._adapters[channel].send_notification(request)
                except Exception as e:
                    # Log error but continue with other channels
                    print(f"Failed to send notification to {channel}: {e}")

    async def _wait_for_response(self, request: ApprovalRequest) -> ApprovalResponse:
        """Wait for a response from any response channel."""
        timeout_seconds = request.timeout_minutes * 60
        start_time = asyncio.get_event_loop().time()

        while True:
            # Check if we have a response
            if request.id in self._responses:
                return self._responses.pop(request.id)

            # Check timeout
            elapsed = asyncio.get_event_loop().time() - start_time
            if elapsed >= timeout_seconds:
                request.status = ApprovalStatus.TIMEOUT
                return ApprovalResponse(
                    request_id=request.id,
                    decision="timeout",
                    comment="Request timed out",
                )

            # Poll response channels
            for channel in self.response_channels:
                if channel in self._adapters:
                    try:
                        response = await self._adapters[channel].poll_response(request)
                        if response:
                            request.status = (
                                ApprovalStatus.APPROVED
                                if response.decision == "approve"
                                else ApprovalStatus.REJECTED
                            )
                            return response
                    except Exception:
                        pass

            # Small delay before next poll
            await asyncio.sleep(1)

    def submit_response(self, response: ApprovalResponse) -> bool:
        """Submit a response to a pending request.

        Used by adapters to submit responses.

        Args:
            response: The approval response

        Returns:
            True if response was accepted, False if request not found
        """
        if response.request_id in self._pending_requests:
            self._responses[response.request_id] = response
            return True
        return False

    def get_pending_requests(self) -> list[ApprovalRequest]:
        """Get all pending approval requests."""
        return list(self._pending_requests.values())

    def cancel_request(self, request_id: str) -> bool:
        """Cancel a pending request.

        Args:
            request_id: Request ID to cancel

        Returns:
            True if cancelled, False if not found
        """
        if request_id in self._pending_requests:
            request = self._pending_requests[request_id]
            request.status = ApprovalStatus.CANCELLED
            self._responses[request_id] = ApprovalResponse(
                request_id=request_id,
                decision="cancelled",
                comment="Request was cancelled",
            )
            return True
        return False
