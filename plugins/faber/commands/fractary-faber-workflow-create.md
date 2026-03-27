---
name: fractary-faber-workflow-create
description: Create a new FABER workflow - delegates to fractary-faber-workflow-engineer agent
allowed-tools: Agent(fractary-faber-workflow-engineer)
model: claude-haiku-4-5
argument-hint: '[<workflow-name>] [--context <description>] [--extends <parent-workflow>] [--template <template-type>] [--asset-type <asset>]'
---

Use **Agent** tool with `fractary-faber-workflow-engineer` agent to create a new workflow configuration with provided arguments.

```
Agent(
  subagent_type="fractary-faber-workflow-engineer",
  description="Create new FABER workflow configuration",
  prompt="Create workflow: $ARGUMENTS --mode create"
)
```
