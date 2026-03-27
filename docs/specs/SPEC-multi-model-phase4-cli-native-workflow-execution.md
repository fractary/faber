---
title: SPEC - Phase 4 - CLI-Native Workflow Execution
description: Deterministic WorkflowExecutor class and faber workflow-execute CLI command for headless multi-model workflow execution
tags: [spec, faber, multi-model, executors, cli, workflow-executor, deterministic]
created: 2026-03-25
updated: 2026-03-25
fractary_doc_type: specification
visibility: internal
status: implemented
---

# Phase 4: CLI-Native Workflow Execution

**Status**: Implemented (2026-03-25)
**Verified**: SDK compiles clean, CLI compiles clean, 135 existing tests pass

---

## Goal

Enable `faber workflow-execute` to run workflows directly from the CLI without Claude Code, using the executor framework. Code controls the step loop deterministically — no LLM needed for orchestration.

## What Was Built

### 4a. WorkflowExecutor (`sdk/js/src/executors/workflow-executor.ts`)

Deterministic workflow executor that iterates through phases and steps, dispatching each to its configured executor:

- Iterates phases in order: frame → architect → build → evaluate → release
- Skips disabled phases and respects `phasesToRun` filter
- Supports `stepToRun` for single-step execution
- For each step, resolves executor via `ExecutorRegistry.resolveForStep()` cascade
- Steps with no executor configured default to the Claude API executor
- Tracks `previousOutputs` across steps for context
- Applies `result_handling` cascade (step > phase > workflow > defaults)
- On failure with `on_failure: 'stop'`, halts execution
- Progress callbacks: `onPhaseStart`, `onPhaseComplete`, `onStepStart`, `onStepComplete`
- Returns structured `WorkflowExecuteResult` with per-phase and per-step results

Exported types: `WorkflowExecuteOptions`, `WorkflowExecuteResult`, `PhaseExecuteResult`, `StepExecuteResult`

### 4b. CLI Command (`cli/src/commands/fractary-faber-workflow/index.ts`)

New `faber workflow-execute <plan.json>` command:

```bash
# Basic execution
faber workflow-execute .fractary/faber/runs/my-plan/plan.json

# Override default model
faber workflow-execute plan.json --model claude-haiku-4-5

# Filter to specific phases
faber workflow-execute plan.json --phase build,evaluate

# Execute single step
faber workflow-execute plan.json --step review-code

# JSON output for CI/CD
faber workflow-execute plan.json --json
```

Features:
- Loads plan.json, creates registry, dispatches to WorkflowExecutor
- Pretty console output with per-step provider tags (e.g., `[openai:gpt-4o]`)
- Shows token usage when available
- Duration per step and total
- Steps/phases completed summary
- JSON output mode for programmatic consumption
- Exit code 1 on failure

### 4c. CLI registration (`cli/src/index.ts`)

`createWorkflowExecuteCommand()` registered as top-level command.

## Files

| File | Action |
|------|--------|
| `sdk/js/src/executors/workflow-executor.ts` | Created |
| `sdk/js/src/executors/index.ts` | Modified (export WorkflowExecutor and types) |
| `cli/src/commands/fractary-faber-workflow/index.ts` | Modified (added createWorkflowExecuteCommand) |
| `cli/src/index.ts` | Modified (registered workflow-execute command) |
