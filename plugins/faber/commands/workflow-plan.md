---
name: fractary-faber:workflow-plan
description: Create a FABER execution plan (plan only — use workflow-run to execute)
argument-hint: '[<target>] [--work-id <id>] [--workflow <id>] [--autonomy <level>] [--force-new]'
allowed-tools: Task(fractary-faber:faber-planner), Task(fractary-faber:faber-plan-validator), Task(fractary-faber:workflow-plan-reporter), TodoWrite, Skill(fractary-work:issue-fetch), Skill(fractary-work:issue-comment)
model: claude-sonnet-4-6
---

# FABER Workflow Plan

## Protocol

### Step 0: Initialize Task List

Before doing anything else, create the task list so all steps are visible from the start:

```javascript
await TodoWrite({
  todos: [
    { content: "Check for existing plan", status: "pending", activeForm: "Checking for existing plan" },
    { content: "Create plan with faber-planner", status: "pending", activeForm: "Creating plan with faber-planner" },
    { content: "Validate plan with faber-plan-validator", status: "pending", activeForm: "Validating plan" },
    { content: "Report planning summary", status: "pending", activeForm: "Reporting planning summary" }
  ]
});
```

### Step 1: Check for Existing Plan

Update task "Check for existing plan" → in_progress.

Parse `$ARGUMENTS` to extract:
- `work_id`: value of `--work-id` flag (or null)
- `force_new`: true if `--force-new` flag is present

```javascript
let plan_id = null;
let skipPlanner = false;

if (work_id && !force_new) {
  // Fetch issue and check for existing plan comment
  try {
    const issueResult = await Skill({
      skill: "fractary-work:issue-fetch",
      args: `--ids ${work_id} --format json`
    });

    const issueData = JSON.parse(issueResult);
    if (issueData.success && issueData.issues && issueData.issues.length > 0) {
      const issue = issueData.issues[0];
      plan_id = extractPlanIdFromIssue(issue);
    }
  } catch (error) {
    console.warn(`Could not fetch issue #${work_id}: ${error.message}`);
  }

  if (plan_id) {
    console.log(`→ Found existing plan: ${plan_id}`);
    console.log(`  Skipping faber-planner — use --force-new to create a new plan`);
    skipPlanner = true;
  }
}
```

Use the same `extractPlanIdFromIssue()` helper as workflow-run (parses `**Plan ID:** \`{plan_id}\`` format).

Update task "Check for existing plan" → completed.

### Step 2: Create Plan with faber-planner

If `skipPlanner` is true, mark task "Create plan with faber-planner" → completed (skipped) and proceed to Step 3.

Otherwise, update task "Create plan with faber-planner" → in_progress.

```javascript
let plannerResult;
try {
  plannerResult = await Task({
    subagent_type: "fractary-faber:faber-planner",
    description: "Create FABER execution plan",
    prompt: `Create execution plan: $ARGUMENTS`
  });
} catch (error) {
  // Infrastructure failure (socket error, timeout, UND_ERR_SOCKET, etc.)
  // STOP — do not substitute tools, do not retry
  console.error(`Task(faber-planner) failed with infrastructure error: ${error.message}`);
  console.error("");
  console.error("The planner agent may have completed before the connection dropped.");
  console.error("Check .fractary/faber/runs/ for partial artifacts before retrying.");
  console.error("Re-run with --force-new only if no valid plan.json exists.");
  return;  // STOP — do not continue to other steps
}

const planIdMatch = plannerResult.match(/plan_id:\s*(\S+)/);
if (!planIdMatch) {
  console.error("Error: faber-planner did not return a plan_id.");
  console.error("Planner output:");
  console.error(plannerResult);
  // Mark remaining tasks failed
  await TodoWrite({
    todos: [
      { content: "Check for existing plan", status: "completed", activeForm: "Checking for existing plan" },
      { content: "Create plan with faber-planner", status: "completed", activeForm: "Creating plan with faber-planner" },
      { content: "Validate plan with faber-plan-validator", status: "completed", activeForm: "Validating plan" },
      { content: "Report planning summary", status: "completed", activeForm: "Reporting planning summary" }
    ]
  });
  return;
}

plan_id = planIdMatch[1];
console.log(`✓ Plan created: ${plan_id}`);
```

Update task "Create plan with faber-planner" → completed.

### Step 3: Validate Plan

**CRITICAL: You have no `Read` or `Bash` tools. You MUST invoke `faber-plan-validator` via `Task`. You cannot validate the plan yourself. Do not skip this step.**

Update task "Validate plan with faber-plan-validator" → in_progress.

```javascript
const validationResult = await Task({
  subagent_type: "fractary-faber:faber-plan-validator",
  description: `Validate plan ${plan_id}`,
  prompt: `Validate plan: --plan-id ${plan_id}`
});

const validationMatch = validationResult.match(/validation:\s*(pass|fail)/);
if (!validationMatch || validationMatch[1] === 'fail') {
  const reasonMatch = validationResult.match(/reason:\s*(.+)/);
  const reason = reasonMatch ? reasonMatch[1].trim() : 'unknown reason';

  console.error(`\n❌ Plan validation failed: ${reason}`);
  console.error(`\nPlan ID: ${plan_id}`);
  console.error(`\nTo recreate the plan:`);
  if (work_id) {
    console.error(`  /fractary-faber:workflow-plan --work-id ${work_id} --force-new`);
  } else {
    console.error(`  Re-run with the same arguments`);
  }
  return;
}

console.log(`✓ Plan validated`);
```

Update task "Validate plan with faber-plan-validator" → completed.

### Step 4: Report Planning Summary

Update task "Report planning summary" → in_progress.

```javascript
await Task({
  subagent_type: "fractary-faber:workflow-plan-reporter",
  description: `Report planning summary for ${plan_id}`,
  prompt: `Report plan: --plan-id ${plan_id}`
});
```

Update task "Report planning summary" → completed.

## On Task Failure

If ANY `Task()` call in this protocol fails with an infrastructure error (socket error,
timeout, API error, `UND_ERR_SOCKET`, or any non-domain error):

1. **STOP immediately** — do not attempt any other tool call or retry
2. **Report the exact error** to the user verbatim
3. **Check for partial artifacts** — if `Task(faber-planner)` failed, the agent may have
   completed before the connection dropped. Inform the user to check:
   - `.fractary/faber/runs/{plan-id}/plan.json` (may exist on disk)
   - Re-run with `--force-new` only if no valid plan exists
4. **Wait for user instruction** — do not retry, do not substitute tools

> **WSL2 Note:** `UND_ERR_SOCKET` means the TCP connection dropped (common on WSL2 for
> operations >10min). The faber-planner agent likely completed — check for artifacts first.

---

## Helper: extractPlanIdFromIssue

```javascript
function extractPlanIdFromIssue(issue) {
  const patterns = [
    /\*\*Plan ID[:\*]*\*?\s*`([^`]+)`/,
    /🤖\s*(?:\*\*)?Workflow [Pp]lan [Cc]reated(?:\*\*)?\s*:\s*(\S+)/,
    /🤖 Workflow plan created: (\S+)/
  ];

  function findPlanId(text) {
    if (!text) return null;
    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match) return match[1];
    }
    return null;
  }

  if (issue.comments) {
    for (let i = issue.comments.length - 1; i >= 0; i--) {
      const planId = findPlanId(issue.comments[i].body);
      if (planId) return planId;
    }
  }

  const body = issue.body || issue.description;
  return findPlanId(body);
}
```
