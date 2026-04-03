---
name: fractary-faber-workflow-runner
description: Primary orchestrator for FABER workflow execution — executes each phase step directly in the main agent context. Use when running or resuming FABER workflows for work items.
user-invocable: true
---

# FABER Workflow Runner

<CONTEXT>
You are the orchestrator for a FABER workflow. You execute each step directly in this session — you do NOT delegate to sub-agents for step execution. Maintain full context throughout. For initialization details see `workflow-runner-init.md` in this directory. For anti-pattern guidance see `anti-patterns.md`.
</CONTEXT>

<CRITICAL_RULES>
1. **NEVER STOP FOR CONTEXT** — Context compaction is automatic. If you feel context pressure, complete the current step, then output `CONTEXT_YIELD: run_id={run_id}` and stop cleanly. Do NOT stop mid-step.
2. **YOU ARE THE ORCHESTRATOR** — Execute steps directly. No sub-agent delegation for workflow steps.
3. **STATE IS SACRED** — Update state file BEFORE (in_progress) and AFTER (completed) every step. Read from disk immediately before writing (transition guard requires fresh read).
4. **EXECUTE GUARDS** — Run `validate-state-transition.sh` before every state write. Run `fractary-faber runs verify-complete` before final completion. Never skip these.
5. **SEQUENTIAL STEPS** — Execute exactly one step at a time. Complete it fully before starting the next. NEVER invoke skills or dispatch agents for two different workflow steps in the same response. Exception: declared `parallel_group` items.
6. **NEVER FABRICATE COMPLETIONS** — Do not mark steps complete without executing them. An honest pause is always better than a fabricated completion.

> If you see anomalous behavior (batch-completing steps, stopping for context, self-blocking), read `anti-patterns.md` for corrective guidance.
</CRITICAL_RULES>

<CONTEXT_CONTINUITY>
Context compaction is automatic and recoverable. Recovery procedure after compaction:
1. Read state.json to confirm current position
2. Check progress tracking to see pending steps
3. Continue from next pending step — do NOT run session-load unless the next step needs spec files

Set status="paused" ONLY for genuine blockers (missing credentials, tool failure). Never for context pressure.
</CONTEXT_CONTINUITY>

<CONTEXT_YIELD>
If context fills despite compaction (i.e., compaction has occurred but context is still full):
1. Complete the current step fully and update state.json
2. Output exactly: `CONTEXT_YIELD: run_id={run_id}` and note to resume with the fractary-faber-workflow-runner skill using `{work_id} --resume {run_id}`
3. Stop cleanly — do NOT mark subsequent steps complete

This signals the next session to resume cleanly. The progress tracking and state.json have full position information.
</CONTEXT_YIELD>

<INPUTS>

**Syntax:**
```bash
/fractary-faber-workflow-run <work-ids|plan-id> [options]
```

**Arguments:**
| Argument | Type | Required | Description |
|----------|------|----------|-------------|
| `<work-ids\|plan-id>` | string | Yes (unless `--resume-batch`) | Single work item ID (e.g., "258"), comma-separated IDs for batch (e.g., "258,259"), OR full plan ID (e.g., "fractary-faber-258") |

**Options:**
| Option | Default | Description |
|--------|---------|-------------|
| `--resume <run-id>` | none | Resume previous run (single mode only) |
| `--force-new` | false | Force fresh start, bypass auto-resume |
| `--phase <phase>` | none | Execute only specified phase(s), comma-separated |
| `--step <step-id>` | none | Execute only specified step(s), comma-separated |
| `--worktree` | false | Auto-create worktree on conflict |
| `--resume-batch` | false | Resume interrupted batch |
| `--workflow <id>` | none | Workflow override for auto-planner |
| `--autonomy <level>` | none | Autonomy level override for auto-planner |

</INPUTS>

<WORKFLOW>

## Batch vs Single Mode Detection

```
isBatchMode = (rawArg contains ',') OR (resumeBatch flag set and no rawArg)
IF isBatchMode:
  Read `workflow-runner-batch.md` (in this directory) and follow batch execution protocol
  RETURN — batch protocol handles everything from here
ELSE:
  Continue with single-workflow execution below
```

---

## Phase 1: Initialization

Read `workflow-runner-init.md` (in this directory) and execute all initialization steps.

After reading, execute Steps 1.1 through 1.7b in order. These produce the variables used throughout Phase 2:
`plan_id`, `runId`, `statePath`, `eventRunId`, `work_id`, `source_id`, `workflow`, `state`, `stepTaskIds`, `phaseFilter`, `stepFilter`, `autonomy`

---

## Phase 2: Workflow Execution

**SEQUENTIAL BY DEFAULT:** Execute exactly one step at a time. Complete it fully — including state updates — then move to the next.

### Step Execution Loop

```
phases_to_execute = workflow.phases filtered to:
  - phase.enabled !== false
  - (!phaseFilter || phaseFilter.includes(phase.name))

FOR EACH phase IN phases_to_execute (in order):

  # ── 2.1: Skip if already complete (idempotency) ──
  Read the state file at {state_path}
  IF phases[phase.name].status == "completed":
    LOG "⏭ Skipping {phase.name} — already complete"
    CONTINUE to next phase

  LOG "═══ PHASE: {phase.name} | Run: {run_id} ═══"

  FOR EACH item IN phase.steps (in order):

    # ── 2.2: Skip if already complete (resume idempotency) ──
    Read the state file at {state_path}
    IF item has steps_parallel (is a parallel_group):
      all_done = ALL steps in item.steps_parallel have status "completed" in state
      IF all_done: CONTINUE to next item
    ELSE:
      IF phases[phase.name].steps[item.id].status == "completed":
        LOG "⏭ Skipping step {item.id} — already complete"
        CONTINUE to next item

    # ══ Sequential step ══════════════════════════════════════════════

    IF item does NOT have steps_parallel:

      step = item

      # ── 2.3: Mark in_progress ──
      Mark progress for step "{phase.name}:{step.id}" as in_progress
      Update state: phases[phase.name].steps[step.id].status = "in_progress", updated_at = now
      Emit step_start event

      # ── 2.4: Execute step ──
      IF step.executor is defined (has "provider" field):
        LOG "⫸ External executor: {step.executor.provider} {step.executor.model || ''}"
        Run: echo '<step-input-json>' | node -e "
          import('@fractary/faber').then(m => m.executeStepCli());
        "
        # Parse result as ExecutorResult: status, output, error
        # Apply result_handling based on result.status

      ELSE IF step.skill is set:
        Invoke the {step.skill} skill with arguments: {resolved_args}

      ELSE:
        Interpret and execute step.prompt directly
        (substitute {work_id}, {plan_id}, {run_id} in prompt before executing)

      # ── 2.5: Transition guard (MANDATORY — prevents batch fabrication) ──
      Read the state file at {state_path}   # FRESH read from disk
      proposed_state = deepcopy(current_state) with phases[phase.name].steps[step.id].status = "completed"
      Run: validate-state-transition.sh \
              --current {state_path} \
              --proposed-json '{JSON.stringify(proposed_state)}'
      # Exit code != 0 → set status="paused", report, HALT — do NOT write state

      Update state: phases[phase.name].steps[step.id].status = "completed", updated_at = now
      Emit step_complete event
      Mark progress for step "{phase.name}:{step.id}" as completed

      # ── 2.6: On failure — follow orchestration protocol result handling ──
      # (see workflow-orchestration-protocol.md: Result Handling, Retry Logic)

    # ══ Parallel group (item HAS steps_parallel) ═════════════════════

    ELSE:
      pending = steps in item.steps_parallel WHERE state shows NOT completed

      FOR EACH s IN pending:
        Mark progress as in_progress; Update state in_progress; Emit step_start

      # Execute all pending steps simultaneously via parallel agents
      Dispatch parallel agents to execute each pending step
      WAIT for all to complete

      # Record results one at a time (transition guard applies per step)
      FOR EACH (s, result) IN zip(pending, results):
        Read the state file at {state_path}   # Fresh read before each write
        proposed = deepcopy with s marked completed
        Run: validate-state-transition.sh --current {state_path} --proposed-json '{...}'
        Update state completed; Emit step_complete; Mark progress as completed

  END FOR (items)

  # ── 2.7: Phase complete — re-read state to ground orchestrator ──
  Read the state file at {state_path}
  LOG "── Phase {phase.name} complete ──"

END FOR (phases)
```

---

## Phase 3: Workflow Completion

```
# Completion guard: verify all steps are done before marking workflow complete
Run: fractary-faber runs verify-complete {runId} --json
IF result shows pass=false:
  LOG "❌ Completion guard FAILED: items still pending"
  Update state: status = "paused", pause_reason = "Completion guard: pending items"
  Write the updated state to {statePath}
  LOG "To resume: invoke fractary-faber-workflow-runner with {work_id} --resume {runId}"
  STOP

# Completion verification gate (MANDATORY)
Invoke the fractary-faber-workflow-run-verifier skill with: --run-id {runId}
IF verification result shows fail:
  Update state: status = "paused", pause_reason = "Verification failed: {reason}"
  Write the updated state to {statePath}
  LOG "Verification failed: {reason}"
  LOG "To resume: invoke fractary-faber-workflow-runner with {work_id} --resume {runId}"
  STOP

# Mark completed
Update state: status = "completed", completed_at = now
Write the updated state to {statePath}

Calculate duration from started_at to completed_at
Emit workflow_complete event with run_id and duration
LOG "✓ Workflow completed! Run ID: {runId} Duration: {durationSeconds}s"
```

### On Failure

```
Update state: status = "failed", error = {errorMessage},
  failed_at_step = {currentStep.id}, failed_at_phase = {currentPhase.name},
  completed_at = now
Write the updated state to {statePath}
Emit workflow_failed event with run_id and error
LOG "✗ Workflow failed. To resume: invoke fractary-faber-workflow-runner with {work_id} --resume {runId}"
# Then run failure-path minimal finalization from workflow-runner-finalize.md
```

---

## Phase 4: Post-Workflow Finalization

```
Read `workflow-runner-finalize.md` (in this directory) and execute all finalization steps.
Execute Steps 4.1 through 4.5 (adherence report, hooks, commit, PR merge, close issue).
All steps are non-fatal — failures are logged, not thrown.
```

</WORKFLOW>

<PROTOCOL_REFERENCE>
Full protocol: `plugins/faber/docs/workflow-orchestration-protocol.md`

Read this at Step 1.2 (initialization). Key sections: Execution Loop, State Management, Guard Execution, Result Handling, Retry Logic, Autonomy Gates, Error Recovery.
</PROTOCOL_REFERENCE>
