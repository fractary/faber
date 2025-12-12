"""
GitHub Issues provider for WorkManager.
"""

from __future__ import annotations

import os
import subprocess
from typing import Any, Optional

from faber.primitives.work.manager import Comment, Issue
from faber.primitives.work.providers.base import WorkProvider


class GitHubWorkProvider(WorkProvider):
    """GitHub Issues provider using gh CLI."""

    def __init__(self, config: dict[str, Any]) -> None:
        super().__init__(config)
        self.owner = config.get("owner", "")
        self.repo = config.get("repo", "")

        # Auto-detect from git remote if not configured
        if not self.owner or not self.repo:
            self._detect_repo()

    def _detect_repo(self) -> None:
        """Detect owner/repo from git remote."""
        try:
            result = subprocess.run(
                ["gh", "repo", "view", "--json", "owner,name"],
                capture_output=True,
                text=True,
                check=True,
            )
            import json

            data = json.loads(result.stdout)
            self.owner = data.get("owner", {}).get("login", "")
            self.repo = data.get("name", "")
        except (subprocess.CalledProcessError, FileNotFoundError):
            pass

    def _run_gh(self, args: list[str]) -> str:
        """Run gh CLI command and return output."""
        cmd = ["gh"] + args
        if self.owner and self.repo:
            cmd.extend(["--repo", f"{self.owner}/{self.repo}"])

        result = subprocess.run(cmd, capture_output=True, text=True, check=True)
        return result.stdout

    def _parse_issue(self, data: dict[str, Any]) -> Issue:
        """Parse gh JSON output into Issue object."""
        return Issue(
            id=str(data.get("number", "")),
            title=data.get("title", ""),
            body=data.get("body", "") or "",
            state=data.get("state", "").lower(),
            labels=[label.get("name", "") for label in data.get("labels", [])],
            assignee=data.get("assignees", [{}])[0].get("login") if data.get("assignees") else None,
            url=data.get("url", ""),
            raw=data,
        )

    def fetch_issue(self, issue_id: str) -> Issue:
        """Fetch an issue by number."""
        import json

        output = self._run_gh([
            "issue", "view", issue_id,
            "--json", "number,title,body,state,labels,assignees,url"
        ])
        data = json.loads(output)
        return self._parse_issue(data)

    def create_issue(
        self,
        title: str,
        body: str,
        labels: list[str],
        assignee: Optional[str],
    ) -> Issue:
        """Create a new issue."""
        import json

        args = ["issue", "create", "--title", title]

        if body:
            args.extend(["--body", body])
        for label in labels:
            args.extend(["--label", label])
        if assignee:
            args.extend(["--assignee", assignee])

        # Get created issue number from output
        output = self._run_gh(args)
        # Output is URL like https://github.com/owner/repo/issues/123
        issue_number = output.strip().split("/")[-1]

        return self.fetch_issue(issue_number)

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
        args = ["issue", "edit", issue_id]

        if title:
            args.extend(["--title", title])
        if body:
            args.extend(["--body", body])
        if labels is not None:
            # Clear existing and set new labels
            args.extend(["--remove-label", "*"])
            for label in labels:
                args.extend(["--add-label", label])
        if assignee:
            args.extend(["--add-assignee", assignee])

        self._run_gh(args)

        # Handle state change separately
        if state:
            if state.lower() == "closed":
                self._run_gh(["issue", "close", issue_id])
            elif state.lower() == "open":
                self._run_gh(["issue", "reopen", issue_id])

        return self.fetch_issue(issue_id)

    def close_issue(self, issue_id: str, reason: Optional[str]) -> Issue:
        """Close an issue."""
        args = ["issue", "close", issue_id]
        if reason:
            args.extend(["--comment", reason])
        self._run_gh(args)
        return self.fetch_issue(issue_id)

    def create_comment(self, issue_id: str, body: str) -> Comment:
        """Create a comment on an issue."""
        import json

        self._run_gh(["issue", "comment", issue_id, "--body", body])

        # Fetch the latest comment
        comments = self.list_comments(issue_id, limit=1)
        if comments:
            return comments[0]

        # Fallback if we can't fetch
        return Comment(
            id="",
            body=body,
            author="",
            created_at="",
        )

    def list_comments(self, issue_id: str, limit: int) -> list[Comment]:
        """List comments on an issue."""
        import json

        output = self._run_gh([
            "issue", "view", issue_id,
            "--json", "comments"
        ])
        data = json.loads(output)

        comments = []
        for comment_data in data.get("comments", [])[-limit:]:
            comments.append(Comment(
                id=str(comment_data.get("id", "")),
                body=comment_data.get("body", ""),
                author=comment_data.get("author", {}).get("login", ""),
                created_at=comment_data.get("createdAt", ""),
                url=comment_data.get("url", ""),
            ))
        return comments

    def search_issues(
        self,
        query: Optional[str],
        state: str,
        labels: Optional[list[str]],
        limit: int,
    ) -> list[Issue]:
        """Search for issues."""
        import json

        args = ["issue", "list", "--json", "number,title,body,state,labels,assignees,url"]

        if state != "all":
            args.extend(["--state", state])
        if labels:
            for label in labels:
                args.extend(["--label", label])
        args.extend(["--limit", str(limit)])
        if query:
            args.extend(["--search", query])

        output = self._run_gh(args)
        issues_data = json.loads(output)

        return [self._parse_issue(data) for data in issues_data]
