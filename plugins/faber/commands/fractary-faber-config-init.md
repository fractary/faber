---
name: fractary-faber-config-init
description: Initialize FABER configuration - delegates to fractary-faber-config-manager skill
allowed-tools: Skill(fractary-faber-config-manager)
model: claude-haiku-4-5
argument-hint: '[--autonomy guarded] [--force] [--json]'
---

Use **Skill** tool with `fractary-faber-config-manager` to initialize FABER configuration with provided arguments.

```
Skill(
  skill="fractary-faber-config-manager",
  args="init $ARGUMENTS"
)
```
