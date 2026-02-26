# SPEC-FABER-skill-bypass-prevention

**Status**: Proposed
**Affects**: fractary/faber orchestration layer
**Discovered During**: workflow #127 (ipeds/sfa v2024 catalog-sync)

---

## Summary

During workflow #127, the `/fractary-repo:pr-review` skill was not invoked. Instead, raw `gh pr view` CLI commands were used directly. This bypassed the skill's `--wait-for-ci` safeguard, causing the PR to be merged while CI was still running. The CI review had flagged a data integrity issue that was consequently ignored.

---

## Root Cause: Context Drift in Long-Running Orchestrations

In long-running FABER orchestrations, agents accumulate context across many steps. As context grows, the agent drifts toward using low-level tools (raw `gh` CLI) instead of invoking the designated skill tool. The skill tool path requires an extra layer of indirection; the raw CLI path produces the same surface-level output and is therefore chosen under context pressure.

The specific bypass in workflow #127:
- **Expected**: `/fractary-repo:pr-review` skill with `--wait-for-ci` flag
- **Actual**: Raw `gh pr view` + `gh pr merge` executed directly
- **Consequence**: PR was merged 20 seconds after CI started — 2 minutes 48 seconds before CI completed

The claude-review CI check ultimately passed (SUCCESS), but it had flagged a substantive data integrity issue before completion: unexplained clearing of `ipeds_effy` fields in `education-colleges-enrollment/data-index.json` — a side effect from the `generate-data-index --all` operation during the frame phase (see SPEC-catalog-sync-generate-index-scope).

---

## The Skill Tool vs. Raw CLI Pattern

| Behavior | Skill Tool (`/fractary-repo:pr-review`) | Raw CLI (`gh pr view` + `gh pr merge`) |
|----------|------------------------------------------|------------------------------------------|
| Waits for CI | Yes (`--wait-for-ci` flag) | No |
| Parses CI results | Yes | No |
| Blocks on failure | Yes | No |
| Surfaces review comments | Yes, structured | Manual grep required |
| Safe for automation | Yes | No |

The skill tool wraps the raw CLI with workflow-safe behavior. Bypassing it strips those guarantees.

---

## Proposed Fix

### Fix 1: Workflow-Level Enforcement (Preferred)

In the FABER workflow definition that invokes PR review, replace the raw CLI step with an explicit skill invocation instruction that names the required flag:

```json
{
  "step": "review-pr",
  "instruction": "Use the /fractary-repo:pr-review skill with --wait-for-ci. Do NOT use raw gh CLI commands for PR operations. The skill must be invoked via the Skill tool, not approximated with gh pr view."
}
```

This makes the requirement explicit at the workflow definition level, where it survives context compression.

### Fix 2: Standards-Level Prohibition

Add a rule to the relevant release-phase standard (e.g., `collection-publish-standards.md` or the catalog-sync release step):

> **PR Review Rule**: PR review MUST use the `/fractary-repo:pr-review` skill via the Skill tool. Raw `gh pr` commands are prohibited for PR merge operations. The `--wait-for-ci` flag is mandatory.

Both fixes are additive. Fix 1 is at the point of failure (the workflow definition); Fix 2 provides a backstop in the standards layer.

---

## Impact if Not Fixed

- Future workflow runs may bypass CI wait behavior
- Data integrity issues flagged by CI review will be missed
- PRs may be merged with unreviewed failures
- The issue is non-obvious because raw CLI and skill tool produce similar surface output

---

## Scope

This spec describes a change to the **fractary/faber** project (workflow definition format and/or orchestration behavior). The fix for this specific project (core.corthodex.ai) is to update the catalog-sync or collection-create workflow JSON to enforce skill invocation in the release step.
