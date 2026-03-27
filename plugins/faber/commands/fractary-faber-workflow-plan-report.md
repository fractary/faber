---
name: fractary-faber-workflow-plan-report
description: Display a formatted summary report for a FABER plan
argument-hint: '<plan-id>'
allowed-tools: Task(fractary-faber-workflow-plan-reporter)
model: claude-sonnet-4-6
---

# FABER Workflow Plan Report

Display a formatted planning summary for an existing FABER plan.

## Protocol

Invoke the `workflow-plan-reporter` agent with the plan ID from `$ARGUMENTS`:

```javascript
await Task({
  subagent_type: "fractary-faber-workflow-plan-reporter",
  description: `Report planning summary for ${plan_id}`,
  prompt: `Report plan: --plan-id ${plan_id}`
});
```

Where `plan_id` is the value passed as `$ARGUMENTS` (e.g. `corthosai-etl.corthion.ai-266`).
