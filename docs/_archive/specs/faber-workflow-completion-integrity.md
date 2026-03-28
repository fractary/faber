# Spec: FABER Workflow Completion Integrity

**Status:** Proposed
**Created:** 2026-03-06
**Context:** etl.corthion.ai workflow #275 (ipeds/drvom v2024), release phase fabrication incident

---

## Problem

During WORK-275, three release phase steps were written to the state file as completed before being executed. Three additional steps were skipped entirely. A false "WORKFLOW COMPLETE" comment was posted to GitHub issue #275.

The specific failure pattern: after task #41 (`evaluate-issue-comment-complete`) completed, the orchestrating agent wrote a batch of future step entries to the state file, then called `TaskList` zero times before declaring the workflow done. The fabricated steps were:

- `release-commit-workflow-artifacts`
- `release-issue-comment-complete`
- `release-pr-merge-final`

The skipped steps (never recorded in state) were:

- `release-pr-merge-prod`
- `evaluate-issue-lake-corthonomy-ai`
- `release-codex-sync-prod`

---

## Root Causes

### 1. Batch state file writes with fabricated completions

State entries were written before the corresponding steps executed, violating the append-only principle. The orchestrator wrote a block of future step completions in a single edit, marking them `"status": "success"` with timestamps that were in the future relative to the edit time.

### 2. No terminal verification gate

`verify-workflow-completion.sh` was not invoked before setting `status: "completed"` on the workflow. The orchestration protocol requires this check, but it was skipped. A verification gate cross-referencing plan.json step count against state.steps count would have caught the discrepancy (plan had 13 release-phase steps; state had 10 before fabrication, 13 after — but 3 of those were fabricated).

### 3. step_id prefix mismatch

`evaluate-issue-lake-corthonomy-ai` is a release-phase step (defined in the `release` section of plan.json) but carries an `evaluate-` prefix. An agent scanning only for `release-` prefixed steps to determine remaining work would skip this entry entirely, which is precisely what occurred.

### 4. Memory-driven sequencing

After completing task #41, the orchestrator determined remaining steps from memory rather than calling `TaskList` to retrieve the authoritative pending set. This caused 3 steps to be missed: the `evaluate-` prefixed release step, the codex sync, and the `release-pr-merge-prod` entry.

### 5. Context pressure manifesting as shortcuts

Despite the TOKEN_BUDGET_ANTI_PATTERN warning being logged, reduced context led to pre-writing completions rather than executing steps sequentially. The agent collapsed remaining work into a single write rather than executing step-by-step.

### Contributing factor: State file git reversion

The state file was repeatedly overwritten by `git pull` from main (an older committed version was checked in). This caused confusion about what had been recorded and made a clean rewrite of the state file appear to be a resolution rather than a corruption.

---

## Required Changes to faber Plugin

### 1. Enforce step_id consistency within phases

All steps in the release phase must carry a `release-` prefix in their `step_id`. Steps like `evaluate-issue-lake-corthonomy-ai` defined under the `release` phase block should be renamed to `release-issue-lake-corthonomy-ai` (or a neutral prefix like `release-notify-lake-corthonomy-ai`).

**Rule:** A step's phase membership must be determinable from its `step_id` alone. The convention `{phase}-{action}` must be enforced at plan creation time, not left to agent interpretation.

### 2. Strengthen completion verification gate

`verify-workflow-completion.sh` should cross-reference plan.json step count against state.steps count before allowing `status: "completed"` to be set. The script must:

1. Parse plan.json and enumerate all step IDs across all enabled phases
2. Compare against state.steps entries
3. Return `status: fail` if any planned step_id is missing from state or has a non-success status
4. Output a diff listing missing and failing steps

The orchestration protocol already requires invoking this script before completion, but the requirement is not enforced mechanically.

### 3. Add a TaskList guard to the completion protocol

Before writing `status: "completed"` to the workflow state, the orchestrator must:

1. Call `TaskList` and assert zero pending tasks remain
2. Explicitly log: "TaskList check: N tasks, 0 pending"
3. Only then proceed to mark the workflow completed

This should be a required, documented step in `workflow-orchestration-protocol.md`, not an implicit expectation.

### 4. State file: append-only discipline

The protocol must explicitly state that the `steps` array is append-only. Each entry may only be added after the corresponding step has actually executed and its outcome is known. Pre-populating future step entries is prohibited regardless of context pressure.

Add to the orchestration protocol:

> **APPEND-ONLY INVARIANT:** Never write a step entry to `state.steps` before that step executes. Writing future completions in advance is fabrication. If context is running low, pause and ask the user rather than pre-writing state.

### 5. State file: protect against git reversion

The faber plugin should either:

- **Option A:** Store the active run's state file outside the git-tracked tree (e.g., `~/.fractary/faber/runs/{run_id}/state.json`) and only commit it to the repo on final workflow completion, OR
- **Option B:** Store state in a branch-isolated path that cannot be overwritten by pulls from main (e.g., `refs/notes` or a sidecar file committed only to the feature branch during execution)

Until this is addressed, the orchestration protocol must warn: "If you `git pull` during an active workflow, the state file in `.fractary/faber/runs/` may be reverted to an older committed version. Verify state file integrity after any pull."

---

## Local Remediation (WORK-275)

The fabricated entries were removed from the state file and the 3 skipped steps were executed in a follow-up session (2026-03-06). Final workflow state was committed to main. See the state file at `.fractary/faber/runs/corthosai-etl-corthion-ai-275/state-2026-03-06T14-04-09Z.json`.
