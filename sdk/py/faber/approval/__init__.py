"""
FABER Approval Queue - Unified human-in-the-loop system.

Provides multi-channel notification and response handling for
approval checkpoints in FABER workflows.
"""

from faber.approval.queue import ApprovalQueue, ApprovalRequest, ApprovalResponse
from faber.approval.adapters.base import ApprovalAdapter

__all__ = [
    "ApprovalQueue",
    "ApprovalRequest",
    "ApprovalResponse",
    "ApprovalAdapter",
]
