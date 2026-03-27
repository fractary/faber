---
name: fractary-faber-session-load
description: Reload critical artifacts for active workflow - delegates to fractary-faber-session-loader agent
allowed-tools: Agent(fractary-faber-session-loader)
model: claude-haiku-4-5
argument-hint: '[--work-id <id>] [--run-id <id>] [--trigger <trigger>] [--artifacts <list>] [--context <hint>] [--force] [--dry-run]'
---

Use **Agent** tool with `fractary-faber-session-loader` agent to reload critical workflow artifacts with provided arguments.

```
Agent(
  subagent_type="fractary-faber-session-loader",
  description="Reload critical artifacts for active workflow",
  prompt="Session load operation: $ARGUMENTS"
)
```
