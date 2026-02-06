---
name: fractary-faber:config-update
description: Update existing FABER configuration
allowed-tools: Task(fractary-faber:config-updater)
model: claude-haiku-4-5
argument-hint: '--context "description of changes" [--force] [--json]'
tags: [faber, configuration, update, management]
examples:
  - trigger: '/fractary-faber:config-update --context "enable autonomous mode"'
    action: "Update configuration based on natural language description"
  - trigger: '/fractary-faber:config-update --context "change autonomy to guarded"'
    action: "Update autonomy level to guarded"
---

# fractary-faber:config-update

Use **Task** tool with `config-updater` agent to update FABER configuration.

```
Task(
  subagent_type="fractary-faber:config-updater",
  description="Update FABER configuration",
  prompt="Update FABER configuration: $ARGUMENTS"
)
```
