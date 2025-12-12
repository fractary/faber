"""
LangChain @tool wrappers for WorkManager.

These tools provide LangChain-compatible interfaces to work tracking
operations without containing business logic.
"""

from __future__ import annotations

from typing import Any, Optional

from langchain_core.tools import tool

from faber.primitives.work.manager import WorkManager

# Singleton instance - lazy loaded
_work_manager: Optional[WorkManager] = None


def get_work_manager() -> WorkManager:
    """Get or create WorkManager singleton."""
    global _work_manager
    if _work_manager is None:
        _work_manager = WorkManager()
    return _work_manager


@tool
def fetch_issue(issue_id: str) -> dict[str, Any]:
    """Fetch an issue from the work tracking system.

    Use this tool to retrieve details about a specific issue or work item.
    Returns the issue title, body, state, labels, assignee, and URL.

    Args:
        issue_id: The issue number or identifier (e.g., "123" or "PROJ-123")

    Returns:
        Issue details including id, title, body, state, labels, assignee, and url.
    """
    issue = get_work_manager().fetch_issue(issue_id)
    return {
        "id": issue.id,
        "title": issue.title,
        "body": issue.body,
        "state": issue.state,
        "labels": issue.labels,
        "assignee": issue.assignee,
        "url": issue.url,
    }


@tool
def create_issue(
    title: str,
    body: str = "",
    labels: Optional[list[str]] = None,
    assignee: Optional[str] = None,
) -> dict[str, Any]:
    """Create a new issue in the work tracking system.

    Use this tool to create a new work item or issue.

    Args:
        title: Issue title - should be clear and descriptive
        body: Issue description/body with details
        labels: Labels to apply (e.g., ["enhancement", "priority:high"])
        assignee: User to assign (e.g., "@username" or just "username")

    Returns:
        Created issue details including id, title, and url.
    """
    issue = get_work_manager().create_issue(
        title=title,
        body=body,
        labels=labels or [],
        assignee=assignee,
    )
    return {
        "id": issue.id,
        "title": issue.title,
        "url": issue.url,
        "state": issue.state,
    }


@tool
def classify_work_type(issue_id: str) -> dict[str, Any]:
    """Classify the work type of an issue.

    Use this tool to determine what type of work an issue represents
    (feature, bug, chore, etc.) based on its labels and content.

    Args:
        issue_id: The issue number or identifier

    Returns:
        Work type classification with type, confidence (0-1), and reasoning.
    """
    issue = get_work_manager().fetch_issue(issue_id)
    work_type = get_work_manager().classify_work_type(issue)
    return {
        "type": work_type.type,
        "confidence": work_type.confidence,
        "reasoning": work_type.reasoning,
    }


@tool
def create_issue_comment(
    issue_id: str,
    body: str,
    context: Optional[str] = None,
) -> dict[str, Any]:
    """Create a comment on an issue.

    Use this tool to add a comment to an existing issue. Optionally
    include FABER phase context to tag the comment.

    Args:
        issue_id: The issue number or identifier
        body: The comment body text (supports markdown)
        context: Optional FABER phase context (frame, architect, build, evaluate, release)

    Returns:
        Created comment details including id and body.
    """
    comment = get_work_manager().create_comment(issue_id, body, context)
    return {
        "id": comment.id,
        "body": comment.body,
        "author": comment.author,
        "url": comment.url,
    }


@tool
def close_issue(issue_id: str, reason: Optional[str] = None) -> dict[str, Any]:
    """Close an issue.

    Use this tool to close a completed or resolved issue.
    Optionally provide a reason that will be posted as a comment.

    Args:
        issue_id: The issue number or identifier
        reason: Optional reason for closing (posted as comment)

    Returns:
        Updated issue details showing closed state.
    """
    issue = get_work_manager().close_issue(issue_id, reason)
    return {
        "id": issue.id,
        "title": issue.title,
        "state": issue.state,
        "url": issue.url,
    }


@tool
def search_issues(
    query: Optional[str] = None,
    state: str = "open",
    labels: Optional[list[str]] = None,
    limit: int = 20,
) -> list[dict[str, Any]]:
    """Search for issues in the work tracking system.

    Use this tool to find issues matching specific criteria.

    Args:
        query: Search query string (searches title and body)
        state: Issue state filter - "open", "closed", or "all"
        labels: Filter by labels (e.g., ["bug", "priority:high"])
        limit: Maximum number of results (default 20, max 100)

    Returns:
        List of matching issues with id, title, state, labels, and url.
    """
    issues = get_work_manager().search_issues(
        query=query,
        state=state,
        labels=labels,
        limit=min(limit, 100),
    )
    return [
        {
            "id": issue.id,
            "title": issue.title,
            "state": issue.state,
            "labels": issue.labels,
            "url": issue.url,
        }
        for issue in issues
    ]


# Export all work tools
WORK_TOOLS = [
    fetch_issue,
    create_issue,
    classify_work_type,
    create_issue_comment,
    close_issue,
    search_issues,
]
