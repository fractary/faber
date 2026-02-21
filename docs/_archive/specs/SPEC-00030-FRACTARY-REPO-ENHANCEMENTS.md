# SPEC-00030: fractary-repo Plugin Enhancements for FABER CLI Integration

**Status**: Proposed
**Version**: 1.0
**Date**: 2026-01-06
**Target Plugin**: fractary-repo
**Requesting Component**: FABER CLI

## Overview

This specification defines the enhancements needed in the fractary-repo plugin to support FABER CLI's batch planning architecture. These commands enable FABER to fetch issues, create branches/worktrees, and update issues programmatically.

**Key Requirement**: All commands must be available in **both fractary-repo CLI and SDK** for FABER CLI integration.

## Issue Management Commands

### 1. issue-fetch

**Purpose**: Fetch specific GitHub issues by ID.

**Usage**:
```bash
/fractary-repo:issue-fetch --ids 258,259,260 [--format json]
```

**Parameters**:
- `--ids` (required): Comma-separated list of issue IDs
- `--format` (optional): Output format (`text` or `json`, default: `json`)

**JSON Response**:
```json
{
  "success": true,
  "issues": [
    {
      "id": "258",
      "number": 258,
      "title": "Load IPEDS HD dataset",
      "description": "Import IPEDS HD data for 2024...",
      "labels": ["workflow:etl", "status:approved", "priority:high"],
      "url": "https://github.com/fractary/myproject/issues/258",
      "state": "open",
      "created_at": "2026-01-05T10:30:00Z",
      "updated_at": "2026-01-06T08:15:00Z"
    },
    {
      "id": "259",
      "number": 259,
      "title": "Load IPEDS IC dataset",
      "description": "Import IPEDS IC data for 2024...",
      "labels": ["workflow:etl", "status:approved"],
      "url": "https://github.com/fractary/myproject/issues/259",
      "state": "open",
      "created_at": "2026-01-05T11:00:00Z",
      "updated_at": "2026-01-06T08:16:00Z"
    }
  ]
}
```

**Error Response**:
```json
{
  "success": false,
  "error": "Issue #999 not found",
  "failed_ids": ["999"]
}
```

### 2. issue-search

**Purpose**: Search for GitHub issues matching label criteria.

**Usage**:
```bash
/fractary-repo:issue-search --labels "workflow:etl,status:approved" [--format json]
```

**Parameters**:
- `--labels` (required): Comma-separated list of labels (issues must match ALL labels)
- `--format` (optional): Output format (`text` or `json`, default: `json`)
- `--state` (optional): Issue state filter (`open`, `closed`, `all`, default: `open`)
- `--limit` (optional): Maximum number of results (default: `50`)

**JSON Response**: Same format as `issue-fetch` (array of issues)

**Behavior**:
- Issues must have ALL specified labels (AND logic)
- Returns open issues by default
- Sorted by creation date (newest first)

**Example**:
```bash
# Find all open ETL workflows that are approved
/fractary-repo:issue-search --labels "workflow:etl,status:approved"

# Find all high-priority bugs
/fractary-repo:issue-search --labels "workflow:bugfix,priority:high"
```

### 3. issue-update

**Purpose**: Update GitHub issue with comments or labels.

**Usage**:
```bash
/fractary-repo:issue-update --id 258 [--comment "..."] [--add-label "..."] [--remove-label "..."]
```

**Parameters**:
- `--id` (required): Issue ID to update
- `--comment` (optional): Add a comment to the issue
- `--add-label` (optional): Comma-separated labels to add
- `--remove-label` (optional): Comma-separated labels to remove

**JSON Response**:
```json
{
  "success": true,
  "issue_id": "258",
  "comment_added": true,
  "labels_added": ["faber:planned"],
  "labels_removed": []
}
```

**Example Usage**:
```bash
# Add planning confirmation comment and label
/fractary-repo:issue-update --id 258 \
  --comment "🤖 Workflow plan created: fractary-faber-258-20260106-143022" \
  --add-label "faber:planned"
```

## Branch Management Commands

### 4. branch-create

**Purpose**: Create a new git branch.

**Usage**:
```bash
/fractary-repo:branch-create <branch-name> [--from <base-branch>] [--format json]
```

**Parameters**:
- `<branch-name>` (required): Name of branch to create (e.g., `feature/258`)
- `--from` (optional): Base branch (default: current HEAD or main)
- `--format` (optional): Output format (`text` or `json`, default: `json`)

**JSON Response**:
```json
{
  "success": true,
  "branch": "feature/258",
  "commit": "abc123def456",
  "base_branch": "main",
  "created_at": "2026-01-06T10:30:00Z"
}
```

**Error Handling**:
- If branch exists: `{"success": false, "error": "Branch feature/258 already exists"}`
- Provide `--force` flag to overwrite existing branch (use with caution)

## Worktree Management Commands

### 5. worktree-create

**Purpose**: Create a new git worktree for isolated work.

**Usage**:
```bash
/fractary-repo:worktree-create --work-id 258 [--path <custom-path>] [--format json]
```

**Parameters**:
- `--work-id` (required): Work item ID (used to generate default path and branch)
- `--path` (optional): Custom worktree path (default: `~/.claude-worktrees/{organization}-{project}-{work-id}`)
- `--branch` (optional): Branch name (default: `feature/{work-id}`, creates if doesn't exist)
- `--format` (optional): Output format (`text` or `json`, default: `json`)

**JSON Response**:
```json
{
  "success": true,
  "path": ".claude-worktrees/fractary-myproject-258",
  "absolute_path": "/home/user/.claude-worktrees/fractary-myproject-258",
  "branch": "feature/258",
  "created_at": "2026-01-06T10:30:00Z",
  "organization": "fractary",
  "project": "myproject",
  "work_id": "258"
}
```

**Path Generation Logic**:
```
Default pattern: ~/.claude-worktrees/{organization}-{project}-{work-id}/

Where:
- organization: Extracted from git remote URL (e.g., "fractary" from git@github.com:fractary/myproject.git)
- project: Repository name (e.g., "myproject")
- work-id: Provided work item ID (e.g., "258")

Example: ~/.claude-worktrees/fractary-myproject-258/
```

**Configuration**:
- Worktree location can be configured in fractary-repo settings
- Default: `~/.claude-worktrees/`
- Respects Claude Code worktree configuration if available

### 6. worktree-list

**Purpose**: List all git worktrees.

**Usage**:
```bash
/fractary-repo:worktree-list [--format json|text]
```

**JSON Response**:
```json
{
  "success": true,
  "worktrees": [
    {
      "path": "/home/user/projects/myproject",
      "branch": "main",
      "is_main": true,
      "commit": "abc123"
    },
    {
      "path": "/home/user/.claude-worktrees/fractary-myproject-258",
      "branch": "feature/258",
      "is_main": false,
      "commit": "def456",
      "created_at": "2026-01-06T10:30:00Z",
      "work_id": "258"
    }
  ]
}
```

### 7. worktree-remove

**Purpose**: Remove a git worktree.

**Usage**:
```bash
/fractary-repo:worktree-remove <path> [--force]
```

**Parameters**:
- `<path>` (required): Path to worktree to remove
- `--force` (optional): Force removal even with uncommitted changes

**JSON Response**:
```json
{
  "success": true,
  "path": "/home/user/.claude-worktrees/fractary-myproject-258",
  "removed_at": "2026-01-06T14:00:00Z"
}
```

**Safety Checks**:
- Validate worktree exists
- Check for uncommitted changes (warn/block unless `--force`)
- Cannot remove main worktree
- Cannot remove worktree if it's the current directory

### 8. worktree-prune

**Purpose**: Clean up orphaned or stale worktrees.

**Usage**:
```bash
/fractary-repo:worktree-prune [--dry-run] [--max-age <days>]
```

**Parameters**:
- `--dry-run` (optional): Show what would be removed without removing
- `--max-age` (optional): Remove worktrees older than N days (default: 30)

**JSON Response**:
```json
{
  "success": true,
  "dry_run": false,
  "removed_count": 3,
  "removed_worktrees": [
    {
      "path": "/home/user/.claude-worktrees/fractary-myproject-256",
      "branch": "feature/256",
      "reason": "Branch deleted on remote, no activity for 45 days"
    }
  ],
  "disk_space_freed": "450 MB"
}
```

**Prune Criteria**:
- Branch deleted on remote
- No workflow activity for N days (configurable, default 30)
- Workflow marked complete but worktree not removed

## Configuration

### fractary-repo Settings

```json
{
  "worktree": {
    "default_location": "~/.claude-worktrees/",
    "inherit_from_claude": true,
    "path_pattern": "{organization}-{project}-{work-id}",
    "max_age_days": 30
  },
  "github": {
    "token": "$GITHUB_TOKEN",
    "api_url": "https://api.github.com"
  }
}
```

### Claude Code Integration

If Claude Code has worktree configuration, fractary-repo should respect it:

**Check locations**:
- Linux: `~/.config/claude/config.json`
- macOS: `~/Library/Application Support/Claude/config.json`
- Windows: `%APPDATA%/Claude/config.json`

**Extract**: `worktree.directory` setting if present

## CLI and SDK Availability

**Critical Requirement**: All commands must be available in:

1. **fractary-repo CLI**: For direct user invocation
   ```bash
   fractary-repo issue-fetch --ids 258,259
   fractary-repo worktree-create --work-id 258
   ```

2. **fractary-repo SDK**: For programmatic use by FABER CLI
   ```javascript
   import { RepoClient } from '@fractary/repo-sdk';

   const client = new RepoClient();
   const issues = await client.issueFetch({ ids: ['258', '259'] });
   const worktree = await client.worktreeCreate({ workId: '258' });
   ```

**Note**: Some commands may already exist in the fractary-repo Claude plugin. Please verify and ensure CLI/SDK availability for all commands listed in this spec.

## Error Handling

All commands must return structured error responses:

```json
{
  "success": false,
  "error": "Human-readable error message",
  "error_code": "ISSUE_NOT_FOUND",
  "details": {
    "issue_id": "258",
    "repository": "fractary/myproject"
  }
}
```

**Common Error Codes**:
- `ISSUE_NOT_FOUND`: Issue doesn't exist
- `BRANCH_EXISTS`: Branch already exists (use --force)
- `WORKTREE_EXISTS`: Worktree already exists at path
- `WORKTREE_HAS_CHANGES`: Worktree has uncommitted changes (use --force)
- `PERMISSION_DENIED`: Insufficient GitHub permissions
- `NETWORK_ERROR`: GitHub API unavailable
- `INVALID_PARAMETER`: Invalid command parameter

## Integration with FABER CLI

### FABER CLI Usage Pattern

```javascript
// Fetch issues
const issues = await repoClient.fetchIssues(['258', '259', '260']);

// For each issue, create branch and worktree
for (const issue of issues) {
  await repoClient.createBranch(`feature/${issue.id}`);

  const worktree = await repoClient.createWorktree({
    workId: issue.id
  });

  // Generate plan and write to worktree
  const plan = await generatePlan(issue, workflow);
  await fs.writeFile(`${worktree.path}/.fractary/faber/runs/${planId}/plan.json`, plan);

  // Update issue with plan reference
  await repoClient.updateIssue({
    id: issue.id,
    comment: `🤖 Workflow plan created: ${planId}`,
    addLabel: 'faber:planned'
  });
}
```

## Testing Requirements

### Unit Tests
- Each command with valid inputs
- Each command with invalid inputs
- Error handling for network failures
- Error handling for permission issues

### Integration Tests
- End-to-end: fetch issue → create branch → create worktree → update issue
- Concurrent worktree creation (multiple issues)
- Worktree cleanup after workflow completion

### CLI Tests
- All commands via CLI interface
- JSON output parsing
- Text output formatting

### SDK Tests
- All commands via SDK
- TypeScript type safety
- Promise-based error handling

## Priority and Phasing

### Phase 1 (Critical for FABER CLI):
1. `issue-fetch` - Fetch specific issues
2. `issue-search` - Search by labels
3. `worktree-create` - Create worktrees
4. `issue-update` - Update issues with plan info

### Phase 2 (Important):
5. `branch-create` - Create branches
6. `worktree-list` - List all worktrees
7. `worktree-remove` - Remove worktrees

### Phase 3 (Nice to have):
8. `worktree-prune` - Cleanup orphaned worktrees

## Success Criteria

1. ✅ All commands available in CLI
2. ✅ All commands available in SDK
3. ✅ All commands return structured JSON
4. ✅ Error handling consistent across commands
5. ✅ Configuration respects Claude Code settings
6. ✅ Worktree paths include organization to avoid conflicts
7. ✅ Integration tests pass for FABER CLI use cases
8. ✅ Documentation complete for all commands

## Related Specifications

- [SPEC-00029](./SPEC-00029-FABER-CLI-PLANNING.md) - FABER CLI planning architecture (consumer of these commands)
- [SPEC-00028](./SPEC-00028-faber-worktree-management.md) - Original worktree management spec

## Questions for fractary-repo Team

1. Do any of these commands already exist in the Claude plugin?
2. What is the current SDK structure? TypeScript or JavaScript?
3. Are there existing patterns for command JSON responses?
4. What is the release timeline for fractary-repo enhancements?
5. Should we implement these incrementally or all at once?
