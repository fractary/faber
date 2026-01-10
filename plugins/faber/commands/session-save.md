---
name: fractary-faber:session-save
description: Save session metadata before session ends - delegates to fractary-faber:session-manager agent
allowed-tools: Task(fractary-faber:session-manager)
model: claude-haiku-4-5
argument-hint: '[--run-id <id>] [--reason <reason>]'
---

Use **Task** tool with `fractary-faber:session-manager` agent to save session metadata with provided arguments.

```
Task(
  subagent_type="fractary-faber:session-manager",
  description="Save session metadata before session ends",
  prompt="Session save operation: $ARGUMENTS"
)
```
