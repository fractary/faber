# SPEC-00053: Batch Workflow Task List — Root Cause Analysis and Fix

## Metadata

| Field | Value |
|-------|-------|
| **Status** | Draft |
| **Priority** | High |
| **Created** | 2026-02-26 |
| **Author** | Claude Code |
| **Affects** | fractary-faber plugin (`faber-planner` agent, `workflow-batch-plan` skill, `workflow-batch-run` skill) |
| **Related** | SPEC-00052 (FABER state integrity) |
| **Scope** | fractary-faber plugin source only — no changes to this project (etl.corthion.ai) |

---

## Summary

When running `/fractary-faber:workflow-batch-run`, the user expects to see the full,
phase-prefixed task list from `plan.json` (all 36 steps across 5 phases), mirroring
what they see during a normal `/fractary-faber:workflow-run`. Instead, a bad 10-item
partial task list appeared. This document identifies the root causes and the changes
required in the `fractary-faber` plugin to fix this for all future batch runs.

---

## What Actually Happened (This Session)

1. `workflow-batch-plan` spawned 3 `faber-planner` sub-agents (via Task tool)
2. The planners each called `TaskCreate` for their **own internal tracking** steps
3. Those tasks leaked into the **parent session's task list** (Tasks are session-scoped,
   not isolated to the sub-agent context)
4. Result: 10 tasks appeared covering only Frame + Architect phase steps,
   not phase-prefixed, incomplete, and stale after planning completed
5. `workflow-batch-run` then attempted to spawn a `general-purpose` sub-agent
   to call `workflow-run` — this was rejected by the user
6. If it had run: the sub-agent would have created the correct full task list —
   but **only in the sub-agent's isolated context**, invisible to the parent session

---

## Root Cause 1: faber-planner Uses TaskCreate for Internal Tracking

**Where:** `fractary-faber:faber-planner` agent definition (in the fractary-faber plugin)

**What happens:** The planner creates TaskCreate entries to track its own planning steps
(e.g., "Reload context for workflow #229", "Research codebase for issue #229"). These
are internal scaffolding tasks for the planner agent itself.

**Why it's a problem:** Claude's `TaskCreate/TaskList/TaskUpdate` tools are **session-scoped**,
not sub-agent-scoped. Tasks created inside a `Task(...)` spawn appear in the parent
session's task list. After the planner completes, those tasks remain as stale artifacts
in the parent context — incomplete, non-phase-prefixed, and misleading.

**Fix:** `faber-planner` must NOT use TaskCreate for internal tracking. Planners should
use the `plan.json` / state file system for tracking their own progress. If the planner
must use TaskCreate (e.g., for user visibility during long planning), it must delete
all its tasks before returning.

---

## Root Cause 2: workflow-batch-run Hides Execution Task List in Sub-Agent Context

**Where:** `fractary-faber:workflow-batch-run` skill definition (in the fractary-faber plugin)

**What happens:** `workflow-batch-run` spawns a `general-purpose` sub-agent per work item,
which calls `workflow-run`. The workflow-run inside that sub-agent creates the correct
full phase-prefixed task list — but it exists only inside the sub-agent's isolated
context, never visible to the user in the parent session.

**Why it's a problem:** The user's Claude session task list (what they see in the UI)
is the parent context's task list. Sub-agent task lists are invisible. The design
goal of "context isolation via sub-agent spawning" directly conflicts with task
list visibility.

**Fix:** `workflow-batch-run` must manage the task list itself in the **parent context**,
not delegate it to a sub-agent. (See Recommended Architecture below.)

---

## Root Cause 3: Architectural Mismatch — Isolation vs. Visibility

The `workflow-batch-run` design chose sub-agent spawning for "true context isolation"
between batch items. But Claude's task list is session-scoped. There is no mechanism
for a sub-agent to write tasks to the parent session's task list.

This means: you can have context isolation OR task list visibility, but not both —
unless you change the execution model.

---

## Recommended Architecture

### Two Modes: Serial (default) and Parallel (--parallel flag)

`workflow-batch-run` should behave differently depending on whether `--parallel`
is passed (or set in batch settings):

- **Serial mode (default):** Execute in the parent context with full task list visibility
- **Parallel mode (`--parallel`):** Spawn sub-agents per item for true concurrency;
  task list visibility is limited to batch-level items only (accepted trade-off)

---

### Serial Mode (Default)

`workflow-batch-run` should NOT spawn sub-agents per work item. Instead:

1. **Before starting an item**, read its `plan.json` and call `TaskCreate` for every
   step (phase-prefixed). This creates the full visible task list in the main context.
2. **Execute each step directly** by invoking the Skill tool for each step's prompt
   (not via a spawned sub-agent).
3. **Update task status** as each step completes (`TaskUpdate` → `in_progress` / `completed`).
4. After all steps for an item complete, proceed to the next item.

The "context isolation" concern between items is low in practice: each item's
execution is driven entirely by its `plan.json`, not by prior conversation context.

---

### Parallel Mode (`--parallel` flag or `"parallel": true` in batch settings)

When `--parallel` is passed, sub-agent spawning IS the right approach — multiple
work items run concurrently and cannot share the parent context. The trade-off is
accepted: only batch-level tasks are visible (one per work item), not step-level tasks.

`workflow-batch-run --parallel` behavior:
1. Create batch-level tasks for all items (as today)
2. Spawn one `general-purpose` sub-agent per item simultaneously via Task tool
3. Each sub-agent calls `workflow-run {work_id}` — creates its own internal task list
4. Parent waits for all Tasks to complete, updates batch-level task statuses
5. Final report same as serial mode

**Visibility note to surface to user when --parallel is invoked:**
```
⚠ Running in parallel mode. Step-level task list not available — only
  batch-level progress is shown. Use serial mode (default) for full visibility.
```

### Desired Task List Shape During Execution

```
[batch] Execute batch item 1/3: #229 — ipeds/cost2 v2024  [in_progress]
  [Frame] Reload Context                                    [completed]
  [Frame] Sync from Codex                                   [completed]
  [Frame] Research Issue                                    [in_progress]
  [Frame] Validate Research Complete                        [pending]
  [Frame] Commit and Push Changes                           [pending]
  [Frame] Add GitHub Issue Comment (Frame Complete)         [pending]
  [Architect] Inspect Current Status                        [pending]
  ... (all 36 steps from plan.json) ...
  [Release] Add GitHub Issue Comment (Release Complete)     [pending]
[batch] Execute batch item 2/3: #223 — ipeds/s_sis v2024  [pending]
[batch] Execute batch item 3/3: #220 — ipeds/gr_pell_ssl  [pending]
```

The batch-level items remain visible below. As execution proceeds, step tasks
update in place. When item 1 completes, item 2's steps are injected below item 2's
batch task.

---

## Changes Required in the fractary-faber Plugin

### Change 1: `faber-planner` agent

**File:** Agent definition for `fractary-faber:faber-planner`

**Change:** Remove all `TaskCreate` calls from the planner's execution instructions.
The planner's progress is already tracked in `plan.json` and the run state files.
Planners do not need a UI task list — planning is fast and atomic from the user's
perspective.

If the planner currently uses a task list for multi-step planning visibility, replace
it with a simple printed progress log (plain text output) that doesn't pollute the
session task list.

**Alternatively:** Add a cleanup step at the END of the faber-planner's instructions
that deletes all tasks it created (`TaskUpdate` status=deleted for each).

**Specifically:** Add to `<CRITICAL_RULES>`:
```
8. **NO TASK MANAGEMENT** - Do NOT use TaskCreate, TaskUpdate, TaskList, or TaskGet
   for internal progress tracking. These tools are session-scoped and pollute the
   parent session's task list when running inside a Task spawn. Track your planning
   progress via printed output only. Your progress is already tracked in plan.json
   and state files.
```

---

### Change 2: `workflow-batch-run` skill

**File:** Skill definition for `fractary-faber:workflow-batch-run`

#### Header changes:
- Update `description` to mention serial/parallel modes
- Update `argument-hint` to add `[--parallel]`
- Update `allowed-tools` to add `Skill, TaskCreate, TaskUpdate`

#### New `--parallel` argument:
Add to arguments table:
```
| `--parallel` | No | Spawn sub-agents per item for concurrency (step tasks hidden in sub-agent context) |
```

#### Replace current Step 5 with:

```
Step 5a: Branch on execution mode

  IF --parallel flag OR batch settings contain "parallel": true:
    → Go to Parallel execution path (Step 5-P below)
  ELSE:
    → Go to Serial execution path (Step 5-S below)

--- SERIAL PATH ---

Step 5-S0: For Each Item — Print Header and Mark In Progress

  Print: ═══ Workflow {i}/{total}: #{work-id} ═══
  Write state.json: item.status = "in_progress", item.started_at = {iso-timestamp}
  TaskUpdate(batchTaskId[work_id], status=in_progress)

Step 5-S1: Resolve Plan ID and Read plan.json

  1. Get plan_id from state.json item: item.plan_id
     - If null/empty: error + skip item
  2. Read: .fractary/faber/runs/{plan_id}/plan.json
     - If not found: error + skip item
  3. Extract workflow.phases from plan.json

Step 5-S2: Inject Step-Level Tasks into Parent Context

  stepTaskIds = {}  # map: "{phase}:{step_name}" -> task_id

  For each phase_name in [frame, architect, build, evaluate, release]:
    If plan.workflow.phases[phase_name] exists:
      For each step in plan.workflow.phases[phase_name].steps:
        TaskCreate:
          subject: "[{PHASE_NAME_UPPER}] {step.name}"
          description: "{step.description or step.name}"
          activeForm: "{step.name} in progress..."
        stepTaskIds["{phase_name}:{step.name}"] = returned task ID

Step 5-S3: Execute Each Step Directly

  For each phase/step (in order):
    1. TaskUpdate(taskId, status=in_progress)
    2. Invoke step:
       - If step.skill is set: Skill(skill=step.skill, args=resolved_args)
       - Else if step.prompt: execute the prompt directly
    3. On success: TaskUpdate(taskId, status=completed)
    4. On failure: apply result_handling.on_failure;
       autonomous+non-blocking: warn and continue;
       autonomous+blocking: mark item failed, break to next item;
       interactive: AskUserQuestion (Stop/Skip step/Skip item/Retry)

Step 5-S4: Mark Batch Item Complete

  Write state.json: item.status = "completed", completed_at
  TaskUpdate(batchTaskId[work_id], status=completed)
  Print: "  ✓ Completed: #{work-id}"
  Proceed to next item.

--- PARALLEL PATH ---

Step 5-P1: Warn user about visibility trade-off

  Print:
  ⚠ Running in parallel mode. Step-level task list not shown —
    only batch-level progress is visible. Use serial mode for
    full step visibility.

Step 5-P2: Spawn sub-agent per item (existing behavior)

  Task(
    subagent_type="general-purpose",
    prompt="Execute FABER workflow for #{work_id}.
            Use the Skill tool to invoke: fractary-faber:workflow-run {work_id}
            Autonomous execution. Follow the complete workflow to completion."
  )
  Spawn all items simultaneously.

Step 5-P3: Wait for all Tasks, update batch item statuses

  For each Task result:
    On success: state.json completed + TaskUpdate(batchTaskId, completed)
    On failure: state.json failed + TaskUpdate(batchTaskId, completed) + print error
```

---

### Change 3: `workflow-batch-run` skill — batch-level task list creation

The initial batch-level tasks (one per work item) were correct and should be kept.
Add explicitly to Step 4 (after filtering items):

```
Step 4b: Create batch-level tasks

  For each item in queue:
    TaskCreate:
      subject: "Execute batch item {i}/{total}: #{work_id} — {issue_title_if_known}"
      description: "Run full FABER dataset-create workflow for #{work_id}"
      activeForm: "Executing workflow for #{work_id}..."
    Store: batchTaskId[work_id] = returned task ID
```

---

### Change 4: `workflow-batch-plan` skill

**File:** Skill definition for `fractary-faber:workflow-batch-plan`

**Change:** Add a note after the Task spawn in Step 7 documenting the task isolation
requirement — that the spawned faber-planner must not use TaskCreate, enforced by
faber-planner CRITICAL_RULES rule 8, and that any task leakage should be reported
as a bug.

---

### Change 5: `workflow-run` skill — no change needed

`workflow-run` is only used for standalone single-item execution. In serial batch
mode, `workflow-batch-run` executes steps directly via Skill invocations and manages
the task list itself — `workflow-run` is bypassed entirely per item.

In parallel batch mode, each sub-agent calls `workflow-run` normally, which creates
its own task list inside the sub-agent context (acceptable trade-off).

No changes to `workflow-run` are required.

---

## Summary Table

| Component | Current Behavior | Required Change |
|---|---|---|
| `faber-planner` | Creates TaskCreate for own tracking; tasks leak to parent | Remove TaskCreate; use state files for tracking |
| `workflow-batch-plan` | Spawns planners, doesn't clean up tasks | Either planners don't create tasks, or batch-plan deletes them post-planning |
| `workflow-batch-run` (serial, default) | Spawns sub-agent per item; task list hidden | Execute in-process; inject full plan.json task list in parent context |
| `workflow-batch-run` (parallel, `--parallel`) | Same sub-agent spawn; acceptable | Keep sub-agent spawn; add visibility warning to user |
| `workflow-run` | Creates full phase-prefixed task list (correct for standalone) | No change |

---

## Scope

All changes are in the **fractary-faber plugin** skill/agent definitions:
- `fractary-faber:faber-planner` agent
- `fractary-faber:workflow-batch-plan` skill
- `fractary-faber:workflow-batch-run` skill

**No changes required in this project (`etl.corthion.ai`)** or the `fractary-faber-code`,
`fractary-faber-cloud`, or `fractary-core` plugins.

Changes must be made in the fractary-faber plugin source repository and installed
via the standard plugin installation process.
