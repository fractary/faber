---
name: fractary-faber-workflow-plan
description: Plan FABER workflow(s) for work items. Use when planning workflows for issues or work items.
user-invocable: true
---

# Workflow Plan

Plans FABER workflows for one or more work items using the CLI.

## Arguments

| Argument | Required | Description |
|----------|----------|-------------|
| `--work-id <ids>` | Yes | Comma-separated work item IDs |
| `--work-label <labels>` | No | Work labels to match |
| `--workflow <name>` | No | Workflow name override |
| `--autonomy <level>` | No | Autonomy level override |
| `--worktree` | No | Create worktree for execution |
| `--skip-confirm` | No | Skip confirmation prompts |
| `--force-new` | No | Force new plan (bypass cache) |

## Execution

Run the FABER CLI planning command with the provided arguments:

```bash
fractary-faber workflow-plan $ARGUMENTS
```

The CLI handles validation, plan creation, branch creation, and worktree setup.
