---
title: SPEC - Phase 2 - Executor Registry & Claude Provider
description: ExecutorRegistry with cascade resolution and Anthropic Messages API executor for CLI-native mode
tags: [spec, faber, multi-model, executors, registry, claude, anthropic]
created: 2026-03-25
updated: 2026-03-25
fractary_doc_type: specification
visibility: internal
status: implemented
---

# Phase 2: Executor Registry & Claude Provider

**Status**: Implemented (2026-03-25)
**Verified**: SDK compiles clean, 135 existing tests pass

---

## Goal

Build the registry that maps provider names to executor implementations and resolves the config cascade, plus the first provider (Claude via Anthropic Messages API).

## What Was Built

### 2a. ExecutorRegistry (`sdk/js/src/executors/registry.ts`)

Central registry with:

- **`register(provider, factory)`** — Register a provider with lazy factory
- **`get(provider)`** — Get executor instance (created lazily on first use)
- **`has(provider)` / `listProviders()`** — Discovery
- **`resolveForStep(step, phase, workflowExecutor, phaseExecutors)`** — Cascade resolution returning `{ executor, config }` or `null` (meaning use default behavior)
- **`validateWorkflow(steps, workflowExecutor, phaseExecutors)`** — Pre-execution validation of all executor configs (checks API keys, endpoints)
- **`ExecutorRegistry.createDefault()`** — Static factory that registers all built-in providers (claude, openai, openai-compatible, http)

### 2b. Claude Executor (`sdk/js/src/executors/providers/claude.ts`)

Executes steps via the Anthropic Messages API directly (no Claude Code required):

- Default model: `claude-sonnet-4-6-20250514`
- Default env var: `ANTHROPIC_API_KEY`
- Default max tokens: 8192
- Builds context prefix from issue/phase/step metadata
- Supports `system_prompt` override, `temperature`, `max_tokens`
- Reports token usage from API response
- Graceful error handling for missing API key, HTTP errors, network failures

### 2c. Provider exports (`sdk/js/src/executors/providers/index.ts`)

Re-exports all provider classes.

## Files

| File | Action |
|------|--------|
| `sdk/js/src/executors/registry.ts` | Created |
| `sdk/js/src/executors/providers/claude.ts` | Created |
| `sdk/js/src/executors/providers/index.ts` | Created |
