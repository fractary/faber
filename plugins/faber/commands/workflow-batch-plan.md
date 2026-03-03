---
name: fractary-faber:workflow-batch-plan
description: Plan a batch of FABER workflows for sequential unattended execution - creates batch directory and plans each item in a fresh context via Task spawning
argument-hint: '<work-ids> [--name <batch-id>]'
allowed-tools: Read, Write, Bash, Task
model: claude-sonnet-4-6
---

# FABER Workflow Batch Plan

## Overview

Creates a named batch of workflow plans for sequential unattended execution. Each item is planned in a fresh Claude context via Task spawning (true context isolation). The resulting batch ID is passed to `workflow-batch-run` for execution.

## Syntax

```
/fractary-faber:workflow-batch-plan <work-ids> [--name <batch-id>]
```

## Arguments

| Argument | Required | Description |
|----------|----------|-------------|
| `<work-ids>` | Yes | Comma-separated work item IDs (e.g., "258,259,260") |
| `--name <batch-id>` | No | Custom batch name (default: `batch-YYYY-MM-DDTHH-MM-SSZ`) |

## Protocol

### Step 1: Parse Arguments

From `$ARGUMENTS`:
1. Extract positional comma-separated IDs (e.g., "258,259,260")
2. Extract `--name <value>` if present (the custom batch ID)

Validate:
- At least one work ID provided
- Work IDs are non-empty strings (numeric or alphanumeric)

### Step 2: Generate Batch ID

```bash
# If --name provided, use it directly (sanitize: lowercase, hyphens only)
# Otherwise generate from current timestamp:
date -u +"%Y-%m-%dT%H-%M-%SZ" | xargs -I{} echo "batch-{}"
```

Example output: `batch-2026-02-26T09-00-00Z`

If `--name` provided, use that value as-is (e.g., `overnight-sprint-01`).

### Step 3: Create Batch Directory

```bash
mkdir -p .fractary/faber/batches/{batch-id}
```

### Step 4: Write queue.txt

Write to `.fractary/faber/batches/{batch-id}/queue.txt`:

```
# FABER Batch Queue
# Batch ID: {batch-id}
# Created: {iso-timestamp}
# Format: <work-id> [--workflow custom-workflow] [--phase build,evaluate]

{work-id-1}
{work-id-2}
...
```

### Step 5: Initialize state.json

Write to `.fractary/faber/batches/{batch-id}/state.json`:

```json
{
  "batch_id": "{batch-id}",
  "status": "planning",
  "created_at": "{iso-timestamp}",
  "updated_at": "{iso-timestamp}",
  "items": [
    { "work_id": "{id}", "status": "pending", "plan_id": null, "run_id": null, "error": null }
  ]
}
```

### Step 6: Report Batch ID

Print clearly so the user has the batch ID for the run step:

```
═══════════════════════════════════════════════
  BATCH CREATED: {batch-id}
  Items: {count}
  Queue: .fractary/faber/batches/{batch-id}/queue.txt
  State: .fractary/faber/batches/{batch-id}/state.json
═══════════════════════════════════════════════

Planning {count} items in parallel...
```

### Step 7: Plan All Items in Parallel

#### Phase A — Spawn all planners in a single message

Print before spawning:
```
Planning {count} items in parallel...
```

Launch **all** `faber-planner` Tasks in a **single message** (parallel tool calls). Do not wait between spawns.

```
Task(subagent_type="fractary-faber:faber-planner", description="Plan workflow for #{work-id-1}", prompt="Create execution plan: {work-id-1}")
Task(subagent_type="fractary-faber:faber-planner", description="Plan workflow for #{work-id-2}", prompt="Create execution plan: {work-id-2}")
... (all items in one message)
```

#### Phase B — Collect results, then update state.json

After **all** Tasks have completed (wait for all results), process results sequentially in original order:

- **On success**: Update that item's entry in state.json:
  ```json
  { "work_id": "{id}", "status": "planned", "plan_id": "{plan-id}", "error": null }
  ```
  Print: `  ✓ Planned #{work-id} → {plan-id}`

- **On failure**: Update that item's entry in state.json:
  ```json
  { "work_id": "{id}", "status": "plan_failed", "error": "{error-summary}" }
  ```
  Print: `  ✗ Plan failed for #{work-id}: {error}`

Update top-level `updated_at` once after all items are processed.

> **Why no conflict**: Planners only write to `.fractary/faber/runs/{plan_id}/plan.json`. The parent is the sole writer of `state.json`, and it only writes after all Tasks have returned — no concurrent access.

> **Context isolation**: Each Task spawn creates a completely fresh Claude context — no carry-over of state, code, or context from prior items. This is the true `/clear` equivalent.

> **Task isolation note**: The spawned `faber-planner` agent must NOT use TaskCreate,
> TaskUpdate, TaskList, or TaskGet for internal tracking (enforced by CRITICAL_RULES
> rule 8 in faber-planner). These tools are session-scoped — tasks created inside a
> Task spawn appear in the parent session. If tasks appear in the session list after
> planning completes, report this as a bug in the faber-planner agent.

### Step 8: Final Report

After all items are processed:

1. Update state.json `status`:
   - `"planned"` if all succeeded
   - `"planning_partial"` if some failed

2. Update `updated_at`.

3. Print summary:

```
═══════════════════════════════════════════════
  BATCH PLANNING COMPLETE
  Batch ID: {batch-id}
  Total: {N} | Planned: {M} | Failed: {K}
═══════════════════════════════════════════════

To run this batch overnight (unattended):
  /fractary-faber:workflow-batch-run --batch {batch-id} --autonomous

To run interactively:
  /fractary-faber:workflow-batch-run --batch {batch-id}
```

## Examples

```bash
# Plan 3 issues, auto-generated batch ID
/fractary-faber:workflow-batch-plan 258,259,260

# Plan with a readable name
/fractary-faber:workflow-batch-plan 258,259,260 --name overnight-sprint-01

# Plan 5 issues
/fractary-faber:workflow-batch-plan 258,259,260,261,262 --name sprint-02

# Plan then run (two-step)
/fractary-faber:workflow-batch-plan 258,259,260 --name sprint-03
/fractary-faber:workflow-batch-run --batch sprint-03 --autonomous
```
