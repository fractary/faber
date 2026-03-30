---
name: fractary-faber-workflow-run
description: Execute a FABER plan created by faber plan CLI command
argument-hint: '<work-ids|plan-id> [--resume <run-id>] [--phase <phases>] [--step <step-id>] [--worktree] [--force-new] [--resume-batch] [--workflow <id>] [--autonomy <level>]'
allowed-tools: Read, Write, Bash, Skill, AskUserQuestion, MCPSearch, TaskCreate, TaskUpdate, TaskList, TaskGet, Agent(fractary-faber-workflow-planner), Agent(fractary-faber-workflow-plan-validator), Agent(fractary-faber-workflow-plan-reporter), Agent(fractary-faber-workflow-verifier)
model: claude-sonnet-4-6
---

Use the **Skill** tool with `fractary-faber-workflow-runner` to execute the workflow.

```
Skill(
  skill="fractary-faber-workflow-runner",
  args="$ARGUMENTS"
)
```
