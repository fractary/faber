---
name: fractary-faber:workflow-batch-plan
description: Plan a batch of FABER workflows for sequential unattended execution - creates batch directory and plans each item deterministically via CLI
argument-hint: '<work-ids> [--name <batch-id>]'
allowed-tools: Write, Bash, Read, Task(fractary-faber:workflow-plan-reporter)
model: claude-sonnet-4-6
---

# FABER Workflow Batch Plan

## Overview

Creates a named batch of workflow plans for sequential unattended execution. Each item is planned deterministically via the `fractary-faber workflow-plan` CLI command (no LLM involved in plan generation). The resulting batch ID is passed to `workflow-batch-run` for execution.

## Syntax

```
/fractary-faber:workflow-batch-plan <work-ids> [--name <batch-id>] [--autonomous] [--force-new]
```

## Arguments

| Argument | Required | Description |
|----------|----------|-------------|
| `<work-ids>` | Yes | Comma-separated work item IDs (e.g., "258,259,260") |
| `--name <batch-id>` | No | Custom batch name (default: `batch-YYYY-MM-DDTHH-MM-SSZ`) |
| `--autonomous` | No | Set autonomy level to "autonomous" for all plans. Persisted in state.json so `workflow-batch-run` can forward it without needing the original flag. |
| `--force-new` | No | Force new plan generation even if plans already exist for the items |

## Protocol

### Step 1: Parse Arguments

From `$ARGUMENTS`:
1. Extract positional comma-separated IDs (e.g., "258,259,260")
2. Extract `--name <value>` if present (the custom batch ID)
3. Extract `--autonomous` flag (boolean — true if present, false otherwise)
4. Extract `--force-new` flag (boolean — true if present, false otherwise)

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
  "autonomy": "autonomous",
  "created_at": "{iso-timestamp}",
  "updated_at": "{iso-timestamp}",
  "items": [
    { "work_id": "{id}", "status": "pending", "plan_id": null, "run_id": null, "error": null }
  ]
}
```

The `autonomy` field is set to `"autonomous"` when `--autonomous` flag is provided, or `null` when omitted. This persists the autonomy intent so that `workflow-batch-run` can forward it to auto-planning and validation without needing the original flag.

### Step 6: Report Batch ID

Print clearly so the user has the batch ID for the run step:

```
═══════════════════════════════════════════════
  BATCH CREATED: {batch-id}
  Items: {count}
  Queue: .fractary/faber/batches/{batch-id}/queue.txt
  State: .fractary/faber/batches/{batch-id}/state.json
═══════════════════════════════════════════════

Planning {count} items via CLI (deterministic)...
```

### Step 7: Plan All Items via CLI in Parallel

#### Phase A — Spawn all CLI plan commands in a single message

Print before spawning:
```
Planning {count} items in parallel via CLI...
```

Launch **all** `Bash()` calls in a **single message** (parallel tool calls). Do not wait between spawns.

```
// If --autonomous was provided:
Bash(command="fractary-faber workflow-plan {work-id-1} --skip-confirm --json --autonomy autonomous", description="Plan workflow for #{work-id-1}")
Bash(command="fractary-faber workflow-plan {work-id-2} --skip-confirm --json --autonomy autonomous", description="Plan workflow for #{work-id-2}")

// If --autonomous was NOT provided:
Bash(command="fractary-faber workflow-plan {work-id-1} --skip-confirm --json", description="Plan workflow for #{work-id-1}")
Bash(command="fractary-faber workflow-plan {work-id-2} --skip-confirm --json", description="Plan workflow for #{work-id-2}")

// If --force-new was provided, append --force-new to any of the above:
Bash(command="fractary-faber workflow-plan {work-id-1} --skip-confirm --json --force-new", description="Plan workflow for #{work-id-1}")
Bash(command="fractary-faber workflow-plan {work-id-2} --skip-confirm --json --force-new", description="Plan workflow for #{work-id-2}")
... (all items in one message)
```

> **Why CLI instead of LLM agents**: The CLI's `workflow-plan` command generates plans deterministically via the SDK's `WorkflowResolver` — no LLM is involved. This eliminates the non-determinism that caused batch plans to have inconsistent step counts (38 vs 52, 49 vs 53) when LLM planner agents were used.

> **What the CLI does for each item:**
> - Fetches the issue from GitHub via `fractary-repo`
> - Resolves workflow from issue labels (same Tier 1-4 strategy)
> - Calls SDK `WorkflowResolver.resolveWorkflow()` (deterministic, equivalent to merge-workflows.sh)
> - Builds plan.json via `AnthropicClient.generatePlan()` (deterministic, no LLM)
> - Writes plan.json to `.fractary/faber/runs/{plan_id}/`
> - Posts issue comment with plan summary
> - Returns JSON with plan_id, steps count, etc.

#### Phase B — Collect results, then update state.json

After **all** Bash calls have completed (wait for all results), process results sequentially in original order:

Parse the CLI's `--json` output. Successful output format:
```json
{
  "status": "success",
  "total": 1,
  "successful": 1,
  "failed": 0,
  "results": [{"issue": {...}, "planId": "...", "branch": "...", "worktree": "..."}]
}
```

- **On success** (exit code 0 and `status: "success"` in JSON output):
  Extract `planId` from `results[0].planId`. Update that item's entry in state.json:
  ```json
  { "work_id": "{id}", "status": "planned", "plan_id": "{plan-id}", "error": null }
  ```
  Print: `  ✓ Planned #{work-id} → {plan-id}`

- **On failure** (non-zero exit code or `status: "error"` in JSON):
  Update that item's entry in state.json:
  ```json
  { "work_id": "{id}", "status": "plan_failed", "error": "{error-summary}" }
  ```
  Print: `  ✗ Plan failed for #{work-id}: {error}`

Update top-level `updated_at` once after all items are processed.

> **No validation step needed**: Since the CLI generates plans deterministically (not copied by an LLM), plans are correct by construction. The CLI validates plans against `plan.schema.json` during generation. The LLM validator's main purpose (catching LLM truncation/fabrication) is eliminated.

### Step 8: Final Report

After all items are processed:

1. Update state.json `status`:
   - `"planned"` if all items planned successfully
   - `"planning_partial"` if any items failed to plan

2. Update `updated_at`.

3. For each item with `status === "planned"`, invoke the plan reporter sequentially:

```javascript
for (const item of plannedItems) {
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
  Total: {N} | Planned: {P} | Failed: {K}
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

# Plan with autonomous flag (persisted in state.json for batch-run)
/fractary-faber:workflow-batch-plan 258,259,260 --name sprint-03 --autonomous

# Force re-planning items that already have plans
/fractary-faber:workflow-batch-plan 105,110 --autonomous --force-new

# Plan then run — batch-run reads persisted autonomy from state.json
/fractary-faber:workflow-batch-plan 258,259,260 --name sprint-03 --autonomous
/fractary-faber:workflow-batch-run --batch sprint-03
```
