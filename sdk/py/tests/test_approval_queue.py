"""Tests for approval queue."""

from __future__ import annotations

import asyncio

import pytest

from faber.approval.queue import (
    ApprovalQueue,
    ApprovalRequest,
    ApprovalResponse,
    ApprovalStatus,
)


class TestApprovalRequest:
    """Tests for ApprovalRequest."""

    def test_create_request(self):
        """Test creating an approval request."""
        request = ApprovalRequest(
            request_id="req-123",
            workflow_id="wf-456",
            approval_type=ApprovalType.SPECIFICATION,
            title="Approve Specification",
            description="Please review the specification.",
            context={"spec_path": "/path/to/spec.md"},
        )

        assert request.request_id == "req-123"
        assert request.workflow_id == "wf-456"
        assert request.approval_type == ApprovalType.SPECIFICATION
        assert request.status == ApprovalStatus.PENDING


class TestApprovalQueue:
    """Tests for ApprovalQueue."""

    @pytest.fixture
    def queue(self):
        """Create a test queue."""
        return ApprovalQueue("wf-123")

    def test_add_request(self, queue):
        """Test adding a request to the queue."""
        request_id = queue.add_request(
            approval_type=ApprovalType.SPECIFICATION,
            title="Test",
            description="Test description",
        )

        assert request_id is not None
        assert request_id in queue.requests

    def test_get_pending(self, queue):
        """Test getting pending requests."""
        queue.add_request(
            approval_type=ApprovalType.SPECIFICATION,
            title="Test 1",
            description="Description 1",
        )
        queue.add_request(
            approval_type=ApprovalType.PR_CREATION,
            title="Test 2",
            description="Description 2",
        )

        pending = queue.get_pending()
        assert len(pending) == 2

    def test_respond(self, queue):
        """Test responding to a request."""
        request_id = queue.add_request(
            approval_type=ApprovalType.SPECIFICATION,
            title="Test",
            description="Test description",
        )

        response = queue.respond(
            request_id=request_id,
            approved=True,
            feedback="Looks good!",
            responder="test-user",
        )

        assert response.approved is True
        assert response.feedback == "Looks good!"
        assert queue.requests[request_id].status == ApprovalStatus.APPROVED

    def test_respond_rejected(self, queue):
        """Test rejecting a request."""
        request_id = queue.add_request(
            approval_type=ApprovalType.SPECIFICATION,
            title="Test",
            description="Test description",
        )

        response = queue.respond(
            request_id=request_id,
            approved=False,
            feedback="Needs changes",
            responder="test-user",
        )

        assert response.approved is False
        assert queue.requests[request_id].status == ApprovalStatus.REJECTED

    def test_respond_not_found(self, queue):
        """Test responding to non-existent request."""
        with pytest.raises(KeyError):
            queue.respond(
                request_id="non-existent",
                approved=True,
            )

    def test_cancel(self, queue):
        """Test cancelling a request."""
        request_id = queue.add_request(
            approval_type=ApprovalType.SPECIFICATION,
            title="Test",
            description="Test description",
        )

        queue.cancel(request_id)

        assert queue.requests[request_id].status == ApprovalStatus.CANCELLED

    @pytest.mark.asyncio
    async def test_wait_for_approval_immediate(self, queue):
        """Test wait_for_approval with immediate response."""
        request_id = queue.add_request(
            approval_type=ApprovalType.SPECIFICATION,
            title="Test",
            description="Test description",
        )

        # Respond immediately in another task
        async def respond_soon():
            await asyncio.sleep(0.1)
            queue.respond(request_id=request_id, approved=True)

        asyncio.create_task(respond_soon())

        response = await queue.wait_for_approval(request_id, timeout=5.0)
        assert response.approved is True

    @pytest.mark.asyncio
    async def test_wait_for_approval_timeout(self, queue):
        """Test wait_for_approval timeout."""
        request_id = queue.add_request(
            approval_type=ApprovalType.SPECIFICATION,
            title="Test",
            description="Test description",
        )

        response = await queue.wait_for_approval(request_id, timeout=0.1)
        assert response is None
        assert queue.requests[request_id].status == ApprovalStatus.TIMEOUT
