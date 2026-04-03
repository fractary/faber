# FABER Workflow Runner — Batch Mode

Batch mode activates when the first argument contains commas (e.g., "258,259,260") or when `--resume-batch` is provided without a positional argument.

## Batch Detection

```javascript
const isBatchMode = (rawArg && rawArg.includes(',')) || (resumeBatch && !rawArg);
if (isBatchMode) {
  // → Enter batch execution (this section)
} else {
  // → Enter single-workflow execution (main SKILL.md Phase 1+)
}
```

## Batch State File

Location: `.fractary/faber/runs/.batch-state.json`

```json
{
  "batch_id": "batch-2026-02-20T15-30-00Z",
  "status": "in_progress",
  "phase_filter": ["frame", "architect", "build", "evaluate"],
  "force_new": false,
  "work_ids": ["258", "259", "260"],
  "items": [
    {
      "work_id": "258",
      "plan_id": "fractary-faber-258",
      "status": "completed",
      "run_id": "fractary-faber-258-run-2026-02-20T15-31-00Z",
      "started_at": "2026-02-20T15:31:00Z",
      "completed_at": "2026-02-20T15:55:00Z",
      "error": null
    },
    {
      "work_id": "259",
      "plan_id": null,
      "status": "pending",
      "run_id": null,
      "started_at": null,
      "completed_at": null,
      "error": null
    }
  ],
  "created_at": "2026-02-20T15:30:00Z",
  "updated_at": "2026-02-20T15:55:00Z"
}
```

## Step B.1: Initialize or Resume Batch

```javascript
const batchStatePath = `.fractary/faber/runs/.batch-state.json`;
let batchState;

if (resumeBatch) {
  const content = read the file at batchStatePath;
  batchState = JSON.parse(content);

  if (batchState.status === "completed") {
    console.log("✓ Batch already completed. Nothing to do.");
    return;
  }

  console.log("→ Resuming batch...");
  const completed = batchState.items.filter(i => i.status === "completed").length;
  const remaining = batchState.items.length - completed;
  console.log(`Progress: ${completed}/${batchState.items.length} completed, ${remaining} remaining`);

} else {
  const workIds = rawArg.split(',').map(id => id.trim()).filter(Boolean);

  if (workIds.length < 2) {
    console.error("Error: Batch mode requires multiple work IDs (comma-separated).");
    console.error("For a single work ID, use: /fractary-faber-workflow-run <work-id>");
    return;
  }

  for (const id of workIds) {
    if (!/^\d+$/.test(id)) {
      console.error(`Error: Invalid work ID '${id}'. Batch mode only accepts numeric work IDs.`);
      return;
    }
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
  batchState = {
    batch_id: `batch-${timestamp}`,
    status: "in_progress",
    phase_filter: phaseFilter || null,
    force_new: force_new || false,
    work_ids: workIds,
    items: workIds.map(id => ({
      work_id: id, plan_id: null, status: "pending",
      run_id: null, started_at: null, completed_at: null, error: null
    })),
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };

  Write the batch state JSON to {batchStatePath}
  console.log(`Batch ID: ${batchState.batch_id}`);
  console.log(`Work IDs: ${workIds.join(', ')}`);
}
```

## Step B.2: Initialize Batch Progress Tracking

```
Create progress tracking entries for each batch item:
  FOR index, item IN batchState.items:
    Create entry: "[Batch {index+1}/{total}] Workflow #{item.work_id}"
    Store entry ID in batchItemTaskIds[item.work_id]
    IF item already completed: mark entry as completed
```

## Step B.3: Sequential Execution Loop

```
FOR each item in batchState.items (skip items with status "completed"):

  item.status = "in_progress";
  item.started_at = new Date().toISOString();
  batchState.updated_at = new Date().toISOString();
  Write batch state to disk.
  Mark progress for #{item.work_id} as in_progress

  TRY:
    // Execute the full single-workflow logic for this work-id:
    // Phase 1 (init) + Phase 2 (execution) + Phase 3 (completion)
    // Set: arg = item.work_id, batch_mode = true (suppresses active-run-id conflict prompts)

    item.status = "completed";
    item.completed_at = new Date().toISOString();
    item.run_id = runId;
    item.plan_id = plan_id;
    batchState.updated_at = new Date().toISOString();
    Write batch state to disk.
    Mark progress for #{item.work_id} as completed

  CATCH error:
    item.status = "failed";
    item.error = error.message;
    item.completed_at = new Date().toISOString();
    Write batch state to disk.

    // Prompt user for decision (even in autonomous mode — batch safety net)
    Ask the user: "Workflow for #{item.work_id} failed. How would you like to proceed?"
    Options:
      - "Stop batch" — Resume later with --resume-batch
      - "Skip and continue" — Skip this workflow and continue
      - "Retry" — Retry this workflow
    // Handle response: stop → halt; skip → continue; retry → re-execute item

END FOR
```

## Step B.4: Batch Completion

```javascript
batchState.status = "completed";
Write batch state to disk.

const completed = batchState.items.filter(i => i.status === "completed");
const failed = batchState.items.filter(i => i.status === "failed");

console.log("BATCH COMPLETE");
console.log(`Total: ${batchState.items.length}, Completed: ${completed.length}, Failed: ${failed.length}`);
for (const item of completed) console.log(`  ✓ #${item.work_id}`);
for (const item of failed)    console.log(`  ✗ #${item.work_id} — ${item.error}`);
```

## Batch Mode Rules

1. `--resume` is not available in batch mode. Individual auto-resume handles mid-workflow recovery.
2. `--step` is not available in batch mode. Too granular for batch execution.
3. Active-run-id conflicts are auto-resolved in batch mode (no user prompt).
4. Each workflow is contextually independent. Never carry over context from one workflow to another.
5. Batch state persists across compaction — `--resume-batch` picks up from last completed item.
6. The orchestration protocol is loaded once (Step 1.2) and reused across all batch workflows.
7. Error halts the batch by default. User is always prompted — even in autonomous mode.
