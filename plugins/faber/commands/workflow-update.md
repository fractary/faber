---
name: fractary-faber:workflow-update
description: Update an existing FABER workflow - delegates to fractary-faber:workflow-engineer agent
allowed-tools: Task(fractary-faber:workflow-engineer)
model: claude-haiku-4-5
argument-hint: '<workflow-name> [--context <changes>] [--add-steps] [--modify-steps] [--change-autonomy]'
---

Use **Task** tool with `fractary-faber:workflow-engineer` agent to update an existing workflow configuration with provided arguments.

```
Task(
  subagent_type="fractary-faber:workflow-engineer",
  description="Update existing FABER workflow configuration",
  prompt="Update workflow: $ARGUMENTS --mode update"
)
```
