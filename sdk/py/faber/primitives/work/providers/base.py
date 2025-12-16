"""
Base provider interface for work tracking systems.
"""

from __future__ import annotations

from abc import ABC, abstractmethod
from typing import Any, Optional

from faber.primitives.work.manager import Comment, Issue


class WorkProvider(ABC):
    """Abstract base class for work tracking providers."""

    def __init__(self, config: dict[str, Any]) -> None:
        """Initialize provider with config."""
        self.config = config

    @abstractmethod
    def fetch_issue(self, issue_id: str) -> Issue:
        """Fetch an issue by ID."""
        pass

    @abstractmethod
    def create_issue(
        self,
        title: str,
        body: str,
        labels: list[str],
        assignee: Optional[str],
    ) -> Issue:
        """Create a new issue."""
        pass

    @abstractmethod
    def update_issue(
        self,
        issue_id: str,
        title: Optional[str],
        body: Optional[str],
        state: Optional[str],
        labels: Optional[list[str]],
        assignee: Optional[str],
    ) -> Issue:
        """Update an existing issue."""
        pass

    @abstractmethod
    def close_issue(self, issue_id: str, reason: Optional[str]) -> Issue:
        """Close an issue."""
        pass

    @abstractmethod
    def create_comment(self, issue_id: str, body: str) -> Comment:
        """Create a comment on an issue."""
        pass

    @abstractmethod
    def list_comments(self, issue_id: str, limit: int) -> list[Comment]:
        """List comments on an issue."""
        pass

    @abstractmethod
    def search_issues(
        self,
        query: Optional[str],
        state: str,
        labels: Optional[list[str]],
        limit: int,
    ) -> list[Issue]:
        """Search for issues."""
        pass
