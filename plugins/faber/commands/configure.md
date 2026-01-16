---
name: fractary-faber:configure
description: Configure FABER - initialization, updates, and management
allowed-tools: Task(fractary-faber:config-manager)
model: claude-haiku-4-5
argument-hint: '[--context "description of changes"] [--force] [--json]'
tags: [faber, configuration, setup, management]
examples:
  - trigger: "/fractary-faber:configure"
    action: "Initialize or update FABER configuration interactively"
  - trigger: "/fractary-faber:configure --context \"enable autonomous mode\""
    action: "Update configuration based on natural language description"
  - trigger: "/fractary-faber:configure --force"
    action: "Overwrite existing configuration without confirmation"
---

# fractary-faber:configure

Use **Task** tool with `config-manager` agent to configure FABER with provided arguments.

```
Task(
  subagent_type="fractary-faber:config-manager",
  description="Configure FABER project",
  prompt="Configure FABER: $ARGUMENTS"
)
```
