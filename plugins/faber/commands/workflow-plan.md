---
name: fractary-faber:workflow-plan
description: Create a FABER execution plan without executing it - delegates to fractary-faber:faber-planner agent
argument-hint: '[<target>] [--work-id <id>] [--workflow <id>] [--autonomy <level>] [--phase <phases>]'
allowed-tools: Task(fractary-faber:faber-planner)
model: claude-haiku-4-5
---

Use **Task** tool with `fractary-faber:faber-planner` agent to create an execution plan with provided arguments.

```
Task(
  subagent_type="fractary-faber:faber-planner",
  description="Create FABER execution plan",
  prompt="Create execution plan: $ARGUMENTS"
)
```
