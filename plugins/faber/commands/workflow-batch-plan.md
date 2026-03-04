---
name: fractary-faber:workflow-batch-plan
description: Plan a batch of FABER workflows for sequential unattended execution - creates batch directory and plans each item in a fresh context via Task spawning
argument-hint: '<work-ids> [--name <batch-id>]'
allowed-tools: Write, Task(fractary-faber:faber-planner), Task(fractary-faber:faber-plan-validator), Task(fractary-faber:workflow-plan-reporter)
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

```javascript
// If --name provided, use it directly (sanitize: lowercase, hyphens only)
// Otherwise generate from current timestamp:
const batchId = `batch-${new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5)}Z`;
```

Example output: `batch-2026-02-26T09-00-00Z`

If `--name` provided, use that value as-is (e.g., `overnight-sprint-01`).

### Step 3: Create Batch Directory

The directory is created automatically when writing the first file in Step 4.

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

### Step 7c: Validate All Planned Items in Parallel

For each item where `status === "planned"` (plan_id is known), spawn a validation Task in parallel (all in a single message):

```
Task(subagent_type="fractary-faber:faber-plan-validator",
     description="Validate plan for #{work-id}",
     prompt="Validate plan: --plan-id {plan_id}")
```

After all validation Tasks complete, update state.json sequentially:
- On validation pass: `item.status = "validated"`
- On validation fail: `item.status = "validation_failed"`, `item.error = reason`

Print per-item:
- `  ✓ Validated #{work-id} → {plan_id}`
- `  ✗ Validation failed #{work-id}: {reason}`

Update top-level `updated_at` once after all items are processed.

### Step 8: Final Report

After all items are processed:

1. Update state.json `status`:
   - `"validated"` if all items validated successfully
   - `"planning_partial"` if any items failed to plan or validate

2. Update `updated_at`.

3. For each item with `status === "validated"`, invoke the plan reporter sequentially:

```javascript
for (const item of validatedItems) {
  await Task({
    subagent_type: "fractary-faber:workflow-plan-reporter",
    description: `Report plan summary for ${item.plan_id}`,
    prompt: `Report plan: --plan-id ${item.plan_id}`
  });
}
```

4. Print summary:

```
═══════════════════════════════════════════════
  BATCH PLANNING COMPLETE
  Batch ID: {batch-id}
  Total: {N} | Validated: {V} | Validation Failed: {VF} | Plan Failed: {K}
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
