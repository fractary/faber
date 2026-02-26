---
name: fractary-faber:workflow-batch-run
description: Execute a planned FABER batch sequentially with true context isolation per item - each workflow runs in a fresh Claude context via Task spawning
argument-hint: '--batch <batch-id> [--autonomous] [--resume]'
allowed-tools: Read, Write, Bash, Task, AskUserQuestion
model: claude-sonnet-4-6
---

# FABER Workflow Batch Run

## Overview

Executes all planned items from an existing batch sequentially. Each item runs in a completely fresh Claude context via Task spawning — the real context reset, not a protocol-only directive.

**Key behaviors:**
- `--autonomous`: Auto-skip failed items, no user prompts (designed for overnight unattended runs)
- `--resume`: Skip already-completed items (safe to re-run after interruption)
- Each Task spawn = completely fresh context, zero carry-over from prior items

## Syntax

```
/fractary-faber:workflow-batch-run --batch <batch-id> [--autonomous] [--resume]
```

## Arguments

| Option | Required | Description |
|--------|----------|-------------|
| `--batch <batch-id>` | Yes | Batch ID from `workflow-batch-plan` (e.g., `overnight-sprint-01`) |
| `--autonomous` | No | Skip user prompts on failure, auto-continue to next item |
| `--resume` | No | Resume from last completed item (skip completed/skipped items) |

## Protocol

### Step 1: Parse Arguments

From `$ARGUMENTS`:
1. Extract `--batch <value>` — required
2. Extract `--autonomous` flag
3. Extract `--resume` flag

If `--batch` is missing, error:
```
Error: --batch <batch-id> is required.
Usage: /fractary-faber:workflow-batch-run --batch <batch-id> [--autonomous] [--resume]
```

### Step 2: Load Batch State

Read `.fractary/faber/batches/{batch-id}/state.json`.

If not found:
```
Error: Batch '{batch-id}' not found.
Expected: .fractary/faber/batches/{batch-id}/state.json

To create a batch, use:
  /fractary-faber:workflow-batch-plan <work-ids> --name {batch-id}
```

### Step 3: Check Batch Status

If `state.status === "completed"`:
```
✓ Batch '{batch-id}' already completed. Nothing to do.
  Completed: {N}/{N} items

To re-run, manually edit state.json and set items to "pending".
```
Stop.

### Step 4: Filter Items to Process

Build the list of items to execute:

- **With `--resume`**: Include only items where `status` is NOT `completed` or `skipped`
- **Without `--resume`**: Include ALL items (even if some were previously run)

Print current progress if resuming:
```
→ Resuming batch '{batch-id}'
  Progress: {completed}/{total} completed, {remaining} remaining
```

### Step 5: Execute Each Item

For each item (in order):

#### 5a. Print Item Header

```
═══ Workflow {i}/{total}: #{work-id} ═══
```

#### 5b. Update State — Mark as In Progress

Write to state.json: `item.status = "in_progress"`, `item.started_at = {iso-timestamp}`, top-level `updated_at`.

#### 5c. Spawn Task for Workflow Execution

```
Task(
  subagent_type="general-purpose",
  description="Execute FABER workflow for #{work-id}",
  prompt="Execute the FABER workflow for work item #{work-id}.

Use the Skill tool to invoke: fractary-faber:workflow-run {work-id}

This is an autonomous execution. Follow the complete workflow to completion.
Do not stop or ask for confirmation — execute all phases through to completion.
If you encounter errors that cannot be recovered, post a failure comment to the GitHub issue and exit."
)
```

> **Context isolation**: Each Task spawn creates a completely fresh Claude context — no carry-over of state, code, test results, or memory from prior items. This is why batch-run provides true unattended overnight execution, unlike the in-process `--resume-batch` mode which shares context.

#### 5d. Wait for Task Result

Wait for the spawned Task to complete.

#### 5e: Handle Result

**On success** (Task completed without error):

```json
{
  "work_id": "{id}",
  "status": "completed",
  "run_id": null,
  "completed_at": "{iso-timestamp}",
  "error": null
}
```

Print: `  ✓ Completed: #{work-id}`

**On failure** (Task returned error or threw):

Extract error summary from Task result.

**Autonomous mode** (`--autonomous`):

```json
{
  "work_id": "{id}",
  "status": "failed",
  "skipped": true,
  "error": "{error-summary}",
  "completed_at": "{iso-timestamp}"
}
```

Print:
```
  ✗ Failed: #{work-id} — {error-summary}
  → Auto-skipping (autonomous mode). Continuing to next item.
```

Continue to next item — no user prompt.

> Note: The spawned `workflow-run` already posts a failure comment to the GitHub issue via its existing failure handler. The batch orchestrator does not need to post additional comments.

**Non-autonomous mode** (interactive):

Ask user:
```
✗ Workflow failed for #{work-id}: {error-summary}

What would you like to do?
```

Options:
- **Stop batch**: Exit immediately, leave remaining items as pending
- **Skip and continue**: Mark item as skipped, continue to next
- **Retry**: Re-spawn the same Task for this item (one retry only)

On retry failure: offer Stop/Skip again.

#### 5f. Update Batch State

After each item, write updated state.json to disk immediately (so state is never lost if the session is interrupted mid-batch).

### Step 6: Final Report

After all items are processed:

1. Determine final batch status:
   - All `completed` → `"completed"`
   - Any `failed` or `skipped` → `"completed_with_failures"`
   - Stopped early → `"paused"`

2. Update `state.json` top-level `status` and `updated_at`.

3. Print summary:

```
═══════════════════════════════════════════════
  BATCH RUN COMPLETE: {batch-id}
  Total: {N} | Completed: {C} | Failed/Skipped: {F}
═══════════════════════════════════════════════

Results:
  ✓ #258 — completed
  ✓ #259 — completed
  ✗ #260 — failed: {error-summary}
  ✓ #261 — completed

Batch state saved to:
  .fractary/faber/batches/{batch-id}/state.json
```

If any failures:
```
To retry failed items:
  /fractary-faber:workflow-batch-run --batch {batch-id} --autonomous --resume
```

## Step-Level Recovery

Step-level recovery (auto-fix, retries within a single workflow) is handled entirely by the spawned `workflow-run`. The batch orchestrator only sees the final pass/fail outcome. If a step auto-recovers within the spawned workflow, the batch never knows — it just sees success.

## Examples

```bash
# Plan first, then run overnight
/fractary-faber:workflow-batch-plan 258,259,260 --name overnight-sprint-01
/fractary-faber:workflow-batch-run --batch overnight-sprint-01 --autonomous

# Resume after interruption
/fractary-faber:workflow-batch-run --batch overnight-sprint-01 --autonomous --resume

# Interactive run (prompts on failure)
/fractary-faber:workflow-batch-run --batch overnight-sprint-01

# Two worktrees, different batches — no state collision
# Worktree 1: /fractary-faber:workflow-batch-run --batch sprint-backend --autonomous
# Worktree 2: /fractary-faber:workflow-batch-run --batch sprint-frontend --autonomous
```
