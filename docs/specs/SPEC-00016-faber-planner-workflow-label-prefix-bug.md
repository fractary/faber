---
spec: SPEC-00016
title: FABER Planner — Hardcoded "workflow:" Label Prefix Ignores "faber-workflow:" Labels
status: active
created: 2026-03-03
work-ref: WORK-142
affects: fractary-faber plugin (faber-planner agent)
---

# SPEC-00016: FABER Planner — Hardcoded "workflow:" Label Prefix

## Background

During issue #142 (`doe/scorecard_institution` v2025-10-03), the `faber-planner` agent was
invoked via `/fractary-faber-workflow-plan --work-id 142`. Issue #142 carries the label
`faber-workflow:catalog-create`, which is the standard label format for this project.

The planner silently fell through to the generic `default` workflow instead of `catalog-create`.
As a result, the Build phase generated a placeholder config with 6 hardcoded columns rather than
fetching the actual 3,330-column schema from the ETL source.

The incorrect artifact (`config/catalogs/doe/scorecard_institution-2025-10-03-publish-config.json`)
was merged to `main` via PR #144 before the problem was identified.

---

## Root Cause

**File:** `.claude/plugins/marketplaces/fractary-faber/plugins/faber/agents/fractary-faber-faber-planner.md`
(also at cache path: `~/.claude/plugins/cache/fractary-faber/fractary-faber/3.8.44/agents/fractary-faber-faber-planner.md`)

**Lines 191–195 (Tier 3 label resolution):**

```
191:  # Check for explicit workflow: label prefix
192:  FOR EACH label IN issue.labels:
193:    IF label.name starts with "workflow:":
194:      workflow_id = label.name without "workflow:" prefix
195:      GOTO merge_workflow
```

The planner only recognizes the `workflow:` prefix. This project uses `faber-workflow:` as the
prefix on all GitHub issue labels (e.g., `faber-workflow:catalog-create`). Because no label
matches `"workflow:"`, the check at line 193 never fires. Execution falls through to Tier 4
(work-type classification) and then Tier 5 (default workflow fallback).

There is **no warning or log entry** when label-based resolution fails — the fallback to
`default` is silent.

**Impact:** Every issue in this project that relies on label-based workflow selection has
been routed to the `default` workflow. Affected issues include #142, #138, #128, #110, and
any others where `--workflow` was not specified explicitly.

---

## Proposed Fix

Change lines 191, 193, and 194 in `faber-planner.md` to recognize both `"workflow:"` and
`"faber-workflow:"` as valid prefixes:

**Before (3 lines):**

```
191:  # Check for explicit workflow: label prefix
193:    IF label.name starts with "workflow:":
194:      workflow_id = label.name without "workflow:" prefix
```

**After (3 lines):**

```
191:  # Check for explicit workflow: label prefix (supports "workflow:" and "faber-workflow:")
193:    IF label.name starts with "workflow:" OR label.name starts with "faber-workflow:":
194:      workflow_id = label.name without leading "workflow:" or "faber-workflow:" prefix
```

**Alternative fix (preferred):** Make the recognized prefix(es) configurable in the project's
`faber` config block, e.g.:

```yaml
# .fractary/config.yaml
faber:
  workflow_inference:
    label_prefixes:
      - "workflow:"
      - "faber-workflow:"
```

This would let projects adopt whatever label convention their GitHub repo uses without
requiring plugin changes.

---

## Project-Level Workarounds

Two workarounds are available until the upstream fix ships:

### Workaround 1: Explicit `--workflow` flag (recommended)

Pass `--workflow <name>` directly on every invocation. This activates Tier 1 resolution
(explicit argument), which bypasses label lookup entirely:

```bash
/fractary-faber-workflow-plan --work-id 142 --workflow catalog-create
```

### Workaround 2: `label_mapping` config (if supported by installed version)

The planner checks `config.workflow_inference.label_mapping` at lines 199–203. If the
installed version supports this, add a mapping in `.fractary/config.yaml`:

```yaml
faber:
  workflow_inference:
    label_mapping:
      "faber-workflow:catalog-create": "catalog-create"
```

This maps the project's label names to workflow IDs without modifying the planner code.
Verify whether your installed version of `faber-planner.md` includes the `label_mapping`
check before relying on this workaround.

---

## Remediation for Issue #142

1. **Delete** `config/catalogs/doe/scorecard_institution-2025-10-03-publish-config.json`
   (merged via PR #144 — placeholder with 6 columns, not the actual 3,330-column schema).

2. **Re-run** with explicit workflow flag to generate the correct artifact:
   ```bash
   /fractary-faber-workflow-plan --work-id 142 --workflow catalog-create --auto-run --autonomous
   ```

---

## Verification Checklist

When implementing the upstream fix in the fractary-faber plugin, verify:

- [ ] `faber-planner.md` lines 191–195 recognize both `"workflow:"` and `"faber-workflow:"` prefixes
- [ ] Label resolution failure emits a warning (does not silently fall through to `default`)
- [ ] Alternatively, prefix list is configurable per-project via `faber.workflow_inference.label_prefixes`
- [ ] Existing `workflow:` label behavior is unchanged (backward compatible)
- [ ] Test: label `faber-workflow:catalog-create` resolves to workflow `catalog-create`
- [ ] Test: label `workflow:catalog-create` still resolves to workflow `catalog-create`
- [ ] Test: no matching labels → warning emitted, then falls through to Tier 4/5

---

## Notes for Transfer

This document is intended to be filed with the fractary/faber project as a bug report.
Exact file paths within the fractary-faber source repo may differ from the installed paths
shown above — adapt as needed.

The lake.corthonomy.ai-side mitigation is to always pass `--workflow` explicitly until
the upstream fix ships.
