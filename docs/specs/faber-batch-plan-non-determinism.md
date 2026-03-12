# Spec: FABER Batch Plan Non-Determinism

**Status:** Proposed
**Created:** 2026-03-12
**Context:** etl.corthion.ai batch plan for WORK-304, WORK-305, WORK-306 (bls/knowledge, bls/work_activities, bls/work_context)

---

## Problem

Three plans were generated in a single batch run (`workflow-batch-plan 304,305,306 --autonomous`) using the same `dataset-create` workflow. Plans #304 and #305 were structurally identical. Plan #306 was structurally different in five ways:

| Field | Plans 304 & 305 | Plan 306 |
|-------|----------------|----------|
| `autonomy` (top-level) | `"autonomous"` | `"guarded"` |
| evaluate step `evaluate-issue-comment-dataset-publish-test` | present | **missing** |
| `execution.max_concurrent` | `1` | `5` |
| `context` block | not present | **present** (invented) |
| `items[0].worktree` path | `../repo-wt-feat-{branch}` | `.claude/worktrees/work-id-306` |

The `--autonomous` flag was explicitly passed to the batch planner but had no effect on Plan #306.

---

## Root Causes

### 1. Batch planner does not forward execution flags to individual planners

The `workflow-batch-plan` skill receives `--autonomous` (and potentially other flags) but constructs each planner Task with only:

```
prompt="Create execution plan: {work-id}"
```

No flags are forwarded. Each `workflow-planner` agent independently determines autonomy by reading whatever configuration it finds. This is the direct and primary cause of Plan #306 getting `"guarded"` — the planner found the global default `autonomy: guarded` in `.fractary/config.yaml` and used it, rather than reading the workflow-level override in `dataset-create.json`.

### 2. The workflow-planner is an LLM agent generating plan.json by inference

The plan.json should be a fully deterministic transformation of the workflow definition file (`dataset-create.json`) plus the work item ID. Instead, the `workflow-planner` agent reads the workflow files and generates plan.json through language model inference. This introduces non-determinism:

- It can omit steps it considers implied or optional (`evaluate-issue-comment-dataset-publish-test` missing from #306)
- It can change value types (`"autonomous"` string in 304/305 vs `{level: "autonomous"}` object in the workflow definition)
- It can invent fields not in the workflow definition (a `context` block added to #306 that does not exist in `dataset-create.json`)
- It can pick up the wrong value when two sources conflict (see RC3)
- It can set structural fields like `max_concurrent` to arbitrary values

The same workflow type run three times produced three meaningfully different outputs. This points to a deeper reliability problem: plan generation is not reproducible.

### 3. Global config.yaml `autonomy: guarded` creates ambiguity with workflow-level settings

`.fractary/config.yaml` contains:
```yaml
faber:
  autonomy: guarded
```

`dataset-create.json` contains:
```json
"autonomy": {
  "level": "autonomous",
  "description": "...",
  "pause_before_release": true,
  "require_approval_for": ["deploy", "publish-prod"]
}
```

When the LLM planner encounters both, there is no enforced precedence rule. The planner can choose either. For #306, it chose the global default. For #304 and #305, it chose the workflow-level definition. The correct precedence is: explicit flag > workflow definition > global config default.

### 4. The plan validator does not enforce structural completeness

The `workflow-plan-validator` checks:
- Required top-level fields are present
- `workflow.phases` is non-empty
- At least one phase has steps
- `items` array is non-empty

It does **not** check:
- That all steps defined in the workflow definition are present in the plan
- That the `autonomy` value matches what the workflow definition specifies
- That there are no extra fields not present in the workflow definition
- That numeric fields like `max_concurrent` are within expected values

As a result, Plan #306 — with a missing step, wrong autonomy, wrong max_concurrent, and an invented `context` block — passed validation successfully.

---

## Required Changes to fractary-faber

### 1. Forward all execution flags from batch planner to individual planners

In `workflow-batch-plan`, extract any recognized execution flags (`--autonomous`, `--guarded`, etc.) from the batch invocation and append them to each individual planner Task prompt:

```
// Before
prompt="Create execution plan: {work-id}"

// After
prompt="Create execution plan: {work-id} {forwarded_flags}"
```

**Where:** The step in the batch plan protocol that constructs the individual planner Task calls (Phase A, Step 7 in the skill definition).

### 2. Add a canonical step manifest to workflow definitions

Each workflow definition file (e.g., `dataset-create.json`) should include or reference a canonical list of expected step IDs per phase. This manifest is the ground truth for validation.

**Option A — Inline manifest:** Add a `"canonical_steps"` object to the workflow JSON:
```json
"canonical_steps": {
  "frame": ["frame-session-load", "frame-env-switch-test", ...],
  "evaluate": ["evaluate-session-load", ..., "evaluate-issue-comment-dataset-publish-test", ...]
}
```

**Option B — Derived at validation time:** The validator resolves the inheritance chain and computes the expected step list from all contributing workflow files.

### 3. Strengthen the plan validator: enforce step completeness

Extend `workflow-plan-validator` to compare the plan's step IDs against the canonical manifest from RC2:

- For each phase, assert that all canonical step IDs are present in the plan
- Fail validation if any canonical step is missing, with a clear error listing the missing step IDs
- Optionally warn (not fail) if extra steps are present that are not in the manifest (to allow workflow-level additions)

This is the mechanical backstop that would have caught Plan #306's missing `evaluate-issue-comment-dataset-publish-test` during the validation phase, before the batch was approved for execution.

### 4. Strengthen the plan validator: enforce autonomy correctness

Extend `workflow-plan-validator` to check the `autonomy` field:

- Resolve the correct autonomy value using precedence: explicit flag > workflow definition > global config default
- Assert that the plan's top-level `autonomy` matches the resolved value
- Fail validation if there is a mismatch (e.g., plan says `"guarded"` but resolved value is `"autonomous"`)

This is the mechanical backstop that would have caught Plan #306's wrong autonomy during the validation phase.

### 5. Document and enforce autonomy precedence in the planner

The `workflow-planner` agent instructions should explicitly state:

> **AUTONOMY PRECEDENCE:** The autonomy level written to plan.json must follow this precedence (highest to lowest): (1) explicit flag passed in the prompt (`--autonomous`, `--guarded`), (2) the `autonomy.level` value in the workflow definition file, (3) the global `faber.autonomy` default in config.yaml. Never use the global default if the workflow definition specifies a value.

---

## Local Remediation (Batch 2026-03-12)

Plans #304 and #305 are correct as generated. Plan #306 will be **regenerated from scratch** (force-new) once the upstream fixes are applied to `fractary-faber`. The batch queue and state files for `batch-2026-03-12T00-00-00Z` remain in place for re-use after re-planning.

---

## References

- [FABER Workflow Completion Integrity](faber-workflow-completion-integrity.md) — prior RCA with similar theme of LLM-agent non-determinism in workflow orchestration
- `.fractary/faber/workflows/dataset-create.json` — the workflow definition that should be the ground truth
- `.fractary/config.yaml` — source of conflicting global `autonomy: guarded` default
- `.fractary/faber/batches/batch-2026-03-12T00-00-00Z/` — the affected batch
