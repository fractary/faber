---
name: fractary-faber-config-validate
description: Validate FABER configuration - delegates to fractary-faber-config-validator agent
allowed-tools: Agent(fractary-faber-config-validator)
model: claude-haiku-4-5
argument-hint: '[--json]'
---

Use **Agent** tool with `fractary-faber-config-validator` agent to validate FABER configuration with provided arguments.

```
Agent(
  subagent_type="fractary-faber-config-validator",
  description="Validate FABER configuration",
  prompt="Validate FABER configuration: $ARGUMENTS"
)
```
