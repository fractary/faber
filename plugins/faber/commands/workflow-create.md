---
name: fractary-faber:workflow-create
description: Create or update a FABER workflow - delegates to fractary-faber:workflow-creator agent
allowed-tools: Task(fractary-faber:workflow-creator)
model: claude-haiku-4-5
argument-hint: '[<workflow-name>] [--context <description>] [--extends <parent-workflow>] [--type <workflow-type>]'
---

Use **Task** tool with `fractary-faber:workflow-creator` agent to create or update a workflow configuration.

**Arguments**:
- `workflow-name` - Name for the new workflow (e.g., `data-pipeline`, `documentation`)
- `--context <description>` - Description of workflow purpose and requirements
- `--extends <parent>` - Parent workflow to extend (default: `fractary-faber:core`)
- `--type <type>` - Workflow type hint: `feature`, `bug`, `data`, `infra`, `custom`

**Examples**:
- `/fractary-faber:workflow-create data-pipeline --context "ETL workflow for processing CSV files"`
- `/fractary-faber:workflow-create docs-update --context "Documentation update workflow" --extends fractary-faber:default`
- `/fractary-faber:workflow-create --context "Custom deployment workflow for production releases"`

```
Task(
  subagent_type="fractary-faber:workflow-creator",
  description="Create or update FABER workflow configuration",
  prompt="Create workflow: $ARGUMENTS"
)
```
