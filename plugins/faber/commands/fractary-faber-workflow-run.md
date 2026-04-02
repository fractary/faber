---
name: fractary-faber-workflow-run
allowed-tools: Skill(fractary-faber-workflow-runner:*)
description: Execute FABER workflow for work item(s)
model: claude-haiku-4-5
argument-hint: '<work-ids|plan-id> [--resume <run-id>] [--phase <phase>] [--step <step-id>] [--force-new] [--worktree] [--resume-batch] [--workflow <id>] [--autonomy <level>]'
---

## Your task

Invoke the FABER workflow runner skill with the provided arguments.

Use the **Skill** tool exactly once:

```
Skill(skill="fractary-faber-workflow-runner", args="$ARGUMENTS")
```

Do NOT execute workflow steps yourself. The skill handles everything.
