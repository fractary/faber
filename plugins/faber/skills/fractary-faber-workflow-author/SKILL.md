---
name: fractary-faber-workflow-author
description: Create, update, or inspect FABER workflow configurations with project-aware generation
user-invocable: true
argument-hint: "<create|update|inspect> [--workflow <name>] [--context <desc>] [--template <type>]"
allowed-tools:
  - Bash
  - Read
  - Write
  - Glob
  - Grep
  - AskUserQuestion
---

# FABER Workflow Author

Creates, updates, and validates FABER workflow configurations by researching project structure, gathering requirements, and applying best practices.

## Operations

- **create**: Build a new workflow definition. Read `docs/create-protocol.md` for detailed instructions.
- **update**: Modify an existing workflow. Read `docs/update-protocol.md` for detailed instructions.
- **inspect**: Validate workflow configuration with completeness scoring. Read `docs/inspect-protocol.md` for detailed instructions.

## Routing

Parse first positional argument or infer from flags:
- `create` or `--template` present → create
- `update` and `--workflow` present → update
- `inspect` or `--verbose`/`--fix`/`--check` present → inspect

## Key Parameters

| Parameter | Operations | Description |
|-----------|-----------|-------------|
| `--workflow <name>` | all | Workflow name/ID (required for update/inspect) |
| `--context <desc>` | create, update | Description of purpose or changes |
| `--extends <parent>` | create | Parent workflow (default: `fractary-faber-core`) |
| `--template <type>` | create | Workflow template (e.g., `asset-create`) |
| `--asset-type <type>` | create | Asset type for templates (e.g., `dataset`, `api`) |
| `--verbose` | inspect | Detailed validation output |
| `--fix` | inspect | Auto-fix simple issues |
| `--check <aspect>` | inspect | Focus: `phases`, `hooks`, `integrations`, `all` |

## Best Practices Enforced

1. All workflows extend `fractary-faber-core` by default
2. Standard 5-phase structure: frame, architect, build, evaluate, release
3. Unique step IDs that don't conflict with inherited steps
4. Proper autonomy configuration with `require_approval_for`
5. Schema reference included (`$schema`)
6. Security: workflow names validated against `^[a-z][a-z0-9-]*$`

## File Locations

- Workflows: `.fractary/faber/workflows/{name}.json`
- Schema: `plugins/faber/config/workflow.schema.json`
- Templates: `templates/workflows/{template}/`
