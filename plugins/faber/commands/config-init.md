---
name: fractary-faber:config-init
description: Initialize FABER configuration - delegates to fractary-faber:config-initializer agent
allowed-tools: Task(fractary-faber:config-initializer)
model: claude-haiku-4-5
argument-hint: '[--autonomy guarded] [--force] [--json]'
---

Use **Task** tool with `fractary-faber:config-initializer` agent to initialize FABER configuration with provided arguments.

```
Task(
  subagent_type="fractary-faber:config-initializer",
  description="Initialize FABER configuration",
  prompt="Initialize FABER configuration: $ARGUMENTS"
)
```
