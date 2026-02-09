---
name: fractary-faber:workflow-inspect
description: Validate FABER workflow configuration - delegates to fractary-faber:workflow-inspector agent
allowed-tools: Task(fractary-faber:workflow-inspector)
model: claude-haiku-4-5
argument-hint: '[<workflow-name-or-path>] [--verbose] [--fix] [--check <aspect>] [--config-path <path>]'
---

Use **Task** tool with `fractary-faber:workflow-inspector` agent to validate workflow configuration with provided arguments.

```
Task(
  subagent_type="fractary-faber:workflow-inspector",
  description="Validate FABER workflow configuration",
  prompt="Inspect workflow configuration: $ARGUMENTS"
)
```
