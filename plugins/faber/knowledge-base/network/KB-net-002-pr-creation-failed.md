---
id: KB-net-002
title: Pull request creation failed
category: network
severity: medium
symptoms:
  - "Failed to create pull request"
  - "gh pr create failed"
  - "Branch does not exist on remote"
  - "No commits between"
agents:
  - deployer
  - release-manager
phases:
  - release
context_type: agent
tags:
  - pull-request
  - github
  - git
  - release
created: 2026-01-28
verified: true
success_count: 12
---

# Pull Request Creation Failed

## Symptoms

The release phase fails when attempting to create a pull request:
- `Failed to create pull request`
- `gh pr create` command fails
- `Branch 'feature-x' does not exist on remote`
- `No commits between 'main' and 'feature-branch'`
- `Pull request already exists`

## Root Cause

PR creation failures typically result from:
- Local branch not pushed to remote
- No changes between source and target branches
- PR already exists for this branch
- Branch name conflicts or invalid characters
- GitHub API rate limiting
- Network connectivity issues

## Solution

Diagnose and fix the PR creation issue.

### Actions

1. Ensure the branch is pushed to remote:
   ```bash
   git push -u origin <branch-name>
   ```

2. Verify there are commits to include:
   ```bash
   git log main..<branch-name> --oneline
   ```

3. If PR already exists, update it instead:
   ```bash
   gh pr view <branch-name>
   # Or push new commits to update existing PR
   git push origin <branch-name>
   ```

4. Check for valid branch name (no special characters):
   ```bash
   # Good: feature/add-login, fix-123-bug
   # Bad: feature/add login, fix#123
   ```

5. For rate limiting, wait and retry:
   ```bash
   gh api rate_limit
   ```

6. Retry PR creation:
   ```bash
   gh pr create --title "Title" --body "Description"
   ```

## Prevention

- Always push branches before attempting PR creation
- Use consistent branch naming conventions
- Check for existing PRs before creating new ones
- Handle PR creation idempotently in automation
- Monitor GitHub API rate limits in CI/CD
