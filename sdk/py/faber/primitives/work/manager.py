"""
WorkManager - Framework-agnostic work tracking abstraction.

Supports GitHub Issues, Jira, and Linear via pluggable providers.
"""

from __future__ import annotations

import os
from dataclasses import dataclass, field
from pathlib import Path
from typing import TYPE_CHECKING, Any, Optional

import yaml

if TYPE_CHECKING:
    from faber.primitives.work.providers.base import WorkProvider


@dataclass
class Issue:
    """Represents a work item/issue from any tracking system."""

    id: str
    title: str
    body: str
    state: str
    labels: list[str] = field(default_factory=list)
    assignee: Optional[str] = None
    url: str = ""
    raw: dict[str, Any] = field(default_factory=dict)


@dataclass
class WorkType:
    """Classification of work type with confidence."""

    type: str  # feature | bug | chore | patch | infrastructure | api
    confidence: float
    reasoning: str


@dataclass
class Comment:
    """Represents a comment on an issue."""

    id: str
    body: str
    author: str
    created_at: str
    url: str = ""


class WorkManager:
    """Framework-agnostic work tracking abstraction.

    This class provides a unified interface for interacting with
    work tracking systems (GitHub Issues, Jira, Linear) without
    any LangChain dependencies.
    """

    def __init__(self, config: Optional[dict[str, Any]] = None) -> None:
        """Initialize WorkManager with optional config.

        Args:
            config: Configuration dict. If None, loads from .faber/config.yaml
        """
        self.config = config or self._load_config()
        self._provider: Optional[WorkProvider] = None

    @property
    def provider(self) -> WorkProvider:
        """Lazy-load the appropriate provider."""
        if self._provider is None:
            self._provider = self._init_provider()
        return self._provider

    def _load_config(self) -> dict[str, Any]:
        """Load configuration from .faber/config.yaml or .fractary/plugins/work/config.json."""
        # Try .faber/config.yaml first
        faber_config = Path.cwd() / ".faber" / "config.yaml"
        if faber_config.exists():
            with open(faber_config) as f:
                full_config = yaml.safe_load(f) or {}
                return full_config.get("work", {})

        # Try .fractary/plugins/work/config.json
        fractary_config = Path.cwd() / ".fractary" / "plugins" / "work" / "config.json"
        if fractary_config.exists():
            import json

            with open(fractary_config) as f:
                return json.load(f)

        # Default config
        return {
            "platform": os.getenv("FABER_WORK_PLATFORM", "github"),
            "owner": os.getenv("GITHUB_REPOSITORY_OWNER", ""),
            "repo": os.getenv("GITHUB_REPOSITORY", "").split("/")[-1] if os.getenv("GITHUB_REPOSITORY") else "",
        }

    def _init_provider(self) -> WorkProvider:
        """Initialize the appropriate provider based on config."""
        platform = self.config.get("platform", "github").lower()

        if platform == "github":
            from faber.primitives.work.providers.github import GitHubWorkProvider

            return GitHubWorkProvider(self.config)
        elif platform == "jira":
            from faber.primitives.work.providers.jira import JiraWorkProvider

            return JiraWorkProvider(self.config)
        elif platform == "linear":
            from faber.primitives.work.providers.linear import LinearWorkProvider

            return LinearWorkProvider(self.config)
        else:
            raise ValueError(f"Unsupported work platform: {platform}")

    def fetch_issue(self, issue_id: str) -> Issue:
        """Fetch an issue from the work tracking system.

        Args:
            issue_id: The issue number or identifier (e.g., "123" or "PROJ-123")

        Returns:
            Issue object with details
        """
        return self.provider.fetch_issue(issue_id)

    def create_issue(
        self,
        title: str,
        body: str = "",
        labels: Optional[list[str]] = None,
        assignee: Optional[str] = None,
    ) -> Issue:
        """Create a new issue.

        Args:
            title: Issue title
            body: Issue description/body
            labels: Labels to apply
            assignee: User to assign

        Returns:
            Created Issue object
        """
        return self.provider.create_issue(
            title=title,
            body=body,
            labels=labels or [],
            assignee=assignee,
        )

    def update_issue(
        self,
        issue_id: str,
        title: Optional[str] = None,
        body: Optional[str] = None,
        state: Optional[str] = None,
        labels: Optional[list[str]] = None,
        assignee: Optional[str] = None,
    ) -> Issue:
        """Update an existing issue.

        Args:
            issue_id: Issue identifier
            title: New title (optional)
            body: New body (optional)
            state: New state (optional)
            labels: New labels (optional)
            assignee: New assignee (optional)

        Returns:
            Updated Issue object
        """
        return self.provider.update_issue(
            issue_id=issue_id,
            title=title,
            body=body,
            state=state,
            labels=labels,
            assignee=assignee,
        )

    def close_issue(self, issue_id: str, reason: Optional[str] = None) -> Issue:
        """Close an issue.

        Args:
            issue_id: Issue identifier
            reason: Optional reason for closing

        Returns:
            Updated Issue object
        """
        return self.provider.close_issue(issue_id, reason)

    def classify_work_type(self, issue: Issue) -> WorkType:
        """Classify the work type based on issue content.

        Uses rule-based classification (no LLM dependency).

        Args:
            issue: Issue to classify

        Returns:
            WorkType with classification and confidence
        """
        labels = [label.lower() for label in issue.labels]
        title_lower = issue.title.lower()

        # Check labels first (highest confidence)
        if any(l in labels for l in ["bug", "fix", "defect", "type: bug"]):
            return WorkType("bug", 0.95, "Label indicates bug")
        elif any(l in labels for l in ["feature", "enhancement", "type: feature"]):
            return WorkType("feature", 0.95, "Label indicates feature")
        elif any(l in labels for l in ["chore", "maintenance", "type: chore"]):
            return WorkType("chore", 0.95, "Label indicates chore")
        elif any(l in labels for l in ["hotfix", "patch", "urgent", "type: patch"]):
            return WorkType("patch", 0.95, "Label indicates patch")
        elif any(l in labels for l in ["infrastructure", "infra", "devops"]):
            return WorkType("infrastructure", 0.90, "Label indicates infrastructure")
        elif any(l in labels for l in ["api", "endpoint"]):
            return WorkType("api", 0.90, "Label indicates API work")

        # Check title keywords (lower confidence)
        if any(word in title_lower for word in ["fix", "bug", "error", "crash", "broken"]):
            return WorkType("bug", 0.70, "Title suggests bug fix")
        elif any(word in title_lower for word in ["add", "new", "feature", "implement"]):
            return WorkType("feature", 0.70, "Title suggests new feature")
        elif any(word in title_lower for word in ["update", "upgrade", "refactor", "clean"]):
            return WorkType("chore", 0.60, "Title suggests maintenance")

        # Default classification
        return WorkType("feature", 0.50, "Default classification")

    def create_comment(
        self,
        issue_id: str,
        body: str,
        context: Optional[str] = None,
    ) -> Comment:
        """Create a comment on an issue.

        Args:
            issue_id: Issue identifier
            body: Comment body text
            context: Optional FABER phase context (frame, architect, build, evaluate, release)

        Returns:
            Created Comment object
        """
        if context:
            body = f"**[FABER:{context.upper()}]**\n\n{body}"
        return self.provider.create_comment(issue_id, body)

    def list_comments(self, issue_id: str, limit: int = 100) -> list[Comment]:
        """List comments on an issue.

        Args:
            issue_id: Issue identifier
            limit: Maximum number of comments to return

        Returns:
            List of Comment objects
        """
        return self.provider.list_comments(issue_id, limit)

    def search_issues(
        self,
        query: Optional[str] = None,
        state: str = "open",
        labels: Optional[list[str]] = None,
        limit: int = 50,
    ) -> list[Issue]:
        """Search for issues.

        Args:
            query: Search query string
            state: Issue state filter (open, closed, all)
            labels: Filter by labels
            limit: Maximum results

        Returns:
            List of matching Issue objects
        """
        return self.provider.search_issues(
            query=query,
            state=state,
            labels=labels,
            limit=limit,
        )
