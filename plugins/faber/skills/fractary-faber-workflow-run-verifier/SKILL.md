---
name: fractary-faber-workflow-run-verifier
description: Verify that a FABER workflow run has fully completed all required completion signals
---

# FABER Workflow Run Verifier Skill

Runs the completion verification script for a given run and returns a structured result.

## Protocol

Parse `$ARGUMENTS` to extract `--run-id <value>` (required).

If `--run-id` is missing, return:
```json
{"status": "fail", "summary": "--run-id is required"}
```

Run the verification script:
```bash
bash "$SKILL_DIR/scripts/verify-workflow-completion.sh" --run-id "$RUN_ID"
```

Return the JSON output as-is.
