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
| [`workflow-execute`](#workflow-execute) | Execute a plan.json using the multi-model executor (no Claude Code required) |
| [`workflow-resolve`](#workflow-resolve) | Resolve a workflow with full inheritance chain |
| [`workflow-batch-plan`](#workflow-batch-plan) | Initialize a batch for sequential unattended execution |
| [`workflow-batch-run`](#workflow-batch-run) | Execute a planned batch sequentially with state tracking |
| [`run-inspect`](#run-inspect) | Show workflow run status |
| [`workflow-resume`](#workflow-resume) | Resume a paused workflow |
| [`workflow-pause`](#workflow-pause) | Pause a running workflow |
| [`workflow-recover`](#workflow-recover) | Recover from checkpoint |
| [`workflow-cleanup`](#workflow-cleanup) | Clean up old workflow states |
| [`workflow-create`](#workflow-create) | Create a workflow definition |
| [`workflow-update`](#workflow-update) | Update a workflow definition |
| [`workflow-inspect`](#workflow-inspect) | Inspect a workflow definition (project-local registry) |
| [`workflow-debug`](#workflow-debug) | Debug a workflow run |
| [`migrate`](#migrate) | Migrate legacy configuration to new format |
| [`session-load`](#session-load) | Load active session context |
| [`session-save`](#session-save) | Save workflow session |
| [`runs`](#runs) | Query run file paths |
| [`work`](#work) | Work item tracking |
| [`repo`](#repo) | Repository operations |
| [`logs`](#logs) | Log management |
| [`changelog`](#changelog) | Machine-readable changelog management |

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

### workflow-run (removed)

> **Removed.** Workflow execution now uses the `fractary-faber-workflow-run` skill instead of the CLI. The CLI command has been removed to prevent divergent behavior between skill and CLI execution paths.

### workflow-batch-plan

Initialize a named batch of workflows for sequential unattended execution. Creates the batch directory, `queue.txt`, and `state.json`. Invokes `workflow-plan` for each work item and tracks per-item status.

```bash
fractary-faber workflow-batch-plan [options]
```

| Option | Description | Default |
|--------|-------------|---------|
| `--work-id <ids>` | Comma-separated work item IDs (e.g., `"258,259,260"`) (required) | |
| `--name <batch-id>` | Custom batch name/ID | `batch-YYYY-MM-DDTHH-MM-SSZ` |
| `--autonomous` | Continue on plan failures without prompting | |
| `--json` | Output as JSON | |

Creates `.fractary/faber/batches/{batch-id}/` with `queue.txt` and `state.json`. Prints the batch ID on completion — this ID is passed to `workflow-batch-run`.

**Claude Code skill equivalent**: `/fractary-faber-workflow-batch-plan <work-ids> [--name <batch-id>]`
(The skill version spawns a fresh Claude context per item via Task for true context isolation.)

### workflow-batch-run (removed)

> **Removed.** Batch workflow execution now uses the `fractary-faber-workflow-batch-run` skill. Use `workflow-batch-plan` to create the batch, then invoke the skill to execute it.

### workflow-execute

Execute a plan.json using the multi-model executor framework. This is a CLI-native executor — it does not require a Claude Code session.

```bash
fractary-faber workflow-execute <plan-path> [options]
```

| Argument | Description |
|----------|-------------|
| `<plan-path>` | Path to the `plan.json` file generated by `workflow-plan` |

| Option | Description | Default |
|--------|-------------|---------|
| `--model <model>` | Default model for steps without an explicit executor | `claude-sonnet-5` |
| `--phase <phases>` | Execute only specified phase(s) — comma-separated (e.g., `build,evaluate`) | |
| `--step <step-id>` | Execute only a specific step | |
| `--resume <run-id>` | Resume an earlier run of this plan, skipping the steps it completed | |
| `--approve <step-id>` | Approve the step a resumed run is waiting on (needs `--resume`) | |
| `--json` | Output as JSON | |

Each execution is a run with its own ID, `{plan_id}-run-{timestamp}`. The run's state is saved next to the plan, in `state-{timestamp}.json`, after every step starts and finishes, in the same format the `fractary-faber-workflow-run` skill writes. A run that crashed, failed, or ran only some phases can be resumed with `--resume`: completed steps are skipped and the interrupted or failed step runs again. The run ends `completed`, `failed`, or `paused` (when a phase or step filter left steps unrun); inspect it with `run-inspect --run-id <run-id>` or check it with `runs verify-complete <run-id>`.

**Approval gates.** Before a step that needs a person's approval, the run stops, is saved as `awaiting_approval`, and the command exits with code `3`. A step needs approval when:
- it is listed in the workflow's `autonomy.require_approval_for`;
- it is the first step to run in a phase with `require_approval: true`;
- it is the first release step and `autonomy.pause_before_release` is set.

To continue, resume the run and approve that step: `--resume <run-id> --approve <step-id>`. The approval applies only to the step the run is waiting on, in that invocation, and is recorded in the step's `approved_at`. Nothing else counts as approval: not the autonomy level, and not a run started by a trigger. A phase gate is asked once; resuming a run that already entered the phase does not ask again.

**Failures and retries.** A failed step is handled by its `on_failure` (set on the step, phase or workflow; default `stop`):
- `stop`: the run stops. Resuming it runs the step again.
- `retry`: the step runs again while the phase has retries left, then the run stops. A phase's `max_retries` sets how many it has: evaluate has 3 unless the workflow sets it, other phases have none.
- A slash command, such as `/fractary-faber-workflow-debug`: the command runs once, in its own session, and gets the step's context in a JSON file passed as `--step-context-file`. The step runs again only when the command returns a recovery plan with `action: "retry"` and `requires_approval: false`, and the phase has retries left. Otherwise the run stops.
- `continue`: the run goes on to the next step and ends `failed`.

Retries are counted per phase and saved in the run's state, so resuming a run does not give it new retries. The state also records each step's `attempts` and every retry or stop that `retry` or a command decided (`failure_recoveries`).

Exit codes: `0` completed or paused, `1` failed, `3` waiting for approval.

Steps run in the root the plan belongs to, the directory that contains `.fractary/faber/runs/{plan_id}/`: the worktree when the plan was created with `--worktree`, otherwise the project root. For a plan stored elsewhere, steps run in the project root found from the current directory.

An agent or model step's result comes from the FABER response block at the end of its output (see the plugin's `docs/RESPONSE-FORMAT.md`). A step that reports `failure` fails, so `on_failure: stop` halts the run. A step without a valid block is recorded as a warning with the reason `no_response_block`; a step with `role: validator` fails instead. Shell command steps (`!`) use their exit code.

**Permissions.** An agent step runs in an Agent SDK session with the permission mode set by `permission_mode` on the step, in `phase_defaults`, or in `defaults`. A CLI run has no one to answer a permission prompt, so a tool call that needs permission is denied unless the step's `allowed_tools` or the project's Claude settings (`.claude/settings.json`) allow it.

| `permission_mode` | What the session can do |
|-------------------|-------------------------|
| `acceptEdits` (default) | Edit files, and run file commands such as `mkdir`, `mv` or `rm`, inside the workspace. Other tools that need permission, such as other Bash commands or web access, need an allow rule |
| `default` | Only use tools that need no permission or have an allow rule |
| `plan` | Read and plan. Edits and commands that change files are denied |
| `dontAsk` | Like `default`, with every call that is not allowed denied outright |
| `auto` | A model classifier decides on actions such as shell commands and network requests |
| `bypassPermissions` | Use every tool without a check, except calls that deny or ask rules cover. Use it only where the run is isolated, such as a disposable container: the run starts with a warning that names these steps. The Agent SDK refuses this mode when it runs as root outside a sandbox it recognizes |

Until this version every agent step ran with `bypassPermissions`. To keep that, set `permission_mode: bypassPermissions` in `defaults`. Shell command steps (`!`) have no permission mode. An unknown mode stops the run before any step runs.

**Example:**
```bash
# Execute a full plan
fractary-faber workflow-execute .fractary/faber/runs/abc123/plan.json

# Execute only the build and evaluate phases
fractary-faber workflow-execute .fractary/faber/runs/abc123/plan.json --phase build,evaluate

# Resume a run that was interrupted
fractary-faber workflow-execute .fractary/faber/runs/abc123/plan.json --resume abc123-run-2026-10-06T18-04-05Z

# Approve the step a run stopped before, and continue
fractary-faber workflow-execute .fractary/faber/runs/abc123/plan.json --resume abc123-run-2026-10-06T18-04-05Z --approve release-deploy-apply-prod
```

### workflow-resolve

Resolve a workflow definition with its full inheritance chain, merging all inherited defaults from bundled plugin workflows.

```bash
fractary-faber workflow-resolve <id> [options]
```

| Argument | Description |
|----------|-------------|
| `<id>` | Workflow ID to resolve (e.g., `core`, `default`, `project:my-workflow`) |

| Option | Description |
|--------|-------------|
| `--project-root <path>` | Project root directory (default: current working directory) |
| `--json` | Output as JSON |

**Example:**
```bash
# See the fully resolved default workflow (includes all inherited steps)
fractary-faber workflow-resolve default

# Resolve a project-specific workflow
fractary-faber workflow-resolve project:my-etl-workflow --json
```

---

### migrate

Migrate legacy `.fractary/settings.json` configuration to the new `.fractary/config.yaml` format. This is also available as `config migrate`.

```bash
fractary-faber migrate [options]
```

| Option | Description |
|--------|-------------|
| `--dry-run` | Show what would be migrated without making changes |
| `--no-backup` | Skip creating a backup before migrating |

---

### run-inspect

Show workflow run status.

```bash
fractary-faber run-inspect [options]
```

| Option | Description |
|--------|-------------|
| `--run-id <id>` | Run ID to check (`{plan_id}-run-{timestamp}`) |
| `--work-id <id>` | Work item ID to check |
| `--workflow-id <id>` | Workflow ID to check |
| `--verbose` | Show detailed phase status (and step status for runs) |
| `--json` | Output as JSON |

Runs started by `workflow-execute` or the `fractary-faber-workflow-run` skill are shown by `--run-id`, and by `--work-id` (latest run) when the work item has no active legacy workflow. If no option is provided, lists all workflows and all runs; with `--json`, runs are listed under a separate `runs` key.

### workflow-resume (removed)

> **Removed.** Use the `fractary-faber-workflow-run` skill with `--resume` to resume workflows.

### workflow-pause (removed)

> **Removed.** Workflow pause/resume is managed through the skill-based orchestrator.

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

Query FABER run paths. All run files are stored in `.fractary/faber/runs/{run_id}/`. A plan-scoped run ID (`{plan_id}-run-{timestamp}`) resolves to its plan's directory, where each run has its own state file: `.fractary/faber/runs/{plan_id}/state-{timestamp}.json`.

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

## Changelog

Machine-readable changelog management. Records and queries workflow step events at the project level.

### changelog emit

Emit a changelog entry for a completed workflow step.

```bash
fractary-faber changelog emit [options]
```

| Option | Description |
|--------|-------------|
| `--event-type <type>` | Event type (e.g., `deploy`, `build`, `test`) |
| `--work-id <id>` | Work item ID |
| `--run-id <id>` | Run ID |
| `--phase <phase>` | Workflow phase |
| `--status <status>` | Step status (e.g., `success`, `failure`) |
| `--target <target>` | Target branch/environment/resource |
| `--environment <env>` | Target environment (`test`, `prod`) |
| `--message <msg>` | Human-readable description |
| `--duration-ms <ms>` | Step duration in milliseconds |
| `--metadata <json>` | Step-specific metadata (JSON string) |
| `--custom <json>` | Project-specific custom data (JSON string) |
| `--json` | Output as JSON |

### changelog query

Query the project-level changelog.

```bash
fractary-faber changelog query [options]
```

| Option | Description |
|--------|-------------|
| `--event-type <type>` | Filter by event type |
| `--target <target>` | Filter by target |
| `--phase <phase>` | Filter by phase |
| `--status <status>` | Filter by status |
| `--work-id <id>` | Filter by work item ID |
| `--since <date>` | Filter entries after this date (ISO 8601) |
| `--until <date>` | Filter entries before this date (ISO 8601) |
| `--limit <n>` | Maximum entries to return |
| `--json` | Output as JSON |

### changelog flush

Aggregate per-run changelog entries to the project-level changelog file.

```bash
fractary-faber changelog flush [--run-id <id>] [--json]
```

### changelog read

Read changelog entries for a specific run.

```bash
fractary-faber changelog read <run-id> [--json]
```

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
