---
name: fractary-faber:config-validate
description: Validate FABER configuration
allowed-tools: Task(fractary-faber:config-validator)
model: claude-haiku-4-5
argument-hint: '[--json]'
tags: [faber, configuration, validation]
examples:
  - trigger: "/fractary-faber:config-validate"
    action: "Validate current FABER configuration"
  - trigger: "/fractary-faber:config-validate --json"
    action: "Validate and output results as JSON"
---

# fractary-faber:config-validate

Use **Task** tool with `config-validator` agent to validate FABER configuration.

```
Task(
  subagent_type="fractary-faber:config-validator",
  description="Validate FABER configuration",
  prompt="Validate FABER configuration: $ARGUMENTS"
)
```
