---
title: SPEC - Phase 5 - Claude Code Integration
description: CLI entry point for external executor invocation from Claude Code's workflow-run skill, and protocol update for executor routing
tags: [spec, faber, multi-model, executors, claude-code, workflow-run, skill]
created: 2026-03-25
updated: 2026-03-25
fractary_doc_type: specification
visibility: internal
status: implemented
---

# Phase 5: Claude Code Integration

**Status**: Implemented (2026-03-25)
**Verified**: SDK compiles clean, 135 existing tests pass

---

## Goal

When running inside Claude Code (via the `workflow-run.md` skill), support steps with non-default executors by providing a CLI entry point that Claude can invoke via Bash.

## What Was Built

### 5a. CLI Entry Point (`sdk/js/src/executors/cli-entry.ts`)

`executeStepCli()` function designed to be invoked from Claude Code's Bash tool:

```bash
echo '{"stepId":"review","prompt":"...","executor":{"provider":"openai","model":"gpt-4o"},"context":{...}}' | \
  node -e "import('@fractary/faber').then(m => m.executeStepCli())"
```

Behavior:
- Reads JSON from stdin with fields: `stepId`, `prompt`, `executor`, `context`
- Creates an `ExecutorRegistry.createDefault()` and resolves the provider
- Executes the step against the specified provider
- Writes JSON `ExecutorResult` to stdout for Claude to parse
- On error, writes a failure `ExecutorResult` and exits with code 1

### 5b. Workflow-run Protocol Update (`plugins/faber/commands/workflow-run.md`)

Added external executor routing to step 2.4 of the execution loop:

```
# ── 2.4: Execute step per orchestration protocol ──
IF step.executor is defined (step has an "executor" field with "provider"):
  # External executor — invoke via Bash, parse JSON result
  LOG "⫸ External executor: {step.executor.provider}"
  result_json = Bash: echo '<step-input-json>' | node -e "
    import('@fractary/faber').then(m => m.executeStepCli());
  "
  # Parse result_json as ExecutorResult
  # Apply result_handling based on result.status
ELSE IF step.skill is set:
  Skill(skill=step.skill, args=resolved_args)
ELSE:
  Interpret and execute step.prompt directly
```

This ensures:
- Steps without an `executor` field continue to work exactly as before (Claude executes directly)
- Steps with an `executor` field are routed to the external model/service via the CLI entry point
- Result handling (success/warning/failure) applies identically regardless of executor

## Files

| File | Action |
|------|--------|
| `sdk/js/src/executors/cli-entry.ts` | Created |
| `sdk/js/src/executors/index.ts` | Modified (export executeStepCli) |
| `plugins/faber/commands/workflow-run.md` | Modified (added external executor protocol in step 2.4) |
