# Spec: Fix workflow-plan-validator false positive on new plans

**Target project**: fractary-faber
**Target file**: `plugins/faber/agents/fractary-faber-workflow-plan-validator.md`
**Check affected**: Check 5 (branch.name validation)

---

## Problem

The `workflow-plan-validator` agent fails every brand-new plan with:

```
validation: fail
reason: no items have a branch.name — plan items are incomplete
```

This is a false positive. For new plans, `branch.name` is legitimately `null` — the branch is
created during the first `frame-commit-and-push` execution step, not during planning. The plan
data model explicitly represents this state with `branch.status: "new"`.

### Observed failing plan data

Plan `corthosai-core-corthodex-ai-306` (a freshly generated plan, never executed):

```json
{
  "work_id": "306",
  "branch": {
    "name": null,
    "status": "new",
    "resume_from": null
  }
}
```

Check 5 filters for `item.branch && item.branch.name`. Because `branch.name` is `null`, this
item is excluded. With one item in the plan, `itemsWithBranch.length === 0` → fail.

---

## Root Cause

Check 5 does not distinguish between:

1. **New plan** — `branch.status: "new"`, `branch.name: null` — valid and expected
2. **In-progress plan with missing branch** — `branch.status` is something other than `"new"`,
   `branch.name: null` — genuinely incomplete, should fail

The current logic treats both cases identically and fails both.

---

## Required Change

**File**: `plugins/faber/agents/fractary-faber-workflow-plan-validator.md`

**Check 5 heading** (currently `items array has at least one entry with non-null branch.name`):

Update to: `items array is non-empty; non-new items must have branch.name`

**Replace the branch.name block** (the code block after the empty-items guard):

Current:
```javascript
const itemsWithBranch = plan.items.filter(item => item.branch && item.branch.name);
if (itemsWithBranch.length === 0) {
  OUTPUT:
    validation: fail
    plan_id: {plan_id}
    reason: no items have a branch.name — plan items are incomplete
  RETURN
}
```

Replacement:
```javascript
// Items with status "new" have no branch yet — the branch is created during execution.
// Only enforce branch.name for items that are NOT new (i.e., a run has started but branch is missing).
const itemsRequiringBranch = plan.items.filter(
  item => item.branch && item.branch.status !== 'new'
);
if (itemsRequiringBranch.length > 0) {
  const itemsWithBranch = itemsRequiringBranch.filter(item => item.branch.name);
  if (itemsWithBranch.length === 0) {
    OUTPUT:
      validation: fail
      plan_id: {plan_id}
      reason: non-new items have no branch.name — plan items are incomplete
    RETURN
  }
}
// If all items are status "new", branch.name being null is expected — continue to pass
```

**Also update the Check 5 heading comment** from:

```
**Check 5: items array has at least one entry with non-null branch.name**
```

to:

```
**Check 5: items array is non-empty; non-new items must have branch.name**
```

---

## Verification

After the change is applied:

**Case 1 — New plan (should pass)**
Plan where all items have `branch.status: "new"` and `branch.name: null`
→ Expected: `validation: pass`

**Case 2 — In-progress plan with missing branch (should still fail)**
Plan where at least one item has `branch.status` other than `"new"` (e.g., `"active"` or `"complete"`)
and `branch.name: null`
→ Expected: `validation: fail` with reason `non-new items have no branch.name — plan items are incomplete`

**Case 3 — In-progress plan with valid branch (should pass)**
Plan where items have `branch.status: "active"` and `branch.name: "feat/some-branch"`
→ Expected: `validation: pass`

---

## Notes

- No other checks are affected
- The `branch.status` field is already part of the plan schema (values: `"new"`, `"active"`, `"complete"`)
- This change is backwards-compatible: existing passing plans (which have `branch.name` set) are
  unaffected because `itemsRequiringBranch` will still find them and `itemsWithBranch` will be non-empty
