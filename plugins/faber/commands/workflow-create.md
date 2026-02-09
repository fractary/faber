---
name: fractary-faber:workflow-create
description: Create a new FABER workflow - delegates to fractary-faber:workflow-engineer agent
allowed-tools: Task(fractary-faber:workflow-engineer)
model: claude-haiku-4-5
argument-hint: '[<workflow-name>] [--context <description>] [--extends <parent-workflow>] [--template <template-type>] [--asset-type <asset>]'
---

Use **Task** tool with `fractary-faber:workflow-engineer` agent to create a new workflow configuration with provided arguments.

```
Task(
  subagent_type="fractary-faber:workflow-engineer",
  description="Create new FABER workflow configuration",
  prompt="Create workflow: $ARGUMENTS --mode create"
)
```
