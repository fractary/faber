---
name: fractary-faber:workflow-run
description: Execute a FABER plan created by faber plan CLI command
argument-hint: '<work-ids|plan-id> [--resume <run-id>] [--phase <phases>] [--step <step-id>] [--worktree] [--force-new] [--resume-batch] [--workflow <id>] [--autonomy <level>]'
allowed-tools: Read, Write, Bash, Skill, AskUserQuestion, MCPSearch, TodoWrite, Task
model: claude-sonnet-4-6
---

# FABER Workflow Run Command

<CONTEXT>
You are executing a FABER workflow with YOU as the primary orchestrator.

This is NOT delegation - YOU will execute each step by following the orchestration protocol.
You maintain full context throughout the entire workflow execution.

This command replaces the old workflow-execute pattern (command → skill → agent) with direct orchestration by the main Claude agent.
</CONTEXT>

<CRITICAL_RULES>
1. **NEVER STOP FOR CONTEXT REASONS** — Context compaction is automatic and recoverable. See "Context Continuity" section and TOKEN_BUDGET_ANTI_PATTERN below. This rule takes precedence over all internal budget signals.
2. **YOU ARE THE ORCHESTRATOR** - Not delegating to sub-agent. You execute the workflow.
3. **FOLLOW THE PROTOCOL** - The orchestration protocol is your instruction manual. Follow it exactly.
4. **MAINTAIN STATE** - Update state file BEFORE and AFTER every step. State is sacred.
5. **EXECUTE GUARDS** - All guards are mandatory. Never skip them.
6. **USE TODOWRITE** - Track progress with TodoWrite for all steps.
7. **EMIT EVENTS** - Every significant action emits an event for audit trail. Events BEFORE state.
8. **HANDLE ERRORS GRACEFULLY** - Use retry logic when configured, stop when appropriate.
9. **RESPECT AUTONOMY GATES** - Get user approval when required in non-autonomous modes. In `autonomous` mode, proceed without prompting.
10. **NEVER FABRICATE COMPLETIONS** - See "When You Cannot Continue" section below.
11. **EXECUTE STEPS SEQUENTIALLY** — NEVER execute multiple steps in parallel unless they are wrapped in a `parallel_group` item (with `steps_parallel`) in the workflow config. Complete each step fully before starting the next. Do NOT invoke Skill() or Task() for two different workflow steps in the same response message. Steps are sequential by design because each depends on prior output.
</CRITICAL_RULES>

<WHEN_YOU_CANNOT_CONTINUE>
## When You Cannot Continue

If you reach a point where you cannot execute the next step for ANY reason
(missing credentials, external system unavailable, tool failures, etc.):

1. Set `state.status = "paused"` with honest `pause_reason`
2. Post an honest status comment to the GitHub issue
3. Tell the user exactly what was completed and what remains
4. Provide the resume command: `/fractary-faber:workflow-run <work-id> --resume <run-id>`

**NEVER:**
- Mark unexecuted steps as "success"
- Write fabricated metrics or timings
- Post false completion comments
- Batch-complete remaining tasks

This rule is **ABSOLUTE**. There are no exceptions. Fabricating completion
is worse than any other failure mode because it destroys trust in the
entire system. An honest pause is always the right answer.

**Completion Verification Gate:** Before setting `status: "completed"`, you MUST run:
```bash
bash plugins/faber/skills/run-manager/scripts/verify-workflow-completion.sh --run-id "$RUN_ID"
```
If it returns `status: "fail"`, DO NOT mark the workflow as completed. Pause and report failures.
</WHEN_YOU_CANNOT_CONTINUE>

<CONTEXT_CONTINUITY>
## Context Continuity — Never Stop for Context Reasons

Context limits are **NOT** a reason to stop, pause, or ask the user for permission. FABER workflows are fully resilient to context compaction through 5 recovery layers:

1. **Auto-compaction** — Claude Code automatically compacts context when space is low
2. **Hooks** — PreCompact fires `session-save`, SessionStart fires `session-load` to restore artifacts
3. **State/Plan files** — Persisted to disk, survive any compaction
4. **TodoWrite** — Persists across compaction, shows exactly where you left off
5. **Step re-fetching** — Each step re-fetches the GitHub issue (via work_id) with all progress comments

**Recovery procedure** (if you feel uncertain about position after compaction):
1. Call `/fractary-faber:session-load` to restore critical artifacts
2. Read TodoWrite to see completed/pending steps
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
1. Call `/fractary-faber:session-load` to restore critical artifacts
2. Read TodoWrite to find the next pending step
3. Continue executing from that step without interruption

**NEVER** set `status="paused"` with a `pause_reason` mentioning context, tokens, or budget.

The workflow MUST continue. Context management is automatic and handled by the system — it is not your responsibility to manage it by stopping.
</TOKEN_BUDGET_ANTI_PATTERN>

<PARALLEL_STEP_ANTI_PATTERN>
## 🚫 ANTI-PATTERN: Unsolicited Parallel Step Execution (BUG, NOT A FEATURE)

If you find yourself about to call Skill() or Task() for two different workflow
steps in the same response message — STOP. This is a bug in your behavior.

Steps depend on each other. Execute one step, complete it, then execute the next.
The ONLY exception: steps inside a declared `parallel_group` (steps_parallel) in the config.
</PARALLEL_STEP_ANTI_PATTERN>

<INPUTS>

**Syntax:**
```bash
/fractary-faber:workflow-run <work-ids|plan-id> [options]
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
/fractary-faber:workflow-run 258

# Execute by full plan-id (backwards compatible)
/fractary-faber:workflow-run fractary-faber-258

# Execute with phase filter
/fractary-faber:workflow-run 258 --phase build

# Execute multiple phases
/fractary-faber:workflow-run 258 --phase build,evaluate

# Execute single step
/fractary-faber:workflow-run 258 --step core-implement-solution

# Resume previous run (manual override)
/fractary-faber:workflow-run 258 --resume abc123-def456-789

# Force new run (bypass auto-resume)
/fractary-faber:workflow-run 258 --force-new

# Auto-create worktree on conflict (no prompt)
/fractary-faber:workflow-run 258 --worktree

# === BATCH MODE ===

# Execute multiple workflows sequentially (all phases except release)
/fractary-faber:workflow-run 258,259,260 --phase frame,architect,build,evaluate

# Execute release phase for multiple completed workflows
/fractary-faber:workflow-run 258,259,260 --phase release

# Resume an interrupted batch
/fractary-faber:workflow-run --resume-batch
```

</INPUTS>

<BATCH_MODE>

## Batch Mode: Sequential Multi-Workflow Execution

Batch mode activates when the first argument contains commas (e.g., "258,259,260") or when `--resume-batch` is provided without a positional argument.

### Batch Detection

```javascript
const rawArg = args[0] || null;
const resumeBatch = flags.includes('--resume-batch');

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
// Capture session working directory (worktree root — may be at any path)
const projectRootResult = await Bash({ command: "pwd", description: "Get session working directory" });
const projectRoot = projectRootResult.trim();

const batchStatePath = `${projectRoot}/.fractary/faber/runs/.batch-state.json`;
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
    console.error("For a single work ID, use: /fractary-faber:workflow-run <work-id>");
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

**Step B.2: Initialize Batch TodoWrite**

```javascript
// Create batch-level TodoWrite with one item per work-id
const batchTodos = batchState.items.map((item, index) => ({
  content: `[Batch ${index + 1}/${batchState.items.length}] Workflow #${item.work_id}`,
  status: item.status === "completed" ? "completed" : "pending",
  activeForm: `Executing workflow for #${item.work_id} (${index + 1}/${batchState.items.length})`
}));

await TodoWrite({ todos: batchTodos });
```

**Step B.3: Sequential Execution Loop**

```
FOR each item in batchState.items (skip items with status "completed"):

  // ── B.3a: Mark batch item as in_progress ──
  item.status = "in_progress";
  item.started_at = new Date().toISOString();
  batchState.updated_at = new Date().toISOString();
  Write batch state to disk.

  // Update batch TodoWrite to show current item in_progress
  Update TodoWrite: mark current item as in_progress.

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

    // Update batch TodoWrite
    Update TodoWrite: mark current item as completed.

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
      console.log(`To resume: /fractary-faber:workflow-run --resume-batch`);
      RETURN;  // Exit batch execution
    }

    if (response === "Skip and continue") {
      item.status = "skipped";
      Write batch state to disk.
      Update TodoWrite: mark current item as completed (with skip indicator).
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
  // 1. TodoWrite will be re-initialized by the next workflow's Step 1.7
  //    (which overwrites with step-level todos). Before that, restore
  //    batch-level TodoWrite so the user sees batch progress.
  //
  // 2. Active-run-id will be overwritten by the next workflow's Step 1.4.
  //
  // 3. CONTEXT INDEPENDENCE: Treat the next workflow as a completely fresh
  //    execution. Do NOT reference, assume, or carry over any code changes,
  //    test results, file contents, or implementation details from previous
  //    workflows. Each workflow operates on a different issue with different
  //    requirements, different branches, and different code changes.
  //
  // Restore batch-level TodoWrite for the transition period:
  Rebuild batch TodoWrite reflecting completed/pending status of all items.

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

**Capture session working directory (worktree root — may be at any path):**

```javascript
// All FABER state/plan files are written relative to this directory.
// Using pwd ensures files stay in the worktree even when --worktree places
// the worktree outside the original project root.
const projectRootResult = await Bash({ command: "pwd", description: "Get session working directory" });
const projectRoot = projectRootResult.trim();
```

### Step 1.1: Parse Arguments and Resolve Plan ID

Extract from user input:
1. `arg`: First positional argument (required) - can be work-id OR plan-id
2. `resume_run_id`: Value of `--resume` flag (optional)
3. `force_new`: Boolean flag for `--force-new` (optional, default false)
4. `phase_filter`: Value of `--phase` flag (optional, single or comma-separated phase names)
5. `step_filter`: Value of `--step` flag (optional, single or comma-separated step IDs)
6. `auto_worktree`: Boolean flag for `--worktree` (optional, default false)
7. `workflow_override`: Value of `--workflow` flag (optional) — forwarded to auto-planner
8. `autonomy_override`: Value of `--autonomy` flag (optional) — forwarded to auto-planner

**Resolve Plan ID from Argument:**

The first argument can be either a work-id (e.g., "258") or a full plan-id (e.g., "fractary-faber-258").

```javascript
const arg = args[0];
let plan_id;

if (!arg) {
  console.error("Error: Missing required argument: <work-id|plan-id>");
  console.error("Usage: /fractary-faber:workflow-run <work-id|plan-id> [options]");
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
      skill: "fractary-repo:issue-fetch",
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

      // Build planner prompt with optional passthrough flags
      let plannerPrompt = `Create execution plan: --work-id ${work_id}`;
      if (workflow_override) plannerPrompt += ` --workflow ${workflow_override}`;
      if (autonomy_override) plannerPrompt += ` --autonomy ${autonomy_override}`;

      // Spawn faber-planner to create the plan
      const plannerResult = await Task({
        subagent_type: "fractary-faber:faber-planner",
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

  } catch (error) {
    console.error(`Error fetching issue #${work_id}: ${error.message}`);
    console.error(`Note: fractary-repo:issue-fetch command may not be available yet.`);
    console.error(`Use full plan-id instead: /fractary-faber:workflow-run fractary-faber-${work_id}-...`);
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
# Determine marketplace root (where all plugin marketplaces live)
MARKETPLACE_ROOT="${CLAUDE_MARKETPLACE_ROOT:-$HOME/.claude/plugins/marketplaces}"

# Read the orchestration protocol from the marketplace
Read(file_path: "${MARKETPLACE_ROOT}/fractary-faber/plugins/faber/docs/workflow-orchestration-protocol.md")

# Output confirmation to user
✓ Loaded orchestration protocol
Protocol: ${MARKETPLACE_ROOT}/fractary-faber/plugins/faber/docs/workflow-orchestration-protocol.md
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
// Read the plan file created by /fractary-faber:plan
const planPath = `${projectRoot}/.fractary/faber/runs/${plan_id}/plan.json`;
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
// State path: {projectRoot}/.fractary/faber/runs/{plan_id}/state-{timestamp}.json
function getStatePath(runId) {
  const runMarker = '-run-';
  const runMarkerIndex = runId.lastIndexOf(runMarker);
  if (runMarkerIndex === -1) {
    throw new Error(`Invalid run_id format: ${runId}. Expected {plan_id}-run-{timestamp}`);
  }
  const planId = runId.substring(0, runMarkerIndex);
  const runSuffix = runId.substring(runMarkerIndex + runMarker.length);
  return `${projectRoot}/.fractary/faber/runs/${planId}/state-${runSuffix}.json`;
}
```

**Auto-Resume Detection (if `--resume` not explicitly provided and `--force-new` not set):**

```javascript
// Only attempt auto-resume if user didn't explicitly provide --resume or --force-new
if (!resume_run_id && !force_new) {
  console.log("\n→ Checking for incomplete runs...");

  // Find all state files for this plan_id (now in same directory as plan.json)
  const planDir = `${projectRoot}/.fractary/faber/runs/${plan_id}`;
  const findOutput = await Bash({
    command: `find "${planDir}" -name "state-*.json" -type f 2>/dev/null || true`,
    description: "Find all workflow state files for this plan"
  });

  if (findOutput.stdout.trim()) {
    const statePaths = findOutput.stdout.trim().split('\n').filter(Boolean);
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

// Ensure events directory exists for resumed run
await Bash({
  command: `mkdir -p "${projectRoot}/.fractary/faber/runs/${resumePlanId}/${resumeRunSuffix}/events" && [ -f "${projectRoot}/.fractary/faber/runs/${resumePlanId}/${resumeRunSuffix}/events/.next-id" ] || echo "1" > "${projectRoot}/.fractary/faber/runs/${resumePlanId}/${resumeRunSuffix}/events/.next-id"`,
  description: "Ensure events directory exists for resumed run"
});

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
const statePath = `${projectRoot}/.fractary/faber/runs/${plan_id}/state-${timestamp}.json`;

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

// Plan directory should already exist (created by faber-planner)
// Ensure it exists just in case, and create events directory for this run
await Bash({
  command: `mkdir -p "${projectRoot}/.fractary/faber/runs/${plan_id}/${timestamp}/events" && echo "1" > "${projectRoot}/.fractary/faber/runs/${plan_id}/${timestamp}/events/.next-id"`,
  description: "Create plan and events directories"
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
// Ensure .fractary/faber/runs directory exists
await Bash({
  command: `mkdir -p "${projectRoot}/.fractary/faber/runs"`,
  description: "Create faber runs directory"
});

// Check if another workflow is active
const activeRunIdPath = `${projectRoot}/.fractary/faber/runs/.active-run-id`;
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
    console.log("  /fractary-faber:workflow-run <plan-id>");
    throw new Error("User cancelled due to active workflow conflict");
  }

  if (answer === "Create new worktree (Recommended)") {
    console.log("\n⚠️  Worktree creation is now handled by the CLI.");
    console.log("\nWorkflows should be planned with 'faber plan', which creates worktrees automatically.");
    console.log("\nRecommended workflow:");
    console.log("  1. Plan workflow: faber plan --work-id <id>");
    console.log("  2. Navigate to worktree: cd ~/.claude-worktrees/{org}-{project}-{id}");
    console.log("  3. Run workflow: /fractary-faber:workflow-run <work-id>");
    console.log("\nAlternatively, create worktree manually:");
    console.log(`  git worktree add ~/.claude-worktrees/{org}-{project}-${work_id || 'workflow'} -b feature/${work_id || plan_id}`);
    console.log(`  cd ~/.claude-worktrees/{org}-{project}-${work_id || 'workflow'}`);
    console.log("  /fractary-faber:workflow-run <work-id>");
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
- **Manual commands**: `/fractary-faber:session-load` and `/fractary-faber:session-save` can auto-detect active workflow

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
      `**State File:** \`${projectRoot}/.fractary/faber/runs/${plan_id}/state-${timestamp}.json\``,
      `**Autonomy:** ${autonomy}`,
      ``,
      `**Phases:** ${enabledPhases}`
    ].join("\n");

    await Skill({
      skill: "fractary-work:issue-comment",
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

### Step 1.7: Initialize TodoWrite

```javascript
// Flatten all steps from all phases into a single todo list
// The plan already has flattened steps in workflow.phases[phaseName].steps
// Include step ID in content for traceability
const allSteps = [];
for (const phaseName of Object.keys(workflow.phases)) {
  const phase = workflow.phases[phaseName];
  if (phase.enabled === false) continue;

  // Plan structure already has all steps flattened into phase.steps array
  const phaseSteps = phase.steps || [];

  for (const step of phaseSteps) {
    allSteps.push({
      content: `[${phaseName}] ${step.name} (${step.id})`,
      status: "pending",
      activeForm: `Executing [${phaseName}] ${step.name}`
    });
  }
}

await TodoWrite({ todos: allSteps });

console.log("✓ Progress tracking initialized");
console.log(`Total steps: ${allSteps.length}`);
```

**Note:** The step ID is included in the `content` field (e.g., `"(core-fetch-issue)"`) because the TodoWrite tool does not support custom fields beyond `content`, `status`, and `activeForm`. This provides traceability to cross-reference todos with state file entries and plan definitions.

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
      Update TodoWrite: "[{phase.name}] {step.name} ({step.id})" → in_progress
      Update state: phases[phase.name].steps[step.id].status = "in_progress", updated_at = now
      Emit step_start event

      # ── 2.4: Execute step per orchestration protocol ──
      IF step.skill is set:
        Skill(skill=step.skill, args=resolved_args)
      ELSE:
        Interpret and execute step.prompt directly
        (call whatever tools/skills the prompt requires,
         substituting {work_id}, {plan_id}, {run_id}, etc.)

      # ── 2.5: On success ──
      Update state: phases[phase.name].steps[step.id].status = "completed", updated_at = now
      Emit step_complete event
      Update TodoWrite: "[{phase.name}] {step.name} ({step.id})" → completed

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
        Update TodoWrite: "[{phase.name}] {s.name} ({s.id})" → in_progress
        Update state: phases[phase.name].steps[s.id].status = "in_progress", updated_at = now
        Emit step_start event for s

      # Execute all pending steps simultaneously via Task agents
      results = run all pending simultaneously:
        FOR EACH s IN pending:
          Task(description=s.name, prompt=s.prompt with {work_id}/{plan_id}/{run_id} substituted)
      WAIT for all Tasks to complete

      # Record results for each step
      FOR EACH (s, result) IN zip(pending, results):
        Update state: phases[phase.name].steps[s.id].status = "completed", updated_at = now
        Emit step_complete event for s
        Update TodoWrite: "[{phase.name}] {s.name} ({s.id})" → completed

      LOG "✓ Parallel group [{item.id}] complete — all {pending.length} steps finished"

  END FOR (items)

END FOR (phases)

## Phase 3: Workflow Completion

### On Successful Completion:

```javascript
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
console.error(`  /fractary-faber:workflow-run ${work_id} --resume ${runId}`);
console.error(`\nState file: ${statePath}`);
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
  /fractary-faber:workflow-run 123 --resume default-123-1703001234567

State file: .fractary/faber/runs/default-123-1703001234567/state.json
```

**Missing Work ID Error:**
```
Error: Work ID is required

Usage: /fractary-faber:workflow-run <work-ids|plan-id> [options]

Examples:
  /fractary-faber:workflow-run 123
  /fractary-faber:workflow-run 123,456,789 --phase frame,architect,build,evaluate
  /fractary-faber:workflow-run 123 --resume abc123-def456-789
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
To resume: /fractary-faber:workflow-run --resume-batch
```

</OUTPUTS>

<ARCHITECTURE_NOTES>

## Old vs New Architecture

### Old: workflow-execute (Delegation Pattern)

```
User invokes: /fractary-faber:execute <plan-id>
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
User invokes: /fractary-faber:workflow-run <work-id>
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
10. **TodoWrite Integration** - How to track progress

**This protocol is your operating manual.** When executing a workflow, you MUST follow it exactly.

## State File Structure

State is persisted to `.fractary/faber/runs/{plan_id}/state-{run_suffix}.json`:

**Directory Structure:**
```
.fractary/faber/runs/{plan_id}/
├── plan.json                    # Execution plan (created by faber-planner)
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

6. **Use TodoWrite for progress** - User needs to see what's happening.

7. **Handle errors gracefully** - Retry when configured, stop when appropriate, report clearly.

8. **Respect autonomy gates** - Get approval when required.

9. **Trust the protocol** - When in doubt, re-read the relevant section.

10. **Run ID is sacred** - Never modify it, use it for resume capability.

</IMPORTANT_REMINDERS>

<SEE_ALSO>

- `/fractary-faber:workflow-plan` - Resolve and merge workflow definitions
- `plugins/faber/docs/workflow-orchestration-protocol.md` - Complete orchestration protocol
- `plugins/faber/config/workflows/` - Workflow definitions
- `.fractary/faber/runs/{run-id}/state.json` - Workflow execution state

</SEE_ALSO>
