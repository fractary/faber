# FABER Result Handling Guide

Complete guide to step and hook result handling in FABER workflow.

## Overview

FABER v2.1 introduces **default result handling configuration** for steps and hooks. This allows workflow configurations to be more concise by omitting result_handling when using standard defaults.

FABER v2.2 extends result handling to support **slash command handlers**. Instead of using predefined actions like `"stop"` or `"continue"`, you can specify a slash command (e.g., `/fractary-faber:workflow-debugger`) that is invoked with step context to provide dynamic recovery behavior.

FABER v2.3 adds **cascading result handling** at workflow and phase levels. Define common handlers once instead of repeating them on every step. Configuration cascades: step > phase > workflow > schema defaults.

## Default Configuration

When a step or hook does not specify `result_handling`, these defaults are applied:

### Step Defaults

```json
{
  "on_success": "continue",
  "on_warning": "continue",
  "on_failure": "stop"
}
```

| Field | Default | Options | Description |
|-------|---------|---------|-------------|
| `on_success` | `"continue"` | `continue`, slash command | Proceed automatically to next step |
| `on_warning` | `"continue"` | `continue`, `stop`, slash command | Log warning and proceed, or `stop` to show prompt with options |
| `on_failure` | `"stop"` | `stop`, slash command | Show prompt with options, or use slash command for dynamic recovery |

**Note**: The `stop` option consistently shows an intelligent prompt with options (continue, fix, stop) for both warnings and failures. This provides a unified user experience. Slash commands (e.g., `/fractary-faber:workflow-debugger`) can be used for automated recovery.

### Hook Defaults

```json
{
  "on_success": "continue",
  "on_warning": "continue",
  "on_failure": "stop"
}
```

| Field | Default | Options | Description |
|-------|---------|---------|-------------|
| `on_success` | `"continue"` | `continue` | Proceed automatically |
| `on_warning` | `"continue"` | `continue`, `stop` | Log warning and proceed, or `stop` to show prompt |
| `on_failure` | `"stop"` | `stop`, `continue` | Show prompt with options; `continue` for informational hooks |

**Note**: Unlike steps, hooks CAN set `on_failure: "continue"` for informational hooks that should not block workflow execution.

## Cascading Configuration (v2.3+)

Result handling can be defined at multiple levels, cascading down to steps:

**Precedence (highest to lowest):**
1. **Step-level** - `step.result_handling` (highest priority)
2. **Phase-level** - `phases.build.result_handling`
3. **Workflow-level** - `result_handling` at workflow root
4. **Schema defaults** - `on_success: "continue"`, `on_warning: "continue"`, `on_failure: "stop"`

**SDK Function:** `@fractary/core` → `resolveStepResultHandling(workflow, phaseName, step)`

### Example: Define Handler Once

Instead of repeating the same handler on every step:

```json
{
  "id": "my-workflow",
  "result_handling": {
    "on_failure": "/fractary-faber:workflow-debugger"
  },
  "phases": {
    "build": {
      "enabled": true,
      "result_handling": {
        "on_failure": "/fractary-faber:workflow-debugger --auto-fix"
      },
      "steps": [
        { "id": "implement", "prompt": "Implement solution" },
        { "id": "test", "prompt": "Run tests" }
      ]
    },
    "release": {
      "enabled": true,
      "steps": [
        {
          "id": "deploy",
          "prompt": "Deploy to production",
          "result_handling": { "on_failure": "stop" }
        }
      ]
    }
  }
}
```

**Resolution:**
- `build/implement` → `/fractary-faber:workflow-debugger --auto-fix` (from phase)
- `build/test` → `/fractary-faber:workflow-debugger --auto-fix` (from phase)
- `release/deploy` → `stop` (step override)
- Other release steps → `/fractary-faber:workflow-debugger` (from workflow)

## Result Types

Steps and hooks return a standardized result structure using the **FABER Response Format**.

**Schema Reference**: `plugins/faber/config/schemas/skill-response.schema.json`
**Full Documentation**: `plugins/faber/docs/RESPONSE-FORMAT.md`
**Best Practices**: `docs/standards/SKILL-RESPONSE-BEST-PRACTICES.md`

```json
{
  "status": "success" | "warning" | "failure",
  "message": "Human-readable summary",
  "details": {},
  "errors": [],
  "warnings": [],
  "error_analysis": "Root cause explanation (recommended for failures)",
  "warning_analysis": "Impact assessment (recommended for warnings)",
  "suggested_fixes": ["Actionable fix suggestions"]
}
```

### Status: Success

Step completed successfully without issues.

**Behaviors:**
- `on_success: "continue"` (default) - Proceed to next step automatically

### Status: Warning

Step completed but with warnings that may need attention.

**Behaviors:**
- `on_warning: "continue"` (default) - Log warnings, proceed automatically
- `on_warning: "stop"` - Show intelligent warning prompt with options (continue, fix, stop)

### Status: Failure

Step failed to complete successfully.

**Behaviors:**
- `on_failure: "stop"` (default) - Show intelligent failure prompt with options
- `on_failure: "continue"` (hooks only) - Log failure, proceed anyway

**Note:** The `stop` option consistently shows an intelligent prompt with options for both warnings and failures. This provides a unified experience where stopping always gives the user actionable choices.

## Automatic Issue Comments (v2.4+)

When a step completes with **warning** or **failure** status, FABER automatically posts a comment to the linked GitHub issue (if `work_id` is available). This provides stakeholders with visibility into workflow problems without requiring manual notification.

**This behavior is automatic and independent of `result_handling` configuration.** Whether you use `continue`, `stop`, or a slash command handler, the issue comment is always posted first.

### Warning Comment

When a step returns `status: "warning"`, a comment is posted containing:
- Step name and phase
- Warning messages from the `warnings` array
- Warning analysis (if `warning_analysis` is provided)
- Suggested actions (if `suggested_fixes` is provided)
- Note that the workflow is continuing

### Failure Comment

When a step returns `status: "failure"`, a comment is posted containing:
- Step name and phase
- Error message and errors from the `errors` array
- Error analysis (if `error_analysis` is provided)
- Suggested fixes (if `suggested_fixes` is provided)
- Note that the workflow has encountered a failure

### Example Comment (Failure)

```markdown
## ❌ Workflow Step Failure

**Step:** implement
**Phase:** build
**Status:** Failed

**Error Message:** TypeScript compilation failed

**Errors:**
- TS2307: Cannot find module './utils'
- TS2304: Cannot find name 'UserConfig'

**Analysis:** Missing import statements for utility functions and type definitions.

**Suggested Fixes:**
- Add import statement: `import { helper } from './utils'`
- Add import statement: `import { UserConfig } from './types'`

The workflow has encountered a failure. Please review and take appropriate action.
```

### Disabling Automatic Comments

Automatic issue comments cannot be disabled through configuration. If `work_id` is not available (e.g., running without a linked issue), no comment is posted.

If commenting fails (e.g., network error, permission issue), the failure is logged but does not affect workflow execution.

## Intelligent Prompts

When `on_warning: "stop"` or a failure occurs, FABER displays intelligent prompts with analysis and options.

### Warning Prompt

```
┌─────────────────────────────────────────────────────────────┐
│  ⚠️  STEP WARNING                                           │
├─────────────────────────────────────────────────────────────┤
│  Step: implement                                            │
│  Phase: build                                               │
│  Status: Completed with warnings                            │
├─────────────────────────────────────────────────────────────┤
│  WARNINGS:                                                  │
│    • Deprecated API usage detected                          │
│    • Missing type annotations in 2 functions                │
├─────────────────────────────────────────────────────────────┤
│  ANALYSIS:                                                  │
│  The deprecated API will be removed in v3.0. Consider       │
│  updating to the new API now to avoid future issues.        │
├─────────────────────────────────────────────────────────────┤
│  SUGGESTED ACTIONS:                                         │
│  • Update to new API: Replace callOldAPI() with callNewAPI()│
│  • Add type annotations to exported functions               │
└─────────────────────────────────────────────────────────────┘
```

**Options (in order):**
1. **Ignore and continue** (default) - Acknowledge warnings and proceed
2. **Fix: {suggested_fix}** (if available) - Apply fix and retry
3. **Stop workflow** - Conservative choice to halt

### Failure Prompt

```
┌─────────────────────────────────────────────────────────────┐
│  ❌  STEP FAILURE                                           │
├─────────────────────────────────────────────────────────────┤
│  Step: test                                                 │
│  Phase: evaluate                                            │
│  Status: Failed                                             │
├─────────────────────────────────────────────────────────────┤
│  ERROR:                                                     │
│    5 tests failed in authentication module                  │
├─────────────────────────────────────────────────────────────┤
│  DETAILS:                                                   │
│    • test_login_invalid_credentials: AssertionError         │
│    • test_logout_session_cleanup: TimeoutError              │
│    • test_token_refresh_expired: KeyError                   │
├─────────────────────────────────────────────────────────────┤
│  ANALYSIS & SUGGESTIONS:                                    │
│  The failures appear related to session handling. Check     │
│  that session cleanup properly awaits async operations.     │
│                                                             │
│  Suggested fixes:                                           │
│    • Add await to session.cleanup() call in logout handler  │
│    • Check token expiry calculation in refresh function     │
└─────────────────────────────────────────────────────────────┘
```

**Options (in priority order - NOT RECOMMENDED option is LAST):**
1. **Fix: {suggested_fix}** (if available) - Apply suggested fix
2. **Diagnose: {diagnostic_command}** (if available) - Run diagnostic
3. **Continue anyway (NOT RECOMMENDED)** - Explicitly discouraged
4. **Stop workflow (recommended)** - Default action

## Configuration Examples

### Minimal Configuration (Uses Defaults)

```json
{
  "steps": [
    {
      "name": "implement",
      "description": "Implement solution",
      "prompt": "Implement based on specification"
    },
    {
      "name": "commit",
      "description": "Create commit",
      "skill": "fractary-repo:commit-creator"
    }
  ]
}
```

Both steps use default result_handling: continue on success/warning, stop on failure.

### Prompt on Warning

```json
{
  "steps": [
    {
      "name": "security-scan",
      "description": "Run security scan",
      "skill": "fractary-security:scanner",
      "result_handling": {
        "on_warning": "stop"
      }
    }
  ]
}
```

With `on_warning: "stop"`, warnings display an intelligent prompt with options (continue, fix, stop). Only `on_warning` is customized; `on_success` and `on_failure` use defaults.

### Informational Hook (Continue on Failure)

```json
{
  "hooks": {
    "post_release": [
      {
        "type": "script",
        "name": "notify-team",
        "path": "./scripts/notify.sh",
        "description": "Send team notification",
        "result_handling": {
          "on_failure": "continue"
        }
      }
    ]
  }
}
```

Notification failure doesn't block the workflow.

## Best Practices

### 1. Use Defaults When Possible

```json
// ✅ Good - uses defaults
{
  "name": "implement",
  "description": "Implement solution"
}

// ❌ Verbose - explicitly specifies defaults
{
  "name": "implement",
  "description": "Implement solution",
  "result_handling": {
    "on_success": "continue",
    "on_warning": "continue",
    "on_failure": "stop"
  }
}
```

### 2. Customize Only What You Need

```json
// ✅ Good - only overrides on_warning
{
  "name": "test",
  "result_handling": {
    "on_warning": "stop"
  }
}

// ❌ Verbose - specifies all fields unnecessarily
{
  "name": "test",
  "result_handling": {
    "on_success": "continue",
    "on_warning": "stop",
    "on_failure": "stop"
  }
}
```

### 3. Use Stop for Critical Steps

For steps where warnings might indicate serious issues, use `stop` to show a prompt with options:

```json
{
  "name": "deploy",
  "description": "Deploy to production",
  "result_handling": {
    "on_warning": "stop"
  }
}
```

### 4. Use Continue for Informational Hooks

For hooks that provide optional functionality:

```json
{
  "name": "telemetry",
  "type": "script",
  "path": "./scripts/send-metrics.sh",
  "description": "Send usage metrics",
  "result_handling": {
    "on_failure": "continue"
  }
}
```

## Recovery Tracking

When users interact with failure/warning prompts, their choices are tracked in workflow state:

```json
{
  "failure_recoveries": [
    {
      "step": "build:implement",
      "timestamp": "2025-12-05T10:30:00Z",
      "action": "suggested_fix",
      "outcome": "retry_attempted"
    },
    {
      "step": "evaluate:test",
      "timestamp": "2025-12-05T10:35:00Z",
      "action": "force_continue",
      "acknowledged": true,
      "outcome": "continued_despite_failure"
    }
  ]
}
```

This provides an audit trail of how failures were handled during workflow execution.

## Migration from Explicit Configuration

If your workflow files have explicit result_handling that matches the defaults, you can safely remove them:

**Before:**
```json
{
  "name": "implement",
  "description": "Implement solution",
  "result_handling": {
    "on_success": "continue",
    "on_warning": "continue",
    "on_failure": "stop"
  }
}
```

**After:**
```json
{
  "name": "implement",
  "description": "Implement solution"
}
```

Existing configurations with explicit result_handling will continue to work unchanged (backward compatibility).

## Slash Command Handlers

In addition to predefined actions (`continue`, `stop`), result handlers can invoke **slash commands** for dynamic recovery behavior.

### Detection

If a handler value starts with `/`, it's treated as a slash command to invoke:

```json
{
  "result_handling": {
    "on_failure": "/fractary-faber:workflow-debugger"
  }
}
```

### Configuration Examples

#### Basic Recovery Handler

```json
{
  "id": "implement",
  "name": "Implement solution",
  "prompt": "Implement based on specification",
  "result_handling": {
    "on_failure": "/fractary-faber:workflow-debugger"
  }
}
```

On failure, the workflow-debugger is invoked to diagnose the issue and propose a recovery plan.

#### Auto-Fix for Trusted Workflows

```json
{
  "result_handling": {
    "on_failure": "/fractary-faber:workflow-debugger --auto-fix"
  }
}
```

With `--auto-fix`, high-confidence fixes are applied automatically without user approval.

#### Auto-Fix with Learning

```json
{
  "result_handling": {
    "on_failure": "/fractary-faber:workflow-debugger --auto-fix --auto-learn"
  }
}
```

Successful resolutions are automatically logged to the knowledge base for future reference.

#### Escalation After Retries

```json
{
  "result_handling": {
    "on_failure": "/fractary-faber:workflow-debugger --escalate --max-retries 3"
  }
}
```

If the issue persists after 3 retries, a GitHub issue is created with full diagnostic context.

### Context Injection

When a slash command handler is invoked, the workflow manager automatically injects **step context**:

```json
{
  "work_id": "ISSUE-123",
  "run_id": "run_abc123",
  "phase": "build",
  "step_id": "implement",
  "step_name": "Implement solution",
  "agent": "software-engineer",
  "status": "failure",
  "error": "TypeScript compilation failed",
  "errors": ["TS2307: Cannot find module './utils'"],
  "output": {},
  "retry_count": 0,
  "max_retries": 3,
  "workflow_id": "default",
  "timestamp": "2026-01-28T10:30:00Z"
}
```

**Security Note:** Context is passed via `--step-context-file` parameter (path to a JSON file) rather than inline JSON arguments. This prevents command injection vulnerabilities from malicious content in error messages or step outputs. The handler reads the context from the file path provided.

### Recovery Plans

Slash command handlers can return a **recovery plan** to modify workflow execution:

```json
{
  "recovery_plan": {
    "action": "goto_step",
    "target_phase": "build",
    "target_step": "implement",
    "modifications": [
      {
        "file": "src/index.ts",
        "description": "Fix import statement"
      }
    ],
    "rationale": "Missing import caused compilation error",
    "requires_approval": true
  }
}
```

#### Recovery Actions

| Action | Description |
|--------|-------------|
| `goto_step` | Resume workflow from a specific step (can go backwards to earlier phases) |
| `retry` | Retry the current step immediately (respects `max_retries` limit) |
| `stop` | Stop workflow - manual intervention required |

### User Approval

By default (`requires_approval: true`), the user is prompted before applying a recovery plan:

```
Recovery plan proposed for step failure:

Action: goto_step
Target: build/implement
Rationale: Missing import caused compilation error

Proposed modifications:
  - src/index.ts: Fix import statement

Apply this recovery plan?
  [1] Apply recovery plan (Recommended)
  [2] Stop workflow
```

With `--auto-fix` flag, high-confidence fixes bypass the approval prompt.

### Backward Compatibility

- Existing string values (`continue`, `stop`) work unchanged
- Slash commands are an additive feature - no migration required
- `on_failure: "stop"` remains the default behavior

## See Also

- [configuration.md](./configuration.md) - Complete configuration guide
- [STATE-TRACKING.md](./STATE-TRACKING.md) - Workflow state tracking
- [workflow-debugger.md](../agents/workflow-debugger.md) - Recovery handler agent
- Schema: `plugins/faber/config/workflow.schema.json`
