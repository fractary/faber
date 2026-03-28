---
title: SPEC - Phase 9 - CLI-Native Orchestration Enhancements (State Management, Claude CLI Integration, Batch Support)
description: Production-grade CLI-native workflow execution - state persistence, claude CLI integration for tool-access steps, and batch execution support
tags: [spec, faber, multi-model, executors, cli, orchestration, state]
created: 2026-03-25
updated: 2026-03-25
fractary_doc_type: specification
visibility: internal
status: proposed
---

# Phase 9: CLI-Native Orchestration Enhancements

**Status**: Proposed (extends initial multi-model executor implementation)
**Depends on**: `WorkflowExecutor` class in `sdk/js/src/executors/workflow-executor.ts`
**Priority**: High — needed to make `faber workflow-execute` production-ready

---

## Background

The initial implementation added `faber workflow-execute <plan.json>` which uses the `WorkflowExecutor` class to iterate through steps deterministically and dispatch to executors. This spec covers the gaps between the current minimal implementation and production readiness.

---

## 1. State Management Integration

### Problem

The `WorkflowExecutor` doesn't currently persist state. If execution is interrupted, there's no way to resume.

### Proposed Design

Wire the existing `StateManager` (from `sdk/js/src/state/`) into `WorkflowExecutor`:

- Create a run state file at the start of execution
- Update step status (pending → in_progress → completed/failed) as execution progresses
- Emit workflow events (step_start, step_complete, phase_start, etc.)
- Support `--resume <run-id>` to resume from last completed step

### Implementation

```typescript
export class WorkflowExecutor {
  constructor(
    private registry: ExecutorRegistry,
    private stateManager?: StateManager,  // Optional for backward compat
  ) {}
}
```

- Before each step: update state to `in_progress`, emit `step_start`
- After each step: update state to `completed`/`failed`, emit `step_complete`
- On interruption: state shows exactly which steps completed

---

## 2. Claude CLI Integration for Tool-Access Steps

### Problem

Steps whose prompts are slash commands (e.g., `/fractary-repo:commit-push-pr`) or that require Claude Code tools (Read, Write, Bash) cannot be executed by a simple API call. They need the full Claude Code environment.

### Proposed Design

When the `WorkflowExecutor` encounters a step that requires Claude Code (no executor specified and prompt starts with `/` or requires tools), invoke the `claude` CLI:

```typescript
private async executeViaClaude(step: WorkflowStep, context: ExecutionContext): Promise<ExecutorResult> {
  // Invoke: claude --prompt "<step.prompt>" --cwd <context.workingDirectory>
  // Parse output
  // Return as ExecutorResult
}
```

### When to use Claude CLI vs API

| Step characteristics | Execution method |
|---------------------|------------------|
| Has `executor` field | Use specified executor (API call) |
| Prompt starts with `/` | Requires Claude Code → invoke `claude` CLI |
| Prompt mentions tools (Read, Write, Bash) | Requires Claude Code → invoke `claude` CLI |
| Plain text prompt, no executor | Use default executor (Claude API or claude CLI based on config) |

### Configuration

Add a `default_execution_mode` to workflow config:

```yaml
executor:
  provider: claude
  model: claude-sonnet-4-6
  # How to handle steps without an explicit executor:
  # 'api' = call Anthropic Messages API (no tool access)
  # 'cli' = invoke claude CLI (full tool access, slower)
  default_mode: api
```

---

## 3. Batch Execution Support

### Problem

The current `faber workflow-execute` only handles a single plan. Need to support batch execution (multiple plans, sequential or parallel).

### Proposed Design

```bash
# Execute a batch
faber workflow-execute --batch <batch-dir>

# Execute in parallel (up to N concurrent)
faber workflow-execute --batch <batch-dir> --parallel --max-concurrent 3
```

### Implementation

- Read all `plan.json` files from the batch directory
- Execute sequentially (default) or spawn concurrent Node.js workers
- Aggregate results across all plans
- Support `--resume` for batch interruption recovery

---

## 4. Event Streaming and Progress Reporting

### Problem

Long-running CLI executions need real-time progress reporting beyond console.log.

### Proposed Design

Support event streaming via:
- **Console** (default): Pretty-printed progress with timing
- **JSON Lines**: Machine-readable event stream for CI/CD pipelines
- **Webhook**: POST events to an external URL for monitoring

```bash
faber workflow-execute plan.json --events jsonl
faber workflow-execute plan.json --events webhook --webhook-url https://...
```

---

## Acceptance Criteria

- [ ] State persistence across interruptions with `--resume`
- [ ] Claude CLI integration for tool-access steps
- [ ] Automatic detection of steps requiring Claude Code vs API-only
- [ ] Batch execution with sequential and parallel modes
- [ ] Event streaming in JSON Lines format
- [ ] Cost summary aggregation across batch
