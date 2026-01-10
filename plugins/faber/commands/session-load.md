---
name: fractary-faber:session-load
description: Reload critical artifacts for active workflow - delegates to fractary-faber:session-manager agent
allowed-tools: Task(fractary-faber:session-manager)
model: claude-haiku-4-5
argument-hint: '[--run-id <id>] [--trigger <trigger>] [--artifacts <list>] [--force] [--dry-run]'
---

Use **Task** tool with `fractary-faber:session-manager` agent to reload critical workflow artifacts with provided arguments.

```
Task(
  subagent_type="fractary-faber:session-manager",
  description="Reload critical artifacts for active workflow",
  prompt="Session load operation: $ARGUMENTS"
)
```
