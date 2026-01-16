---
name: fractary-faber:run-status
description: Display FABER workflow run status - delegates to fractary-faber:run-status agent
allowed-tools: Task(fractary-faber:run-status)
model: claude-haiku-4-5
argument-hint: '[work-id|run-id] [--logs <n>] [--state-only] [--timing] [--verbose] [--json]'
---

Use **Task** tool with `fractary-faber:run-status` agent to display workflow run status with provided arguments.

```
Task(
  subagent_type="fractary-faber:run-status",
  description="Display FABER workflow run status",
  prompt="Show workflow run status: $ARGUMENTS"
)
```
