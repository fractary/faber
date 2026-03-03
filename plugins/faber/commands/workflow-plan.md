---
name: fractary-faber:workflow-plan
description: Create a FABER execution plan (plan only — use workflow-run to execute)
argument-hint: '[<target>] [--work-id <id>] [--workflow <id>] [--autonomy <level>] [--phase <phases>]'
allowed-tools: Task(fractary-faber:faber-planner)
model: claude-haiku-4-5
---

# FABER Workflow Plan

## Protocol

### Step 1: Spawn faber-planner

Pass `$ARGUMENTS` directly to the planner.

```
Task(
  subagent_type="fractary-faber:faber-planner",
  description="Create FABER execution plan",
  prompt="Create execution plan: $ARGUMENTS"
)
```

### Step 2: Parse Task Response

From the Task result, scan for these lines (anywhere in the output):

```
plan_id: <id>
```

Extract:
- `plan_id` = value after `plan_id: ` if that line appears in the response

Output the plan_id and next steps to the user:

```
Plan created: {plan_id}

To execute:
  /fractary-faber:workflow-run {plan_id}
```
