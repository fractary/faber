---
name: fractary-faber-workflow-batch-plan
description: Plan FABER workflows for multiple work items in a single operation. Use when planning several issues before batch execution. For a single work item, use fractary-faber-workflow-plan.
user-invocable: true
---

# FABER Workflow Batch Plan

Plans FABER workflows for multiple work items using the CLI.

## Arguments

| Argument | Required | Description |
|----------|----------|-------------|
| `<work-ids>` | Yes | Comma-separated work item IDs, e.g. "258,259,260" (minimum 2) |
| `--workflow <name>` | No | Workflow name override for all items |
| `--autonomy <level>` | No | Autonomy level override for all items |
| `--force-new` | No | Force new plan for each item (bypass cache) |
| `--worktree` | No | Create worktrees for each item during planning |
| `--skip-confirm` | No | Skip confirmation prompts |

## Execution

```javascript
// Parse the first positional argument as comma-separated IDs
const raw = "$ARGUMENTS";
const tokens = raw.trim().split(/\s+/);
const firstArg = tokens[0] || "";
const workIds = firstArg.split(',').map(id => id.trim()).filter(Boolean);

if (workIds.length < 2) {
  if (workIds.length === 1) {
    console.error("Error: Batch plan requires multiple work IDs.");
    console.error(`For a single item, use: fractary-faber-workflow-plan --work-id ${workIds[0]}`);
  } else {
    console.error("Error: Missing required argument: <work-ids>");
    console.error("Usage: /fractary-faber-workflow-batch-plan 258,259,260 [options]");
  }
  return;
}

// Collect remaining flags (everything after the first positional arg)
const passthroughFlags = tokens.slice(1).join(' ');
```

Run the FABER CLI planning command:

```bash
fractary-faber workflow-plan --work-id <work-ids> [passthrough-flags]
```

For example, given `/fractary-faber-workflow-batch-plan 258,259,260 --workflow custom --autonomy full`:
```bash
fractary-faber workflow-plan --work-id 258,259,260 --workflow custom --autonomy full
```

The CLI handles validation, plan creation, branch setup, and worktree configuration for all items. Output the CLI result verbatim.
