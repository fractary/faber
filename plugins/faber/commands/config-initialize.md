---
name: fractary-faber:config-initialize
description: Initialize FABER configuration for a new project
allowed-tools: Task(fractary-faber:config-initializer)
model: claude-haiku-4-5
argument-hint: '[--autonomy guarded] [--force] [--json]'
tags: [faber, configuration, setup, initialization]
examples:
  - trigger: "/fractary-faber:config-initialize"
    action: "Initialize FABER configuration interactively"
  - trigger: "/fractary-faber:config-initialize --force"
    action: "Re-initialize FABER configuration, overwriting existing"
---

# fractary-faber:config-initialize

Use **Task** tool with `config-initializer` agent to initialize FABER configuration.

```
Task(
  subagent_type="fractary-faber:config-initializer",
  description="Initialize FABER configuration",
  prompt="Initialize FABER configuration: $ARGUMENTS"
)
```
