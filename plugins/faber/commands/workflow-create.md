---
name: fractary-faber:workflow-create
description: Create a new FABER workflow - delegates to fractary-faber:workflow-engineer agent
allowed-tools: Task(fractary-faber:workflow-engineer)
model: claude-haiku-4-5
argument-hint: '[<workflow-name>] [--context <description>] [--extends <parent-workflow>] [--template <template-type>] [--asset-type <asset>]'
---

Use **Task** tool with `fractary-faber:workflow-engineer` agent to create a new workflow configuration.

**Arguments**:
- `workflow-name` - Name for the new workflow (e.g., `data-pipeline`, `documentation`)
- `--context <description>` - Description of workflow purpose and requirements
- `--extends <parent>` - Parent workflow to extend (default: `fractary-faber:core`)
- `--template <template>` - Workflow template from `templates/workflows/` (e.g., `asset-create`). Uses template structure and prompts for required variables.
- `--asset-type <asset>` - Asset type for template-based workflows (e.g., `dataset`, `catalog`, `api`). Required when `--template` is specified.

**Examples**:
- `/fractary-faber:workflow-create data-pipeline --context "ETL workflow for processing CSV files"`
- `/fractary-faber:workflow-create --template asset-create --asset-type dataset --context "Dataset creation workflow"`
- `/fractary-faber:workflow-create docs-update --context "Documentation update workflow" --extends fractary-faber:default`
- `/fractary-faber:workflow-create --context "Custom deployment workflow for production releases"`

```
Task(
  subagent_type="fractary-faber:workflow-engineer",
  description="Create new FABER workflow configuration",
  prompt="Create workflow: $ARGUMENTS --mode create"
)
```
