---
name: fractary-faber:init
description: Initialize FABER project configuration - delegates to fractary-faber:faber-initializer agent
allowed-tools: Task(fractary-faber:faber-initializer)
model: claude-haiku-4-5
argument-hint: '[--force] [--json]'
---

Use **Task** tool with `fractary-faber:faber-initializer` agent to initialize FABER configuration with provided arguments.

```
Task(
  subagent_type="fractary-faber:faber-initializer",
  description="Initialize FABER project configuration",
  prompt="Initialize FABER configuration: $ARGUMENTS"
)
```
