---
name: fractary-faber-workflow-batch-run
description: Batch orchestrator for FABER workflows — runs multiple work items sequentially (default) or in parallel via sub-agents (--parallel). Manages batch state, error handling, and resume. For a single work item, use fractary-faber-workflow-run.
user-invocable: true
---

# FABER Workflow Batch Run

<CONTEXT>
You are the FABER batch orchestrator. Your job is to manage a list of work IDs and ensure each runs through the full FABER workflow. In serial mode (default), you invoke the `fractary-faber-workflow-run` skill per item, one at a time. In parallel mode (`--parallel`), you dispatch one sub-agent per item simultaneously, each invoking the `fractary-faber-workflow-run` skill independently. You do NOT execute individual workflow steps yourself.
</CONTEXT>

<CRITICAL_RULES>
1. **SERIAL MODE (default)** — Read `batch-serial-protocol.md` in this directory and follow it exactly. One item at a time. Wait for completion before starting the next.
2. **PARALLEL MODE** — Launch all sub-agents in a single message (parallel Agent tool calls). Each sub-agent independently invokes `/fractary-faber-workflow-run {work_id}`. Requires `--worktree`.
3. **PARALLEL REQUIRES WORKTREES** — `--parallel` without `--worktree` is an error. Each concurrent run needs its own isolated git worktree to prevent conflicts.
4. **BATCH STATE IS THE SOURCE OF TRUTH** — Read/write `.fractary/faber/runs/.batch-state.json` before and after each item (serial) or after all complete (parallel).
5. **ERRORS ALWAYS PROMPT USER** — When any item fails, prompt the user even in autonomous mode: "Stop batch / Skip and continue / Retry". The batch is a safety net — never silently skip a failure.
6. **`--resume-batch` CONTINUES FROM LAST INCOMPLETE** — Read `.batch-state.json`, skip completed items, continue from first pending/failed item.
</CRITICAL_RULES>

<INPUTS>

**Syntax:**
```bash
/fractary-faber-workflow-batch-run <work-ids> [options]
```

**Arguments:**
| Argument | Type | Required | Description |
|----------|------|----------|-------------|
| `<work-ids>` | string | Yes (unless `--resume-batch`) | Comma-separated work item IDs, e.g. "258,259,260" (minimum 2) |

**Options:**
| Option | Default | Description |
|--------|---------|-------------|
| `--parallel` | false | Launch all workflows simultaneously as sub-agents. Requires `--worktree`. |
| `--phase <phases>` | none | Execute only specified phase(s), comma-separated, for all items |
| `--force-new` | false | Force fresh start for each item, bypass auto-resume |
| `--worktree` | false | Create isolated worktree per item (required with `--parallel`) |
| `--resume-batch` | false | Resume interrupted batch from `.batch-state.json` |
| `--workflow <id>` | none | Workflow override for all items |
| `--autonomy <level>` | none | Autonomy level override for all items |

</INPUTS>

<WORKFLOW>

## Mode Detection

```javascript
const passedIds = rawArg ? rawArg.split(',').map(id => id.trim()).filter(Boolean) : [];
const isParallel = flags['--parallel'] === true;
const isResume = flags['--resume-batch'] === true;

if (!isResume && passedIds.length < 2) {
  if (passedIds.length === 1) {
    console.error("Error: Batch run requires multiple work IDs. For a single item, use fractary-faber-workflow-run.");
  } else {
    console.error("Error: Missing required argument: <work-ids>. Use --resume-batch to resume a previous batch.");
  }
  return;
}

if (isParallel && !flags['--worktree']) {
  console.error("Error: --parallel requires --worktree. Each concurrent run needs an isolated git worktree to prevent conflicts.");
  console.error("Re-run with: /fractary-faber-workflow-batch-run <work-ids> --parallel --worktree [other-options]");
  return;
}

if (isParallel) {
  // → PARALLEL EXECUTION: see section below
} else {
  // → SERIAL EXECUTION: read batch-serial-protocol.md and follow it
}
```

---

## Serial Execution (default)

Read `batch-serial-protocol.md` in this directory and follow the protocol exactly.

Key points:
- Invoke `fractary-faber-workflow-run` skill per item (not the CLI — the skill)
- Pass through `--phase`, `--force-new`, `--workflow`, `--autonomy` flags to each invocation
- Update `.batch-state.json` before and after each item
- On error: always prompt user (stop / skip / retry) before continuing

---

## Parallel Execution (`--parallel`)

### P.1: Initialize Batch State

```javascript
const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
const batchState = {
  batch_id: `batch-${timestamp}`,
  status: "in_progress",
  mode: "parallel",
  phase_filter: phaseFilter || null,
  force_new: force_new || false,
  work_ids: passedIds,
  items: passedIds.map(id => ({
    work_id: id, plan_id: null, status: "pending",
    run_id: null, started_at: null, completed_at: null, error: null
  })),
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString()
};

Write the batch state JSON to `.fractary/faber/runs/.batch-state.json`
LOG `Batch ID: ${batchState.batch_id}`;
LOG `Mode: parallel | Work IDs: ${passedIds.join(', ')}`;
```

### P.2: Initialize Progress Tracking

```
Create progress tracking entries for each item:
  FOR index, item IN batchState.items:
    Create entry: "[Parallel Batch {index+1}/{total}] Workflow #{item.work_id}"
    Store entry ID in batchItemTaskIds[item.work_id]
    Mark entry as in_progress (all start simultaneously)
```

### P.3: Launch All Sub-agents Simultaneously

Launch one Agent per work item **in a single message** (parallel tool calls). Do not wait between launches.

For each `work_id` in `passedIds`, the Agent prompt is:

```
You are executing a FABER workflow for a single work item as part of a parallel batch.

Your only task: invoke the fractary-faber-workflow-run skill with these exact arguments:
  "{work_id} --worktree{phase_flag}{force_flag}{workflow_flag}{autonomy_flag}"

Where:
  {phase_flag}    = " --phase {phases}" if --phase was specified, else ""
  {force_flag}    = " --force-new" if --force-new was specified, else ""
  {workflow_flag} = " --workflow {id}" if --workflow was specified, else ""
  {autonomy_flag} = " --autonomy {level}" if --autonomy was specified, else ""

When the skill completes, report back in this exact format:
  STATUS: succeeded|failed
  RUN_ID: {run_id or "unknown"}
  ERROR: {error message or "none"}
```

### P.4: Wait for All Agents and Collect Results

Wait for all Agent tool calls to complete. Parse each response for STATUS/RUN_ID/ERROR.

```javascript
const results = {}; // work_id → { status, run_id, error }
for (const [work_id, agentResponse] of agentResults) {
  const statusMatch = agentResponse.match(/STATUS:\s*(succeeded|failed)/);
  const runIdMatch  = agentResponse.match(/RUN_ID:\s*(\S+)/);
  const errorMatch  = agentResponse.match(/ERROR:\s*(.+)/);

  results[work_id] = {
    status:  statusMatch ? statusMatch[1] : "unknown",
    run_id:  runIdMatch  ? runIdMatch[1]  : null,
    error:   errorMatch  ? errorMatch[1]  : null
  };
}
```

### P.5: Update Batch State

```javascript
const now = new Date().toISOString();
for (const item of batchState.items) {
  const r = results[item.work_id] || { status: "unknown", run_id: null, error: "No response from sub-agent" };
  item.status       = r.status === "succeeded" ? "completed" : "failed";
  item.run_id       = r.run_id;
  item.completed_at = now;
  item.error        = r.error !== "none" ? r.error : null;
}

const allCompleted = batchState.items.every(i => i.status === "completed");
batchState.status     = allCompleted ? "completed" : "failed";
batchState.updated_at = now;

Write batchState to `.fractary/faber/runs/.batch-state.json`
```

### P.6: Report Batch Summary

```javascript
const completed = batchState.items.filter(i => i.status === "completed");
const failed    = batchState.items.filter(i => i.status === "failed");

LOG "═══════════════════════════════════════════";
LOG "  PARALLEL BATCH COMPLETE";
LOG `  Total: ${batchState.items.length} | ✓ ${completed.length} | ✗ ${failed.length}`;
LOG "═══════════════════════════════════════════";
for (const item of completed) LOG `  ✓ #${item.work_id}  run: ${item.run_id}`;
for (const item of failed)    LOG `  ✗ #${item.work_id}  error: ${item.error}`;

if (failed.length > 0) {
  LOG "";
  LOG "Failed items can be retried individually:";
  for (const item of failed) LOG `  /fractary-faber-workflow-run ${item.work_id}`;
}
```

</WORKFLOW>

<PARALLEL_NOTES>
- Sub-agents are fully independent contexts — never attempt to share state between them
- Each sub-agent creates its own worktree via the `--worktree` flag in its workflow-run invocation
- `.batch-state.json` is written once after all agents complete (P.5), not during, to avoid write conflicts
- If a sub-agent fails to parse (no STATUS line in response), treat it as `status: "unknown"` and report to user
- Parallel batch does not support `--resume` of individual items mid-run. If the batch itself is interrupted before P.5, re-run with the same work IDs; completed worktrees will be auto-resumed by workflow-run's auto-resume logic
</PARALLEL_NOTES>
