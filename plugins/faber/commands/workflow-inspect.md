---
name: fractary-faber:workflow-inspect
description: Validate FABER workflow configuration - delegates to fractary-faber:workflow-inspector agent
allowed-tools: Task(fractary-faber:workflow-inspector)
model: claude-haiku-4-5
argument-hint: '[<workflow-name-or-path>] [--verbose] [--fix] [--check <aspect>] [--config-path <path>]'
---

Use **Task** tool with `fractary-faber:workflow-inspector` agent to validate workflow configuration with provided arguments.

**Workflow identifier** (optional):
- `workflow-id` - Validates workflow from project config
- `path/to/file.json` - Validates standalone workflow file
- `plugin:workflow-id` - Validates namespaced workflow from plugin
- Omitted - Shows usage and lists available workflows

```
Task(
  subagent_type="fractary-faber:workflow-inspector",
  description="Validate FABER workflow configuration",
  prompt="Inspect workflow configuration: $ARGUMENTS"
)
```
