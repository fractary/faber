---
name: fractary-faber-workflow-plan
allowed-tools: Bash(fractary-faber workflow-plan:*)
description: Plan FABER workflow(s) for work items
model: claude-haiku-4-5
argument-hint: '--work-id <ids> [--work-label <labels>] [--workflow <name>] [--autonomy <level>] [--worktree] [--skip-confirm] [--force-new]'
---

## Your task

Run the FABER CLI planning command with the provided arguments.

Use the **Bash** tool exactly once:

```bash
fractary-faber workflow-plan $ARGUMENTS
```

Do NOT modify arguments. The CLI handles validation, plan creation, branch creation, and worktree setup.
