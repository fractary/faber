---
name: fractary-faber:workflow-audit
description: Validate FABER workflow configuration - delegates to fractary-faber:workflow-audit agent
allowed-tools: Task(fractary-faber:workflow-audit)
model: claude-haiku-4-5
argument-hint: '[--verbose] [--fix] [--check <aspect>] [--config-path <path>]'
---

Use **Task** tool with `fractary-faber:workflow-audit` agent to validate workflow configuration with provided arguments.

```
Task(
  subagent_type="fractary-faber:workflow-audit",
  description="Validate FABER workflow configuration",
  prompt="Audit workflow configuration: $ARGUMENTS"
)
```
