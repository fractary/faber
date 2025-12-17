"""
RepoManager - Framework-agnostic repository operations abstraction.

Supports Git operations with GitHub, GitLab, and Bitbucket providers for
platform-specific features like PRs.
"""

from __future__ import annotations

import os
import re
import subprocess
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Optional

import yaml


@dataclass
class Branch:
    """Represents a Git branch."""

    name: str
    sha: str
    is_default: bool = False
    upstream: Optional[str] = None
    is_current: bool = False


@dataclass
class Commit:
    """Represents a Git commit."""

    sha: str
    message: str
    author: str
    date: str


@dataclass
class PullRequest:
    """Represents a pull request."""

    number: int
    title: str
    body: str
    state: str
    head_branch: str
    base_branch: str
    url: str
    draft: bool = False
    raw: dict[str, Any] = field(default_factory=dict)


class RepoManager:
    """Framework-agnostic repository operations abstraction.

    Provides Git operations and platform-specific features (PRs)
    without any LangChain dependencies.
    """

    def __init__(self, config: Optional[dict[str, Any]] = None) -> None:
        """Initialize RepoManager with optional config."""
        self.config = config or self._load_config()
        self._provider = None

    def _load_config(self) -> dict[str, Any]:
        """Load configuration from .faber/config.yaml or .fractary/plugins/repo/config.json."""
        # Try .faber/config.yaml first
        faber_config = Path.cwd() / ".faber" / "config.yaml"
        if faber_config.exists():
            with open(faber_config) as f:
                full_config = yaml.safe_load(f) or {}
                return full_config.get("repo", {})

        # Try .fractary/plugins/repo/config.json
        fractary_config = Path.cwd() / ".fractary" / "plugins" / "repo" / "config.json"
        if fractary_config.exists():
            import json

            with open(fractary_config) as f:
                return json.load(f)

        # Default config
        return {
            "platform": os.getenv("FABER_REPO_PLATFORM", "github"),
            "default_branch": "main",
            "branch_prefixes": {
                "feature": "feat",
                "bug": "fix",
                "chore": "chore",
                "patch": "fix",
                "docs": "docs",
                "refactor": "refactor",
            },
        }

    def _run_git(self, args: list[str], check: bool = True) -> subprocess.CompletedProcess:
        """Run a git command."""
        return subprocess.run(
            ["git"] + args,
            capture_output=True,
            text=True,
            check=check,
        )

    # =========================================================================
    # Branch Operations
    # =========================================================================

    def get_current_branch(self) -> str:
        """Get the current branch name."""
        result = self._run_git(["branch", "--show-current"])
        return result.stdout.strip()

    def get_default_branch(self) -> str:
        """Get the default branch name (main or master)."""
        # Try to get from remote
        result = self._run_git(
            ["symbolic-ref", "refs/remotes/origin/HEAD", "--short"],
            check=False,
        )
        if result.returncode == 0:
            return result.stdout.strip().replace("origin/", "")

        # Fallback to config or common defaults
        default = self.config.get("default_branch", "main")
        result = self._run_git(["branch", "--list", default], check=False)
        if result.stdout.strip():
            return default

        result = self._run_git(["branch", "--list", "master"], check=False)
        if result.stdout.strip():
            return "master"

        return "main"

    def get_branch(self, name: str) -> Branch:
        """Get branch details."""
        result = self._run_git(["rev-parse", name])
        sha = result.stdout.strip()

        # Check if it's the current branch
        current = self.get_current_branch()
        is_current = name == current

        # Check upstream
        upstream_result = self._run_git(
            ["rev-parse", "--abbrev-ref", f"{name}@{{upstream}}"],
            check=False,
        )
        upstream = upstream_result.stdout.strip() if upstream_result.returncode == 0 else None

        # Check if default
        default_branch = self.get_default_branch()
        is_default = name == default_branch

        return Branch(
            name=name,
            sha=sha,
            is_default=is_default,
            upstream=upstream,
            is_current=is_current,
        )

    def list_branches(self, pattern: Optional[str] = None) -> list[Branch]:
        """List branches, optionally filtered by pattern."""
        args = ["branch", "--format=%(refname:short)|%(objectname:short)|%(upstream:short)"]
        if pattern:
            args.append(pattern)

        result = self._run_git(args)
        branches = []
        current = self.get_current_branch()
        default = self.get_default_branch()

        for line in result.stdout.strip().split("\n"):
            if not line:
                continue
            parts = line.split("|")
            name = parts[0]
            sha = parts[1] if len(parts) > 1 else ""
            upstream = parts[2] if len(parts) > 2 and parts[2] else None

            branches.append(Branch(
                name=name,
                sha=sha,
                is_default=(name == default),
                upstream=upstream,
                is_current=(name == current),
            ))

        return branches

    def create_branch(
        self,
        name: str,
        base: Optional[str] = None,
        checkout: bool = True,
    ) -> Branch:
        """Create a new branch.

        Args:
            name: Branch name
            base: Base branch (default: current branch)
            checkout: Whether to checkout the new branch

        Returns:
            Created Branch object
        """
        base = base or self.get_default_branch()

        if checkout:
            self._run_git(["checkout", "-b", name, base])
        else:
            self._run_git(["branch", name, base])

        return self.get_branch(name)

    def checkout_branch(self, name: str) -> Branch:
        """Checkout an existing branch."""
        self._run_git(["checkout", name])
        return self.get_branch(name)

    def delete_branch(self, name: str, force: bool = False) -> bool:
        """Delete a branch.

        Args:
            name: Branch name
            force: Force delete even if not merged

        Returns:
            True if successful
        """
        flag = "-D" if force else "-d"
        self._run_git(["branch", flag, name])
        return True

    def generate_branch_name(
        self,
        description: str,
        work_type: str = "feature",
        work_id: Optional[str] = None,
    ) -> str:
        """Generate a semantic branch name.

        Args:
            description: Brief description of the work
            work_type: Type of work (feature, bug, chore, patch)
            work_id: Optional work item ID to include

        Returns:
            Generated branch name following conventions
        """
        # Normalize description to slug
        slug = description.lower()
        slug = re.sub(r"[^a-z0-9]+", "-", slug)
        slug = re.sub(r"-+", "-", slug).strip("-")
        slug = slug[:50]  # Limit length

        # Get prefix from config
        prefixes = self.config.get("branch_prefixes", {})
        prefix = prefixes.get(work_type, "feat")

        if work_id:
            return f"{prefix}/{work_id}-{slug}"
        return f"{prefix}/{slug}"

    # =========================================================================
    # Commit Operations
    # =========================================================================

    def stage_all(self) -> None:
        """Stage all changes."""
        self._run_git(["add", "-A"])

    def stage_files(self, files: list[str]) -> None:
        """Stage specific files."""
        self._run_git(["add"] + files)

    def commit(
        self,
        message: str,
        commit_type: str = "feat",
        scope: Optional[str] = None,
        work_id: Optional[str] = None,
        breaking: bool = False,
        body: Optional[str] = None,
    ) -> Commit:
        """Create a semantic commit.

        Args:
            message: Commit message (without type prefix)
            commit_type: Conventional commit type (feat, fix, chore, docs, etc.)
            scope: Optional scope for the commit
            work_id: Optional work item ID to reference
            breaking: Whether this is a breaking change
            body: Extended commit description

        Returns:
            Created Commit object
        """
        # Build conventional commit message
        prefix = commit_type
        if scope:
            prefix = f"{commit_type}({scope})"
        if breaking:
            prefix = f"{prefix}!"

        full_message = f"{prefix}: {message}"

        if body:
            full_message += f"\n\n{body}"

        if work_id:
            full_message += f"\n\nRefs: #{work_id}"

        # Stage if there are unstaged changes
        status = self._run_git(["status", "--porcelain"])
        if status.stdout.strip():
            self.stage_all()

        self._run_git(["commit", "-m", full_message])

        # Get the commit we just created
        result = self._run_git(["log", "-1", "--format=%H|%s|%an|%ai"])
        parts = result.stdout.strip().split("|")

        return Commit(
            sha=parts[0],
            message=parts[1],
            author=parts[2],
            date=parts[3],
        )

    def get_commits(
        self,
        since: Optional[str] = None,
        until: Optional[str] = None,
        limit: int = 50,
    ) -> list[Commit]:
        """Get commit history.

        Args:
            since: Start commit/branch
            until: End commit/branch
            limit: Maximum commits to return

        Returns:
            List of Commit objects
        """
        args = ["log", f"-{limit}", "--format=%H|%s|%an|%ai"]

        if since and until:
            args.append(f"{since}..{until}")
        elif since:
            args.append(since)

        result = self._run_git(args)
        commits = []

        for line in result.stdout.strip().split("\n"):
            if not line:
                continue
            parts = line.split("|")
            commits.append(Commit(
                sha=parts[0],
                message=parts[1],
                author=parts[2],
                date=parts[3],
            ))

        return commits

    # =========================================================================
    # Remote Operations
    # =========================================================================

    def push(
        self,
        branch: Optional[str] = None,
        remote: str = "origin",
        set_upstream: bool = False,
        force: bool = False,
    ) -> dict[str, Any]:
        """Push to remote.

        Args:
            branch: Branch to push (default: current)
            remote: Remote name
            set_upstream: Set upstream tracking
            force: Force push (dangerous!)

        Returns:
            Result dict with success status
        """
        branch = branch or self.get_current_branch()

        args = ["push"]
        if force:
            args.append("--force-with-lease")
        if set_upstream:
            args.extend(["-u", remote, branch])
        else:
            args.extend([remote, branch])

        self._run_git(args)
        return {"success": True, "branch": branch, "remote": remote}

    def pull(
        self,
        branch: Optional[str] = None,
        remote: str = "origin",
        rebase: bool = False,
    ) -> dict[str, Any]:
        """Pull from remote.

        Args:
            branch: Branch to pull
            remote: Remote name
            rebase: Use rebase instead of merge

        Returns:
            Result dict
        """
        args = ["pull", remote]
        if branch:
            args.append(branch)
        if rebase:
            args.append("--rebase")

        self._run_git(args)
        return {"success": True}

    def fetch(self, remote: str = "origin", prune: bool = True) -> dict[str, Any]:
        """Fetch from remote.

        Args:
            remote: Remote name
            prune: Prune deleted branches

        Returns:
            Result dict
        """
        args = ["fetch", remote]
        if prune:
            args.append("--prune")

        self._run_git(args)
        return {"success": True}

    # =========================================================================
    # Pull Request Operations (via provider)
    # =========================================================================

    def create_pr(
        self,
        title: str,
        body: str,
        head: Optional[str] = None,
        base: Optional[str] = None,
        draft: bool = False,
    ) -> PullRequest:
        """Create a pull request.

        Args:
            title: PR title
            body: PR body/description
            head: Head branch (default: current)
            base: Base branch (default: main)
            draft: Create as draft PR

        Returns:
            Created PullRequest object
        """
        import json

        head = head or self.get_current_branch()
        base = base or self.get_default_branch()

        args = [
            "gh", "pr", "create",
            "--title", title,
            "--body", body,
            "--head", head,
            "--base", base,
        ]
        if draft:
            args.append("--draft")

        result = subprocess.run(args, capture_output=True, text=True, check=True)

        # Output is the PR URL
        pr_url = result.stdout.strip()
        pr_number = int(pr_url.split("/")[-1])

        return self.get_pr(pr_number)

    def get_pr(self, number: int) -> PullRequest:
        """Get pull request details."""
        import json

        result = subprocess.run(
            ["gh", "pr", "view", str(number), "--json",
             "number,title,body,state,headRefName,baseRefName,url,isDraft"],
            capture_output=True,
            text=True,
            check=True,
        )
        data = json.loads(result.stdout)

        return PullRequest(
            number=data["number"],
            title=data["title"],
            body=data.get("body", "") or "",
            state=data["state"].lower(),
            head_branch=data["headRefName"],
            base_branch=data["baseRefName"],
            url=data["url"],
            draft=data.get("isDraft", False),
            raw=data,
        )

    def merge_pr(
        self,
        number: int,
        method: str = "squash",
        delete_branch: bool = True,
    ) -> dict[str, Any]:
        """Merge a pull request.

        Args:
            number: PR number
            method: Merge method (merge, squash, rebase)
            delete_branch: Delete head branch after merge

        Returns:
            Result dict
        """
        args = ["gh", "pr", "merge", str(number), f"--{method}"]
        if delete_branch:
            args.append("--delete-branch")

        subprocess.run(args, capture_output=True, text=True, check=True)
        return {"success": True, "method": method}
