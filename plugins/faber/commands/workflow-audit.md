---
name: fractary-faber:workflow-audit
description: Validate FABER workflow configuration - delegates to fractary-faber:workflow-auditor agent
allowed-tools: Task(fractary-faber:workflow-auditor)
model: claude-haiku-4-5
argument-hint: '[<workflow-name-or-path>] [--verbose] [--fix] [--check <aspect>] [--config-path <path>]'
---

Use **Task** tool with `fractary-faber:workflow-auditor` agent to validate workflow configuration with provided arguments.

**Workflow identifier** (optional):
- `workflow-id` - Validates workflow from project config
- `path/to/file.json` - Validates standalone workflow file
- `plugin:workflow-id` - Validates namespaced workflow from plugin
- Omitted - Shows usage and lists available workflows

```
Task(
  subagent_type="fractary-faber:workflow-auditor",
  description="Validate FABER workflow configuration",
  prompt="Audit workflow configuration: $ARGUMENTS"
)
```
