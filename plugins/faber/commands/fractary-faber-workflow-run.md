---
name: fractary-faber-workflow-run
allowed-tools: Skill(fractary-faber-workflow-runner:*)
description: Execute FABER workflow for work item(s)
model: claude-haiku-4-5
argument-hint: '<work-ids|plan-id> [--resume <run-id>] [--phase <phase>] [--step <step-id>] [--force-new] [--worktree] [--resume-batch] [--workflow <id>] [--autonomy <level>]'
---

## Your task

**IMMEDIATELY** call the Skill tool with the following parameters — do not output any text first:

- skill: `fractary-faber-workflow-runner`
- args: `$ARGUMENTS`

This is your only action. Do NOT describe the workflow, explain what will happen, or do anything else. Just call the Skill tool now.
