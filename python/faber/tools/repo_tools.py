"""
LangChain @tool wrappers for RepoManager.

These tools provide LangChain-compatible interfaces to repository
operations without containing business logic.
"""

from __future__ import annotations

from typing import Any, Optional

from langchain_core.tools import tool

from faber.primitives.repo.manager import RepoManager

# Singleton instance - lazy loaded
_repo_manager: Optional[RepoManager] = None


def get_repo_manager() -> RepoManager:
    """Get or create RepoManager singleton."""
    global _repo_manager
    if _repo_manager is None:
        _repo_manager = RepoManager()
    return _repo_manager


@tool
def get_current_branch() -> str:
    """Get the current Git branch name.

    Use this tool to find out which branch is currently checked out.

    Returns:
        The name of the current branch (e.g., "main", "feature/123-add-login").
    """
    return get_repo_manager().get_current_branch()


@tool
def create_branch(
    name: str,
    base: Optional[str] = None,
    checkout: bool = True,
) -> dict[str, Any]:
    """Create a new Git branch.

    Use this tool to create a new branch for development work.

    Args:
        name: Branch name (e.g., "feature/123-add-login")
        base: Base branch to create from (default: main/master)
        checkout: Whether to checkout the new branch (default: True)

    Returns:
        Branch details including name, sha, and whether it's checked out.
    """
    branch = get_repo_manager().create_branch(name, base, checkout)
    return {
        "name": branch.name,
        "sha": branch.sha,
        "is_current": branch.is_current,
    }


@tool
def generate_branch_name(
    description: str,
    work_type: str = "feature",
    work_id: Optional[str] = None,
) -> str:
    """Generate a semantic branch name.

    Use this tool to generate a properly formatted branch name from a description.
    Follows conventional naming patterns like "feat/123-add-login-feature".

    Args:
        description: Brief description of the work (e.g., "add login feature")
        work_type: Type of work - "feature", "bug", "chore", or "patch"
        work_id: Optional work item ID to include in the name

    Returns:
        Generated branch name following semantic conventions.
    """
    return get_repo_manager().generate_branch_name(description, work_type, work_id)


@tool
def git_commit(
    message: str,
    commit_type: str = "feat",
    scope: Optional[str] = None,
    work_id: Optional[str] = None,
    breaking: bool = False,
    body: Optional[str] = None,
) -> dict[str, Any]:
    """Create a semantic Git commit.

    Use this tool to create a commit following Conventional Commits format.
    Automatically stages all changes before committing.

    Args:
        message: Commit message (without type prefix, e.g., "add login page")
        commit_type: Conventional commit type - "feat", "fix", "chore", "docs", "refactor", "test", "style", "perf"
        scope: Optional scope for the commit (e.g., "auth", "api", "ui")
        work_id: Optional work item ID to reference in footer
        breaking: Whether this is a breaking change (adds ! to type)
        body: Extended commit description (multiline)

    Returns:
        Commit details including sha and full message.
    """
    commit = get_repo_manager().commit(
        message=message,
        commit_type=commit_type,
        scope=scope,
        work_id=work_id,
        breaking=breaking,
        body=body,
    )
    return {
        "sha": commit.sha,
        "message": commit.message,
        "author": commit.author,
        "date": commit.date,
    }


@tool
def git_push(
    branch: Optional[str] = None,
    remote: str = "origin",
    set_upstream: bool = False,
    force: bool = False,
) -> dict[str, Any]:
    """Push current branch to remote.

    Use this tool to push commits to the remote repository.

    Args:
        branch: Branch to push (default: current branch)
        remote: Remote name (default: origin)
        set_upstream: Set upstream tracking for the branch
        force: Force push with lease (use with caution!)

    Returns:
        Push result with success status.
    """
    result = get_repo_manager().push(
        branch=branch,
        remote=remote,
        set_upstream=set_upstream,
        force=force,
    )
    return result


@tool
def create_pull_request(
    title: str,
    body: str,
    head: Optional[str] = None,
    base: Optional[str] = None,
    draft: bool = False,
) -> dict[str, Any]:
    """Create a pull request.

    Use this tool to create a PR for code review and merging.

    Args:
        title: PR title - should be clear and descriptive
        body: PR body/description (supports markdown)
        head: Head branch (default: current branch)
        base: Base branch to merge into (default: main)
        draft: Create as draft PR

    Returns:
        Created PR details including number, title, and URL.
    """
    pr = get_repo_manager().create_pr(
        title=title,
        body=body,
        head=head,
        base=base,
        draft=draft,
    )
    return {
        "number": pr.number,
        "title": pr.title,
        "url": pr.url,
        "state": pr.state,
        "draft": pr.draft,
    }


@tool
def list_branches(pattern: Optional[str] = None) -> list[dict[str, Any]]:
    """List Git branches.

    Use this tool to see available branches in the repository.

    Args:
        pattern: Optional pattern to filter branches (e.g., "feature/*")

    Returns:
        List of branches with name, sha, and status.
    """
    branches = get_repo_manager().list_branches(pattern)
    return [
        {
            "name": b.name,
            "sha": b.sha,
            "is_current": b.is_current,
            "is_default": b.is_default,
            "upstream": b.upstream,
        }
        for b in branches
    ]


@tool
def get_commits(
    since: Optional[str] = None,
    until: Optional[str] = None,
    limit: int = 10,
) -> list[dict[str, Any]]:
    """Get commit history.

    Use this tool to view recent commits or commits between references.

    Args:
        since: Start commit/branch/tag
        until: End commit/branch/tag
        limit: Maximum commits to return (default: 10)

    Returns:
        List of commits with sha, message, author, and date.
    """
    commits = get_repo_manager().get_commits(since, until, limit)
    return [
        {
            "sha": c.sha,
            "message": c.message,
            "author": c.author,
            "date": c.date,
        }
        for c in commits
    ]


# Export all repo tools
REPO_TOOLS = [
    get_current_branch,
    create_branch,
    generate_branch_name,
    git_commit,
    git_push,
    create_pull_request,
    list_branches,
    get_commits,
]
