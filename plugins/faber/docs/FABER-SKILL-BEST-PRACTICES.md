# FABER Skill Best Practices

Guidelines for building and using FABER workflow skills effectively.

## Overview

FABER skills orchestrate workflow execution across phases (Frame → Architect → Build → Evaluate → Release). This guide covers best practices for response handling, error recovery, and integration.

For everything core expects from a pack (runtime contract, validators, approvals, permissions, conformance checklist), see [PACK-BEST-PRACTICES.md](./PACK-BEST-PRACTICES.md).

## Skill Response Format

All FABER skills MUST return responses using the **standard FABER response format**.

In CLI runs (`fractary-faber workflow-execute`), the response block decides the step's result:

- **The block comes last.** The runtime reads the last JSON object with a `status` field in the step's output. Print nothing after the block that has a `status` field.
- **Pass a subagent's block through.** A skill that delegates to a subagent ends with the subagent's block, verbatim. A prose summary in its place loses the result, and the step is recorded as a warning (`no_response_block`).
- **Validators set `role: validator`** on their workflow step. A validator step without a valid block fails instead of warning.

### Required Fields

| Field | Type | Description |
|-------|------|-------------|
| `status` | enum | `"success"`, `"warning"`, or `"failure"` |
| `message` | string | Human-readable summary (1-2 sentences) |

### Recommended Fields

| Field | Type | When to Include |
|-------|------|-----------------|
| `details` | object | Always - operation-specific data |
| `errors` | string[] | When status is `"failure"` |
| `warnings` | string[] | When status is `"warning"` |
| `error_analysis` | string | When status is `"failure"` - root cause |
| `warning_analysis` | string | When status is `"warning"` - impact |
| `suggested_fixes` | string[] | When issue is recoverable |

### References

- **Schema**: `plugins/faber/config/schemas/skill-response.schema.json`
- **Documentation**: `plugins/faber/docs/RESPONSE-FORMAT.md`

## Response Status Values

### Success
- Goal fully achieved
- No issues encountered
- Workflow proceeds automatically (default behavior)

```json
{
  "status": "success",
  "message": "Branch 'feat/123-add-export' created successfully",
  "details": {
    "branch_name": "feat/123-add-export",
    "base_branch": "main"
  }
}
```

### Warning
- Goal achieved but with concerns
- Non-blocking issues detected
- Workflow may prompt user depending on configuration

```json
{
  "status": "warning",
  "message": "Spec generated with incomplete issue data",
  "details": {
    "spec_path": "/specs/WORK-00123.md",
    "completeness_score": 0.75
  },
  "warnings": [
    "Issue description is empty",
    "No acceptance criteria defined"
  ],
  "warning_analysis": "Spec may be incomplete due to sparse issue data",
  "suggested_fixes": [
    "Add description to issue #123",
    "Review and complete spec sections manually"
  ]
}
```

### Failure
- Goal NOT achieved
- Critical error occurred
- The step's `on_failure` decides what happens next; the default, `stop`, stops the workflow

```json
{
  "status": "failure",
  "message": "Tests failed - 5 of 47 tests failed",
  "details": {
    "total_tests": 47,
    "passed": 42,
    "failed": 5
  },
  "errors": [
    "test_login: AssertionError",
    "test_logout: TimeoutError",
    "test_token_refresh: KeyError"
  ],
  "error_analysis": "Auth module tests failing due to session handling issues",
  "suggested_fixes": [
    "Add await to session.cleanup() in logout handler",
    "Check token refresh expiry calculation"
  ]
}
```

## Result Handling Configuration

Steps can configure how different result statuses are handled.

### Default Behavior

```json
{
  "on_success": "continue",   // Proceed automatically
  "on_warning": "continue",   // Log warning, proceed
  "on_failure": "stop"        // Stop the workflow
}
```

`on_failure` can also be `retry` or a slash-command handler such as `/fractary-faber-workflow-debug`. In CLI runs, a failed step never lets the run continue silently. See [RESULT-HANDLING.md](./RESULT-HANDLING.md) for what each value does.

### Custom Configurations

**Prompt on Warning** (recommended for critical steps):
```json
{
  "result_handling": {
    "on_warning": "stop"
  }
}
```

With `on_warning: "stop"`, warnings display an intelligent prompt with options (continue, fix, stop). This is recommended for critical steps where warnings should be reviewed.

## Validation Tooling

### Validate Individual Responses

```bash
# Quick format check
./plugins/faber/skills/fractary-faber-response-validator/scripts/check-format.sh \
  '{"status":"success","message":"Done"}'

# Full schema validation
./plugins/faber/skills/fractary-faber-response-validator/scripts/validate-response.sh \
  '{"status":"success","message":"Done"}'
```

## Skill Implementation Guidelines

### 1. Always Validate Responses

Before processing a skill's response, validate its structure:

```
IF result is null OR result.status not in ["success", "warning", "failure"] THEN
  Treat as failure with appropriate error message
```

### 2. Include Rich Error Context

When returning failures, provide actionable information:

```json
{
  "status": "failure",
  "message": "Brief summary",
  "errors": ["Specific error 1", "Specific error 2"],
  "error_analysis": "Why this happened and what it means",
  "suggested_fixes": ["What the user can do to fix it"]
}
```

### 3. Differentiate Warnings from Failures

- **Warning**: Goal achieved but not perfectly
- **Failure**: Goal NOT achieved

Don't use warning when the operation actually failed.

### 4. Use Structured Details

Put operation-specific data in `details`, not at the root level:

```json
// ✅ Correct
{
  "status": "success",
  "message": "PR created",
  "details": {
    "pr_number": 123,
    "pr_url": "https://..."
  }
}

// ❌ Wrong
{
  "status": "success",
  "message": "PR created",
  "pr_number": 123,
  "pr_url": "https://..."
}
```

### 5. Keep Messages Concise

- 1-2 sentences maximum
- Focus on "what happened"
- Avoid technical IDs and timestamps in message
- Use active voice

```json
// ✅ Good
"message": "Branch created successfully"

// ❌ Bad
"message": "Operation completed at 2025-12-05T10:30:00Z with exit code 0"
```

## Error Pattern Handling

Common error patterns and suggested responses:

| Pattern | Analysis | Suggested Fix |
|---------|----------|---------------|
| `ENOENT` | File or directory not found | Create the missing file or check path |
| `ECONNREFUSED` | Service unavailable | Check if service is running |
| `401 Unauthorized` | Auth failure | Run `gh auth login` or check token |
| `test.*failed` | Test failure | Review failing tests, fix implementation |
| `merge conflict` | Git conflict | Resolve conflicts, then retry |

## Logging and Audit

A CLI run records each step's result in the run's state file:

```json
{
  "phases": {
    "build": {
      "retry_count": 1,
      "steps": {
        "implement": {
          "status": "completed",
          "result": "success",
          "attempts": 2,
          "duration_ms": 84213
        }
      }
    }
  }
}
```

When `on_failure: retry` or a handler decides what happens after a failure, the decision is recorded too:

```json
{
  "failure_recoveries": [
    {
      "step": "build:implement",
      "attempt": 1,
      "action": "retry",
      "reason": "on_failure is retry, retry 1 of 2",
      "timestamp": "2026-10-10T10:30:00Z"
    }
  ]
}
```

## Migration Checklist

For existing skills that need updating:

- [ ] Replace `success: true/false` with `status: "success"/"failure"`
- [ ] Add `message` field with human-readable summary
- [ ] Move operation data into `details` object
- [ ] Replace single `error` with `errors` array
- [ ] Add `error_analysis` for failure cases
- [ ] Add `suggested_fixes` for recoverable issues
- [ ] Remove deprecated fields (`error_code`, `result`, etc.)
- [ ] Make the response block the last JSON object in the output
- [ ] Test with response-validator skill
- [ ] Update skill documentation

## See Also

- [PACK-BEST-PRACTICES.md](./PACK-BEST-PRACTICES.md) - What core expects from a pack
- [RESPONSE-FORMAT.md](./RESPONSE-FORMAT.md) - Complete response schema
- [RESULT-HANDLING.md](./RESULT-HANDLING.md) - Result handling configuration
- [WORKFLOW-STEP-REFERENCE.md](./WORKFLOW-STEP-REFERENCE.md) - Workflow fields CLI runs read
