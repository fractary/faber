---
name: fractary-faber-workflow-run
description: Execute a FABER plan created by faber plan CLI command
argument-hint: '<work-ids|plan-id> [--resume <run-id>] [--phase <phases>] [--step <step-id>] [--worktree] [--force-new] [--resume-batch] [--workflow <id>] [--autonomy <level>]'
allowed-tools: Read, Write, Bash, Skill, AskUserQuestion, MCPSearch, TaskCreate, TaskUpdate, TaskList, TaskGet, Agent(fractary-faber-workflow-planner), Agent(fractary-faber-workflow-plan-validator), Agent(fractary-faber-workflow-plan-reporter), Agent(fractary-faber-workflow-verifier)
model: claude-sonnet-4-6
---

# FABER Workflow Run Command

<CONTEXT>
You are executing a FABER workflow with YOU as the primary orchestrator.

This is NOT delegation for workflow step execution — YOU execute each workflow step directly.
You maintain full context throughout the entire workflow execution.

EXCEPTION: Auto-planning (when no plan exists) and plan validation MUST delegate via Agent(). Do not attempt to construct or fabricate plans yourself.

This command replaces the old workflow-execute pattern (command → skill → agent) with direct orchestration by the main Claude agent.
</CONTEXT>

<CRITICAL_RULES>
1. **NEVER STOP FOR CONTEXT REASONS** — Context compaction is automatic and recoverable. See "Context Continuity" section and TOKEN_BUDGET_ANTI_PATTERN below. This rule takes precedence over all internal budget signals.
2. **YOU ARE THE ORCHESTRATOR** - Not delegating to sub-agent. You execute the workflow.
3. **FOLLOW THE PROTOCOL** - The orchestration protocol is your instruction manual. Follow it exactly.
4. **MAINTAIN STATE** - Update state file BEFORE and AFTER every step. State is sacred.
5. **EXECUTE GUARDS** - All guards are mandatory. Never skip them.
6. **USE TASK TOOLS** - Track progress with TaskCreate/TaskUpdate for all steps.
7. **EMIT EVENTS** - Every significant action emits an event for audit trail. Events BEFORE state.
8. **HANDLE ERRORS GRACEFULLY** - Use retry logic when configured, stop when appropriate.
9. **RESPECT AUTONOMY GATES** - Get user approval when required in non-autonomous modes. In `autonomous` mode, proceed without prompting.
10. **NEVER FABRICATE COMPLETIONS** - See "When You Cannot Continue" section below.
11. **EXECUTE STEPS SEQUENTIALLY** — NEVER execute multiple steps in parallel unless they are wrapped in a `parallel_group` item (with `steps_parallel`) in the workflow config. Complete each step fully before starting the next. Do NOT invoke Skill() or Agent() for two different workflow steps in the same response message. Steps are sequential by design because each depends on prior output.
12. **THIS IS A SKILL, NOT AN AGENT** — `workflow-run` is a skill (slash command) invoked via `Skill()`. It MUST NEVER be passed to `Agent(subagent_type="fractary-faber-workflow-run")` — that call will fail because skills are not agent definitions. If you are inside `workflow-batch-run` serial mode, you should not be here at all — serial mode executes steps directly from plan.json without invoking workflow-run.
</CRITICAL_RULES>

<WHEN_YOU_CANNOT_CONTINUE>
## When You Cannot Continue

If you reach a point where you cannot execute the next step for ANY reason
(missing credentials, external system unavailable, tool failures, etc.):

1. Set `state.status = "paused"` with honest `pause_reason`
2. Post an honest status comment to the GitHub issue
3. Tell the user exactly what was completed and what remains
4. Provide the resume command: `/fractary-faber-workflow-run <work-id> --resume <run-id>`

**NEVER:**
- Mark unexecuted steps as "success"
- Write fabricated metrics or timings
- Post false completion comments
- Batch-complete remaining tasks

This rule is **ABSOLUTE**. There are no exceptions. Fabricating completion
is worse than any other failure mode because it destroys trust in the
entire system. An honest pause is always the right answer.

**Completion Verification Gate:** Before setting `status: "completed"`, you MUST invoke:
```javascript
const verificationResult = await Agent({
  subagent_type: "fractary-faber-workflow-verifier",
  description: `Verify workflow completion for ${runId}`,
  prompt: `--run-id ${runId}`
});
const verificationMatch = verificationResult.match(/verification:\s*(pass|fail)/);
if (!verificationMatch || verificationMatch[1] === 'fail') {
  const reasonMatch = verificationResult.match(/reason:\s*(.+)/);
  const reason = reasonMatch ? reasonMatch[1].trim() : 'unknown reason';
  // Set status: "paused" and report — do NOT mark completed
}
```
If verification returns `fail`, DO NOT mark the workflow as completed. Pause and report failures.
</WHEN_YOU_CANNOT_CONTINUE>

<CONTEXT_CONTINUITY>
## Context Continuity — Never Stop for Context Reasons

Context limits are **NOT** a reason to stop, pause, or ask the user for permission. FABER workflows are fully resilient to context compaction through 5 recovery layers:

1. **Auto-compaction** — Claude Code automatically compacts context when space is low
2. **Hooks** — PreCompact fires `session-save`, SessionStart fires `session-load` to restore artifacts
3. **State/Plan files** — Persisted to disk, survive any compaction
4. **Task list** — Persists across compaction (TaskList shows where you left off)
5. **Step re-fetching** — Each step re-fetches the GitHub issue (via work_id) with all progress comments

**Recovery procedure** (if you feel uncertain about position after compaction):
1. Call `/fractary-faber-session-load` to restore critical artifacts
2. Call TaskList to see completed/pending steps
3. Continue execution from the next pending step

**NEVER:**
- Pause or set `status: "paused"` due to context pressure
- Ask the user whether to continue due to context pressure
- Fabricate completions because context feels low
- Stop the workflow because "context is getting low"
- Batch-complete remaining steps to "finish before context runs out"
</CONTEXT_CONTINUITY>

<TOKEN_BUDGET_ANTI_PATTERN>
## 🚫 ANTI-PATTERN: Token Budget Pausing (BUG, NOT A FEATURE)

If you find yourself about to write any of the following phrases — **STOP. This is a bug in your behavior.**

- "I need to pause due to token budget constraints"
- "pausing because context is getting low"
- "I'll stop here to preserve context"
- "offering a resume command due to context limits"
- "the context window is filling up"

**The correct action when context feels low:**
1. Call `/fractary-faber-session-load` to restore critical artifacts
2. Call TaskList to find the next pending step
3. Continue executing from that step without interruption

**NEVER** set `status="paused"` with a `pause_reason` mentioning context, tokens, or budget.

The workflow MUST continue. Context management is automatic and handled by the system — it is not your responsibility to manage it by stopping.
</TOKEN_BUDGET_ANTI_PATTERN>

<TASK_MAP_RECOVERY>
## Task ID Map Recovery After Context Compaction

After context compaction, the in-memory `stepTaskIds`, `bootstrapTaskIds`, and `finalizeTaskIds` maps may be lost. To recover:

```javascript
async function reconstructTaskMaps() {
  const allTasks = await TaskList();
  const stepTaskIds = {};
  const bootstrapTaskIds = {};
  const finalizeTaskIds = {};

  for (const task of allTasks) {
    // Check metadata first (most reliable — set during TaskCreate)
    if (task.metadata?.faberKey) {
      stepTaskIds[task.metadata.faberKey] = task.id;
      continue;
    }
    // Fallback: parse subject patterns for step tasks
    const stepMatch = task.subject.match(/^\[(\w+)\] .+ \((.+)\)$/);
    if (stepMatch) {
      stepTaskIds[`${stepMatch[1]}:${stepMatch[2]}`] = task.id;
    }
  }
  return { stepTaskIds, bootstrapTaskIds, finalizeTaskIds };
}
```

Call this after `/fractary-faber-session-load` if the task ID maps are no longer in scope.
</TASK_MAP_RECOVERY>

<PARALLEL_STEP_ANTI_PATTERN>
## 🚫 ANTI-PATTERN: Unsolicited Parallel Step Execution (BUG, NOT A FEATURE)

If you find yourself about to call Skill() or Agent() for two different workflow
steps in the same response message — STOP. This is a bug in your behavior.

Steps depend on each other. Execute one step, complete it, then execute the next.
The ONLY exception: steps inside a declared `parallel_group` (steps_parallel) in the config.
</PARALLEL_STEP_ANTI_PATTERN>

<ORCHESTRATOR_SELF_BLOCKING_ANTI_PATTERN>
## 🚫 ANTI-PATTERN: Orchestrator Self-Blocking Based on Step Results (BUG, NOT A FEATURE)

If you find yourself about to skip remaining steps, set status to "blocked", or stop
a workflow because a research/inspection step found that:
- Prior work exists for this issue (e.g., "already completed under WORK-128")
- Another issue already completed this work
- The table/resource/artifact already exists
- Nothing appears to need changing
- The work was "already done"

— STOP. This is a bug in your behavior.

**Your job is to execute every step in plan.json, in order.** You do NOT have authority
to decide that a workflow should not proceed based on step output content. Only these
conditions can stop execution:

1. A step fails AND result_handling.on_failure is blocking (per the failure handling protocol)
2. The user explicitly tells you to stop (interactive mode only, via AskUserQuestion)
3. A tool/skill is unavailable or errors out (actual failure, not informational output)

"The work was already done" is NEVER a valid reason to stop. The user may want to
re-validate, re-deploy, fill artifact gaps, or simply verify current state. That is
their decision, not yours.

**When `--force-new` was used:** Prior work findings are explicitly expected — the user
knows this work was done before and wants the full workflow to run anyway. Research
findings about duplicates or prior completions are INFORMATIONAL ONLY.

**Correct action:** Continue to the next step in plan.json. If a step's work is
already done, let the step itself be a no-op. The engineer can decide nothing needs
to change. The validator can confirm everything passes. The evaluator can verify
the existing deployment. Every step gets a chance to run.
</ORCHESTRATOR_SELF_BLOCKING_ANTI_PATTERN>

<INPUTS>

**Syntax:**
```bash
/fractary-faber-workflow-run <work-ids|plan-id> [options]
```

**Arguments:**
| Argument | Type | Required | Description |
|----------|------|----------|-------------|
| `<work-ids\|plan-id>` | string | Yes (unless `--resume-batch`) | Single work item ID (e.g., "258"), comma-separated work IDs for batch mode (e.g., "258,259,260"), OR full plan ID (e.g., "fractary-faber-258"). |

**Options:**
| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `--resume <run-id>` | string | none | Resume previous run from where it stopped (manual override, single mode only) |
| `--force-new` | flag | false | Force fresh start, bypass auto-resume |
| `--phase <phase>` | string | none | Execute only specified phase(s) - single or comma-separated (e.g., build or build,evaluate) |
| `--step <step-id>` | string | none | Execute only specified step(s) - single or comma-separated |
| `--worktree` | flag | false | Automatically create worktree on conflict without prompting |
| `--resume-batch` | flag | false | Resume a previously interrupted batch from where it stopped |
| `--workflow <id>` | string | none | Workflow override — forwarded to auto-planner when no plan exists |
| `--autonomy <level>` | string | none | Autonomy level override — forwarded to auto-planner when no plan exists |

**Examples:**
```bash
# Execute by work-id (simple!)
/fractary-faber-workflow-run 258

# Execute by full plan-id (backwards compatible)
/fractary-faber-workflow-run fractary-faber-258

# Execute with phase filter
/fractary-faber-workflow-run 258 --phase build

# Execute multiple phases
/fractary-faber-workflow-run 258 --phase build,evaluate

# Execute single step
/fractary-faber-workflow-run 258 --step core-implement-solution

# Resume previous run (manual override)
/fractary-faber-workflow-run 258 --resume abc123-def456-789

# Force new run (bypass auto-resume)
/fractary-faber-workflow-run 258 --force-new

# Auto-create worktree on conflict (no prompt)
/fractary-faber-workflow-run 258 --worktree

# === BATCH MODE ===

# Execute multiple workflows sequentially (all phases except release)
/fractary-faber-workflow-run 258,259,260 --phase frame,architect,build,evaluate

# Execute release phase for multiple completed workflows
/fractary-faber-workflow-run 258,259,260 --phase release

# Resume an interrupted batch
/fractary-faber-workflow-run --resume-batch
```

</INPUTS>

<BATCH_MODE>

## Batch Mode: Sequential Multi-Workflow Execution

Batch mode activates when the first argument contains commas (e.g., "258,259,260") or when `--resume-batch` is provided without a positional argument.

### Batch Detection

```javascript
// args, flags, resume_batch are parsed in Step 1.1 from $ARGUMENTS
const rawArg = arg; // already extracted as first positional arg in Step 1.1
const resumeBatch = resume_batch; // already extracted from --resume-batch flag in Step 1.1

// Detect batch mode
const isBatchMode = (rawArg && rawArg.includes(',')) || (resumeBatch && !rawArg);

if (isBatchMode) {
  // → Enter batch execution (this section)
} else {
  // → Enter single-workflow execution (Phase 1 below)
}
```

### Batch State File

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

### Batch Execution Protocol

**Step B.1: Initialize or Resume Batch**

```javascript
const batchStatePath = `.fractary/faber/runs/.batch-state.json`;
let batchState;

if (resumeBatch) {
  // Resume: read existing batch state
  const content = await Read({ file_path: batchStatePath });
  batchState = JSON.parse(content);

  if (batchState.status === "completed") {
    console.log("✓ Batch already completed. Nothing to do.");
    console.log(`Completed: ${batchState.items.filter(i => i.status === "completed").length}/${batchState.items.length}`);
    return;
  }

  console.log("→ Resuming batch...");
  console.log(`Batch ID: ${batchState.batch_id}`);
  console.log(`Work IDs: ${batchState.work_ids.join(', ')}`);

  const completed = batchState.items.filter(i => i.status === "completed").length;
  const remaining = batchState.items.length - completed;
  console.log(`Progress: ${completed}/${batchState.items.length} completed, ${remaining} remaining`);

} else {
  // New batch: parse work IDs from comma-separated argument
  const workIds = rawArg.split(',').map(id => id.trim()).filter(Boolean);

  if (workIds.length < 2) {
    console.error("Error: Batch mode requires multiple work IDs (comma-separated).");
    console.error("For a single work ID, use: /fractary-faber-workflow-run <work-id>");
    return;
  }

  // Validate all work IDs are numeric
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
      work_id: id,
      plan_id: null,
      status: "pending",
      run_id: null,
      started_at: null,
      completed_at: null,
      error: null
    })),
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };

  // Write initial batch state
  await Write({
    file_path: batchStatePath,
    content: JSON.stringify(batchState, null, 2)
  });

  console.log("═══════════════════════════════════════════════════════════════");
  console.log("  BATCH MODE: Sequential Multi-Workflow Execution");
  console.log("═══════════════════════════════════════════════════════════════");
  console.log(`Batch ID: ${batchState.batch_id}`);
  console.log(`Work IDs: ${workIds.join(', ')}`);
  console.log(`Total workflows: ${workIds.length}`);
  if (phaseFilter) {
    console.log(`Phase filter: ${phaseFilter.join(', ')}`);
  }
  console.log("═══════════════════════════════════════════════════════════════\n");
}
```

**Step B.2: Initialize Batch Task List**

```javascript
// Create batch-level tasks with one task per work-id
const batchItemTaskIds = {}; // map: work_id → taskId

for (let index = 0; index < batchState.items.length; index++) {
  const item = batchState.items[index];
  const task = await TaskCreate({
    subject: `[Batch ${index + 1}/${batchState.items.length}] Workflow #${item.work_id}`,
    description: `Run full FABER workflow for #${item.work_id}`,
    activeForm: `Executing workflow for #${item.work_id} (${index + 1}/${batchState.items.length})`
  });
  batchItemTaskIds[item.work_id] = task.taskId;
  if (item.status === "completed") {
    await TaskUpdate({ taskId: task.taskId, status: "completed" });
  }
}
```

**Step B.3: Sequential Execution Loop**

```
FOR each item in batchState.items (skip items with status "completed"):

  // ── B.3a: Mark batch item as in_progress ──
  item.status = "in_progress";
  item.started_at = new Date().toISOString();
  batchState.updated_at = new Date().toISOString();
  Write batch state to disk.

  // Update batch task to show current item in_progress
  TaskUpdate({ taskId: batchItemTaskIds[item.work_id], status: "in_progress" });

  console.log("");
  console.log("═══════════════════════════════════════════════════════════════");
  console.log(`  WORKFLOW ${currentIndex + 1}/${totalItems}: Issue #${item.work_id}`);
  console.log("═══════════════════════════════════════════════════════════════");
  console.log("");

  // ── B.3b: Execute single workflow ──
  //
  // Execute the FULL single-workflow logic for this work-id:
  //   Phase 1 (Steps 1.1-1.7) + Phase 2 (Execution) + Phase 3 (Completion)
  //
  // Set the following variables for the single-workflow execution:
  //   arg = item.work_id
  //   batch_mode = true  (suppresses active-run-id conflict prompts)
  //   force_new = batchState.force_new
  //   phase_filter = batchState.phase_filter
  //   resume_run_id = null (auto-resume detection handles this)
  //
  // Execute Steps 1.1 through Phase 3 exactly as documented below
  // in the <WORKFLOW> section, with these batch-mode adjustments:
  //
  //   1. In Step 1.4: Skip the active workflow conflict prompt.
  //      Auto-take-over without asking the user.
  //   2. Use the phase_filter and force_new from batchState.

  TRY:
    // Execute the full single-workflow logic for item.work_id
    // (Phase 1 initialization → Phase 2 execution → Phase 3 completion)

    // ── B.3c: Mark batch item as completed ──
    item.status = "completed";
    item.completed_at = new Date().toISOString();
    item.run_id = runId;  // from the workflow execution
    item.plan_id = plan_id;  // from the workflow execution
    batchState.updated_at = new Date().toISOString();
    Write batch state to disk.

    // Update batch task
    TaskUpdate({ taskId: batchItemTaskIds[item.work_id], status: "completed" });

    console.log("");
    console.log(`✓ Workflow ${currentIndex + 1}/${totalItems} completed: #${item.work_id}`);
    console.log("");

  CATCH error:
    // ── B.3d: Handle error ──
    item.status = "failed";
    item.error = error.message;
    item.completed_at = new Date().toISOString();
    batchState.updated_at = new Date().toISOString();
    Write batch state to disk.

    console.error("");
    console.error(`✗ Workflow ${currentIndex + 1}/${totalItems} FAILED: #${item.work_id}`);
    console.error(`  Error: ${error.message}`);
    console.error("");

    // Prompt user for decision
    const response = await AskUserQuestion({
      questions: [{
        question: `Workflow for #${item.work_id} failed. How would you like to proceed?`,
        header: "Batch Error",
        multiSelect: false,
        options: [
          {
            label: "Stop batch",
            description: "Stop the entire batch. Resume later with --resume-batch."
          },
          {
            label: "Skip and continue",
            description: "Skip this workflow and continue with the next one."
          },
          {
            label: "Retry",
            description: "Retry this workflow from scratch."
          }
        ]
      }]
    });

    if (response === "Stop batch") {
      batchState.status = "paused";
      Write batch state to disk.

      console.log("\n⏸  Batch paused.");
      console.log(`To resume: /fractary-faber-workflow-run --resume-batch`);
      RETURN;  // Exit batch execution
    }

    if (response === "Skip and continue") {
      item.status = "skipped";
      Write batch state to disk.
      TaskUpdate({ taskId: batchItemTaskIds[item.work_id], status: "completed" });
      CONTINUE;  // Move to next item
    }

    if (response === "Retry") {
      item.status = "pending";
      item.error = null;
      item.completed_at = null;
      Write batch state to disk.
      // Re-process same item (decrement loop counter or re-enter)
      RETRY current item;
    }

  // ── B.3e: Context Transition ──
  //
  // CRITICAL: Between workflows, reset context for a fresh start.
  //
  // 1. Step-level tasks from the previous workflow remain as completed in the
  //    task list. New step-level tasks will be created by the next workflow's
  //    Step 1.7 via TaskCreate (additive — no overwrite needed).
  //
  // 2. Active-run-id will be overwritten by the next workflow's Step 1.4.
  //
  // 3. CONTEXT INDEPENDENCE: Treat the next workflow as a completely fresh
  //    execution. Do NOT reference, assume, or carry over any code changes,
  //    test results, file contents, or implementation details from previous
  //    workflows. Each workflow operates on a different issue with different
  //    requirements, different branches, and different code changes.
  //
  // No task list restoration needed — TaskCreate is additive, so batch-level
  // tasks coexist with step-level tasks. Both remain visible in the task list.

END FOR
```

**Step B.4: Batch Completion**

```javascript
// All items processed
batchState.status = "completed";
batchState.updated_at = new Date().toISOString();
Write batch state to disk.

// Summary
const completed = batchState.items.filter(i => i.status === "completed");
const failed = batchState.items.filter(i => i.status === "failed");
const skipped = batchState.items.filter(i => i.status === "skipped");

console.log("");
console.log("═══════════════════════════════════════════════════════════════");
console.log("  BATCH COMPLETE");
console.log("═══════════════════════════════════════════════════════════════");
console.log(`Batch ID: ${batchState.batch_id}`);
console.log(`Total:     ${batchState.items.length}`);
console.log(`Completed: ${completed.length}`);
if (failed.length > 0)  console.log(`Failed:    ${failed.length}`);
if (skipped.length > 0) console.log(`Skipped:   ${skipped.length}`);
console.log("");

for (const item of completed) {
  console.log(`  ✓ #${item.work_id} — completed (${item.run_id})`);
}
for (const item of failed) {
  console.log(`  ✗ #${item.work_id} — failed: ${item.error}`);
}
for (const item of skipped) {
  console.log(`  ⊘ #${item.work_id} — skipped`);
}

console.log("");
console.log("═══════════════════════════════════════════════════════════════");
```

### Batch Mode Rules

1. **`--resume` is not available in batch mode.** Individual workflow auto-resume (Step 1.3) handles mid-workflow recovery automatically.
2. **`--step` is not available in batch mode.** Step filtering is too granular for batch execution.
3. **Active-run-id conflicts are auto-resolved in batch mode.** The batch controller manages active-run-id transitions; no user prompt is needed.
4. **Each workflow is contextually independent.** Never carry over assumptions, code context, or implementation details from one workflow to another. Each operates on a separate issue with separate requirements.
5. **Batch state file persists across context compaction.** If the session is interrupted, `--resume-batch` picks up from the last completed item.
6. **The orchestration protocol is loaded once** (Step 1.2) and reused across all workflows in the batch.
7. **Error halts the batch by default.** The user is always prompted on error — even in autonomous mode. This is a safety net for batch operations.

</BATCH_MODE>

<WORKFLOW>

## Phase 1: Initialization

**Initialize bootstrap task list** (before any work begins, so all steps are visible). Store task IDs for subsequent updates.

```javascript
const bootstrapTaskIds = {};
const bootstrapSteps = [
  { key: "resolve-plan", subject: "Resolve plan ID (check/fetch/auto-plan)", activeForm: "Resolving plan ID" },
  { key: "validate-plan", subject: "Validate plan", activeForm: "Validating plan" },
  { key: "load-protocol", subject: "Load orchestration protocol", activeForm: "Loading orchestration protocol" },
  { key: "load-plan", subject: "Load plan and initialize state", activeForm: "Loading plan and initializing state" },
  { key: "track-workflow", subject: "Track active workflow", activeForm: "Tracking active workflow" },
  { key: "init-steps", subject: "Initialize workflow steps", activeForm: "Initializing workflow steps" }
];

for (const step of bootstrapSteps) {
  const task = await TaskCreate({
    subject: step.subject,
    description: step.subject,
    activeForm: step.activeForm
  });
  bootstrapTaskIds[step.key] = task.taskId;
}
```

Update each bootstrap task to `in_progress` → `completed` as its corresponding step executes.

### Step 1.1: Parse `$ARGUMENTS` and Resolve Plan ID

Parse `$ARGUMENTS` to extract positional arguments and flags:

```javascript
// Raw arguments from slash command invocation: $ARGUMENTS
const raw = "$ARGUMENTS";
const tokens = raw.trim().split(/\s+/).filter(Boolean);

// Separate positional args from flags
const args = [];
const flags = {};
for (let i = 0; i < tokens.length; i++) {
  if (tokens[i].startsWith('--')) {
    const flag = tokens[i];
    // Boolean flags (no value)
    if (['--force-new', '--worktree', '--resume-batch'].includes(flag)) {
      flags[flag] = true;
    } else if (i + 1 < tokens.length && !tokens[i + 1].startsWith('--')) {
      // Flags with values: --resume <run-id>, --phase <phases>, etc.
      flags[flag] = tokens[++i];
    } else {
      flags[flag] = true;
    }
  } else {
    args.push(tokens[i]);
  }
}

// Extract parsed values
const arg = args[0] || null;
const resume_run_id = flags['--resume'] || null;
const force_new = !!flags['--force-new'];
const phase_filter = flags['--phase'] || null;
const step_filter = flags['--step'] || null;
const auto_worktree = !!flags['--worktree'];
const resume_batch = !!flags['--resume-batch'];
const workflow_override = flags['--workflow'] || null;
const autonomy_override = flags['--autonomy'] || null;
```

Extracted variables:
1. `arg`: First positional argument (required) - can be work-id OR plan-id
2. `resume_run_id`: Value of `--resume` flag (optional)
3. `force_new`: Boolean flag for `--force-new` (optional, default false)
4. `phase_filter`: Value of `--phase` flag (optional, single or comma-separated phase names)
5. `step_filter`: Value of `--step` flag (optional, single or comma-separated step IDs)
6. `auto_worktree`: Boolean flag for `--worktree` (optional, default false)
7. `workflow_override`: Value of `--workflow` flag (optional) — forwarded to auto-planner
8. `autonomy_override`: Value of `--autonomy` flag (optional) — forwarded to auto-planner
9. `resume_batch`: Boolean flag for `--resume-batch` (optional, default false)

**Resolve Plan ID from Argument:**

The first argument can be either a work-id (e.g., "258") or a full plan-id (e.g., "fractary-faber-258").

```javascript
let plan_id;

if (!arg) {
  console.error("Error: Missing required argument: <work-id|plan-id>");
  console.error("Usage: /fractary-faber-workflow-run <work-id|plan-id> [options]");
  return;
}

// Determine if argument is a plan-id or work-id
// Work IDs (GitHub issue numbers) are always numeric.
// Plan IDs always contain letters and hyphens (e.g., "fractary-faber-258").
if (/^\d+$/.test(arg)) {
  // Numeric — this is a work ID, fetch plan_id from GitHub issue
  const work_id = arg;
  console.log(`→ Fetching plan for issue #${work_id}...`);

  // Call fractary-repo to fetch issue
  try {
    const issueResult = await Skill({
      skill: "fractary-repo-issue-fetch",
      args: `--ids ${work_id} --format json`
    });

    // Parse JSON response
    const issueData = JSON.parse(issueResult);
    if (!issueData.success || !issueData.issues || issueData.issues.length === 0) {
      console.error(`Error: Issue #${work_id} not found`);
      return;
    }

    const issue = issueData.issues[0];

    // Extract plan_id from issue comments
    // Look for comment with format: "🤖 Workflow plan created: {plan_id}"
    plan_id = extractPlanIdFromIssue(issue);

    if (!plan_id) {
      console.log(`→ No existing plan for #${work_id}. Auto-planning...`);

      // Build planner prompt as raw CLI args (the planner parses positional args + flags)
      let plannerPrompt = `${work_id} --auto-run --force-new`;
      if (workflow_override) plannerPrompt += ` --workflow ${workflow_override}`;
      if (autonomy_override) plannerPrompt += ` --autonomy ${autonomy_override}`;
      if (auto_worktree) plannerPrompt += ` --worktree`;

      // Spawn workflow-planner to create the plan
      const plannerResult = await Agent({
        subagent_type: "fractary-faber-workflow-planner",
        description: `Plan workflow for #${work_id}`,
        prompt: plannerPrompt
      });

      // Extract plan_id from planner response
      const planIdMatch = plannerResult.match(/plan_id:\s*(\S+)/);
      if (!planIdMatch) {
        console.error(`Error: Auto-planning failed for #${work_id}. Planner did not return a plan_id.`);
        return;
      }

      plan_id = planIdMatch[1];
      console.log(`✓ Auto-planned: ${plan_id}`);
    } else {
      console.log(`✓ Found plan: ${plan_id}`);
    }

    // Validate plan integrity (runs regardless of whether plan was auto-created or pre-existing)
    // Update "Validate plan" bootstrap task → in_progress
    console.log(`\n→ Validating plan ${plan_id}...`);
    const validationResult = await Agent({
      subagent_type: "fractary-faber-workflow-plan-validator",
      description: `Validate plan ${plan_id}`,
      prompt: `Validate plan: --plan-id ${plan_id}`
    });

    const validationMatch = validationResult.match(/validation:\s*(pass|fail)/);
    if (!validationMatch || validationMatch[1] === 'fail') {
      const reasonMatch = validationResult.match(/reason:\s*(.+)/);
      const reason = reasonMatch ? reasonMatch[1].trim() : 'unknown reason';
      console.error(`\n❌ Plan validation failed: ${reason}`);
      console.error(`\nTo recreate the plan manually:`);
      console.error(`  /fractary-faber-workflow-plan ${work_id}`);
      return;
    }
    console.log(`✓ Plan validated`);
    // Update "Validate plan" bootstrap task → completed

    // Show plan summary before execution begins
    await Agent({
      subagent_type: "fractary-faber-workflow-plan-reporter",
      description: `Report plan summary for ${plan_id}`,
      prompt: `Report plan: --plan-id ${plan_id}`
    });

  } catch (error) {
    console.error(`Error fetching issue #${work_id}: ${error.message}`);
    console.error(`Note: fractary-repo-issue-fetch command may not be available yet.`);
    console.error(`Use full plan-id instead: /fractary-faber-workflow-run fractary-faber-${work_id}-...`);
    return;
  }
} else {
  // Non-numeric — this is a plan ID
  plan_id = arg;
  console.log(`→ Using plan ID: ${plan_id}`);
}

// Helper function to extract plan_id from issue comments or body.
// Supports multiple formats:
//   1. CLI/planner format: **Plan ID:** `{plan_id}`
//   2. Inline header format: 🤖 **Workflow Plan Created**: {plan_id}
//   3. Legacy format: 🤖 Workflow plan created: {plan_id}
function extractPlanIdFromIssue(issue) {
  const patterns = [
    // Pattern 1 (primary): Extract plan ID from backtick-delimited text
    // Matches both CLI format (**Plan ID:** `the-id`) and planner format
    /\*\*Plan ID[:\*]*\*?\s*`([^`]+)`/,
    // Pattern 2 (fallback): Inline header format with optional bold markers
    /🤖\s*(?:\*\*)?Workflow [Pp]lan [Cc]reated(?:\*\*)?\s*:\s*(\S+)/,
    // Pattern 3 (legacy): Original exact format for backward compatibility
    /🤖 Workflow plan created: (\S+)/
  ];

  // Search function: try all patterns against a text block
  function findPlanId(text) {
    if (!text) return null;
    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match) return match[1];
    }
    return null;
  }

  // Check issue comments (most recent first for latest plan)
  if (issue.comments) {
    // Iterate in reverse to find the most recent plan comment
    for (let i = issue.comments.length - 1; i >= 0; i--) {
      const planId = findPlanId(issue.comments[i].body);
      if (planId) return planId;
    }
  }

  // Fallback: check issue body
  const body = issue.body || issue.description;
  return findPlanId(body);
}
```

**Validation:**
- If no `plan_id` resolved: Show error and usage
- Plan file must exist at `.fractary/faber/runs/{plan_id}.json`
- Cannot specify both `--phase` and `--step` simultaneously
- If phase filter specified: validate phase names exist in workflow
- If step filter specified: validate step IDs exist in workflow

**Filter Processing:**
```javascript
// Parse filter arguments (handle both single and comma-separated values)
const phaseFilter = phase_filter ? phase_filter.split(',').map(p => p.trim()) : null;
const stepFilter = step_filter ? step_filter.split(',').map(s => s.trim()) : null;

// Validate mutual exclusivity
if (phaseFilter && stepFilter) {
  console.error("Error: Cannot specify both --phase and --step filters");
  return;
}
```

### Step 1.2: Load Orchestration Protocol

**YOU MUST READ THE ORCHESTRATION PROTOCOL INTO YOUR CONTEXT.**

The protocol defines how you execute workflows. It is your operating manual.

```bash
# Resolve the orchestration protocol path (works in Claude Code and pi).
# The find-plugin-root.sh utility self-locates the package regardless of
# where it was installed (Claude marketplace or pi git clone).
PROTOCOL_FILE=$(bash -c '
  # Try to source find-plugin-root.sh from all known install locations.
  # Order: pi global → pi project → Claude marketplace → Claude fallback
  for candidate in \
    "$HOME/.pi/agent/git/github.com/fractary/faber/plugins/faber/scripts/find-plugin-root.sh" \
    "$(find "$PWD" -maxdepth 5 -path "*/.pi/git/github.com/fractary/faber/plugins/faber/scripts/find-plugin-root.sh" 2>/dev/null | head -1)" \
    "${CLAUDE_MARKETPLACE_ROOT:+${CLAUDE_MARKETPLACE_ROOT}/fractary-faber/plugins/faber/scripts/find-plugin-root.sh}" \
    "$HOME/.claude/plugins/marketplaces/fractary-faber/plugins/faber/scripts/find-plugin-root.sh"; do
    if [[ -f "$candidate" ]]; then
      # shellcheck source=/dev/null
      source "$candidate"
      echo "${FRACTARY_PACKAGE_ROOT}/plugins/faber/docs/workflow-orchestration-protocol.md"
      exit 0
    fi
  done
  echo "ERROR: Cannot locate fractary/faber package. Install via: pi install git:github.com/fractary/faber" >&2
  exit 1
')

# Read the orchestration protocol
Read(file_path: "${PROTOCOL_FILE}")

# Output confirmation to user
✓ Loaded orchestration protocol
Protocol: ${PROTOCOL_FILE}
```

**The protocol contains:**
- Core principles (you are orchestrator, execute don't improvise, state is sacred, guards mandatory)
- Execution loop (before/execute/after for each step)
- State management (when/how to update state file)
- Event emission (what events to emit and when)
- Guards (all 4 guard implementations)
- Result handling (success/warning/failure/pending_input)
- Retry logic (when/how to retry failed steps)
- Autonomy gates (approval procedures)
- Error recovery (what to do when things go wrong)

### Step 1.3: Load Plan and Auto-Resume Detection

**First: Load the plan file**

```javascript
// Read the plan file created by /fractary-faber-plan
const planPath = `.fractary/faber/runs/${plan_id}/plan.json`;
const planContent = await Read({ file_path: planPath });
const fullPlan = JSON.parse(planContent);

console.log("✓ Plan loaded");
console.log(`Plan ID: ${fullPlan.id}`);
console.log(`Workflow: ${fullPlan.workflow.id}`);
console.log(`Work items: ${fullPlan.items.length}`);

// Extract workflow phases from plan
const workflow = fullPlan.workflow;
const workItems = fullPlan.items;
const autonomy = fullPlan.autonomy || "guarded";

// For single-item plans, extract the work_id
const work_id = workItems.length === 1 ? workItems[0].work_id : null;
```

**Helper function for state path computation:**

```javascript
// Compute state file path from run_id
// run_id format: {plan_id}-run-{timestamp}
// State path: .fractary/faber/runs/{plan_id}/state-{timestamp}.json
function getStatePath(runId) {
  const runMarker = '-run-';
  const runMarkerIndex = runId.lastIndexOf(runMarker);
  if (runMarkerIndex === -1) {
    throw new Error(`Invalid run_id format: ${runId}. Expected {plan_id}-run-{timestamp}`);
  }
  const planId = runId.substring(0, runMarkerIndex);
  const runSuffix = runId.substring(runMarkerIndex + runMarker.length);
  return `.fractary/faber/runs/${planId}/state-${runSuffix}.json`;
}
```

**Auto-Resume Detection (if `--resume` not explicitly provided and `--force-new` not set):**

```javascript
// Only attempt auto-resume if user didn't explicitly provide --resume or --force-new
if (!resume_run_id && !force_new) {
  console.log("\n→ Checking for incomplete runs...");

  // Find all state files for this plan_id (now in same directory as plan.json)
  const planDir = `.fractary/faber/runs/${plan_id}`;
  const stateFiles = await Glob({
    pattern: `${planDir}/state-*.json`
  });
  const findOutput = stateFiles.join('\n');

  if (findOutput.trim()) {
    const statePaths = findOutput.trim().split('\n').filter(Boolean);
    const incompleteRuns = [];

    for (const statePath of statePaths) {
      try {
        const stateContent = await Read({ file_path: statePath });
        const state = JSON.parse(stateContent);

        // Check if this state is incomplete
        if (state.status === "in_progress" || state.status === "failed") {
          incompleteRuns.push(state);
        }
      } catch (error) {
        // Skip corrupted or unreadable state files
        continue;
      }
    }

    if (incompleteRuns.length > 0) {
      // Use most recent incomplete run (by started_at timestamp)
      incompleteRuns.sort((a, b) =>
        new Date(b.started_at) - new Date(a.started_at)
      );
      const latestRun = incompleteRuns[0];

      console.log("✓ Incomplete run detected");
      console.log(`  Run ID: ${latestRun.run_id}`);
      console.log(`  Status: ${latestRun.status}`);
      console.log(`  Last phase: ${latestRun.current_phase || 'not started'}`);
      console.log(`  Last step: ${latestRun.current_step || 'not started'}`);
      console.log("\n→ Auto-resuming from where you left off...\n");

      // Set resume_run_id to trigger resume logic below
      resume_run_id = latestRun.run_id;
    } else {
      console.log("  No incomplete runs found. Starting fresh.\n");
    }
  } else {
    console.log("  No previous runs found. Starting fresh.\n");
  }
}
```

**If resuming (`--resume` explicitly provided OR auto-detected above):**

```javascript
// Resume from previous run
const runId = resume_run_id;
const statePath = getStatePath(runId);  // Uses helper function defined above

// Derive eventRunId for MCP event calls (maps to {plan_id}/{run_suffix}/events/)
const runMarker = '-run-';
const runMarkerIdx = runId.lastIndexOf(runMarker);
const resumePlanId = runId.substring(0, runMarkerIdx);
const resumeRunSuffix = runId.substring(runMarkerIdx + runMarker.length);
const eventRunId = `${resumePlanId}/${resumeRunSuffix}`;

// Ensure events directory exists for resumed run (Write creates intermediate dirs automatically)
const resumeNextIdPath = `.fractary/faber/runs/${resumePlanId}/${resumeRunSuffix}/events/.next-id`;
const existingNextId = await Glob({ pattern: resumeNextIdPath });
if (!existingNextId || existingNextId.length === 0) {
  await Write({ file_path: resumeNextIdPath, content: "1" });
}

// Read existing state
const state = JSON.parse(await Read({ file_path: statePath }));

console.log("✓ Resuming workflow");
console.log(`Run ID: ${runId}`);
console.log(`Plan ID: ${state.plan_id}`);
console.log(`Current phase: ${state.current_phase}`);
console.log(`Current step: ${state.current_step}`);

// Verify plan_id matches
if (state.plan_id !== plan_id) {
  console.error(`Error: Plan ID mismatch. State has ${state.plan_id}, provided ${plan_id}`);
  throw new Error("Plan ID mismatch");
}
```

**If starting new run (`--resume` not provided):**

```javascript
// Generate unique run ID
// Format: {plan_id}-run-{timestamp}
const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
const runId = `${plan_id}-run-${timestamp}`;

// Event run_id uses slash-separated format so the MCP server maps it to
// .fractary/faber/runs/{plan_id}/{timestamp}/events/
const eventRunId = `${plan_id}/${timestamp}`;

// State file goes in same directory as plan.json, with timestamp in filename
// This keeps all artifacts for a plan together while allowing multiple runs
const statePath = `.fractary/faber/runs/${plan_id}/state-${timestamp}.json`;

console.log("✓ Starting new workflow execution");
console.log(`Run ID: ${runId}`);

// Initialize state file
const initialState = {
  run_id: runId,
  plan_id: plan_id,
  workflow_id: workflow.id,
  workflow_name: workflow.id,
  status: "pending",
  current_phase: null,
  current_step: null,
  work_id: work_id,
  work_items: workItems,
  branch: null, // Will be set by branch creation step
  autonomy: autonomy,
  phases: Object.keys(workflow.phases).map(phaseName => {
    const p = workflow.phases[phaseName];
    return {
      name: phaseName,
      status: "pending",
      enabled: p.enabled !== false,
      max_retries: p.max_retries || 0,
      retry_count: 0
    };
  }),
  steps: [],
  started_at: new Date().toISOString(),
  updated_at: new Date().toISOString()
};

// Create events directory for this run (Write creates intermediate dirs automatically)
await Write({
  file_path: `.fractary/faber/runs/${plan_id}/${timestamp}/events/.next-id`,
  content: "1"
});

// Write initial state
await Write({
  file_path: statePath,
  content: JSON.stringify(initialState, null, 2)
});

console.log("✓ State initialized");
console.log(`State file: ${statePath}`);

// Update state to in_progress
initialState.status = "in_progress";
initialState.updated_at = new Date().toISOString();
await Write({
  file_path: statePath,
  content: JSON.stringify(initialState, null, 2)
});
```

### Step 1.4: Track Active Workflow

**Track this workflow as the active workflow in the worktree.**

This enables hooks (PreCompact, SessionStart, SessionEnd) to know which workflow to operate on without requiring explicit run_id parameters.

```javascript
// Check if another workflow is active
const activeRunIdPath = `.fractary/faber/runs/.active-run-id`;
let existingRunId = null;

try {
  const existingContent = await Read({ file_path: activeRunIdPath });
  existingRunId = existingContent.trim();
} catch (error) {
  // File doesn't exist, no active workflow
  existingRunId = null;
}

// If another workflow is active and different from current
if (existingRunId && existingRunId !== runId) {
  // In batch mode, auto-take-over without prompting
  if (batch_mode) {
    console.log("→ Batch mode: auto-switching active workflow");
    console.log(`   Previous: ${existingRunId}`);
    console.log(`   New: ${runId}`);
    // Skip directly to writing the new active-run-id (below)
  } else {
  console.log("\n⚠️  WARNING: Another workflow is active in this worktree");
  console.log(`   Active: ${existingRunId}`);
  console.log(`   New: ${runId}`);
  console.log("");
  console.log("For concurrent workflows, it's recommended to use separate worktrees.");
  console.log("");

  // If --worktree flag provided, automatically create worktree without prompting
  let answer;
  if (auto_worktree) {
    console.log("→ --worktree flag detected: automatically creating new worktree");
    answer = "Create new worktree (Recommended)";
  } else {
    // Ask user what they want to do
    const confirmation = await AskUserQuestion({
      questions: [{
        question: "How would you like to proceed?",
        header: "Action",
        multiSelect: false,
        options: [
          {
            label: "Create new worktree (Recommended)",
            description: "Automatically create a new git worktree and start workflow there"
          },
          {
            label: "Take over this worktree",
            description: "Stop tracking other workflow and use this worktree (may cause conflicts)"
          },
          {
            label: "Cancel",
            description: "Stop and manually manage worktrees"
          }
        ]
      }]
    });

    answer = confirmation.answers["0"];
  }

  if (answer === "Cancel") {
    console.log("\n❌ Workflow start cancelled.");
    console.log("\nTo manually create a worktree:");
    console.log("  git worktree add ../myproject-issue-XXX -b feature/XXX");
    console.log("  cd ../myproject-issue-XXX");
    console.log("  /fractary-faber-workflow-run <plan-id>");
    throw new Error("User cancelled due to active workflow conflict");
  }

  if (answer === "Create new worktree (Recommended)") {
    console.log("\n⚠️  Worktree creation is now handled by the CLI.");
    console.log("\nWorkflows should be planned with 'faber plan', which creates worktrees automatically.");
    console.log("\nRecommended workflow:");
    console.log("  1. Plan workflow: faber plan --work-id <id>");
    console.log("  2. Navigate to worktree: cd ~/.claude-worktrees/{org}-{project}-{id}");
    console.log("  3. Run workflow: /fractary-faber-workflow-run <work-id>");
    console.log("\nAlternatively, create worktree manually:");
    console.log(`  git worktree add ~/.claude-worktrees/{org}-{project}-${work_id || 'workflow'} -b feature/${work_id || plan_id}`);
    console.log(`  cd ~/.claude-worktrees/{org}-{project}-${work_id || 'workflow'}`);
    console.log("  /fractary-faber-workflow-run <work-id>");
    throw new Error("Use CLI for worktree creation (faber plan)");
  } else {
    // User chose "Take over this worktree"
    console.log("\n⚠️  Taking over this worktree...");
    console.log("   The other workflow's context management will be interrupted.");
  }
  } // end else (non-batch conflict handling)
}

// Write current run_id to active-run-id file
await Write({
  file_path: activeRunIdPath,
  content: runId
});

console.log("✓ Workflow tracked as active");
console.log(`Active run ID: ${runId}`);
console.log(`Tracking file: ${activeRunIdPath}`);
```

**What this enables:**
- **PreCompact hook**: Knows which workflow to save session for before compaction
- **SessionStart hook**: Knows which workflow to restore context for after compaction
- **SessionEnd hook**: Knows which workflow to save final session state for
- **Manual commands**: `/fractary-faber-session-load` and `/fractary-faber-session-save` can auto-detect active workflow

**One workflow per worktree:**
FABER enforces one active workflow per worktree to avoid conflicts. Users needing concurrent workflows should use git worktrees.

### Step 1.4b: Post Workflow Start Comment

**Post a comment to the GitHub issue notifying that the workflow has started.**

This only executes when a `work_id` is available (not for target-based plans without an issue).

```javascript
// Only post comment when we have a work_id (GitHub issue)
if (work_id) {
  try {
    // Build enabled phases list
    const enabledPhases = Object.keys(workflow.phases)
      .filter(p => workflow.phases[p].enabled !== false)
      .join(" → ");

    const commentBody = [
      `🚀 **FABER Workflow Started**`,
      ``,
      `**Run ID:** \`${runId}\``,
      `**Plan ID:** \`${plan_id}\``,
      `**Workflow:** \`${workflow.id}\``,
      `**State File:** \`.fractary/faber/runs/${plan_id}/state-${timestamp}.json\``,
      `**Autonomy:** ${autonomy}`,
      ``,
      `**Phases:** ${enabledPhases}`
    ].join("\n");

    await Skill({
      skill: "fractary-work-issue-comment",
      args: `${work_id} --body "${commentBody}"`
    });

    console.log("✓ Posted workflow start comment to issue");
  } catch (error) {
    // Non-fatal: warn but don't block execution
    console.warn(`⚠️  Could not post start comment to issue #${work_id}: ${error.message}`);
  }
}
```

### Step 1.5: Load MCP Event Tool

```javascript
// Load the fractary_faber_event_emit MCP tool
await MCPSearch({ query: "select:fractary_faber_event_emit" });

// Emit workflow_start event (use eventRunId for MCP — maps to {plan_id}/{timestamp}/events/)
await fractary_faber_event_emit({
  run_id: eventRunId,
  type: "workflow_start",
  metadata: {
    plan_id: plan_id,
    run_id: runId,
    workflow_id: workflow.id,
    work_id: work_id,
    work_items_count: workItems.length
  }
});

console.log("✓ Event system ready");
```

### Step 1.6: Apply Phase/Step Filters

```javascript
// If phase or step filters are specified, filter the workflow
if (phaseFilter || stepFilter) {
  console.log("✓ Applying filters...");

  if (phaseFilter) {
    console.log(`Filtering to phases: ${phaseFilter.join(', ')}`);

    // Validate all specified phases exist
    for (const phaseName of phaseFilter) {
      if (!workflow.phases[phaseName]) {
        console.error(`Error: Phase '${phaseName}' not found in workflow`);
        console.error(`Available phases: ${Object.keys(workflow.phases).join(', ')}`);
        return;
      }
    }

    // Disable phases not in filter
    for (const phaseName of Object.keys(workflow.phases)) {
      if (!phaseFilter.includes(phaseName)) {
        workflow.phases[phaseName].enabled = false;
      }
    }
  }

  if (stepFilter) {
    console.log(`Filtering to steps: ${stepFilter.join(', ')}`);

    // Build list of all steps
    const allStepIds = [];
    for (const phaseName of Object.keys(workflow.phases)) {
      const phase = workflow.phases[phaseName];
      const phaseSteps = phase.steps || [];
      for (const step of phaseSteps) {
        allStepIds.push(step.step_id);
      }
    }

    // Validate all specified steps exist
    for (const stepId of stepFilter) {
      if (!allStepIds.includes(stepId)) {
        console.error(`Error: Step '${stepId}' not found in workflow`);
        console.error(`Available steps: ${allStepIds.join(', ')}`);
        return;
      }
    }

    // Filter steps in each phase
    for (const phaseName of Object.keys(workflow.phases)) {
      const phase = workflow.phases[phaseName];
      const phaseSteps = phase.steps || [];

      // Keep only steps that are in the filter
      const filteredSteps = phaseSteps.filter(step => stepFilter.includes(step.step_id));

      if (filteredSteps.length === 0) {
        // Disable phase if no steps match
        phase.enabled = false;
      } else {
        // Update phase with filtered steps
        phase.steps = filteredSteps;
      }
    }
  }

  console.log("✓ Filters applied");
}
```

### Step 1.7: Initialize Workflow Step Tasks

Create a task for every workflow step across all enabled phases using TaskCreate. Store task IDs in `stepTaskIds` map for subsequent updates. Bootstrap tasks are already completed by this point.

```javascript
// Mark final bootstrap task as in_progress during step creation
await TaskUpdate({ taskId: bootstrapTaskIds["init-steps"], status: "in_progress" });

// Create one task per workflow step, maintaining a task ID map
const stepTaskIds = {}; // map: "phase:step_id" → taskId

let stepCount = 0;
for (const phaseName of Object.keys(workflow.phases)) {
  const phase = workflow.phases[phaseName];
  if (phase.enabled === false) continue;

  const phaseSteps = phase.steps || [];

  for (const step of phaseSteps) {
    const task = await TaskCreate({
      subject: `[${phaseName}] ${step.name} (${step.id})`,
      description: step.description || step.name,
      activeForm: `Executing [${phaseName}] ${step.name}`,
      metadata: { faberKey: `${phaseName}:${step.id}` }
    });
    stepTaskIds[`${phaseName}:${step.id}`] = task.taskId;
    stepCount++;
  }
}

await TaskUpdate({ taskId: bootstrapTaskIds["init-steps"], status: "completed" });

console.log("✓ Progress tracking initialized");
console.log(`Total steps: ${stepCount}`);
```

**Note:** The `metadata.faberKey` field (e.g., `"frame:core-fetch-issue"`) enables reliable task ID map reconstruction after context compaction. The step ID is also included in the `subject` field for human readability.

### Step 1.7b: Validate Step ID Prefix Convention

Before execution begins, verify all step IDs follow `{phase}-{action}` naming. A step defined under the `release` phase must begin with `release-`. Steps that violate this are silently skipped by prefix-based orchestrators, a root cause of the WORK-275/346 fabrication incidents.

```javascript
try {
  const prefixResult = await Bash({
    command: `bash plugins/faber/skills/fractary-faber-run-manager/scripts/validate-plan-step-ids.sh --plan-file "${planPath}"`,
    description: "Validate plan step_id prefix convention"
  });

  if (prefixResult.exitCode !== 0) {
    // Log violations to output — do NOT abort (legacy plans may exist)
    // But escalate: post a warning comment to the GitHub issue
    console.warn(`\n⚠️  STEP ID PREFIX VIOLATIONS detected in plan.json:`);
    console.warn(prefixResult.stdout);
    console.warn(`Steps with wrong prefix will be silently skipped by prefix-based orchestrators.`);
    console.warn(`These steps MUST still be executed — iterate through plan.json steps array directly, not by prefix scan.`);
    if (source_id) {
      await Skill({
        skill: "fractary-work-issue-comment",
        args: `${source_id} --body "⚠️ **FABER Step ID Prefix Warning**: Plan contains steps whose IDs do not match their phase prefix. These will be explicitly enumerated from plan.json to prevent silent skipping.\n\`\`\`\n${prefixResult.stdout}\n\`\`\`"`
      });
    }
  } else {
    console.log("✓ Step ID prefix convention validated");
  }
} catch (e) {
  console.warn(`⚠️  Step ID validation skipped (non-fatal): ${e.message}`);
}
```

> **GIT-REVERSION WARNING:** Active state files (`.fractary/faber/runs/{plan_id}/state-*.json`) live in the git-tracked tree. A `git pull` during an active workflow can silently revert the state file to an older committed version, making completed steps appear pending. **If you run `git pull` during a workflow:**
> 1. Do NOT assume state is current.
> 2. Run `validate-state-integrity.sh --run-id <run-id>` to verify state vs event log.
> 3. Reconstruct state from events if reverted (run-manager `reconstruct-state` operation).
> The transition guard in section 2.5 provides a secondary check — a fresh disk read before each write will surface stale state — but manual verification after any git pull is required.

## Phase 2: Workflow Execution

**You are the orchestrator.** Execute all phase steps directly in this session — do NOT delegate to sub-agents. You have full context, all tools, and the full orchestration protocol loaded. Direct execution gives step-level task list visibility and avoids context loss between phases.

**SEQUENTIAL BY DEFAULT:** Execute exactly one step at a time. Complete it fully — including state updates — then move to the next. The only exception is a `parallel_group` item (containing `steps_parallel`) in the config. See Parallel Group Execution below.

### Step Execution Loop

```
# Determine phases to execute (respecting phase_filter)
phases_to_execute = workflow.phases filtered to:
  - phase.enabled !== false
  - (!phaseFilter || phaseFilter.includes(phase.name))

FOR EACH phase IN phases_to_execute (in order):

  # ── 2.1: Skip if already complete (idempotency) ──
  current_state = Read(file_path: state_path)
  IF current_state.phases[phase.name].status == "completed":
    LOG "⏭ Skipping {phase.name} — already complete in state"
    CONTINUE to next phase

  LOG "═══════════════════════════════════════════════════════════"
  LOG "  PHASE: {phase.name}"
  LOG "  Run ID: {run_id}  |  Plan: {plan_id}  |  Work ID: {work_id}"
  LOG "═══════════════════════════════════════════════════════════"

  FOR EACH item IN phase.steps (in order):

    # ── 2.2: Skip if already complete (resume idempotency) ──
    current_state = Read(file_path: state_path)
    IF item has steps_parallel (is a parallel_group):
      all_done = ALL(current_state.phases[phase.name].steps[s.id].status == "completed" for s in item.steps_parallel)
      IF all_done:
        LOG "⏭ Skipping parallel group {item.id} — all steps already complete"
        CONTINUE to next item
    ELSE:
      IF current_state.phases[phase.name].steps[item.id].status == "completed":
        LOG "⏭ Skipping step {item.id} — already complete"
        CONTINUE to next item

    # ══ Sequential step (item does NOT have steps_parallel) ══════════════════

    IF item does NOT have steps_parallel:

      step = item

      # ── 2.3: Mark in_progress ──
      TaskUpdate({ taskId: stepTaskIds["{phase.name}:{step.id}"], status: "in_progress" })
      Update state: phases[phase.name].steps[step.id].status = "in_progress", updated_at = now
      Emit step_start event

      # ── 2.4: Execute step per orchestration protocol ──
      #
      # EXECUTOR ROUTING: Check if step has an external executor configured.
      # If step.executor is defined, delegate to external model/service via CLI.
      # If not, use default behavior (direct execution by you).
      #
      IF step.executor is defined (step has an "executor" field with "provider"):
        # External executor — invoke via Bash, parse JSON result
        LOG "⫸ External executor: {step.executor.provider}" + (step.executor.model if set)
        result_json = Bash: echo '<step-input-json>' | node -e "
          import('@fractary/faber').then(m => m.executeStepCli());
        "
        # Where <step-input-json> is:
        # {"stepId":"<step.id>","prompt":"<step.prompt with vars substituted>",
        #  "executor":<step.executor>,"context":{"workId":"<work_id>","phase":"<phase>"}}
        #
        # Parse result_json as ExecutorResult:
        #   result.status → 'success' | 'warning' | 'failure'
        #   result.output → text output from external model
        #   result.error → error message if failure
        #
        # Apply result_handling based on result.status (same as normal steps)
        # The output text can be used as context for subsequent steps

      ELSE IF step.skill is set:
        Skill(skill=step.skill, args=resolved_args)
      ELSE:
        Interpret and execute step.prompt directly
        (call whatever tools/skills the prompt requires,
         substituting {work_id}, {plan_id}, {run_id}, etc.)

      # ── 2.5: On success ──
      # TRANSITION GUARD (mandatory — prevents batch fabrication):
      #   Re-read current state from disk (catches git-reversion and stale in-memory state).
      #   Construct proposed state with this one step marked completed.
      #   Validate via script — fails if more than 1 step is being completed in this write.
      #   If validation fails, HALT immediately — do not write state.
      current_state = Read(file_path: state_path)   # Fresh read from disk
      proposed_state = deepcopy(current_state) with phases[phase.name].steps[step.id].status = "completed"
      Bash: validate-state-transition.sh \
              --current {state_path} \
              --proposed-json '{JSON.stringify(proposed_state)}'
      # Exit code != 0 → transition invalid → set status="paused", report, halt execution
      Update state: phases[phase.name].steps[step.id].status = "completed", updated_at = now
      Emit step_complete event
      TaskUpdate({ taskId: stepTaskIds["{phase.name}:{step.id}"], status: "completed" })

      # ── 2.6: On failure — follow orchestration protocol retry/guard/autonomy-gate logic ──
      # (see workflow-orchestration-protocol.md: Result Handling, Retry Logic, Error Recovery)

    # ══ Parallel group (item HAS steps_parallel) ═════════════════════════════
    # This is the ONLY place in workflow execution where running multiple steps
    # simultaneously is permitted. All steps in steps_parallel run at the same time.

    ELSE:

      pending = [s for s in item.steps_parallel WHERE current_state.phases[phase.name].steps[s.id].status != "completed"]

      LOG "⫸ Parallel group [{item.id}]: {pending.length} steps running simultaneously"

      # Mark all pending steps as in_progress
      FOR EACH s IN pending:
        TaskUpdate({ taskId: stepTaskIds["{phase.name}:{s.id}"], status: "in_progress" })
        Update state: phases[phase.name].steps[s.id].status = "in_progress", updated_at = now
        Emit step_start event for s

      # Execute all pending steps simultaneously via Task agents
      results = run all pending simultaneously:
        FOR EACH s IN pending:
          Agent(description=s.name, prompt=s.prompt with {work_id}/{plan_id}/{run_id} substituted)
      WAIT for all Tasks to complete

      # Record results for each step (one at a time — transition guard applies per step)
      FOR EACH (s, result) IN zip(pending, results):
        current_state = Read(file_path: state_path)   # Fresh read before each write
        proposed_state = deepcopy(current_state) with phases[phase.name].steps[s.id].status = "completed"
        Bash: validate-state-transition.sh \
                --current {state_path} \
                --proposed-json '{JSON.stringify(proposed_state)}'
        # Exit code != 0 → halt — do not record this step as complete
        Update state: phases[phase.name].steps[s.id].status = "completed", updated_at = now
        Emit step_complete event for s
        TaskUpdate({ taskId: stepTaskIds["{phase.name}:{s.id}"], status: "completed" })

      LOG "✓ Parallel group [{item.id}] complete — all {pending.length} steps finished"

  END FOR (items)

  # ── 2.7: Phase Boundary Context Refresh ──
  # The next phase's first pre_step is /fractary-faber-session-clear (clears context)
  # followed by /fractary-faber-session-load (reloads critical artifacts).
  # Re-read state to ground orchestrator before continuing the loop.
  current_state = Read(file_path: state_path)
  LOG "── Phase {phase.name} complete ──"

END FOR (phases)

## Phase 3: Workflow Completion

### On Successful Completion:

```javascript
// TaskList guard: assert zero pending tasks remain before invoking completion gate.
// An orchestrator that batch-fabricated steps would have pending tasks in the task list.
// This check catches task-queue divergence from state-file divergence independently.
const allTasks = await TaskList();
const pendingTasks = allTasks.filter(t => t.status === "pending" || t.status === "in_progress");
if (pendingTasks.length > 0) {
  console.error(`\n❌ TaskList guard FAILED: ${pendingTasks.length} task(s) still pending:`);
  pendingTasks.forEach(t => console.error(`  - [${t.status}] ${t.subject}`));
  const pausedState = {
    ...state,
    status: "paused",
    pause_reason: `TaskList guard: ${pendingTasks.length} task(s) pending before completion — resolve then resume`,
    updated_at: new Date().toISOString()
  };
  await Write({ file_path: statePath, content: JSON.stringify(pausedState, null, 2) });
  console.error(`\nTo resume: /fractary-faber-workflow-run ${work_id} --resume ${runId}`);
  return;
}
console.log(`TaskList check: ${allTasks.length} tasks, 0 pending ✓`);

// Run completion verification before marking as completed
const verificationResult = await Agent({
  subagent_type: "fractary-faber-workflow-verifier",
  description: `Verify workflow completion for ${runId}`,
  prompt: `--run-id ${runId}`
});

const verificationMatch = verificationResult.match(/verification:\s*(pass|fail)/);
if (!verificationMatch || verificationMatch[1] === 'fail') {
  const reasonMatch = verificationResult.match(/reason:\s*(.+)/);
  const reason = reasonMatch ? reasonMatch[1].trim() : 'unknown reason';
  console.error(`\n❌ Completion verification failed: ${reason}`);
  const pausedState = { ...state, status: "paused", pause_reason: `Verification failed: ${reason}`, updated_at: new Date().toISOString() };
  await Write({ file_path: statePath, content: JSON.stringify(pausedState, null, 2) });
  console.error(`\nTo resume after resolving: /fractary-faber-workflow-run ${work_id} --resume ${runId}`);
  return;
}

// Update state to completed
const completedState = {
  ...state,
  status: "completed",
  completed_at: new Date().toISOString()
};

await Write({
  file_path: statePath,
  content: JSON.stringify(completedState, null, 2)
});

// Calculate duration
const durationSeconds = Math.floor(
  (new Date(completedState.completed_at).getTime() -
   new Date(completedState.started_at).getTime()) / 1000
);

// Emit completion event (use eventRunId for MCP — maps to {plan_id}/{timestamp}/events/)
await fractary_faber_event_emit({
  run_id: eventRunId,
  type: "workflow_complete",
  metadata: {
    run_id: runId,
    duration_seconds: durationSeconds,
    phases_completed: state.phases.filter(p => p.status === "completed").length,
    total_phases: state.phases.length
  }
});

// Report success
console.log("\n✓ Workflow completed successfully!");
console.log(`Run ID: ${runId}`);
console.log(`Total duration: ${durationSeconds}s`);
console.log(`Phases completed: ${state.phases.filter(p => p.status === "completed").length}/${state.phases.length}`);
console.log(`\nState file: ${statePath}`);
```

## Phase 4: Post-Workflow Finalization (state-untracked, task-tracked)

After Phase 3 marks the workflow as "completed", run post-workflow finalization. This phase is **not tracked in the state file** (avoiding the chicken-and-egg problem where state updates after the last commit create lingering uncommitted files). Instead, steps are tracked via **TaskCreate/TaskUpdate** for agent accountability and user visibility.

**Every action in Phase 4 is wrapped in try/catch. Failures are non-fatal — the workflow is already "completed".**

### Register Phase 4 Task Items

```javascript
// Register finalization steps as tasks for visibility
const finalizeTaskIds = {};
const finalizeSteps = [
  { key: "adherence",    subject: "Plan Adherence Report — verify planned vs executed steps" },
  { key: "hooks",        subject: "Execute post_workflow hooks" },
  { key: "commit-push",  subject: "Final cleanup commit & push (state files, memory)" },
  { key: "pr-merge",     subject: "Final PR merge & branch cleanup" },
  { key: "close-issue",  subject: "Close GitHub issue" }
];

for (const step of finalizeSteps) {
  const task = await TaskCreate({
    subject: step.subject,
    description: step.subject,
    activeForm: step.subject
  });
  finalizeTaskIds[step.key] = task.taskId;
}

// Mark first step as in_progress
await TaskUpdate({ taskId: finalizeTaskIds["adherence"], status: "in_progress" });
```

### Step 4.1: Plan Adherence Report [finalize-adherence]

Compare the plan's defined steps against what was actually executed and report to the GitHub issue.

```javascript
try {
  // Run adherence verification script
  const adherenceResult = await Bash({
    command: `bash plugins/faber/skills/fractary-faber-run-manager/scripts/verify-plan-adherence.sh --run-id "${runId}" --base-path ".fractary/faber/runs" --format markdown`,
    description: "Verify plan adherence"
  });

  const adherenceReport = adherenceResult.stdout;

  // Post the adherence report as a comment on the GitHub issue
  if (source_id) {
    await Skill({
      skill: "fractary-work-issue-comment",
      args: `${source_id} --context "Post the following plan adherence report as a comment:\n${adherenceReport}"`
    });
  }

  // Mark task completed
  await TaskUpdate({ taskId: finalizeTaskIds["adherence"], status: "completed" });
} catch (e) {
  console.warn("⚠️  Plan adherence report failed (non-fatal):", e.message);
  await TaskUpdate({ taskId: finalizeTaskIds["adherence"], status: "completed", subject: "Plan Adherence Report — failed (non-fatal): " + e.message });
}
```

### Step 4.2: Execute post_workflow Hooks [finalize-hooks]

```javascript
try {
  // Execute any post_workflow hooks defined in the workflow config
  // Uses the faber-hooks skill with the new post_workflow boundary
  await Skill({
    skill: "fractary-faber-faber-hooks",
    args: JSON.stringify({
      operation: "execute-all",
      boundary: "post_workflow",
      context_json: { work_id, run_id: runId, source_id },
      continue_on_error: true
    })
  });

  await TaskUpdate({ taskId: finalizeTaskIds["hooks"], status: "completed" });
} catch (e) {
  console.warn("⚠️  post_workflow hooks failed (non-fatal):", e.message);
  await TaskUpdate({ taskId: finalizeTaskIds["hooks"], status: "completed", subject: "Execute post_workflow hooks — skipped/failed: " + e.message });
}
```

### Step 4.3: Final Cleanup Commit & Push [finalize-commit-push]

Commit all lingering files (state, events, memory) to the feature branch.

```javascript
let hasCleanupChanges = false;
try {
  // Force-add state file (gitignored during active run to prevent git-reversion;
  // committed only here at workflow completion via -f to override .gitignore)
  await Bash({ command: `git add -f "${statePath}" 2>/dev/null || true`, description: "Force-add completed state file" });

  // Stage all lingering files from .fractary/ and .claude/ directories
  await Bash({ command: `git add .fractary/ 2>/dev/null || true`, description: "Stage .fractary/ files" });
  await Bash({ command: `git add .claude/ 2>/dev/null || true`, description: "Stage .claude/ files" });

  // Check if there are staged changes
  const diffResult = await Bash({ command: `git diff --cached --quiet 2>/dev/null; echo $?`, description: "Check for staged changes" });
  hasCleanupChanges = diffResult.stdout.trim() !== "0";

  if (hasCleanupChanges) {
    // Get the current branch name
    const branchResult = await Bash({ command: `git branch --show-current`, description: "Get current branch" });
    const currentBranch = branchResult.stdout.trim();

    await Bash({
      command: `git commit -m "chore: post-workflow finalization [${work_id || runId}]"`,
      description: "Commit lingering state/memory files"
    });

    await Bash({
      command: `git push origin ${currentBranch}`,
      description: "Push finalization commit"
    });

    console.log("✓ Lingering files committed and pushed");
    await TaskUpdate({ taskId: finalizeTaskIds["commit-push"], status: "completed" });
  } else {
    console.log("✓ No lingering files to commit");
    await TaskUpdate({ taskId: finalizeTaskIds["commit-push"], status: "completed", subject: "Final cleanup commit & push — no changes to commit" });
  }
} catch (e) {
  console.warn("⚠️  Final cleanup commit failed (non-fatal):", e.message);
  await TaskUpdate({ taskId: finalizeTaskIds["commit-push"], status: "completed", subject: "Final cleanup commit & push — failed: " + e.message });
}
```

### Step 4.4: Final PR Merge & Branch Cleanup [finalize-pr-merge]

If there are changes to merge, ensure they get merged to main and clean up the branch.

```javascript
try {
  if (hasCleanupChanges) {
    const branchResult = await Bash({ command: `git branch --show-current`, description: "Get current branch" });
    const currentBranch = branchResult.stdout.trim();

    // Check if there's an open PR for this branch
    const prListResult = await Bash({
      command: `gh pr list --head "${currentBranch}" --json number,state --jq '.[0]' 2>/dev/null || echo '{}'`,
      description: "Check for existing PR"
    });

    const prInfo = prListResult.stdout.trim();

    if (prInfo && prInfo !== '{}' && prInfo !== '') {
      const pr = JSON.parse(prInfo);
      if (pr.state === "OPEN") {
        // Open PR exists — merge it with branch deletion
        await Bash({
          command: `gh pr merge ${pr.number} --squash --delete-branch`,
          description: "Merge existing PR with cleanup commit"
        });
        console.log(`✓ Merged existing PR #${pr.number} with finalization commit`);
      } else {
        // PR is closed/merged — create new one for the cleanup commit
        await Bash({
          command: `gh pr create --base main --title "chore: post-workflow finalization [${work_id || runId}]" --body "Automated post-workflow cleanup: state files, memory, events.\n\nRun ID: ${runId}"`,
          description: "Create finalization PR"
        });
        const newPrResult = await Bash({
          command: `gh pr list --head "${currentBranch}" --json number --jq '.[0].number'`,
          description: "Get new PR number"
        });
        const newPrNumber = newPrResult.stdout.trim();
        if (newPrNumber) {
          await Bash({
            command: `gh pr merge ${newPrNumber} --squash --delete-branch`,
            description: "Merge finalization PR"
          });
          console.log(`✓ Created and merged finalization PR #${newPrNumber}`);
        }
      }
    } else {
      // No PR exists — create one for the cleanup
      await Bash({
        command: `gh pr create --base main --title "chore: post-workflow finalization [${work_id || runId}]" --body "Automated post-workflow cleanup: state files, memory, events.\n\nRun ID: ${runId}"`,
        description: "Create finalization PR"
      });
      const newPrResult = await Bash({
        command: `gh pr list --head "${currentBranch}" --json number --jq '.[0].number'`,
        description: "Get new PR number"
      });
      const newPrNumber = newPrResult.stdout.trim();
      if (newPrNumber) {
        await Bash({
          command: `gh pr merge ${newPrNumber} --squash --delete-branch`,
          description: "Merge finalization PR"
        });
        console.log(`✓ Created and merged finalization PR #${newPrNumber}`);
      }
    }

    await TaskUpdate({ taskId: finalizeTaskIds["pr-merge"], status: "completed" });
  } else {
    console.log("✓ No cleanup PR needed (no changes)");
    await TaskUpdate({ taskId: finalizeTaskIds["pr-merge"], status: "completed", subject: "Final PR merge — skipped (no changes)" });
  }
} catch (e) {
  console.warn("⚠️  Final PR merge failed (non-fatal):", e.message);
  await TaskUpdate({ taskId: finalizeTaskIds["pr-merge"], status: "completed", subject: "Final PR merge — failed: " + e.message });
}
```

### Step 4.5: Close Issue [finalize-close-issue]

Close the GitHub issue as the very last action. This is idempotent — if the issue was already closed by PR auto-link (`Closes #`), it will be detected and skipped.

```javascript
try {
  if (source_id) {
    // Check current issue state
    const issueStateResult = await Bash({
      command: `gh issue view ${source_id} --json state --jq '.state' 2>/dev/null || echo 'UNKNOWN'`,
      description: "Check issue state"
    });
    const issueState = issueStateResult.stdout.trim();

    if (issueState === "OPEN") {
      await Bash({
        command: `gh issue close ${source_id} --comment "✅ **Workflow completed successfully**\n\nRun ID: \`${runId}\`\nAll phases completed. Plan adherence report posted above.\n\n🤖 Closed by FABER post-workflow finalization"`,
        description: "Close issue"
      });
      console.log(`✓ Issue #${source_id} closed`);
    } else {
      console.log(`✓ Issue #${source_id} already closed (state: ${issueState})`);
    }

    await TaskUpdate({ taskId: finalizeTaskIds["close-issue"], status: "completed" });
  } else {
    console.log("✓ No issue to close (no source_id)");
    await TaskUpdate({ taskId: finalizeTaskIds["close-issue"], status: "completed", subject: "Close issue — skipped (no source_id)" });
  }
} catch (e) {
  console.warn("⚠️  Issue close failed (non-fatal):", e.message);
  await TaskUpdate({ taskId: finalizeTaskIds["close-issue"], status: "completed", subject: "Close issue — failed: " + e.message });
}
```

### Phase 4 Complete

```javascript
console.log("\n═══════════════════════════════════════════════════════════");
console.log("  POST-WORKFLOW FINALIZATION COMPLETE");
console.log("═══════════════════════════════════════════════════════════");
```

### On Workflow Failure:

```javascript
// Update state to failed
const failedState = {
  ...state,
  status: "failed",
  error: errorMessage,
  failed_at_step: currentStep.step_id,
  failed_at_phase: currentPhase.name,
  completed_at: new Date().toISOString()
};

await Write({
  file_path: statePath,
  content: JSON.stringify(failedState, null, 2)
});

// Emit failure event (use eventRunId for MCP — maps to {plan_id}/{timestamp}/events/)
await fractary_faber_event_emit({
  run_id: eventRunId,
  type: "workflow_failed",
  phase: currentPhase.name,
  step_id: currentStep.step_id,
  metadata: {
    run_id: runId,
    error: errorMessage
  }
});

// Report failure with actionable information
console.error("\n✗ Workflow failed");
console.error(`Run ID: ${runId}`);
console.error(`Phase: ${currentPhase.name}`);
console.error(`Step: ${currentStep.name}`);
console.error(`Error: ${errorMessage}`);
console.error(`\nTo resume after fixing:`);
console.error(`  /fractary-faber-workflow-run ${work_id} --resume ${runId}`);
console.error(`\nState file: ${statePath}`);
```

### Failure Path: Reduced Post-Workflow Finalization

Even on failure, commit lingering state and event files so they aren't lost. This is a minimal cleanup — no adherence report, no issue close, no branch deletion.

```javascript
// Register minimal finalization task
const failureCleanupTask = await TaskCreate({
  subject: "Cleanup commit of state/event files (failure path)",
  description: "Cleanup commit of state/event files (failure path)",
  activeForm: "Committing state files after failure"
});
await TaskUpdate({ taskId: failureCleanupTask.taskId, status: "in_progress" });

try {
  await Bash({ command: `git add .fractary/ 2>/dev/null || true`, description: "Stage .fractary/ files" });
  await Bash({ command: `git add .claude/ 2>/dev/null || true`, description: "Stage .claude/ files" });

  const diffResult = await Bash({ command: `git diff --cached --quiet 2>/dev/null; echo $?`, description: "Check for staged changes" });
  if (diffResult.stdout.trim() !== "0") {
    await Bash({
      command: `git commit -m "chore: post-workflow cleanup (failed) [${work_id || runId}]"`,
      description: "Commit state files after failure"
    });

    const branchResult = await Bash({ command: `git branch --show-current`, description: "Get current branch" });
    await Bash({
      command: `git push origin ${branchResult.stdout.trim()}`,
      description: "Push failure cleanup commit"
    });
    console.log("✓ State files committed after workflow failure");
  }

  await TaskUpdate({ taskId: failureCleanupTask.taskId, status: "completed" });
} catch (e) {
  console.warn("⚠️  Failure cleanup commit failed (non-fatal):", e.message);
  await TaskUpdate({ taskId: failureCleanupTask.taskId, status: "completed", subject: "Cleanup commit — failed: " + e.message });
}
```

</WORKFLOW>

<OUTPUTS>

**Success:**
```
✓ Loaded orchestration protocol
✓ Workflow resolved
✓ State initialized
✓ Event system ready
✓ Progress tracking initialized

=== Phase: frame ===
[Execution output...]

=== Phase: architect ===
[Execution output...]

=== Phase: build ===
[Execution output...]

=== Phase: evaluate ===
[Execution output...]

=== Phase: release ===
[Execution output...]

✓ Workflow completed successfully!
Run ID: default-123-1703001234567
Total duration: 245s
Phases completed: 5/5

State file: .fractary/faber/runs/default-123-1703001234567/state.json
```

**Failure with Resume Instructions:**
```
✗ Workflow failed
Run ID: default-123-1703001234567
Phase: build
Step: implement-solution
Error: Tests failed (3 failures)

To resume after fixing:
  /fractary-faber-workflow-run 123 --resume default-123-1703001234567

State file: .fractary/faber/runs/default-123-1703001234567/state.json
```

**Missing Work ID Error:**
```
Error: Work ID is required

Usage: /fractary-faber-workflow-run <work-ids|plan-id> [options]

Examples:
  /fractary-faber-workflow-run 123
  /fractary-faber-workflow-run 123,456,789 --phase frame,architect,build,evaluate
  /fractary-faber-workflow-run 123 --resume abc123-def456-789
```

**Batch Mode Success:**
```
═══════════════════════════════════════════════════════════════
  BATCH MODE: Sequential Multi-Workflow Execution
═══════════════════════════════════════════════════════════════
Batch ID: batch-2026-02-20T15-30-00Z
Work IDs: 258, 259, 260
Total workflows: 3
Phase filter: frame, architect, build, evaluate
═══════════════════════════════════════════════════════════════

═══════════════════════════════════════════════════════════════
  WORKFLOW 1/3: Issue #258
═══════════════════════════════════════════════════════════════
[... workflow execution output ...]
✓ Workflow 1/3 completed: #258

═══════════════════════════════════════════════════════════════
  WORKFLOW 2/3: Issue #259
═══════════════════════════════════════════════════════════════
[... workflow execution output ...]
✓ Workflow 2/3 completed: #259

═══════════════════════════════════════════════════════════════
  WORKFLOW 3/3: Issue #260
═══════════════════════════════════════════════════════════════
[... workflow execution output ...]
✓ Workflow 3/3 completed: #260

═══════════════════════════════════════════════════════════════
  BATCH COMPLETE
═══════════════════════════════════════════════════════════════
Batch ID: batch-2026-02-20T15-30-00Z
Total:     3
Completed: 3
  ✓ #258 — completed
  ✓ #259 — completed
  ✓ #260 — completed
═══════════════════════════════════════════════════════════════
```

**Batch Mode with Error:**
```
═══════════════════════════════════════════════════════════════
  WORKFLOW 2/3: Issue #259
═══════════════════════════════════════════════════════════════
[... workflow execution output ...]
✗ Workflow 2/3 FAILED: #259
  Error: Tests failed (3 failures)

[User prompted: Stop batch / Skip and continue / Retry]

⏸  Batch paused.
To resume: /fractary-faber-workflow-run --resume-batch
```

</OUTPUTS>

<ARCHITECTURE_NOTES>

## Old vs New Architecture

### Old: workflow-execute (Delegation Pattern)

```
User invokes: /fractary-faber-execute <plan-id>
    ↓
workflow-execute command parses args
    ↓
Invokes faber-executor skill
    ↓
Executor spawns faber-manager agent(s) via Task tool
    ↓
Each agent executes one work item
    ↓
Results aggregated by executor
```

**Issues:**
- Context split across 3 layers (command/skill/agent)
- No way for agent to access full orchestration logic
- Limited token budget per agent instance
- (Removed: workflow-execute command and faber-executor/faber-manager agents no longer exist)

### New: workflow-run (Orchestrator Pattern)

```
User invokes: /fractary-faber-workflow-run <work-id>
    ↓
workflow-run command loads orchestration protocol into context
    ↓
Main Claude agent (THIS) executes entire workflow
    ↓
Full context maintained throughout
    ↓
Protocol defines all orchestration logic explicitly
```

**Benefits:**
- Single Claude session with full context
- All orchestration logic explicit in protocol document
- No context loss between layers
- Direct tool access (Read, Write, Bash, Skill, etc.)
- Natural execution with intelligent guardrails

## Key Differences

| Aspect | workflow-execute (old) | workflow-run (current) |
|--------|------------------------|------------------------|
| **Orchestrator** | faber-manager agent (removed) | Main Claude (you) |
| **Context** | Split across 3 layers | Single session |
| **Logic Source** | agent rules | Protocol document |
| **Execution** | Agent interprets rules | Claude follows protocol |
| **State** | Agent-managed | File-based (Read/Write) |
| **Guards** | Agent heuristics | Explicit bash checks |
| **Resume** | Agent state file | Run state file |
| **Tool Access** | Via agent's tools | Direct (all tools) |
| **Batch parallel** | N/A | general-purpose → workflow-run |

## Protocol-Based Orchestration

The orchestration protocol (`plugins/faber/docs/workflow-orchestration-protocol.md`) is a comprehensive document that defines:

1. **Core Principles** - Your role, execution philosophy, state management
2. **Execution Loop** - Exact before/execute/after sequence for each step
3. **State Management** - When/how to update state file, JSON schema
4. **Event Emission** - What events to emit and when
5. **Guards** - All 4 guard implementations (execution evidence, state validation, branch safety, destructive approval)
6. **Result Handling** - How to handle success/warning/failure/pending_input
7. **Retry Logic** - When/how to retry failed steps (Build-Evaluate loop)
8. **Autonomy Gates** - Approval procedures before/after phases
9. **Error Recovery** - What to do when things go wrong
10. **Task List Integration** - How to track progress with TaskCreate/TaskUpdate

**This protocol is your operating manual.** When executing a workflow, you MUST follow it exactly.

## State File Structure

State is persisted to `.fractary/faber/runs/{plan_id}/state-{run_suffix}.json`:

**Directory Structure:**
```
.fractary/faber/runs/{plan_id}/
├── plan.json                    # Execution plan (created by workflow-planner)
├── state-2026-02-04T19-56-42Z.json  # First run state
├── state-2026-02-04T20-30-15Z.json  # Second run state (if re-run)
└── ...
```

This structure keeps all artifacts for a plan together while allowing multiple runs.
The run_id (`{plan_id}-run-{timestamp}`) is stored inside the state file for identification.

```json
{
  "run_id": "default-123-1703001234567",
  "workflow_id": "default",
  "workflow_name": "Default FABER Workflow",
  "workflow_plan": { /* full resolved workflow */ },
  "status": "in_progress",
  "current_phase": "build",
  "current_step": "implement-solution",
  "work_id": "123",
  "branch": "feature/issue-123",
  "phases": [
    {
      "name": "frame",
      "status": "completed",
      "enabled": true,
      "retry_count": 0
    },
    {
      "name": "build",
      "status": "in_progress",
      "enabled": true,
      "max_retries": 3,
      "retry_count": 1
    }
  ],
  "steps": [
    {
      "step_id": "fetch-issue",
      "phase": "frame",
      "status": "success",
      "message": "Issue #123 fetched",
      "completed_at": "2024-12-22T10:30:00Z"
    }
  ],
  "started_at": "2024-12-22T10:25:00Z",
  "updated_at": "2024-12-22T10:35:00Z"
}
```

This state enables:
- Resume from exact step
- Retry tracking
- Audit trail
- Progress monitoring
- Error diagnosis

</ARCHITECTURE_NOTES>

<PROTOCOL_REFERENCE>

**Full Protocol:** `plugins/faber/docs/workflow-orchestration-protocol.md`

**You MUST read and follow this protocol when executing workflows.**

Key sections to reference during execution:

- **Execution Loop** - The before/execute/after pattern for each step
- **State Management Protocol** - When to update state file
- **Guard Execution Protocol** - All 4 guards with implementations
- **Result Handling Protocol** - How to handle different result types
- **Retry Logic Protocol** - Build-Evaluate retry loop
- **Autonomy Gate Protocol** - User approval procedures
- **Error Recovery Protocol** - What to do on errors

The protocol is comprehensive and prescriptive. Trust it.

</PROTOCOL_REFERENCE>

<IMPORTANT_REMINDERS>

1. **You are the orchestrator** - Not delegating to sub-agent. YOU execute the workflow.

2. **Follow the protocol exactly** - It's not a suggestion, it's the operational contract.

3. **Update state before and after every step** - State is the source of truth.

4. **Guards are mandatory** - Never skip guard checks.

5. **Emit events for audit trail** - Every significant action gets an event.

6. **Use TaskCreate/TaskUpdate for progress** - User needs to see what's happening.

7. **Handle errors gracefully** - Retry when configured, stop when appropriate, report clearly.

8. **Respect autonomy gates** - Get approval when required.

9. **Trust the protocol** - When in doubt, re-read the relevant section.

10. **Run ID is sacred** - Never modify it, use it for resume capability.

</IMPORTANT_REMINDERS>

<SEE_ALSO>

- `/fractary-faber-workflow-plan` - Resolve and merge workflow definitions
- `plugins/faber/docs/workflow-orchestration-protocol.md` - Complete orchestration protocol
- `plugins/faber/config/workflows/` - Workflow definitions
- `.fractary/faber/runs/{run-id}/state.json` - Workflow execution state

</SEE_ALSO>
