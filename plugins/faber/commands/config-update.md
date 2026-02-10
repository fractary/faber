---
name: fractary-faber:config-update
description: Update existing FABER configuration - delegates to fractary-faber:config-updater agent
allowed-tools: Task(fractary-faber:config-updater)
model: claude-haiku-4-5
argument-hint: '--context "description of changes" [--force] [--json]'
---

Use **Task** tool with `fractary-faber:config-updater` agent to update FABER configuration with provided arguments.

```
Task(
  subagent_type="fractary-faber:config-updater",
  description="Update FABER configuration",
  prompt="Update FABER configuration: $ARGUMENTS"
)
```
