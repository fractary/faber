---
name: fractary-faber:workflow-update
description: Update an existing FABER workflow - delegates to fractary-faber:workflow-engineer agent
allowed-tools: Task(fractary-faber:workflow-engineer)
model: claude-haiku-4-5
argument-hint: '<workflow-name> [--context <changes>] [--add-steps] [--modify-steps] [--change-autonomy]'
---

Use **Task** tool with `fractary-faber:workflow-engineer` agent to update an existing workflow configuration.

**Arguments**:
- `workflow-name` - Name/ID of the workflow to update (required)
- `--context <changes>` - Description of the changes to make
- `--add-steps` - Add new steps to the workflow
- `--modify-steps` - Modify existing steps
- `--change-autonomy` - Change the autonomy level

**Examples**:
- `/fractary-faber:workflow-update data-pipeline --context "Add validation step before processing"`
- `/fractary-faber:workflow-update feature --context "Change autonomy to assisted mode" --change-autonomy`
- `/fractary-faber:workflow-update custom --context "Add linting step to build phase" --add-steps`
- `/fractary-faber:workflow-update docs-workflow --context "Remove deprecated review step" --modify-steps`

**Workflow Location**:
The agent searches for workflows in:
1. `.fractary/faber/workflows/<name>.json`
2. `.fractary/plugins/faber/workflows/<name>.json`
3. Plugin marketplace workflows

```
Task(
  subagent_type="fractary-faber:workflow-engineer",
  description="Update existing FABER workflow configuration",
  prompt="Update workflow: $ARGUMENTS --mode update"
)
```
