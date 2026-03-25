---
title: SPEC - Phase 6 - Multi-Model Executor Hardening (Tests, Retries, Cost Tracking)
description: Production hardening for the multi-model executor framework - tests, retry logic, fallback executors, cost tracking, and plan-time validation
tags: [spec, faber, multi-model, executors, testing, reliability, cost]
created: 2026-03-25
updated: 2026-03-25
fractary_doc_type: specification
visibility: internal
status: proposed
---

# Phase 6: Multi-Model Executor Hardening

**Status**: Proposed (deferred from initial multi-model executor implementation)
**Depends on**: Multi-model executor framework (implemented in `sdk/js/src/executors/`)
**Priority**: High — needed before production use of multi-model workflows

---

## Background

The multi-model executor framework was implemented with the core architecture (types, registry, providers, CLI-native execution, Claude Code integration). This spec covers the production hardening needed before relying on it for real workflows.

---

## 1. Unit Tests for Executor Framework

### Test files to create

| File | What to test |
|------|-------------|
| `sdk/js/src/executors/__tests__/registry.test.ts` | Registry: register, get, has, listProviders, resolveForStep cascade logic, validateWorkflow |
| `sdk/js/src/executors/__tests__/providers/claude.test.ts` | Claude executor: execute (mock API), validate (env var check), error handling |
| `sdk/js/src/executors/__tests__/providers/openai.test.ts` | OpenAI executor: execute (mock API), validate, error handling |
| `sdk/js/src/executors/__tests__/providers/openai-compatible.test.ts` | OpenAI-compatible: base_url required, model required, auth optional |
| `sdk/js/src/executors/__tests__/providers/http.test.ts` | HTTP executor: JSON response parsing, text response, URL validation |
| `sdk/js/src/executors/__tests__/workflow-executor.test.ts` | WorkflowExecutor: phase iteration, step execution, result_handling cascade, callbacks |

### Key test scenarios

- **Cascade resolution**: step.executor > phase_executors > workflow.executor > null
- **Missing API key**: validate() returns error, execute() returns failure
- **API errors**: 401, 429, 500 responses handled gracefully
- **Timeout handling**: Long-running requests
- **Empty/null responses**: Model returns empty content
- **Backward compatibility**: Steps with no executor field use default behavior

---

## 2. Retry Logic with Fallback Executors

### Problem

External API calls can fail due to rate limits (429), server errors (500), or network issues. The current implementation fails immediately.

### Proposed Design

Add retry configuration to `StepExecutorConfig`:

```typescript
export interface StepExecutorConfig {
  // ... existing fields ...
  /** Retry configuration */
  retry?: {
    /** Maximum retry attempts (default: 0 = no retry) */
    max_attempts?: number;
    /** Backoff strategy */
    backoff?: 'fixed' | 'exponential';
    /** Base delay in ms (default: 1000) */
    delay_ms?: number;
    /** Retry on these HTTP status codes (default: [429, 500, 502, 503]) */
    retry_on?: number[];
  };
  /** Fallback executor if primary fails after all retries */
  fallback?: StepExecutorConfig;
}
```

### Workflow YAML Example

```yaml
executor:
  provider: openai
  model: gpt-4o
  retry:
    max_attempts: 3
    backoff: exponential
    delay_ms: 1000
  fallback:
    provider: claude
    model: claude-sonnet-4-6
```

### Implementation

- Add retry loop in each executor's `execute()` method (or as a wrapper/decorator)
- On final failure, check for `fallback` config and dispatch to fallback executor
- Log retry attempts and fallback activations in workflow events

---

## 3. Cost and Latency Tracking

### Problem

Multi-model workflows use different providers with different pricing. Need visibility into per-step and per-workflow costs.

### Proposed Design

The `ExecutorResult.metadata` already has `tokens_used` and `duration_ms`. Add aggregation:

```typescript
export interface WorkflowExecuteResult {
  // ... existing fields ...
  cost_summary?: {
    total_tokens: { input: number; output: number };
    by_provider: Record<string, {
      steps: number;
      tokens: { input: number; output: number };
      total_duration_ms: number;
    }>;
  };
}
```

### Implementation

- `WorkflowExecutor` aggregates cost data as steps complete
- CLI `workflow-execute` command outputs cost summary at the end
- Optionally write cost data to workflow events/state for historical tracking

---

## 4. Plan-Time Executor Validation

### Problem

If a workflow references `provider: openai` but `OPENAI_API_KEY` isn't set, it fails at execution time. Should fail at plan time.

### Proposed Design

The `ExecutorRegistry.validateWorkflow()` method already exists. Wire it into:

1. `cli/src/commands/plan/index.ts` — Validate executor configs when generating plans
2. `plugins/faber/commands/workflow-run.md` — Validate before starting execution
3. `faber workflow-execute` CLI command — Validate before starting

### Implementation

- Call `registry.validateWorkflow()` after loading the plan
- Report all validation errors before starting execution
- Allow `--skip-validation` flag for offline/CI environments

---

## 5. Workflow Schema Validation for Executor Config

### Problem

The JSON schema for workflows (`plugins/faber/config/workflow.schema.json`) accepts the `executor` field but doesn't validate provider-specific requirements (e.g., `base_url` required for `openai-compatible`).

### Proposed Design

Add conditional validation rules to the schema:

```json
{
  "if": { "properties": { "provider": { "const": "openai-compatible" } } },
  "then": { "required": ["base_url", "model"] }
}
```

---

## Acceptance Criteria

- [ ] Unit tests for all executors with >80% coverage
- [ ] Retry logic with configurable backoff
- [ ] Fallback executor support
- [ ] Cost summary in CLI output
- [ ] Plan-time validation of executor configs
- [ ] Schema-level validation of provider-specific requirements
