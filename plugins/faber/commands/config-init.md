---
name: fractary-faber:config-init
description: Initialize FABER configuration — auto-detects values and confirms with user
allowed-tools: Task(fractary-faber:config-initializer)
model: claude-haiku-4-5
argument-hint: '[--autonomy guarded] [--force] [--json]'
tags: [faber, configuration, setup, initialization]
examples:
  - trigger: "/fractary-faber:config-init"
    action: "Auto-detect configuration values and ask user to confirm each one"
  - trigger: "/fractary-faber:config-init --autonomy guarded"
    action: "Pre-set autonomy to guarded, auto-detect and confirm the rest"
  - trigger: "/fractary-faber:config-init --force"
    action: "Re-initialize FABER configuration with auto-detected defaults, no prompts"
---

# fractary-faber:config-init

Use **Task** tool with `config-initializer` agent to initialize FABER configuration.

When called with no arguments, the agent auto-detects sensible values for all configuration
fields based on the project structure and presents them to the user for confirmation. The
user can accept the detected values or provide alternatives — no CLI argument knowledge needed.

```
Task(
  subagent_type="fractary-faber:config-initializer",
  description="Initialize FABER configuration",
  prompt="Initialize FABER configuration: $ARGUMENTS"
)
```
