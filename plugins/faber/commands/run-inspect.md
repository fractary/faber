---
name: fractary-faber:run-inspect
description: Display FABER workflow run status - delegates to fractary-faber:run-inspect agent
allowed-tools: Task(fractary-faber:run-inspect)
model: claude-haiku-4-5
argument-hint: '[work-id|run-id] [--logs <n>] [--state-only] [--timing] [--verbose] [--json]'
---

Use **Task** tool with `fractary-faber:run-inspect` agent to display workflow run status with provided arguments.

```
Task(
  subagent_type="fractary-faber:run-inspect",
  description="Display FABER workflow run status",
  prompt="Show workflow run status: $ARGUMENTS"
)
```
