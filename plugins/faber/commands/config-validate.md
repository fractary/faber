---
name: fractary-faber:config-validate
description: Validate FABER configuration - delegates to fractary-faber:config-validator agent
allowed-tools: Task(fractary-faber:config-validator)
model: claude-haiku-4-5
argument-hint: '[--json]'
---

Use **Task** tool with `fractary-faber:config-validator` agent to validate FABER configuration with provided arguments.

```
Task(
  subagent_type="fractary-faber:config-validator",
  description="Validate FABER configuration",
  prompt="Validate FABER configuration: $ARGUMENTS"
)
```
