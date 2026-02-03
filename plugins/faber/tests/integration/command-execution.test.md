# Command Execution via Skill Tool Integration Tests

This document defines integration test scenarios for validating that FABER workflow steps with `command` fields are correctly executed via the Skill tool.

## Background

Issue #91 identified that workflow steps using `command` fields were incorrectly attempting to map commands to agents via Task tool, resulting in "Agent type not found" errors. The fix changes command execution to use Skill tool, which is the correct invocation method for slash commands.

## Test Categories

1. **Skill Tool Invocation Tests** - Verify commands are invoked via Skill tool (not Task tool)
2. **Argument Passing Tests** - Verify context is correctly passed to commands
3. **Response Handling Tests** - Verify command responses are properly captured

---

## Test 1: Command Invoked via Skill Tool

**Scenario**: Workflow step with `command` field invokes the command via Skill tool

**Setup**:
```yaml
# Workflow step configuration
step:
  id: "test-step"
  name: "Test Command Execution"
  command: "fractary-faber:workflow-inspect"
```

**Expected Behavior**:
- Step execution uses Skill tool (not Task tool)
- Command is invoked as `/fractary-faber:workflow-inspect`
- Command receives context via args parameter
- Event log shows "command_invoked" with "via Skill tool" message

**Verification**:
```bash
# Check event log for correct invocation method
grep "via Skill tool" plugins/faber/runs/{run_id}/events/*.json

# Expected: Event with type "command_invoked" and message containing "via Skill tool"
```

---

## Test 2: Command Without Leading Slash

**Scenario**: Workflow step specifies command without leading slash

**Setup**:
```yaml
step:
  id: "test-step"
  name: "Test Command Normalization"
  command: "fractary-faber:workflow-inspect"  # No leading slash
```

**Expected Behavior**:
- Executor normalizes command by adding leading slash
- Skill tool receives `/fractary-faber:workflow-inspect`
- Command executes successfully

**Verification**:
```bash
# Event log should show normalized command with slash
grep "command_name" plugins/faber/runs/{run_id}/events/*.json

# Expected: command_name shows original (without slash), message shows normalized (with slash)
```

---

## Test 3: Command With Leading Slash

**Scenario**: Workflow step specifies command with leading slash

**Setup**:
```yaml
step:
  id: "test-step"
  name: "Test Command With Slash"
  command: "/fractary-faber:workflow-inspect"  # Has leading slash
```

**Expected Behavior**:
- Executor does not double the slash
- Skill tool receives `/fractary-faber:workflow-inspect`
- Command executes successfully

---

## Test 4: Argument Passing - Standard Context

**Scenario**: Workflow step passes standard FABER context to command

**Setup**:
```yaml
step:
  id: "test-step"
  name: "Test Argument Passing"
  command: "fractary-faber:workflow-inspect"
  config:
    verbose: true
    format: "json"

# Execution context
target: "123"
work_id: "work-456"
run_id: "run-789"
```

**Expected Behavior**:
- Command receives args string: `123 --work-id work-456 --run-id run-789 --config '{"verbose":true,"format":"json"}'`
- All standard arguments are present
- Config is JSON-stringified

**Verification**:
```bash
# Inspect event log for argument details
jq '.args' plugins/faber/runs/{run_id}/events/*command_invoked*.json

# Expected: Contains target, --work-id, --run-id, --config
```

---

## Test 5: Argument Passing - With Instructions

**Scenario**: Workflow step includes additional_instructions for AI-driven commands

**Setup**:
```yaml
step:
  id: "ai-step"
  name: "AI-Driven Command"
  command: "fractary-faber:workflow-create"
  additional_instructions: "Focus on error handling patterns"
```

**Expected Behavior**:
- Args include `--instructions 'Focus on error handling patterns'`
- Command can use instructions for AI-driven decisions

---

## Test 6: Response Capture - Success

**Scenario**: Command returns success response, workflow captures it

**Setup**:
```yaml
step:
  id: "success-step"
  name: "Test Success Response"
  command: "fractary-faber:workflow-inspect"
```

**Expected Response from Command**:
```json
{
  "status": "success",
  "message": "Workflow inspection complete",
  "details": { "workflow_name": "test-workflow" }
}
```

**Expected Behavior**:
- Step result equals command response
- Workflow proceeds to next step
- No errors logged

---

## Test 7: Response Capture - Failure

**Scenario**: Command returns failure response, workflow handles appropriately

**Setup**:
```yaml
step:
  id: "failure-step"
  name: "Test Failure Response"
  command: "fractary-faber:workflow-inspect"
  # Command will fail due to missing workflow
```

**Expected Response from Command**:
```json
{
  "status": "failure",
  "message": "Workflow not found",
  "errors": ["No workflow configuration found at specified path"]
}
```

**Expected Behavior**:
- Step result captures failure response
- Workflow triggers result_handling for failure status
- Error is logged with context

---

## Test 8: External Plugin Commands (Documentation Reference)

**Scenario**: Verify documentation correctly describes external plugin command pattern

**Note**: This test validates documentation, not runtime behavior. External plugins (fractary-work, fractary-repo, fractary-spec) exist in separate repositories.

**Documentation Check**:
- faber-manager.md examples use local commands (fractary-faber:*)
- External plugin examples are clearly marked as "External plugins"
- Command naming convention is consistent

**Verification**:
```bash
# Check that primary examples use local commands
grep -A2 "Examples from this plugin" plugins/faber/agents/faber-manager.md

# Expected: fractary-faber:workflow-run, fractary-faber:workflow-create, fractary-faber:agent-create
```

---

## Test 9: Legacy Skill Field Backward Compatibility

**Scenario**: Workflow step uses legacy `skill` field instead of `command`

**Setup**:
```yaml
step:
  id: "legacy-step"
  name: "Legacy Skill Execution"
  skill: "fractary-faber:workflow-inspect"  # Legacy field
```

**Expected Behavior**:
- Executor falls back to skill-based execution
- Skill tool is invoked (same as command-based)
- Event log shows "skill_invoked" type
- Backward compatibility maintained

---

## Regression Test: Issue #91

**Scenario**: Verify the specific bug from issue #91 is fixed

**Original Bug**:
- Workflow step: `command: "fractary-work:issue-fetch"`
- Executor tried: `Task(subagent_type="fractary-work:work-manager")`
- Result: "Agent type not found" error

**Fixed Behavior**:
- Workflow step: `command: "fractary-work:issue-fetch"`
- Executor now uses: `Skill(skill="/fractary-work:issue-fetch")`
- Result: Command executes (or "skill not found" if plugin not installed)

**Key Difference**: Error message should be about missing skill/command, NOT missing agent type.

**Verification**:
```bash
# If command doesn't exist, error should mention "skill" or "command", not "agent"
# Run a workflow with non-existent command and check error message

# Expected error (if command missing): "Skill not found" or "Command not found"
# NOT expected: "Agent type not found"
```
