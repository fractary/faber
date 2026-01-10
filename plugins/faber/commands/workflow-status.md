---
name: fractary-faber:workflow-status
description: Display FABER workflow status - delegates to fractary-faber:workflow-status agent
allowed-tools: Task(fractary-faber:workflow-status)
model: claude-haiku-4-5
argument-hint: '[work-id|run-id] [--logs <n>] [--state-only] [--timing] [--verbose] [--json]'
---

Use **Task** tool with `fractary-faber:workflow-status` agent to display workflow status with provided arguments.

```
Task(
  subagent_type="fractary-faber:workflow-status",
  description="Display FABER workflow status",
  prompt="Show workflow status: $ARGUMENTS"
)
```
