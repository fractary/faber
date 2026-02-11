---
title: CLI Reference
description: Complete command-line interface reference for fractary-faber
visibility: public
---

# CLI Reference

Complete reference for all `fractary-faber` commands, arguments, and options.

## Installation

```bash
npm install -g @fractary/faber-cli

fractary-faber --version
```

## Global Options

All commands accept these options:

| Option | Description |
|--------|-------------|
| `--debug` | Enable debug output |
| `-V, --version` | Output version number |
| `-h, --help` | Display help for command |

## Commands Overview

| Command | Description |
|---------|-------------|
| [`config`](#config) | Configuration management |
| [`auth`](#auth) | Authentication setup |
| [`workflow-plan`](#workflow-plan) | Plan workflows for GitHub issues |
| [`workflow-run`](#workflow-run) | Execute a FABER workflow |
| [`run-inspect`](#run-inspect) | Show workflow run status |
| [`workflow-resume`](#workflow-resume) | Resume a paused workflow |
| [`workflow-pause`](#workflow-pause) | Pause a running workflow |
| [`workflow-recover`](#workflow-recover) | Recover from checkpoint |
| [`workflow-cleanup`](#workflow-cleanup) | Clean up old workflow states |
| [`workflow-create`](#workflow-create) | Create a workflow definition |
| [`workflow-update`](#workflow-update) | Update a workflow definition |
| [`workflow-inspect`](#workflow-inspect) | Inspect a workflow definition |
| [`workflow-debug`](#workflow-debug) | Debug a workflow run |
| [`session-load`](#session-load) | Load active session context |
| [`session-save`](#session-save) | Save workflow session |
| [`runs`](#runs) | Query run file paths |
| [`work`](#work) | Work item tracking |
| [`repo`](#repo) | Repository operations |
| [`logs`](#logs) | Log management |

---

## Config

Manage FABER configuration (`.fractary/config.yaml`).

### config init

Initialize FABER configuration with minimal defaults.

```bash
fractary-faber config init [options]
```

| Option | Description | Default |
|--------|-------------|---------|
| `--workflows-path <path>` | Directory for workflow files | `.fractary/faber/workflows` |
| `--default-workflow <id>` | Default workflow ID | `default` |
| `--autonomy <level>` | Autonomy level: `dry-run\|assisted\|guarded\|autonomous` | `guarded` |
| `--runs-path <path>` | Directory for run artifacts | `.fractary/faber/runs` |
| `--force` | Overwrite existing configuration | |

### config get

Get configuration values.

```bash
fractary-faber config get [key] [options]
```

| Argument | Description |
|----------|-------------|
| `[key]` | Config key path (e.g., `faber.default_workflow`). Omit for full config. |

| Option | Description |
|--------|-------------|
| `--json` | Output as JSON |
| `--raw` | Output raw value without quotes (for shell scripts) |

**Examples:**
```bash
# Get full config
fractary-faber config get --json

# Get a specific value
fractary-faber config get faber.workflows.autonomy

# Get raw value for scripts
fractary-faber config get github.organization --raw
```

### config set

Set a configuration value.

```bash
fractary-faber config set <key> <value>
```

| Argument | Description |
|----------|-------------|
| `<key>` | Config key path (e.g., `faber.workflows.autonomy`) |
| `<value>` | Value to set (auto-parses booleans and numbers) |

### config validate

Validate FABER configuration using the SDK ConfigValidator.

```bash
fractary-faber config validate [options]
```

| Option | Description |
|--------|-------------|
| `--json` | Output validation results as JSON |

### config update

Update configuration fields with backup and validation.

```bash
fractary-faber config update <changes...> [options]
```

| Argument | Description |
|----------|-------------|
| `<changes...>` | Key=value pairs (e.g., `faber.workflows.autonomy=autonomous`) |

| Option | Description |
|--------|-------------|
| `--dry-run` | Preview changes without applying |
| `--json` | Output results as JSON |

**Example:**
```bash
fractary-faber config update faber.workflows.autonomy=autonomous --dry-run
```

### config migrate

Migrate legacy configuration to new simplified format.

```bash
fractary-faber config migrate [options]
```

| Option | Description |
|--------|-------------|
| `--dry-run` | Show what would be migrated without making changes |

### config path

Show configuration file path.

```bash
fractary-faber config path
```

### config exists

Check if configuration file exists. Exits 0 if yes, 1 if no.

```bash
fractary-faber config exists
```

---

## Auth

Authentication management.

### auth setup

Set up GitHub App authentication for FABER CLI. Interactive guided flow that creates a new GitHub App or configures an existing one.

```bash
fractary-faber auth setup [options]
```

| Option | Description | Default |
|--------|-------------|---------|
| `--org <name>` | GitHub organization name | Auto-detected from git remote |
| `--repo <name>` | GitHub repository name | Auto-detected from git remote |
| `--config-path <path>` | Path to config file | `.fractary/config.yaml` |
| `--show-manifest` | Display manifest JSON before setup | |
| `--no-save` | Display credentials without saving | |

---

## Workflow Commands

### workflow-plan

Plan workflows for GitHub issues. Fetches issues, assigns workflows, creates branches/worktrees, and generates execution plans via the Anthropic API.

```bash
fractary-faber workflow-plan [options]
```

| Option | Description | Default |
|--------|-------------|---------|
| `--work-id <ids>` | Comma-separated list of work item IDs (e.g., `"258,259,260"`) | |
| `--work-label <labels>` | Comma-separated label filters (e.g., `"workflow:etl,status:approved"`) | |
| `--workflow <name>` | Override workflow (default: read from issue `workflow:*` label) | |
| `--no-worktree` | Skip worktree creation | |
| `--no-branch` | Skip branch creation | |
| `--skip-confirm` | Skip confirmation prompt | |
| `--output <format>` | Output format: `text\|json\|yaml` | `text` |
| `--json` | Output as JSON (shorthand for `--output json`) | |
| `--limit <n>` | Maximum number of issues to plan (max 100) | |
| `--order-by <strategy>` | Order issues by: `priority\|created\|updated\|none` | `none` |
| `--order-direction <dir>` | Order direction: `asc\|desc` | `desc` |

Either `--work-id` or `--work-label` is required (but not both).

### workflow-run

Run FABER workflow for a work item through all 5 phases (Frame, Architect, Build, Evaluate, Release).

```bash
fractary-faber workflow-run [options]
```

| Option | Description | Default |
|--------|-------------|---------|
| `--work-id <id>` | Work item ID to process (required) | |
| `--autonomy <level>` | Autonomy level: `supervised\|assisted\|autonomous` | `supervised` |
| `--json` | Output as JSON | |

### run-inspect

Show workflow run status.

```bash
fractary-faber run-inspect [options]
```

| Option | Description |
|--------|-------------|
| `--work-id <id>` | Work item ID to check |
| `--workflow-id <id>` | Workflow ID to check |
| `--verbose` | Show detailed phase status |
| `--json` | Output as JSON |

If neither `--work-id` nor `--workflow-id` is provided, lists all workflows.

### workflow-resume

Resume a paused workflow.

```bash
fractary-faber workflow-resume <workflow_id> [options]
```

| Argument | Description |
|----------|-------------|
| `<workflow_id>` | Workflow ID to resume |

| Option | Description |
|--------|-------------|
| `--json` | Output as JSON |

### workflow-pause

Pause a running workflow.

```bash
fractary-faber workflow-pause <workflow_id> [options]
```

| Argument | Description |
|----------|-------------|
| `<workflow_id>` | Workflow ID to pause |

| Option | Description |
|--------|-------------|
| `--json` | Output as JSON |

### workflow-recover

Recover a workflow from checkpoint.

```bash
fractary-faber workflow-recover <workflow_id> [options]
```

| Argument | Description |
|----------|-------------|
| `<workflow_id>` | Workflow ID to recover |

| Option | Description |
|--------|-------------|
| `--checkpoint <id>` | Specific checkpoint ID to recover from |
| `--phase <phase>` | Recover to specific phase |
| `--json` | Output as JSON |

### workflow-cleanup

Clean up old workflow states.

```bash
fractary-faber workflow-cleanup [options]
```

| Option | Description | Default |
|--------|-------------|---------|
| `--max-age <days>` | Delete workflows older than N days | `30` |
| `--json` | Output as JSON | |

### workflow-create

Create a new workflow definition.

```bash
fractary-faber workflow-create <name> [options]
```

| Argument | Description |
|----------|-------------|
| `<name>` | Workflow name (lowercase, hyphens allowed) |

| Option | Description |
|--------|-------------|
| `--template <id>` | Copy from existing workflow template |
| `--description <text>` | Workflow description |
| `--json` | Output as JSON |

### workflow-update

Update a workflow definition.

```bash
fractary-faber workflow-update <name> [options]
```

| Argument | Description |
|----------|-------------|
| `<name>` | Workflow name to update |

| Option | Description |
|--------|-------------|
| `--description <text>` | New description |
| `--json` | Output as JSON |

### workflow-inspect

Inspect a workflow definition. Shows file location, phases, and inheritance.

```bash
fractary-faber workflow-inspect <name> [options]
```

| Argument | Description |
|----------|-------------|
| `<name>` | Workflow name to inspect |

| Option | Description |
|--------|-------------|
| `--json` | Output as JSON |

### workflow-debug

Debug a workflow run. Shows state, events, and detected issues.

```bash
fractary-faber workflow-debug [options]
```

| Option | Description |
|--------|-------------|
| `--run-id <id>` | Run ID to debug (required) |
| `--json` | Output as JSON |

---

## Session Commands

### session-load

Load active workflow session context.

```bash
fractary-faber session-load [options]
```

| Option | Description |
|--------|-------------|
| `--work-id <id>` | Work item ID to find session for |
| `--run-id <id>` | Specific run ID to load |
| `--json` | Output as JSON |

### session-save

Save workflow session (set active run).

```bash
fractary-faber session-save [options]
```

| Option | Description |
|--------|-------------|
| `--run-id <id>` | Run ID to set as active (required) |
| `--work-id <id>` | Work item ID (for reference) |
| `--json` | Output as JSON |

---

## Runs

Query FABER run paths. All run files are stored in `.fractary/faber/runs/{run_id}/`.

### runs dir

Show runs directory path or specific run directory.

```bash
fractary-faber runs dir [run_id] [options]
```

| Argument | Description |
|----------|-------------|
| `[run_id]` | Run ID (optional - omit for base runs directory) |

| Option | Description |
|--------|-------------|
| `--relative` | Output relative path instead of absolute |
| `--json` | Output as JSON |

### runs plan-path

Show plan file path for a run.

```bash
fractary-faber runs plan-path <run_id> [options]
```

| Option | Description |
|--------|-------------|
| `--relative` | Output relative path instead of absolute |
| `--json` | Output as JSON |

### runs state-path

Show state file path for a run.

```bash
fractary-faber runs state-path <run_id> [options]
```

| Option | Description |
|--------|-------------|
| `--relative` | Output relative path instead of absolute |
| `--json` | Output as JSON |

### runs active-run-id-path

Show active run ID file path (`.fractary/faber/runs/.active-run-id`).

```bash
fractary-faber runs active-run-id-path [options]
```

| Option | Description |
|--------|-------------|
| `--relative` | Output relative path instead of absolute |
| `--json` | Output as JSON |

### runs paths

Show all path templates.

```bash
fractary-faber runs paths [options]
```

| Option | Description |
|--------|-------------|
| `--json` | Output as JSON |

---

## Work

Work item tracking operations (GitHub Issues, Jira, Linear).

### work init

Initialize work tracking configuration. Auto-detects platform from git remote.

```bash
fractary-faber work init [options]
```

| Option | Description |
|--------|-------------|
| `--platform <name>` | Platform: `github`, `jira`, `linear` (auto-detect if not specified) |
| `--token <value>` | API token (or use env var) |
| `--project <key>` | Project key for Jira/Linear |
| `--yes` | Accept defaults without prompting |
| `--json` | Output as JSON |

### work issue fetch

Fetch a work item by ID.

```bash
fractary-faber work issue fetch <number> [options]
```

| Option | Description |
|--------|-------------|
| `--verbose` | Show additional details |
| `--json` | Output as JSON |

### work issue create

Create a new work item.

```bash
fractary-faber work issue create [options]
```

| Option | Description |
|--------|-------------|
| `--title <title>` | Issue title (required) |
| `--body <body>` | Issue body |
| `--labels <labels>` | Comma-separated labels |
| `--assignees <assignees>` | Comma-separated assignees |
| `--json` | Output as JSON |

### work issue update

Update a work item.

```bash
fractary-faber work issue update <number> [options]
```

| Option | Description |
|--------|-------------|
| `--title <title>` | New title |
| `--body <body>` | New body |
| `--state <state>` | New state: `open`, `closed` |
| `--json` | Output as JSON |

### work issue close

Close a work item.

```bash
fractary-faber work issue close <number> [options]
```

| Option | Description |
|--------|-------------|
| `--comment <text>` | Add closing comment |
| `--json` | Output as JSON |

### work issue reopen

Reopen a closed work item.

```bash
fractary-faber work issue reopen <number> [options]
```

| Option | Description |
|--------|-------------|
| `--comment <text>` | Add comment when reopening |
| `--json` | Output as JSON |

### work issue assign

Assign or unassign a work item.

```bash
fractary-faber work issue assign <number> [options]
```

| Option | Description |
|--------|-------------|
| `--user <username>` | User to assign (use `@me` for self, omit to unassign) |
| `--json` | Output as JSON |

### work issue classify

Classify work item type (feature, bug, chore, patch).

```bash
fractary-faber work issue classify <number> [options]
```

| Option | Description |
|--------|-------------|
| `--json` | Output as JSON |

### work issue search

Search work items.

```bash
fractary-faber work issue search [options]
```

| Option | Description | Default |
|--------|-------------|---------|
| `--query <query>` | Search query (required) | |
| `--state <state>` | Filter by state: `open`, `closed`, `all` | `open` |
| `--labels <labels>` | Filter by labels (comma-separated) | |
| `--limit <n>` | Max results | `10` |
| `--json` | Output as JSON | |

### work comment create

Add a comment to an issue.

```bash
fractary-faber work comment create <issue_number> [options]
```

| Option | Description |
|--------|-------------|
| `--body <text>` | Comment body (required) |
| `--json` | Output as JSON |

### work comment list

List comments on an issue.

```bash
fractary-faber work comment list <issue_number> [options]
```

| Option | Description | Default |
|--------|-------------|---------|
| `--limit <n>` | Max results | `20` |
| `--json` | Output as JSON | |

### work label add

Add labels to an issue.

```bash
fractary-faber work label add <issue_number> [options]
```

| Option | Description |
|--------|-------------|
| `--label <names>` | Label name(s), comma-separated (required) |
| `--json` | Output as JSON |

### work label remove

Remove labels from an issue.

```bash
fractary-faber work label remove <issue_number> [options]
```

| Option | Description |
|--------|-------------|
| `--label <names>` | Label name(s), comma-separated (required) |
| `--json` | Output as JSON |

### work label list

List labels.

```bash
fractary-faber work label list [options]
```

| Option | Description |
|--------|-------------|
| `--issue <number>` | List labels for specific issue |
| `--json` | Output as JSON |

### work milestone create

Create a milestone.

```bash
fractary-faber work milestone create [options]
```

| Option | Description |
|--------|-------------|
| `--title <title>` | Milestone title (required) |
| `--description <text>` | Milestone description |
| `--due-on <date>` | Due date (ISO format) |
| `--json` | Output as JSON |

### work milestone list

List milestones.

```bash
fractary-faber work milestone list [options]
```

| Option | Description | Default |
|--------|-------------|---------|
| `--state <state>` | Filter by state: `open`, `closed`, `all` | `open` |
| `--json` | Output as JSON | |

### work milestone set

Set milestone on an issue.

```bash
fractary-faber work milestone set <issue_number> [options]
```

| Option | Description |
|--------|-------------|
| `--milestone <title>` | Milestone title (required) |
| `--json` | Output as JSON |

---

## Repo

Repository and Git operations.

### repo branch create

Create a new branch.

```bash
fractary-faber repo branch create <name> [options]
```

| Option | Description |
|--------|-------------|
| `--base <branch>` | Base branch |
| `--checkout` | Checkout after creation |
| `--json` | Output as JSON |

### repo branch delete

Delete a branch.

```bash
fractary-faber repo branch delete <name> [options]
```

| Option | Description | Default |
|--------|-------------|---------|
| `--location <where>` | Delete location: `local\|remote\|both` | `local` |
| `--force` | Force delete even if not merged | |
| `--json` | Output as JSON | |

### repo branch list

List branches.

```bash
fractary-faber repo branch list [options]
```

| Option | Description |
|--------|-------------|
| `--merged` | Show only merged branches |
| `--stale` | Show stale branches |
| `--pattern <glob>` | Filter by pattern |
| `--limit <n>` | Limit results |
| `--json` | Output as JSON |

### repo commit

Create a commit with conventional commit formatting.

```bash
fractary-faber repo commit [options]
```

| Option | Description | Default |
|--------|-------------|---------|
| `--message <msg>` | Commit message (required) | |
| `--type <type>` | Commit type (`feat`, `fix`, `chore`, etc.) | `feat` |
| `--scope <scope>` | Commit scope | |
| `--work-id <id>` | Associated work item ID | |
| `--breaking` | Mark as breaking change | |
| `--all` | Stage all changes before committing | |
| `--json` | Output as JSON | |

### repo pr create

Create a pull request.

```bash
fractary-faber repo pr create [options]
```

| Option | Description | Default |
|--------|-------------|---------|
| `--title <title>` | PR title (required) | |
| `--body <text>` | PR body | |
| `--base <branch>` | Base branch | `main` |
| `--head <branch>` | Head branch | Current branch |
| `--draft` | Create as draft | |
| `--json` | Output as JSON | |

### repo pr list

List pull requests.

```bash
fractary-faber repo pr list [options]
```

| Option | Description | Default |
|--------|-------------|---------|
| `--state <state>` | Filter by state: `open`, `closed`, `all` | `open` |
| `--author <user>` | Filter by author | |
| `--json` | Output as JSON | |

### repo pr merge

Merge a pull request.

```bash
fractary-faber repo pr merge <number> [options]
```

| Option | Description | Default |
|--------|-------------|---------|
| `--strategy <strategy>` | Merge strategy: `merge`, `squash`, `rebase` | `squash` |
| `--delete-branch` | Delete branch after merge | |
| `--json` | Output as JSON | |

### repo pr review

Review a pull request.

```bash
fractary-faber repo pr review <number> [options]
```

| Option | Description |
|--------|-------------|
| `--approve` | Approve the PR |
| `--request-changes` | Request changes |
| `--comment <text>` | Review comment |
| `--json` | Output as JSON |

### repo tag create

Create a tag.

```bash
fractary-faber repo tag create <name> [options]
```

| Option | Description |
|--------|-------------|
| `--message <text>` | Tag message |
| `--sign` | Sign the tag |
| `--json` | Output as JSON |

### repo tag push

Push tag(s) to remote.

```bash
fractary-faber repo tag push <name> [options]
```

| Argument | Description |
|----------|-------------|
| `<name>` | Tag name or `"all"` |

| Option | Description | Default |
|--------|-------------|---------|
| `--remote <name>` | Remote name | `origin` |
| `--json` | Output as JSON | |

### repo tag list

List tags.

```bash
fractary-faber repo tag list [options]
```

| Option | Description |
|--------|-------------|
| `--pattern <glob>` | Filter by pattern |
| `--latest <n>` | Show only latest N tags |
| `--json` | Output as JSON |

### repo worktree create

Create a worktree.

```bash
fractary-faber repo worktree create <branch> [options]
```

| Option | Description |
|--------|-------------|
| `--path <path>` | Worktree path |
| `--work-id <id>` | Associated work item ID |
| `--json` | Output as JSON |

### repo worktree list

List worktrees.

```bash
fractary-faber repo worktree list [options]
```

| Option | Description |
|--------|-------------|
| `--json` | Output as JSON |

### repo worktree remove

Remove a worktree.

```bash
fractary-faber repo worktree remove <path> [options]
```

| Option | Description |
|--------|-------------|
| `--force` | Force removal |
| `--json` | Output as JSON |

### repo worktree cleanup

Clean up worktrees.

```bash
fractary-faber repo worktree cleanup [options]
```

| Option | Description |
|--------|-------------|
| `--merged` | Clean merged worktrees |
| `--stale` | Clean stale worktrees |
| `--dry-run` | Show what would be cleaned |
| `--json` | Output as JSON |

### repo push

Push to remote.

```bash
fractary-faber repo push [options]
```

| Option | Description | Default |
|--------|-------------|---------|
| `--remote <name>` | Remote name | `origin` |
| `--set-upstream` | Set upstream tracking | |
| `--force` | Force push | |
| `--json` | Output as JSON | |

### repo pull

Pull from remote.

```bash
fractary-faber repo pull [options]
```

| Option | Description | Default |
|--------|-------------|---------|
| `--rebase` | Use rebase instead of merge | |
| `--remote <name>` | Remote name | `origin` |
| `--json` | Output as JSON | |

### repo status

Show repository status (branch, clean state, ahead/behind, staged/modified/untracked/conflicts).

```bash
fractary-faber repo status [options]
```

| Option | Description |
|--------|-------------|
| `--json` | Output as JSON |

---

## Logs

Log management. Supports typed log entries: `session`, `build`, `deployment`, `debug`, `test`, `audit`, `operational`.

### logs capture

Start session capture for an issue.

```bash
fractary-faber logs capture <issue_number> [options]
```

| Option | Description |
|--------|-------------|
| `--model <model>` | Model being used |
| `--json` | Output as JSON |

### logs stop

Stop session capture.

```bash
fractary-faber logs stop [options]
```

| Option | Description |
|--------|-------------|
| `--json` | Output as JSON |

### logs write

Write a typed log entry.

```bash
fractary-faber logs write [options]
```

| Option | Description |
|--------|-------------|
| `--type <type>` | Log type: `session\|build\|deployment\|debug\|test\|audit\|operational` (required) |
| `--title <title>` | Log entry title (required) |
| `--content <text>` | Log content (required) |
| `--issue <number>` | Associated issue number |
| `--json` | Output as JSON |

### logs read

Read a log entry by ID or path.

```bash
fractary-faber logs read <id> [options]
```

| Option | Description |
|--------|-------------|
| `--json` | Output as JSON |

### logs search

Search logs.

```bash
fractary-faber logs search [options]
```

| Option | Description |
|--------|-------------|
| `--query <text>` | Search query (required) |
| `--type <type>` | Filter by log type |
| `--issue <number>` | Filter by issue number |
| `--regex` | Use regex search |
| `--json` | Output as JSON |

### logs list

List logs.

```bash
fractary-faber logs list [options]
```

| Option | Description | Default |
|--------|-------------|---------|
| `--type <type>` | Filter by log type | |
| `--status <status>` | Filter by status: `active`, `archived` | `active` |
| `--issue <number>` | Filter by issue number | |
| `--limit <n>` | Max results | `50` |
| `--json` | Output as JSON | |

### logs archive

Archive old logs.

```bash
fractary-faber logs archive [options]
```

| Option | Description | Default |
|--------|-------------|---------|
| `--max-age <days>` | Archive logs older than N days | `30` |
| `--compress` | Compress archived logs | |
| `--json` | Output as JSON | |

### logs delete

Delete a log entry.

```bash
fractary-faber logs delete <id> [options]
```

| Option | Description |
|--------|-------------|
| `--json` | Output as JSON |

---

## Configuration

The CLI reads configuration from `.fractary/config.yaml` in your project root.

```yaml
version: "2.0"
github:
  organization: your-org
  project: your-repo
  app:
    id: "12345"
    installation_id: "67890"
    private_key_path: ~/.github/faber-your-org.pem
faber:
  workflows:
    path: .fractary/faber/workflows
    default: default
    autonomy: guarded
  runs:
    path: .fractary/faber/runs
```

Initialize with:
```bash
fractary-faber config init
```

Or set up authentication:
```bash
fractary-faber auth setup
```

## Exit Codes

| Code | Meaning |
|------|---------|
| 0 | Success |
| 1 | General error |
| 5 | Not found (e.g., log entry) |

## JSON Output

All commands support `--json` for structured output. Success responses follow this format:

```json
{
  "status": "success",
  "data": { ... }
}
```

Error responses:
```json
{
  "status": "error",
  "error": {
    "code": "ERROR_CODE",
    "message": "Description"
  }
}
```

---

## See Also

- [Getting Started](./getting-started.md) - Installation and setup
- [Concepts](./concepts.md) - Core concepts
- [API Reference](./api.md) - Programmatic SDK API
- [Plugin Reference](./plugin-reference.md) - Plugin commands and agents
- [Configuration Guide](../guides/configuration.md) - Detailed configuration reference
