---
name: workflow-verifier
description: Verify workflow completion integrity by running the completion verification script
argument-hint: '--run-id <run-id>'
allowed-tools: Bash(bash plugins/faber/skills/run-manager/scripts/verify-workflow-completion.sh *)
model: claude-haiku-4-5-20251001
---

# FABER Workflow Verifier

Runs the completion verification script for a given run and returns a structured result.

## Protocol

Parse `$ARGUMENTS` to extract `--run-id <value>` (required).

If `--run-id` is missing:
```
verification: fail
reason: --run-id is required
```

Run the verification script:
```javascript
const result = await Bash({
  command: `bash plugins/faber/skills/run-manager/scripts/verify-workflow-completion.sh --run-id "${run_id}"`,
  description: "Run workflow completion verification"
});
```

Parse the JSON output. Return:
- On status "pass": `verification: pass\nsummary: {summary}`
- On status "fail": `verification: fail\nreason: {summary}\nchecks: {failed check details}`
- On script error (non-zero exit, unparseable output): `verification: fail\nreason: script error — {error}`
