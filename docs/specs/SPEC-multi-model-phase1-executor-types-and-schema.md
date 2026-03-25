---
title: SPEC - Phase 1 - Executor Types & Schema (Foundation)
description: Core executor abstraction types and workflow schema extensions for multi-model FABER step execution
tags: [spec, faber, multi-model, executors, schema, types]
created: 2026-03-25
updated: 2026-03-25
fractary_doc_type: specification
visibility: internal
status: implemented
---

# Phase 1: Executor Types & Schema (Foundation)

**Status**: Implemented (2026-03-25)
**Verified**: SDK compiles clean, 135 existing tests pass

---

## Goal

Define the executor abstraction and extend the workflow step schema so that any step can optionally specify which provider/model executes it.

## What Was Built

### 1a. Executor types (`sdk/js/src/executors/types.ts`)

Core interfaces for the multi-model framework:

- **`StepExecutorConfig`** — Configuration for a step's executor (provider, model, base_url, api_key_env, max_tokens, temperature, system_prompt)
- **`ExecutionContext`** — Context passed to executors (workId, phase, stepId, issue, previousOutputs, workingDirectory)
- **`ExecutorResult`** — Structured result (output text, status, metadata with provider/model/duration/tokens)
- **`Executor`** — Interface all providers implement (`execute()` + `validate()`)
- **`ExecutorFactory`** — Factory type for lazy executor instantiation

### 1b. WorkflowStep extension (`sdk/js/src/workflow/resolver.ts`)

Added optional `executor?: StepExecutorConfig` field to `WorkflowStep`. Fully backward-compatible — existing workflows without this field are unaffected.

### 1c. WorkflowFileConfig extension (`sdk/js/src/workflow/resolver.ts`)

Added workflow-level defaults:
- `executor?: StepExecutorConfig` — Default executor for all steps
- `phase_executors?: Partial<Record<string, StepExecutorConfig>>` — Per-phase overrides

Config cascade: `step.executor > phase_executors[phase] > workflow.executor > system default`

### 1d. ResolvedWorkflow extension (`sdk/js/src/workflow/resolver.ts`)

Added `executor` and `phase_executors` to `ResolvedWorkflow` so resolved (merged) workflows carry executor config through.

### 1e. Resolver merge logic (`sdk/js/src/workflow/resolver.ts`)

Added `mergeExecutorConfig()` method. In inheritance, child workflow executor overrides parent. Phase executors merge with child taking precedence per phase.

### 1f. Workflow JSON schema (`plugins/faber/config/workflow.schema.json`)

Added `step_executor` definition with all properties (provider, model, base_url, api_key_env, max_tokens, temperature, system_prompt). Added `executor` to `sequential_step` properties and as top-level workflow properties (`executor`, `phase_executors`).

### 1g. Module exports (`sdk/js/src/executors/index.ts`, `sdk/js/src/index.ts`)

Executors module exported from SDK entry point.

## Files

| File | Action |
|------|--------|
| `sdk/js/src/executors/types.ts` | Created |
| `sdk/js/src/executors/index.ts` | Created |
| `sdk/js/src/workflow/resolver.ts` | Modified (WorkflowStep, WorkflowFileConfig, ResolvedWorkflow, mergeExecutorConfig) |
| `sdk/js/src/index.ts` | Modified (export executors) |
| `plugins/faber/config/workflow.schema.json` | Modified (step_executor definition, executor on steps and workflow) |
