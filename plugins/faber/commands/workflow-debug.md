---
name: fractary-faber:workflow-debug
description: Diagnose workflow issues and propose solutions - delegates to fractary-faber:workflow-debugger agent
allowed-tools: Task(fractary-faber:workflow-debugger)
model: claude-haiku-4-5
argument-hint: '[--work-id <id>] [--run-id <id>] [--problem "<text>"] [--phase <phase>] [--auto-fix] [--learn] [--create-spec]'
---

Use **Task** tool with `fractary-faber:workflow-debugger` agent to diagnose workflow issues with provided arguments.

```
Task(
  subagent_type="fractary-faber:workflow-debugger",
  description="Diagnose FABER workflow issues",
  prompt="Debug workflow: $ARGUMENTS"
)
```
