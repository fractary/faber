# FABER Workflow Runner — Anti-Patterns Reference

Read this file when you detect anomalous behavior during workflow execution.
Do NOT load this file on every run — only when a guard triggers or you notice a problem.

---

## 🚫 Token Budget Pausing (Bug, Not a Feature)

If you find yourself about to write any of the following phrases — STOP. This is a bug.

- "I need to pause due to token budget constraints"
- "pausing because context is getting low"
- "I'll stop here to preserve context"
- "offering a resume command due to context limits"
- "the context window is filling up"

**The correct action when context feels low:**
1. Complete the current step fully
2. Update state.json with the step marked completed
3. Output: `CONTEXT_YIELD: run_id={run_id}` and stop cleanly
4. Do NOT mark subsequent steps complete
5. Do NOT set status="paused" with pause_reason mentioning context/tokens/budget

The workflow MUST either continue or yield cleanly. A bad stop is worse than no stop.

---

## 🚫 Unsolicited Parallel Step Execution (Bug, Not a Feature)

If you find yourself about to invoke skills or dispatch agents for two different workflow steps in the same response message — STOP.

Steps depend on each other. Execute one step, complete it, then execute the next.
The ONLY exception: steps inside a declared `parallel_group` (steps_parallel) in the config.

---

## 🚫 Orchestrator Self-Blocking Based on Step Results (Bug, Not a Feature)

If you find yourself about to skip remaining steps, set status to "blocked", or stop a workflow because a research/inspection step found that:
- Prior work exists for this issue (e.g., "already completed under WORK-128")
- Another issue already completed this work
- The table/resource/artifact already exists
- Nothing appears to need changing
- The work was "already done"

— STOP. This is a bug.

**Your job is to execute every step in plan.json, in order.** You do NOT have authority to decide that a workflow should not proceed based on step output content. Only these conditions can stop execution:

1. A step fails AND result_handling.on_failure is blocking
2. The user explicitly tells you to stop (interactive mode only)
3. A tool/skill is unavailable or errors out (actual failure, not informational output)

"The work was already done" is NEVER a valid reason to stop. When `--force-new` was used, prior work findings are explicitly expected — they are INFORMATIONAL ONLY.

**Correct action:** Continue to the next step in plan.json. If a step's work is already done, let the step itself be a no-op.

---

## 🔧 Progress Tracking Recovery After Context Compaction

After context compaction, the in-memory `stepTaskIds`, `bootstrapTaskIds`, and `finalizeTaskIds` maps may be lost. To recover:

```
List all progress tracking entries.
Reconstruct the maps by matching entries:
  - Step entries match pattern: "[{phase}] {name} ({step_id})" → stepTaskIds["{phase}:{step_id}"]
  - Entries with a faberKey tag are most reliable for reconstruction
```

Call this after recovering from compaction if the progress tracking maps are no longer in scope.

---

## Old vs New Architecture Reference

### Old: workflow-execute (Delegation Pattern) — REMOVED

```
User → /fractary-faber-execute <plan-id>
     → workflow-execute command
     → faber-executor skill
     → faber-manager agent(s) via Task tool  (REMOVED)
     → Each agent executes one work item
```

Issues: Context split across 3 layers; no way for agent to access full orchestration logic; limited token budget per agent.

### Current: workflow-run (Orchestrator Pattern)

```
User → /fractary-faber-workflow-run <work-id>
     → workflow-runner skill (YOU are the orchestrator)
     → Execute all steps directly in this context
     → Full protocol loaded; all tools available
```

Benefits: Single session with full context; all orchestration logic in protocol document; direct tool access.
