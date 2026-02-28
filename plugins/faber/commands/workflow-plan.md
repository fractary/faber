---
name: fractary-faber:workflow-plan
description: Create a FABER execution plan and optionally execute it immediately
argument-hint: '[<target>] [--work-id <id>] [--workflow <id>] [--autonomy <level>] [--phase <phases>] [--auto-run]'
allowed-tools: Task(fractary-faber:faber-planner), Skill(fractary-faber:workflow-run)
model: claude-haiku-4-5
---

# FABER Workflow Plan

## Protocol

### Step 1: Parse Arguments

From `$ARGUMENTS`:
1. Check if `--auto-run` flag is present (boolean)
2. Build planner args: take full `$ARGUMENTS`, strip `--auto-run` (if present), then append `--auto-execute` if `--auto-run` was present

Example:
- Input: `--work-id 123 --auto-run` → planner args: `--work-id 123 --auto-execute`
- Input: `--work-id 123` → planner args: `--work-id 123`

### Step 2: Spawn faber-planner

```
Task(
  subagent_type="fractary-faber:faber-planner",
  description="Create FABER execution plan",
  prompt="Create execution plan: {planner-args}"
)
```

### Step 3: Parse Task Response

From the Task result, scan for these lines (anywhere in the output):

```
execute: true
plan_id: <id>
```

Extract:
- `execute_flag` = true if the string `execute: true` appears in the response
- `plan_id` = value after `plan_id: ` if that line appears in the response

### Step 4: Conditional Execution

IF `execute_flag` is true AND `plan_id` is non-empty:

```
Print: "Executing plan: /fractary-faber:workflow-run {plan_id}"
Skill("fractary-faber:workflow-run", args="{plan_id}")
```

Otherwise: done — the plan was created but not executed. The faber-planner will have already printed the plan ID and next steps.
