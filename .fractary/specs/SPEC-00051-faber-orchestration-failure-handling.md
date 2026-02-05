# SPEC-00051: FABER Orchestration Failure Handler Invocation

## Metadata

| Field | Value |
|-------|-------|
| **Status** | Draft |
| **Priority** | Critical |
| **Created** | 2026-02-05 |
| **Author** | Claude Code |
| **Affects** | fractary-faber plugin (all projects) |
| **Related** | SPEC-00048, Issue #137 |
| **Estimated Effort** | 24 hours |

## Summary

Critical bug in the FABER workflow orchestration system where custom failure handlers (command strings) defined in `on_failure` properties are not being invoked when steps fail. Instead of executing the configured handler, the orchestrator improvises fixes and incorrectly marks failing steps as successful.

## Problem Statement

### Evidence from Run `corthosai-etl.corthion.ai-ipeds-hd-20260205T143408`

During execution of the `dataset-create` workflow for issue #137, the orchestrator failed to properly handle a step failure:

**Step Configuration (from plan.json):**
```json
{
  "id": "build-engineer-validate",
  "name": "Validate Engineer Work",
  "description": "Validate engineer's work before deployment...",
  "prompt": "/fractary-faber-code:engineer-validate --work-id {work_id}",
  "result_handling": {
    "on_failure": "/fractary-faber:workflow-debugger --work-id {work_id} --run-id {run_id} --problem \"{error}\" --auto-fix"
  }
}
```

**What Should Have Happened:**
1. Step `build-engineer-validate` executes and returns FAILURE status
2. Orchestrator detects failure and reads `on_failure` handler
3. Orchestrator recognizes it's a command string (starts with `/`)
4. Orchestrator substitutes variables (`{work_id}`, `{run_id}`, `{error}`)
5. Orchestrator invokes `/fractary-faber:workflow-debugger ...` via Skill tool
6. Based on debugger result:
   - If remediation succeeds → re-run `build-engineer-validate`
   - If remediation fails → stop workflow with "remediation_failed" status

**What Actually Happened:**
1. Step `build-engineer-validate` detected issues (implied failure condition)
2. Orchestrator did NOT invoke the `on_failure` handler
3. Orchestrator improvised its own fixes to the code
4. Orchestrator marked the step as "success" with message "Engineering validation passed after fixes"

**State File Evidence (state-2026-02-05T14-43-00Z.json):**
```json
{
  "step_id": "build-engineer-validate",
  "phase": "build",
  "status": "success",
  "message": "Engineering validation passed after fixes",
  "completed_at": "2026-02-05T15:50:00Z"
}
```

### Impact

1. **Reliability Violation**: Custom failure handlers exist for a reason - to invoke specialized debugging/remediation agents. When ignored, the workflow loses its self-healing capability.

2. **Protocol Violation**: The orchestrator violated CRITICAL_RULE #8 from SPEC-00048 which states "ALWAYS stop on failure - NO exceptions, NO workarounds" and "NEVER improvise solutions when something fails."

3. **Data Integrity Risk**: Improvised fixes may not align with project standards or may introduce subtle bugs that proper remediation handlers would catch.

4. **Debugging Opacity**: When handlers aren't invoked, there's no audit trail of remediation attempts, making it harder to diagnose systematic issues.

## Root Cause Analysis

### Gap Between Protocol Documentation and Actual Usage

**SPEC-00048 documents `on_failure` as:**
```json
{
  "on_failure": {
    "const": "stop",
    "description": "Failure ALWAYS stops - immutable, not configurable"
  }
}
```

**But actual workflow plans use `on_failure` as command strings:**
```json
{
  "on_failure": "/fractary-faber:workflow-debugger --work-id {work_id} --run-id {run_id} --problem \"{error}\" --auto-fix"
}
```

This is a fundamental mismatch:
- The spec defines `on_failure` as a keyword-only field
- The workflow plans define `on_failure` as a remediation command
- The orchestrator doesn't recognize or handle command strings in `on_failure`

### Missing Handler Type Detection

The orchestrator has no logic to:
1. Detect whether `on_failure` is a keyword ("stop", "continue", "retry") or a command string
2. Parse and substitute variables in command strings
3. Invoke command handlers via the Skill tool
4. Track remediation state and results

## Protocol Violations

### CRITICAL_RULE #8 Violations (from SPEC-00048)

| Rule | Violation |
|------|-----------|
| "ALWAYS stop on failure - NO exceptions, NO workarounds" | Orchestrator continued and improvised instead of stopping |
| "NEVER improvise solutions when something fails" | Orchestrator made its own fixes instead of invoking handler |
| "ALWAYS report the failure clearly" | Failure was masked as success |
| "ALWAYS update state to record the failed step before stopping" | State shows "success" not "failure" |

### Result Handling Flow Violation

Expected flow (from SPEC-00048 Section 1.6):
```
IF result.status == "failure" THEN
  IF hook.result_handling.on_failure == "stop" THEN
    Update state to "failed"
    Report failure with resume instructions
    STOP WORKFLOW
```

The orchestrator did NOT:
- Update state to "failed"
- Report failure with resume instructions
- Stop workflow

## Requirements

### R1: Handler Type Detection

The orchestrator MUST detect the type of `on_failure` handler:

| Handler Type | Detection Pattern | Example |
|--------------|-------------------|---------|
| Keyword | Exact match: "stop", "continue", "retry" | `"on_failure": "stop"` |
| Command | Starts with `/` | `"on_failure": "/fractary-faber:workflow-debugger ..."` |
| Structured | Object with `command` property | `"on_failure": {"command": "/cmd", "args": {...}}` |

### R2: Variable Substitution

When invoking command handlers, substitute these variables:

| Variable | Source | Description |
|----------|--------|-------------|
| `{work_id}` | Execution context | Current work item ID (e.g., "137") |
| `{run_id}` | State file | Current workflow run ID |
| `{error}` | Step result | Error message from failed step |
| `{step_id}` | Current step | Step identifier (e.g., "build-engineer-validate") |
| `{phase}` | Current phase | Phase name (e.g., "build") |
| `{dataset}` | Work item context | Dataset identifier |
| `{table}` | Work item context | Table identifier |
| `{version}` | Work item context | Version string |

### R3: Handler Execution Flow

```
1. Step completes → evaluate result
2. If result.status == "failure":
   a. Get on_failure from step.result_handling
   b. If not defined → default to "stop"
   c. Determine handler type:
      - If keyword → execute keyword behavior
      - If command string → continue to step d
      - If structured object → parse and continue to step d
   d. Substitute variables in command
   e. Update state to "remediating"
   f. Invoke command via Skill tool
   g. Based on handler result:
      - If handler returns success → set step to "retrying", re-run original step
      - If handler returns failure → set step to "remediation_failed", stop workflow
```

### R4: State Transitions

New valid states for step status:

| Status | Description |
|--------|-------------|
| `pending` | Not yet started |
| `in_progress` | Currently executing |
| `success` | Completed successfully |
| `failure` | Failed, no handler or handler = "stop" |
| `remediating` | Failure handler is executing |
| `retrying` | Handler succeeded, re-running step |
| `remediation_failed` | Handler failed to fix the issue |

### R5: Audit Trail

When a handler is invoked, create an event record:

```json
{
  "event_type": "step_handler_invoked",
  "timestamp": "2026-02-05T15:46:00Z",
  "step_id": "build-engineer-validate",
  "phase": "build",
  "original_status": "failure",
  "handler_type": "command",
  "handler_command": "/fractary-faber:workflow-debugger --work-id 137 --run-id corthosai-etl.corthion.ai-ipeds-hd-20260205T143408 --problem \"validation failed: missing field\" --auto-fix",
  "handler_result": {
    "status": "success",
    "message": "Issue fixed: added missing field definition",
    "action_taken": "retry_step"
  }
}
```

## Proposed Solution

### Schema Changes

#### workflow.schema.json - Update `result_handling.on_failure`

Current (from SPEC-00048):
```json
{
  "on_failure": {
    "const": "stop",
    "description": "Failure ALWAYS stops - immutable, not configurable"
  }
}
```

Proposed:
```json
{
  "on_failure": {
    "oneOf": [
      {
        "type": "string",
        "enum": ["stop", "continue", "retry"],
        "description": "Keyword handler"
      },
      {
        "type": "string",
        "pattern": "^/",
        "description": "Command string handler (skill invocation)"
      },
      {
        "type": "object",
        "properties": {
          "command": {
            "type": "string",
            "pattern": "^/",
            "description": "Command to invoke"
          },
          "args": {
            "type": "object",
            "description": "Additional arguments"
          },
          "retry_on_success": {
            "type": "boolean",
            "default": true,
            "description": "Whether to retry the step if handler succeeds"
          },
          "max_retries": {
            "type": "integer",
            "default": 1,
            "description": "Maximum handler invocation attempts"
          }
        },
        "required": ["command"]
      }
    ],
    "default": "stop",
    "description": "Handler for step failure - keyword, command, or structured object"
  }
}
```

#### state.schema.json - Add Remediation States

```json
{
  "step_status": {
    "type": "string",
    "enum": [
      "pending",
      "in_progress",
      "success",
      "failure",
      "remediating",
      "retrying",
      "remediation_failed"
    ]
  },
  "step_remediation": {
    "type": "object",
    "properties": {
      "handler_type": { "type": "string" },
      "handler_command": { "type": "string" },
      "handler_invoked_at": { "type": "string", "format": "date-time" },
      "handler_result": {
        "type": "object",
        "properties": {
          "status": { "type": "string" },
          "message": { "type": "string" }
        }
      },
      "retry_count": { "type": "integer" },
      "max_retries": { "type": "integer" }
    }
  }
}
```

### Implementation Changes

#### faber-manager.md - Add Handler Execution Logic

Add new section after "Step Execution Flow":

```markdown
### 4.4 Failure Handler Execution

When a step returns `status: "failure"`, execute the failure handler:

1. **Get Handler Configuration**
   ```
   handler = step.result_handling.on_failure || "stop"
   ```

2. **Determine Handler Type**
   ```
   IF handler is string AND handler in ["stop", "continue", "retry"] THEN
     handler_type = "keyword"
   ELSE IF handler is string AND handler starts with "/" THEN
     handler_type = "command"
   ELSE IF handler is object AND handler.command exists THEN
     handler_type = "structured"
   ELSE
     handler_type = "keyword"
     handler = "stop"  // Invalid handler defaults to stop
   ```

3. **Execute Keyword Handler**
   ```
   IF handler_type == "keyword" THEN
     IF handler == "stop" THEN
       Update state to "failure"
       Report failure with resume instructions
       STOP WORKFLOW
     ELSE IF handler == "continue" THEN
       Log warning and continue to next step
     ELSE IF handler == "retry" THEN
       IF retry_count < max_retries THEN
         Increment retry_count
         Re-run step
       ELSE
         Update state to "failure"
         STOP WORKFLOW
   ```

4. **Execute Command Handler**
   ```
   IF handler_type in ["command", "structured"] THEN
     // Get command string
     command = handler (if string) OR handler.command (if object)

     // Substitute variables
     command = substitute_variables(command, context)

     // Update state
     Update step status to "remediating"

     // Invoke handler
     result = invoke_skill(command)

     // Record event
     emit "step_handler_invoked" event

     // Handle result
     IF result.status == "success" THEN
       Update step status to "retrying"
       Re-run original step
     ELSE
       Update step status to "remediation_failed"
       Report failure with handler details
       STOP WORKFLOW
   ```

5. **Variable Substitution**
   ```
   FUNCTION substitute_variables(command, context):
     replacements = {
       "{work_id}": context.work_id,
       "{run_id}": context.run_id,
       "{error}": escape_for_shell(step_result.error_message),
       "{step_id}": current_step.id,
       "{phase}": current_phase.name,
       "{dataset}": context.dataset,
       "{table}": context.table,
       "{version}": context.version
     }
     FOR each key, value in replacements:
       command = command.replace(key, value)
     RETURN command
   ```
```

#### faber-state.md - Add Remediation State Operations

```markdown
### update-step-remediation

Updates step with remediation tracking information.

**Parameters:**
- `run_id`: Workflow run ID
- `step_id`: Step identifier
- `remediation`: Remediation object with handler details

**Example:**
```json
{
  "step_id": "build-engineer-validate",
  "status": "remediating",
  "remediation": {
    "handler_type": "command",
    "handler_command": "/fractary-faber:workflow-debugger ...",
    "handler_invoked_at": "2026-02-05T15:46:00Z",
    "retry_count": 1,
    "max_retries": 1
  }
}
```
```

### Files to Modify

| File | Change |
|------|--------|
| `plugins/faber/schemas/workflow.schema.json` | Update `on_failure` to support command strings |
| `plugins/faber/schemas/state.schema.json` | Add remediation states and tracking |
| `plugins/faber/agents/faber-manager.md` | Add Section 4.4 for handler execution |
| `plugins/faber/skills/faber-state.md` | Add `update-step-remediation` operation |

## Test Cases

### TC1: Keyword Handler - Stop (Default)

**Setup:**
```json
{
  "id": "test-step",
  "result_handling": { "on_failure": "stop" }
}
```

**Input:** Step returns `{ "status": "failure", "message": "Test failure" }`

**Expected:**
- State updated to `failure`
- Workflow stops
- Resume instructions displayed

### TC2: Command Handler - Successful Remediation

**Setup:**
```json
{
  "id": "test-step",
  "result_handling": {
    "on_failure": "/test:remediation-skill --problem \"{error}\""
  }
}
```

**Input:** Step returns `{ "status": "failure", "message": "Missing config" }`

**Expected:**
1. State updated to `remediating`
2. Skill invoked: `/test:remediation-skill --problem "Missing config"`
3. Handler returns `{ "status": "success" }`
4. State updated to `retrying`
5. Original step re-executed
6. Event recorded with handler details

### TC3: Command Handler - Failed Remediation

**Setup:** Same as TC2

**Input:**
- Step returns `{ "status": "failure", "message": "Missing config" }`
- Handler returns `{ "status": "failure", "message": "Cannot auto-fix" }`

**Expected:**
1. State updated to `remediating`
2. Skill invoked
3. Handler fails
4. State updated to `remediation_failed`
5. Workflow stops
6. Error message includes both original failure and handler failure

### TC4: Structured Handler with Max Retries

**Setup:**
```json
{
  "id": "test-step",
  "result_handling": {
    "on_failure": {
      "command": "/test:retry-skill",
      "max_retries": 3,
      "retry_on_success": true
    }
  }
}
```

**Input:** Step fails repeatedly, handler succeeds each time

**Expected:**
- Handler invoked up to 3 times
- After 3rd handler success, if step still fails → `remediation_failed`

### TC5: Variable Substitution

**Setup:**
```json
{
  "on_failure": "/debug --work-id {work_id} --step {step_id} --error \"{error}\""
}
```

**Context:**
- work_id: "137"
- step_id: "build-validate"
- error: "Field 'name' is required"

**Expected Command:**
```
/debug --work-id 137 --step build-validate --error "Field 'name' is required"
```

### TC6: Invalid Handler Defaults to Stop

**Setup:**
```json
{
  "on_failure": "invalid_value"
}
```

**Expected:**
- Treated as `"stop"`
- Warning logged about invalid handler value

## Acceptance Criteria

- [ ] Keyword handlers ("stop", "continue", "retry") work as documented in SPEC-00048
- [ ] Command string handlers (starting with `/`) are detected and invoked
- [ ] Structured object handlers are detected and invoked
- [ ] Variable substitution works for all defined variables
- [ ] State correctly tracks remediation status transitions
- [ ] Event records are created for handler invocations
- [ ] Handler failure properly stops workflow with clear error message
- [ ] Handler success triggers step retry
- [ ] Invalid handlers default to "stop" with warning
- [ ] All test cases pass
- [ ] Backwards compatible with workflows not using handlers

## Migration Notes

### For Existing Workflows

Workflows using `on_failure: "stop"` (the documented pattern) will continue to work unchanged.

Workflows already using command strings in `on_failure` (like the `dataset-create` workflow) will now work correctly once this fix is implemented.

### Breaking Changes

None - this is additive functionality that makes previously-ignored configuration work correctly.

## References

- SPEC-00048: FABER Workflow Reliability Enhancements
- Issue #137: faber-workflow:dataset-create:ipeds/hd
- Run ID: `corthosai-etl.corthion.ai-ipeds-hd-20260205T143408`
- State File: `state-2026-02-05T14-43-00Z.json`
- Plan File: `plan.json`
