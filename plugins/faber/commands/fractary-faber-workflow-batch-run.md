---
name: fractary-faber-workflow-batch-run
description: Execute a planned FABER batch sequentially (serial mode, default) or in parallel (--parallel). Serial mode runs steps in the parent context with full task list visibility; parallel mode spawns sub-agents per item for concurrency with batch-level-only visibility.
argument-hint: '--batch <batch-id> [--autonomy <level>] [--resume] [--phase <phases>] [--force-new] [--parallel]'
allowed-tools: Read(.fractary/faber/**), Write, Agent(fractary-faber-workflow-planner), Agent(fractary-faber-workflow-plan-validator), Agent(fractary-faber-workflow-plan-reporter), Skill, TaskCreate, TaskUpdate, AskUserQuestion
model: claude-sonnet-4-6
---

# FABER Workflow Batch Run

## Overview

Executes all planned items from an existing batch. Runs in **serial mode by default** — steps execute in the parent context with full task list visibility. Use `--parallel` to spawn sub-agents per item for concurrency (batch-level visibility only).

**Key behaviors:**
- `--autonomy autonomous`: Auto-skip failed items, no user prompts (designed for overnight unattended runs)
- `--resume`: Skip already-completed items (safe to re-run after interruption)
- Serial mode (default): Full step-level task list visible in UI, steps run in parent context
- `--parallel`: Each Task spawn = completely fresh context, zero carry-over; only batch-level tasks visible

<CRITICAL_RULES>
1. **SERIAL MODE = YOU ARE THE ORCHESTRATOR** — In serial mode (default), you execute steps directly from plan.json. There is no delegation. You read the plan, you invoke the skills/fractary-faber-prompts, you update state. This is the entire design.
2. **SEQUENTIAL EXECUTION IS MANDATORY** — Without `--parallel`, complete item N fully (all phases, all steps) before starting item N+1. Never launch multiple items simultaneously.
3. **NEVER INVOKE workflow-run** — Not as `Skill(fractary-faber-workflow-run)`, not as `Agent(subagent_type="fractary-faber-workflow-run")`, not as `Bash(fractary-faber workflow-run ...)`, not as `Agent(...)`. Serial mode replaces workflow-run entirely. You execute steps directly per Step 5-S3.
4. **BASH IS NOT AVAILABLE** — Check the `allowed-tools` header above. Bash is intentionally excluded from this skill. Any attempt to use Bash will fail. Execute steps via Skill() or direct prompt execution only.
</CRITICAL_RULES>

## Syntax

```
/fractary-faber-workflow-batch-run --batch <batch-id> [--autonomy <level>] [--resume] [--phase <phases>] [--force-new] [--parallel]
```

## Arguments

| Option | Required | Description |
|--------|----------|-------------|
| `--batch <batch-id>` | Yes | Batch ID from `workflow-batch-plan` (e.g., `overnight-sprint-01`) |
| `--autonomy <level>` | No | Autonomy level override (e.g., `autonomous`, `guarded`, `assisted`). When `autonomous`: skip user prompts on failure, auto-continue to next item. Merges with persisted autonomy from state.json. |
| `--resume` | No | Resume from last completed item (skip completed/skipped items) |
| `--phase <phases>` | No | Execute only specified phase(s) — comma-separated (e.g., `build` or `build,evaluate`) |
| `--force-new` | No | Force fresh start for each item, bypassing auto-resume |
| `--parallel` | No | Spawn sub-agents per item for concurrency. Step-level task list not shown (accepted trade-off). |

## Protocol

### Step 1: Parse Arguments

From `$ARGUMENTS`:
1. Extract `--batch <value>` — required
2. Extract `--autonomy <value>` if present, or null
3. Extract `--resume` flag
4. Extract `--phase <value>` — optional (e.g., `build` or `build,evaluate`)
5. Extract `--force-new` flag
6. Extract `--parallel` flag

If `--batch` is missing, error:
```
Error: --batch <batch-id> is required.
Usage: /fractary-faber-workflow-batch-run --batch <batch-id> [--autonomy <level>] [--resume] [--phase <phases>] [--force-new] [--parallel]
```

### Step 2: Load Batch State

Read `.fractary/faber/batches/{batch-id}/state.json`.

Extract `state.autonomy` — this is the persisted autonomy level set by `workflow-batch-plan --autonomy <level>`. It may be `"autonomous"`, another level, or `null`. If `--autonomy` was also passed at runtime, the runtime value takes precedence over the persisted value. The resolved autonomy is forwarded to auto-planning and validation Tasks in Step 5-S1, ensuring autonomy intent survives across the batch-plan → batch-run boundary without requiring the user to re-specify `--autonomy`.

Extract `state.force_new` — this is the persisted force-new intent set by `workflow-batch-plan --force-new`. When `true`, the orchestrator knows that prior work findings are expected and informational only. This flag also merges with the `--force-new` runtime flag (either being `true` means force-new is active).

If not found:
```
Error: Batch '{batch-id}' not found.
Expected: .fractary/faber/batches/{batch-id}/state.json

To create a batch, use:
  /fractary-faber-workflow-batch-plan <work-ids> --name {batch-id}
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

### Step 4b: Create Batch-Level Tasks

Create one task per item in the execution queue. Store returned task IDs for later updates.

```
batchTaskIds = {}  # map: work_id -> task_id

For each item (i, work_id) in queue:
  TaskCreate(
    subject: "Batch item {i}/{total}: #{work_id}",
    description: "Run full FABER workflow for #{work_id}",
    activeForm: "Executing workflow for #{work_id}..."
  )
  batchTaskIds[work_id] = returned task ID
```

### Step 5: Execute Each Item

#### Step 5a: Branch on Execution Mode

```
IF --parallel flag was provided:
  → Go to Parallel Execution (Step 5-P)
ELSE:
  → Go to Serial Execution (Step 5-S)
```

---

#### SERIAL PATH (default)

<SERIAL_MODE_RULES>
**Serial mode execution rules — these override any competing impulse:**
- You execute steps DIRECTLY from plan.json via Step 5-S3. There is no other mechanism.
- You ARE the orchestrator. workflow-run does not exist in serial mode.
- Even under context pressure, even after errors, even when the task list is long — the approach does not change. Execute each step inline per Step 5-S3.
- plan.json is your instruction set. workflow-run is not.
</SERIAL_MODE_RULES>

<DELEGATION_ANTI_PATTERN>
## ANTI-PATTERN: Delegating to workflow-run (BUG, NOT A FEATURE)

If you find yourself about to invoke workflow-run in ANY form — STOP. This is a bug in your behavior.

- `Skill(fractary-faber-workflow-run ...)` — WRONG. Serial mode replaces workflow-run.
- `Agent(subagent_type="fractary-faber-workflow-run")` — WRONG. workflow-run is a Skill, not an Agent. This call will fail.
- `Agent(subagent_type="fractary-faber-workflow-run")` — WRONG. Same reason.
- `Bash(fractary-faber workflow-run ...)` — WRONG. Bash is not available in this skill.

**Correct action:** Go to Step 5-S3 and execute steps directly from plan.json using Skill() or prompt execution.
</DELEGATION_ANTI_PATTERN>

<BASH_FALLBACK_ANTI_PATTERN>
## ANTI-PATTERN: Bash CLI Fallback (BUG, NOT A FEATURE)

If you find yourself about to use Bash to run CLI commands, spawn background processes, or poll with TaskOutput — STOP. This is a bug in your behavior.

- `Bash(fractary-faber workflow-run ...)` — WRONG. Bash is not in allowed-tools.
- `Bash(... &)` or `run_in_background: true` — WRONG. Background processes cannot be read by TaskOutput.
- `TaskOutput(task_id)` to poll a Bash process — WRONG. This pattern does not work.

**Correct action:** Go to Step 5-S3 and execute steps directly from plan.json using Skill() or prompt execution.
</BASH_FALLBACK_ANTI_PATTERN>

<PARALLEL_EXECUTION_ANTI_PATTERN>
## ANTI-PATTERN: Parallel Item Execution Without --parallel (BUG, NOT A FEATURE)

If you find yourself about to launch multiple items simultaneously (spawning Tasks for items 2, 3, 4 while item 1 is still running) — STOP. This is a bug in your behavior.

Serial mode means: complete item N fully, then start item N+1. No exceptions.

The `--parallel` flag was NOT provided. You MUST execute items one at a time, sequentially.

**Correct action:** Complete the current item through all phases/steps (Step 5-S3), then return to Step 5-S0 for the next item.
</PARALLEL_EXECUTION_ANTI_PATTERN>

<LARGE_CONTEXT_GUIDANCE>
After loading batch state, creating batch-level tasks, and creating step-level tasks, your context will be large. This is NORMAL. This is expected. Do NOT change your execution strategy because of context size. Do NOT switch to delegation, Bash fallback, or parallel execution because "context is getting large." The approach is always the same: execute steps directly from plan.json per Step 5-S3, one item at a time.
</LARGE_CONTEXT_GUIDANCE>

<ORCHESTRATOR_SELF_BLOCKING_ANTI_PATTERN>
## ANTI-PATTERN: Orchestrator Self-Blocking Based on Step Results (BUG, NOT A FEATURE)

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

1. A step fails AND result_handling.on_failure is blocking (per Step 5-S3 failure handling)
2. The user explicitly tells you to stop (interactive mode only, via AskUserQuestion)
3. A tool/skill is unavailable or errors out (actual failure, not informational output)

"The work was already done" is NEVER a valid reason to stop. The user may want to
re-validate, re-deploy, fill artifact gaps, or simply verify current state. That is
their decision, not yours.

**When `force_new` is set in batch state:** Prior work findings are explicitly expected —
the user knows this work was done before and wants the full workflow to run anyway.
Research findings about duplicates or prior completions are INFORMATIONAL ONLY.

**Correct action:** Continue to the next step in plan.json. If a step's work is
already done, let the step itself be a no-op. The engineer can decide nothing needs
to change. The validator can confirm everything passes. The evaluator can verify
the existing deployment. Every step gets a chance to run.
</ORCHESTRATOR_SELF_BLOCKING_ANTI_PATTERN>

##### Step 5-S0: Pre-Execution Checkpoint and Item Header

**Before each item, mentally verify:**
- I will execute steps DIRECTLY via Skill() or prompt execution (Step 5-S3)
- I will NOT invoke workflow-run in any form (not Skill, not Agent, not Task, not Bash)
- I will NOT use Bash (it is not in allowed-tools)
- I will complete this item fully before starting the next

```
Print: ═══ Workflow {i}/{total}: #{work-id} ═══
Write state.json: item.status = "in_progress", item.started_at = {iso-timestamp}
TaskUpdate(batchTaskIds[work_id], status=in_progress)
```

##### Step 5-S1: Read plan.json for This Item

```
1. Get plan_id from state.json item: item.plan_id
   - If null/empty:
     console.log(`→ No plan for #${item.work_id}. Auto-planning...`);
     // Build planner prompt — forward persisted autonomy if set
     let plannerPrompt = `Create execution plan: ${item.work_id} --auto-run`;
     if (state.autonomy) {
       plannerPrompt += ` --autonomy ${state.autonomy}`;
     }
     const plannerResult = await Agent({
       subagent_type: "fractary-faber-workflow-planner",
       description: `Plan workflow for #${item.work_id}`,
       prompt: plannerPrompt
     });
     const planIdMatch = plannerResult.match(/plan_id:\s*(\S+)/);
     if (!planIdMatch) {
       console.error(`Error: Auto-planning failed for #${item.work_id}.`);
       TaskUpdate(batchTaskIds[item.work_id], status=completed);
       skip to next item;
     }
     plan_id = planIdMatch[1];
     Update state.json: item.plan_id = plan_id, item.status = "planned"
     console.log(`✓ Auto-planned: ${plan_id}`);
     Continue with execution using plan_id
2. Validate plan before executing:
   ```javascript
   // Build validator prompt — forward persisted autonomy if set
   let validatorPrompt = `Validate plan: --plan-id ${plan_id}`;
   if (state.autonomy) {
     validatorPrompt += ` --expected-autonomy ${state.autonomy}`;
   }
   const validationResult = await Agent({
     subagent_type: "fractary-faber-workflow-plan-validator",
     description: `Validate plan ${plan_id}`,
     prompt: validatorPrompt
   });

   const validationMatch = validationResult.match(/validation:\s*(pass|fail)/);
   if (!validationMatch || validationMatch[1] === 'fail') {
     const reasonMatch = validationResult.match(/reason:\s*(.+)/);
     const reason = reasonMatch ? reasonMatch[1].trim() : 'unknown reason';
     console.error(`✗ Plan validation failed for #${item.work_id}: ${reason}`);
     Write state.json: item.status = "failed", item.error = reason
     TaskUpdate(batchTaskIds[item.work_id], status=completed);
     continue; // skip to next item
   }
   console.log(`✓ Plan validated: ${plan_id}`);
   ```
3. Show plan summary before executing this item:
   ```javascript
   await Agent({
     subagent_type: "fractary-faber-workflow-plan-reporter",
     description: `Report plan summary for ${plan_id}`,
     prompt: `Report plan: --plan-id ${plan_id}`
   });
   ```
4. Read: .fractary/faber/runs/{plan_id}/plan.json
   - If not found: print error, TaskUpdate(batchTaskId, status=completed), skip to next item
5. Extract workflow.phases from plan.json
```

##### Step 5-S2: Inject Step-Level Tasks into Parent Context

Create a task for every step across all phases (upfront, all pending):

```
stepTaskIds = {}  # map: "{phase_name}:{step_id}" -> task_id

PHASE_ORDER = [frame, architect, build, evaluate, release]

For each phase_name in PHASE_ORDER:
  If plan.workflow.phases[phase_name] exists AND phase is enabled:
    For each step in plan.workflow.phases[phase_name].steps:
      TaskCreate(
        subject:     "[{PHASE_NAME_UPPER}] {step.name}",
        description: "{step.description ?? step.name}",
        activeForm:  "{step.name} in progress..."
      )
      stepTaskIds["{phase_name}:{step.id}"] = returned task ID
```

> All tasks are created upfront so the user sees the complete pending list before
> execution begins. Tasks update in place as execution proceeds.

##### Step 5-S3: Execute Each Phase/Step Directly

**Execute steps HERE, directly. Do NOT delegate to workflow-run or Bash CLI. You invoke Skill() or execute the prompt yourself, right now, in this context.**

For each phase_name in PHASE_ORDER (in order), for each step in that phase's steps:

```
taskId = stepTaskIds["{phase_name}:{step.id}"]

1. TaskUpdate(taskId, status=in_progress)

2. Invoke step:
   - If step.skill is set:
       Skill(skill=step.skill, args=resolved_args)
   - Else if step.prompt is set:
       Execute step.prompt directly (the LLM orchestrating this skill interprets
       and executes the prompt — calling whatever tools/skills the prompt requires,
       substituting {work_id}, {plan_id}, etc. as appropriate)

3. On success:
       TaskUpdate(taskId, status=completed)

4. On failure:
   - Autonomous + step is non-blocking (result_handling.on_failure == "warn"):
       TaskUpdate(taskId, status=completed)  # mark done to unblock list
       Print: "  ⚠ Step failed (non-blocking): {step.name} — {error}"
       Continue to next step
   - Autonomous + step is blocking:
       TaskUpdate(taskId, status=completed)
       # Immediately clean up all remaining pending step tasks for this item
       For each stepTaskId in stepTaskIds.values() not yet completed:
         TaskUpdate(stepTaskId, status=completed)
       Mark item as failed in state.json
       TaskUpdate(batchTaskIds[work_id], status=completed)
       Print: "  ✗ Step failed (blocking): #{work_id} — {step.name}: {error}"
       Continue immediately to next item (return to Step 5-S0) — do NOT stop or pause
   - Interactive:
       AskUserQuestion: "Step failed: {step.name} — {error}. Options: Skip step / Skip item / Retry"
       On Skip step: TaskUpdate(taskId, completed), continue
       On Skip item:
           For each stepTaskId in stepTaskIds.values() not yet completed:
             TaskUpdate(stepTaskId, status=completed)
           Mark item failed in state.json
           TaskUpdate(batchTaskIds[work_id], status=completed)
           Continue to next item (return to Step 5-S0)
       On Retry: re-execute step once; on second failure: offer Skip/Stop
```

> **CRITICAL — No unauthorized stops**: After any item failure, the execution
> loop MUST return immediately to Step 5-S0 for the next item. The agent MUST
> NOT generate a "BATCH PAUSED" report, pause summary, or any interim stop.
> The only valid terminal states are:
> (a) All items processed → proceed to Step 6 Final Report
> (b) User explicitly selects "Stop" via AskUserQuestion in interactive mode

> **CRITICAL — No strategy changes after failure**: Encountering an error does NOT change the execution approach. After marking an item as failed, return to Step 5-S0 for the next item and continue with the same direct-execution approach (Step 5-S3). Do NOT switch to workflow-run delegation, Bash fallback, or parallel execution after a failure.

##### Step 5-S4: Mark Batch Item Complete

```
Write state.json: item.status = "completed", item.completed_at = {iso-timestamp}
TaskUpdate(batchTaskIds[work_id], status=completed)
Print: "  ✓ Completed: #{work_id}"
→ Proceed to next item (back to Step 5-S0)
```

---

#### PARALLEL PATH (`--parallel`)

##### Step 5-P1: Warn User About Visibility Trade-off

```
Print:
  ⚠ Running in parallel mode. Step-level task list not shown —
    only batch-level progress is visible. Use serial mode (default)
    for full step-by-step visibility.
```

##### Step 5-P2: Spawn Sub-Agent Per Item (existing behavior)

```
Agent(
  subagent_type="general-purpose",
  description="Execute FABER workflow for #{work_id}",
  prompt="Execute the FABER workflow for work item #{work_id}.

Use the Skill tool to invoke: fractary-faber-workflow-run {work_id}[--phase {phase}][--force-new]

This is an autonomous execution. Follow the complete workflow to completion.
Do not stop or ask for confirmation — execute all phases through to completion.
If you encounter errors that cannot be recovered, post a failure comment to the
GitHub issue and exit."
)
```

Spawn all items simultaneously. Store Task handles.

##### Step 5-P3: Wait for All Tasks, Update Batch Item Statuses

```
For each Task result:
  On success:
    Write state.json: item.status = "completed", completed_at
    TaskUpdate(batchTaskIds[work_id], status=completed)
    Print: "  ✓ Completed: #{work_id}"
  On failure:
    Write state.json: item.status = "failed", error
    TaskUpdate(batchTaskIds[work_id], status=completed)
    Print: "  ✗ Failed: #{work_id} — {error-summary}"
```

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
  /fractary-faber-workflow-batch-run --batch {batch-id} --autonomy autonomous --resume
```

## Step-Level Recovery

Step-level recovery (auto-fix, retries within a single workflow) is handled by the serial path inline, or by the spawned `workflow-run` in parallel mode. In parallel mode, the batch orchestrator only sees the final pass/fail outcome.

## Examples

```bash
# Plan first, then run in serial mode (default — full task list visible)
/fractary-faber-workflow-batch-plan 258,259,260 --name overnight-sprint-01
/fractary-faber-workflow-batch-run --batch overnight-sprint-01 --autonomy autonomous

# Run in parallel mode (sub-agents, batch-level visibility only)
/fractary-faber-workflow-batch-run --batch overnight-sprint-01 --autonomy autonomous --parallel

# Resume after interruption
/fractary-faber-workflow-batch-run --batch overnight-sprint-01 --autonomy autonomous --resume

# Interactive run (prompts on failure)
/fractary-faber-workflow-batch-run --batch overnight-sprint-01

# Run only the build and evaluate phases for all items
/fractary-faber-workflow-batch-run --batch overnight-sprint-01 --autonomy autonomous --phase build,evaluate

# Force fresh start for all items (ignore existing workflow state)
/fractary-faber-workflow-batch-run --batch overnight-sprint-01 --autonomy autonomous --force-new

# Phase filter + force new combined
/fractary-faber-workflow-batch-run --batch overnight-sprint-01 --autonomy autonomous --phase build,evaluate --force-new

# Two worktrees, different batches — no state collision
# Worktree 1: /fractary-faber-workflow-batch-run --batch sprint-backend --autonomy autonomous
# Worktree 2: /fractary-faber-workflow-batch-run --batch sprint-frontend --autonomy autonomous
```
