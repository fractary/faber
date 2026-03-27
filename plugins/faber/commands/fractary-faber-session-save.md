---
name: fractary-faber-session-save
description: Save session metadata before session ends - delegates to fractary-faber-session-saver agent
allowed-tools: Task(fractary-faber-session-saver)
model: claude-haiku-4-5
argument-hint: '[--run-id <id>] [--reason <reason>]'
---

Use **Task** tool with `fractary-faber-session-saver` agent to save session metadata with provided arguments.

```
Task(
  subagent_type="fractary-faber-session-saver",
  description="Save session metadata before session ends",
  prompt="Session save operation: $ARGUMENTS"
)
```
