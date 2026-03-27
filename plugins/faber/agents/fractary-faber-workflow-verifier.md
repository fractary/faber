---
name: fractary-faber-workflow-verifier
description: Verify workflow completion integrity by running the completion verification script
argument-hint: '--run-id <run-id>'
allowed-tools: Skill(fractary-faber-workflow-run-verifier)
model: claude-haiku-4-5-20251001
color: orange
memory: project
---

# FABER Workflow Verifier

Runs the completion verification for a given run and returns a structured result.

## Protocol

Parse `$ARGUMENTS` to extract `--run-id <value>` (required).

If `--run-id` is missing:
```
verification: fail
reason: --run-id is required
```

Invoke the workflow-run-verifier skill:
```javascript
const result = await Skill({
  skill: "fractary-faber-workflow-run-verifier",
  args: `--run-id "${run_id}"`
});
```

Parse the JSON output. Return:
- On status "pass": `verification: pass\nsummary: {summary}`
- On status "fail": `verification: fail\nreason: {summary}\nchecks: {failed check details}`
- On skill error (non-zero exit, unparseable output): `verification: fail\nreason: skill error — {error}`
