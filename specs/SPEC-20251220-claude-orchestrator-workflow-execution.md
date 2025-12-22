# SPEC-20251220: Claude-as-Orchestrator Workflow Execution

## Metadata

| Field | Value |
|-------|-------|
| **Spec ID** | SPEC-20251220 |
| **Title** | Claude-as-Orchestrator Workflow Execution |
| **Status** | Draft |
| **Created** | 2025-12-20 |
| **Author** | FABER Team |
| **Related Specs** | SPEC-20251219-claude-code-orchestration-architecture |

## 1. Executive Summary

### 1.1 Summary

This specification defines a new workflow execution model where the **main Claude agent acts as the orchestrator** instead of delegating to a sub-agent (faber-manager). The orchestration logic is provided as a protocol document that Claude follows, enabling a single Claude session to maintain full context throughout the workflow while leveraging Claude's native orchestration capabilities.

### 1.2 Key Changes

**From** (workflow-execute):
- Command delegates to faber-executor skill
- Skill invokes faber-manager agent
- Agent contains all orchestration logic
- Agent uses Task tool, TodoWrite, state management

**To** (workflow-run):
- Command provides orchestration protocol to main Claude agent
- Claude executes workflow directly
- Protocol document contains orchestration rules
- Claude uses Write/Bash/SlashCommand/AskUserQuestion tools directly

### 1.3 Goals

1. **Leverage Claude's orchestration abilities** - Single session maintains context
2. **Simplify architecture** - No sub-agent needed for orchestration
3. **Make protocol explicit** - Documented rules, easy to understand/extend
4. **Enable headless execution** - Foundation for containerized workflows

### 1.4 Non-Goals

1. Replacing workflow-execute (keep both, workflow-run is alternative)
2. Changing workflow-plan command (it already works well)
3. Modifying existing workflow definitions (backward compatible)

## 2. Architecture Comparison

### 2.1 Current Architecture (workflow-execute)

```
User runs: /fractary-faber:workflow-execute <plan-id>
  ↓
workflow-execute.md command (haiku model)
  ├─ Parses arguments
  └─ Invokes faber-executor skill via Skill tool
      ↓
faber-executor.md skill
  └─ Invokes faber-manager agent via Task tool
      ↓
faber-manager.md agent (opus model)
  ├─ Loads plan from .fractary/runs/{run_id}/plan.json
  ├─ Contains ALL orchestration logic (60+ rules)
  ├─ Updates state BEFORE and AFTER each step
  ├─ Executes guard checks
  ├─ Handles result evaluation
  ├─ Manages retries
  ├─ Handles autonomy gates
  └─ Emits events

Context: Split across command → skill → agent
Orchestration: Embedded in agent code
State: Managed by agent
```

**Strengths**:
- ✅ Well-tested, production-ready
- ✅ Comprehensive error handling
- ✅ Detailed guard checks
- ✅ Strong autonomy controls

**Limitations**:
- ❌ Context fragmentation (command → skill → agent)
- ❌ Orchestration logic hidden in agent
- ❌ Harder to extend/customize
- ❌ Sub-agent doesn't leverage main Claude's context

### 2.2 New Architecture (workflow-run)

```
User runs: /fractary-faber:workflow-run --run-id <id>
  ↓
workflow-run.md command (sonnet model)
  ├─ Loads execution plan: .fractary/runs/{run_id}/plan.json
  ├─ Loads orchestration protocol: plugins/faber/docs/workflow-orchestration-protocol.md
  ├─ Initializes state file
  ├─ Creates TodoWrite from execution plan
  └─ Provides comprehensive prompt to MAIN Claude agent
      ↓
Main Claude Agent (YOU)
  ├─ Follows orchestration protocol exactly
  ├─ Updates state using Write tool
  ├─ Executes guards using Bash tool
  ├─ Handles results per protocol rules
  ├─ Manages retries per protocol
  ├─ Handles approvals using AskUserQuestion
  ├─ Emits events using fractary_faber_event_emit MCP tool
  └─ Executes each step:
      - If prompt starts with /: use SlashCommand tool
      - If freeform prompt: execute directly
      - Include context if present

Context: Single Claude session (full context maintained)
Orchestration: Defined in protocol document (explicit, readable)
State: Managed by main Claude via Write tool
```

**Strengths**:
- ✅ Single Claude session (full context)
- ✅ Orchestration protocol is explicit documentation
- ✅ Easier to understand and extend
- ✅ Leverages Claude's native orchestration abilities
- ✅ Foundation for headless containerized execution

**Trade-offs**:
- ⚠️ Relies on Claude following protocol (vs enforced in code)
- ⚠️ New system, needs testing/validation

## 3. Orchestration Protocol

### 3.1 Protocol Document Structure

**Location**: `plugins/faber/docs/workflow-orchestration-protocol.md`

**Purpose**: Comprehensive reference for how to execute workflows

**Sections**:

1. **Core Principles** - Fundamental rules (you are orchestrator, execute don't improvise, state is sacred)
2. **Execution Loop** - Before step → Execute → After step procedure
3. **State Management** - When and how to update state file
4. **Event Emission** - What events to emit and when
5. **Guards** - Safety checks that MUST be executed
6. **Result Handling** - How to process step outputs (success/warning/failure/pending_input)
7. **Retry Logic** - When and how to retry failed steps
8. **Autonomy Gates** - How to handle approval requirements
9. **Error Recovery** - What to do when things go wrong

### 3.2 State Management Protocol

**State File**: `.fractary/runs/{run_id}/state.json`

**Update Timing**:
```
BEFORE step execution:
  - Mark step as "in_progress"
  - Update current_step
  - Update current_phase if changed

AFTER step execution:
  - Mark step as "completed" or "failed"
  - Update phase status if phase complete
  - Clear current_step if workflow complete
```

**State Schema**:
```json
{
  "run_id": "run_20251220_143022_abc123",
  "work_id": "123",
  "workflow_id": "default",
  "status": "in_progress",
  "current_phase": "build",
  "current_step": "implement-solution",
  "started_at": "2025-12-20T14:30:22Z",
  "updated_at": "2025-12-20T14:35:45Z",
  "phases": [
    {
      "name": "frame",
      "status": "completed",
      "started_at": "2025-12-20T14:30:22Z",
      "completed_at": "2025-12-20T14:31:05Z",
      "steps_completed": 2,
      "steps_total": 2
    },
    {
      "name": "architect",
      "status": "completed",
      "started_at": "2025-12-20T14:31:05Z",
      "completed_at": "2025-12-20T14:35:20Z",
      "steps_completed": 2,
      "steps_total": 2
    },
    {
      "name": "build",
      "status": "in_progress",
      "started_at": "2025-12-20T14:35:20Z",
      "steps_completed": 0,
      "steps_total": 2,
      "retry_count": 0
    },
    {
      "name": "evaluate",
      "status": "pending",
      "steps_total": 4
    },
    {
      "name": "release",
      "status": "pending",
      "steps_total": 1
    }
  ]
}
```

### 3.3 Guard Execution Protocol

Guards are **mandatory safety checks** that Claude MUST execute at specific points:

#### Guard 1: Execution Evidence (Before workflow_complete)

```bash
# Check for evidence of execution
if [ -z "$(ls .fractary/runs/{run_id}/events/*-step_start* 2>/dev/null)" ]; then
  echo "FATAL ERROR: No execution evidence found"
  echo "Cannot mark workflow as complete without proof of step execution"
  exit 1
fi
```

#### Guard 2: State Validation (Before workflow_complete)

```bash
# Verify at least one phase is not pending
PENDING_COUNT=$(jq '.phases | map(select(.status == "pending")) | length' state.json)
TOTAL_PHASES=$(jq '.phases | length' state.json)

if [ "$PENDING_COUNT" -eq "$TOTAL_PHASES" ]; then
  echo "FATAL ERROR: All phases still pending - no execution occurred"
  exit 1
fi
```

#### Guard 3: Branch Safety (Before Build phase with commits)

```bash
# Check current branch is not protected
CURRENT_BRANCH=$(git rev-parse --abbrev-ref HEAD)
PROTECTED="main|master|production|staging"

if [[ "$CURRENT_BRANCH" =~ ^($PROTECTED)$ ]]; then
  echo "ERROR: Cannot commit to protected branch '$CURRENT_BRANCH'"
  echo "Create feature branch: /fractary-repo:branch-create --work-id {work_id}"
  exit 1
fi
```

#### Guard 4: Destructive Operation Approval (Before merge/delete/close)

```bash
# Verify approval event exists
if [ -z "$(ls .fractary/runs/{run_id}/events/*-approval_granted* 2>/dev/null)" ]; then
  echo "FATAL ERROR: Destructive operation requires approval"
  echo "No approval_granted event found"
  exit 1
fi
```

### 3.4 Result Handling Protocol

After each step execution, evaluate the result:

```javascript
// Determine result status
const result = {
  status: "success" | "warning" | "failure" | "pending_input",
  message: "...",
  error: "..." // if failure
};

// Get result handling config (with defaults)
const handling = {
  on_success: step.result_handling?.on_success || "continue",
  on_warning: step.result_handling?.on_warning || "continue",
  on_failure: "stop" // IMMUTABLE - always stop on failure
};

// Handle based on status
if (result.status === "failure") {
  // ALWAYS stop - no exceptions
  await emitEvent({ type: "step_failed", error: result.error });
  await updateState({ status: "failed" });
  throw new Error(`Step failed: ${result.error}`);
}

if (result.status === "warning") {
  await emitEvent({ type: "step_warning", warning: result.message });

  if (handling.on_warning === "prompt") {
    const approval = await AskUserQuestion({
      question: `Warning: ${result.message}. Continue?`,
      options: ["Continue", "Stop"]
    });

    if (approval !== "Continue") {
      await updateState({ status: "paused" });
      return; // Stop workflow
    }
  }
  // else: continue
}

if (result.status === "pending_input") {
  // Workflow needs user input
  await emitEvent({ type: "workflow_paused", reason: "pending_input" });
  await updateState({ status: "paused", pending_input: result.message });
  return; // Halt workflow, save state, wait for user
}

// Success - continue to next step
await emitEvent({ type: "step_complete" });
```

### 3.5 Autonomy Gate Protocol

Before executing first step of phase that requires approval:

```javascript
// Check if phase requires approval
if (plan.autonomy.require_approval_for.includes(phase.name)) {
  // Emit decision point event
  await fractary_faber_event_emit({
    run_id: plan.run_id,
    type: "decision_point",
    phase: phase.name,
    metadata: {
      steps_to_execute: phase.steps.length,
      description: phase.description
    }
  });

  // MUST use AskUserQuestion (not just emit event)
  const approval = await AskUserQuestion({
    questions: [{
      question: `About to execute ${phase.name} phase with ${phase.steps.length} steps. Approve?`,
      header: "Approval Required",
      multiSelect: false,
      options: [
        {
          label: "Approve",
          description: `Continue with ${phase.name} phase`
        },
        {
          label: "Reject",
          description: "Stop workflow execution"
        },
        {
          label: "View Details",
          description: `Show steps in ${phase.name} phase`
        }
      ]
    }]
  });

  if (approval.answers["0"] === "Approve") {
    // Emit approval granted event
    await fractary_faber_event_emit({
      run_id: plan.run_id,
      type: "approval_granted",
      phase: phase.name,
      timestamp: new Date().toISOString()
    });

    // Continue to phase execution
  } else if (approval.answers["0"] === "View Details") {
    // Show phase details
    console.log(`\n${phase.name} Phase Steps:\n`);
    phase.steps.forEach((step, i) => {
      console.log(`${i+1}. ${step.name}: ${step.description}`);
    });

    // Ask again
    // (recursive call to approval logic)
  } else {
    // Rejected - stop workflow
    await fractary_faber_event_emit({
      run_id: plan.run_id,
      type: "workflow_paused",
      reason: "user_rejected_phase",
      phase: phase.name
    });

    await updateState({ status: "paused" });
    return; // Exit workflow
  }
}
```

## 4. Workflow Step Schema Updates

### 4.1 Current Step Schema

```json
{
  "id": "implement-solution",
  "name": "Implement Solution",
  "description": "Implement based on specification",
  "command": "/fractary-faber:build",
  "arguments": {
    "work_id": "{work_id}"
  }
}
```

### 4.2 New Step Schema

```json
{
  "id": "implement-solution",
  "name": "Implement Solution",
  "description": "Implement based on specification",
  "prompt": "/fractary-faber:build",
  "context": "Focus on following the architectural patterns established in the codebase. Ensure all new code has test coverage.",
  "arguments": {
    "work_id": "{work_id}"
  },
  "result_handling": {
    "on_success": "continue",
    "on_warning": "prompt",
    "on_failure": "stop"
  }
}
```

**Changes**:
1. **Remove `command` field** - Replaced by `prompt`
2. **Add `prompt` field** - Can be slash command OR freeform text
3. **Add `context` field** (optional) - Additional context for prompt
4. **Keep `arguments`** - Still used for variable substitution
5. **Keep `result_handling`** - Still defines how to handle results

**Rationale**:
- Commands are just saved prompts, so `prompt` is more general
- `context` allows customization without creating new commands
- Backward compatible: convert `command` → `prompt` in plan resolution

### 4.3 Example Steps

**Slash Command**:
```json
{
  "id": "fetch-issue",
  "prompt": "/fractary-work:issue-fetch",
  "arguments": { "issue_number": "123" }
}
```

**Freeform Prompt**:
```json
{
  "id": "analyze-codebase",
  "prompt": "Analyze the authentication implementation in src/auth/* files. Identify the root cause of the OAuth failure."
}
```

**Command with Context**:
```json
{
  "id": "generate-spec",
  "prompt": "/fractary-spec:create",
  "context": "This is a security-critical feature. The spec should include threat modeling and security considerations.",
  "arguments": { "work_id": "123" }
}
```

## 5. workflow-run Command Design

### 5.1 Command Signature

```markdown
---
name: fractary-faber:workflow-run
description: Execute a FABER workflow with Claude as the orchestrator
argument-hint: '--run-id <id>'
tools: Read, Write, Bash, SlashCommand, AskUserQuestion
model: claude-sonnet-4-5
---
```

### 5.2 Command Flow

```
┌─────────────────────────────────────────────────────────────┐
│ INITIALIZATION PHASE                                        │
├─────────────────────────────────────────────────────────────┤
│ 1. Parse arguments (--run-id)                               │
│ 2. Load execution plan                                      │
│    Read(.fractary/runs/{run_id}/plan.json)                  │
│ 3. Load orchestration protocol                              │
│    Read(plugins/faber/docs/workflow-orchestration-protocol.md)│
│ 4. Initialize or load state file                            │
│    Read/Write(.fractary/runs/{run_id}/state.json)           │
│ 5. Create TodoWrite checklist                               │
│    TodoWrite({ todos: [...all steps...] })                  │
└─────────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────┐
│ EXECUTION PHASE                                             │
├─────────────────────────────────────────────────────────────┤
│ For each step in plan.execution_order:                      │
│                                                              │
│ ┌─ BEFORE STEP ─────────────────────────────────────────┐  │
│ │ • Update state (step → in_progress)                    │  │
│ │ • Update TodoWrite (step → in_progress)                │  │
│ │ • Emit step_start event                                │  │
│ │ • Execute phase transition guards if needed            │  │
│ └────────────────────────────────────────────────────────┘  │
│                          ↓                                   │
│ ┌─ EXECUTE STEP ────────────────────────────────────────┐  │
│ │ if (step.prompt.startsWith('/')) {                     │  │
│ │   // Slash command                                     │  │
│ │   SlashCommand({                                       │  │
│ │     command: step.prompt.replace(/^\//, ''),           │  │
│ │     args: JSON.stringify(step.arguments)               │  │
│ │   })                                                   │  │
│ │ } else {                                               │  │
│ │   // Freeform prompt                                   │  │
│ │   if (step.context) {                                  │  │
│ │     console.log(`${step.prompt}\n\n${step.context}`)   │  │
│ │   } else {                                             │  │
│ │     console.log(step.prompt)                           │  │
│ │   }                                                    │  │
│ │ }                                                      │  │
│ └────────────────────────────────────────────────────────┘  │
│                          ↓                                   │
│ ┌─ AFTER STEP ──────────────────────────────────────────┐  │
│ │ • Evaluate result (success/warning/failure)            │  │
│ │ • Handle per result_handling config                    │  │
│ │ • If failure: STOP workflow                            │  │
│ │ • If warning + prompt: AskUserQuestion                 │  │
│ │ • Emit step_complete or step_failed event              │  │
│ │ • Update state (step → completed/failed)               │  │
│ │ • Update TodoWrite (step → completed)                  │  │
│ └────────────────────────────────────────────────────────┘  │
│                                                              │
│ Repeat for all steps...                                     │
└─────────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────┐
│ COMPLETION PHASE                                            │
├─────────────────────────────────────────────────────────────┤
│ 1. Execute Guard 1 (execution evidence check)               │
│ 2. Execute Guard 2 (state validation check)                 │
│ 3. Emit workflow_complete event                             │
│ 4. Update state (status → completed)                        │
│ 5. Post completion comment to issue (if work_id)            │
│ 6. Display summary                                          │
└─────────────────────────────────────────────────────────────┘
```

### 5.3 Error Handling

```javascript
try {
  // Execute step
  await executeStep(step);
} catch (error) {
  // Step failed
  await fractary_faber_event_emit({
    run_id: runId,
    type: "step_failed",
    step_id: step.step_id,
    error: error.message,
    stack: error.stack
  });

  // Check retry logic
  if (phase.max_retries && phaseState.retry_count < phase.max_retries) {
    phaseState.retry_count++;

    await fractary_faber_event_emit({
      run_id: runId,
      type: "step_retry",
      step_id: step.step_id,
      retry_count: phaseState.retry_count,
      max_retries: phase.max_retries
    });

    // Update state with retry count
    await updateState({ phases: updatedPhases });

    // Retry step
    await executeStep(step);
  } else {
    // Max retries exceeded or no retry config
    await updateState({ status: "failed" });

    throw new Error(
      `Step ${step.step_id} failed: ${error.message}\n` +
      (phase.max_retries
        ? `Max retries (${phase.max_retries}) exceeded.`
        : `No retry configuration.`) +
      `\n\nRun ID: ${runId}` +
      `\nResume with: /fractary-faber:workflow-run --run-id ${runId}`
    );
  }
}
```

### 5.4 Resume Support

The state file enables resume:

```javascript
// On startup, check state
const state = JSON.parse(await Read({ file_path: statePath }));

if (state.status === "paused" || state.status === "failed") {
  console.log(`Resuming workflow from ${state.current_phase}/${state.current_step}`);

  // Find index of current step in execution_order
  const resumeIndex = plan.execution_order.findIndex(
    s => s.step_id === state.current_step
  );

  if (resumeIndex === -1) {
    // Current step not found, start from beginning of current phase
    const resumePhaseIndex = plan.execution_order.findIndex(
      s => s.phase === state.current_phase
    );
    startIndex = resumePhaseIndex;
  } else {
    // Resume from next step (current step may have partially completed)
    startIndex = resumeIndex + 1;
  }
} else {
  // Fresh run
  startIndex = 0;
}

// Execute from startIndex
for (let i = startIndex; i < plan.execution_order.length; i++) {
  await executeStep(plan.execution_order[i]);
}
```

## 6. Implementation Plan

### 6.1 Phase 1: Protocol Document (Week 1)

**Deliverables**:
- `plugins/faber/docs/workflow-orchestration-protocol.md`

**Sections to implement**:
1. Core Principles
2. Execution Loop (before/execute/after)
3. State Management rules
4. Event Emission requirements
5. Guard definitions (all 4 guards)
6. Result Handling matrix
7. Retry Logic procedures
8. Autonomy Gate procedures
9. Error Recovery guidelines

**Testing**: Document review, ensure all faber-manager logic is captured

### 6.2 Phase 2: workflow-run Command (Week 1-2)

**Deliverables**:
- `plugins/faber/commands/workflow-run.md`

**Implementation steps**:
1. Create command file with metadata
2. Implement initialization section:
   - Argument parsing
   - Plan loading
   - Protocol loading
   - State initialization
   - TodoWrite creation
3. Implement execution loop:
   - Before step logic
   - Step execution logic
   - After step logic
   - Phase transition logic
4. Implement completion logic:
   - Guard execution
   - Final state update
   - Summary output

**Testing**: Run against existing plan from workflow-plan

### 6.3 Phase 3: Step Schema Update (Week 2)

**Deliverables**:
- Updated `plugins/faber/config/workflow.schema.json`
- Migration guide for existing workflows

**Changes**:
1. Add `prompt` field (required, replaces `command`)
2. Add `context` field (optional)
3. Deprecate `command` field (backward compatible)
4. Update validation rules

**Migration**:
- Plan resolution automatically converts `command` → `prompt`
- No changes needed to existing workflow files initially
- Document recommended migration path

### 6.4 Phase 4: Testing & Validation (Week 2-3)

**Test Cases**:

1. **Basic Workflow**:
   - Run workflow-plan on simple issue
   - Run workflow-run with generated plan
   - Verify all steps execute
   - Verify state updates correctly
   - Verify events emitted correctly

2. **Autonomy Gates**:
   - Workflow with `require_approval_for: ["release"]`
   - Verify approval prompt appears
   - Test approve path
   - Test reject path

3. **Error Handling**:
   - Workflow with failing step (no retry)
   - Verify workflow stops
   - Verify error logged
   - Verify state shows failure

4. **Retry Logic**:
   - Workflow with failing step (max_retries: 2)
   - Verify retry attempts
   - Verify retry count tracked
   - Verify eventual failure after max retries

5. **Resume**:
   - Start workflow, fail midway
   - Verify state saved
   - Resume with same run-id
   - Verify picks up from correct step

6. **Guards**:
   - Test Guard 3 (protected branch)
   - Verify blocks commit on main
   - Test Guard 4 (destructive approval)
   - Verify requires approval event

**Success Criteria**:
- All test cases pass
- No regressions in workflow-plan
- workflow-execute still works (backward compatibility)
- Documentation complete

## 7. Backward Compatibility

### 7.1 Existing Commands Unchanged

- `/fractary-faber:workflow-plan` - No changes
- `/fractary-faber:workflow-execute` - No changes
- Both commands continue to work as before

### 7.2 Workflow Definitions Compatible

- Existing workflow JSON files work with both systems
- `command` field automatically mapped to `prompt` during plan resolution
- No breaking changes to workflow schema

### 7.3 Migration Path

**Immediate**: Both systems coexist
- Users can choose workflow-execute or workflow-run
- Same plan works with both

**Future**: Gradual migration
- Update documentation to recommend workflow-run
- Update example workflows to use `prompt` field
- Eventually deprecate workflow-execute (v3.0+)

## 8. Advantages of New Approach

### 8.1 Single Claude Session

**Problem with old approach**: Context split across command → skill → agent
**Solution**: Main Claude maintains full context throughout

**Benefits**:
- Claude can reference earlier conversation
- User can ask questions during workflow
- Better error messages (Claude has full context)
- More natural interaction model

### 8.2 Explicit Protocol

**Problem with old approach**: Orchestration logic embedded in agent code
**Solution**: Protocol documented in readable markdown

**Benefits**:
- Easy to understand how workflows execute
- Easy to extend with new rules
- Easy to audit for compliance
- Serves as both implementation and documentation

### 8.3 Foundation for Headless

**Problem with old approach**: Agent-based model harder to containerize
**Solution**: Command-based model maps cleanly to headless execution

**Benefits**:
- Command can be initial prompt for container
- Protocol loads into container context
- State/events persist in filesystem
- Easy to stream progress back via stdout

### 8.4 Leverages Claude's Strengths

**Problem with old approach**: Sub-agent doesn't leverage main Claude's abilities
**Solution**: Main Claude orchestrates using its native capabilities

**Benefits**:
- TodoWrite for progress tracking (built-in)
- AskUserQuestion for approvals (built-in)
- Context management (built-in)
- Error recovery (Claude's reasoning)

## 9. Risks & Mitigations

### 9.1 Risk: Claude Doesn't Follow Protocol

**Concern**: Protocol is documentation, not enforced code

**Mitigations**:
1. Protocol is loaded into Claude's context (high salience)
2. Critical rules marked as CRITICAL/FATAL
3. Guards provide runtime verification
4. Extensive testing to validate behavior
5. If issues found, can add more explicit checks

### 9.2 Risk: Performance

**Concern**: Main Claude session may be slower than specialized agent

**Mitigations**:
1. Sonnet model (fast, capable)
2. Protocol is concise, loads quickly
3. Most time spent in step execution (same as before)
4. Can optimize protocol document over time

### 9.3 Risk: State Corruption

**Concern**: Manual state updates could corrupt state file

**Mitigations**:
1. Protocol specifies exact update pattern
2. State updates are simple JSON writes
3. Events provide audit trail
4. State validation guard catches corruption
5. Can add state schema validation

## 10. Future Enhancements

### 10.1 Visual Progress Tracking

Enhance TodoWrite to show richer progress:
```
Frame Phase (2/2 steps complete)
  ✓ Fetch or Create Issue (0:15)
  ✓ Switch or Create Branch (0:08)

Architect Phase (1/2 steps complete)
  ✓ Generate Specification (1:23)
  ⟳ Refine Specification (in progress...)

Build Phase (pending)
  ○ Implement Solution
  ○ Commit and Push Changes
```

### 10.2 Parallel Step Execution

Support parallel steps in workflow definitions:
```json
{
  "steps": [
    {
      "id": "lint",
      "prompt": "/fractary-lint:check",
      "parallel_group": "validation"
    },
    {
      "id": "typecheck",
      "prompt": "/fractary-typecheck:run",
      "parallel_group": "validation"
    }
  ]
}
```

Execute steps in same parallel_group concurrently.

### 10.3 Conditional Steps

Support conditional execution:
```json
{
  "id": "deploy-staging",
  "prompt": "/fractary-deploy:staging",
  "condition": {
    "env": "production",
    "branch": "main"
  }
}
```

Skip step if condition not met.

### 10.4 Sub-Workflows

Support invoking workflows from workflows:
```json
{
  "id": "run-tests",
  "prompt": "/fractary-faber:workflow-run",
  "arguments": {
    "run_id": "{test_workflow_run_id}"
  }
}
```

### 10.5 Rollback Support

Add rollback procedures to workflow:
```json
{
  "phases": {
    "deploy": {
      "steps": [...],
      "rollback_steps": [
        {
          "id": "rollback-deployment",
          "prompt": "/fractary-deploy:rollback"
        }
      ]
    }
  }
}
```

If phase fails, execute rollback_steps.

## 11. Success Metrics

### 11.1 Functional Metrics

- [ ] workflow-run successfully executes default workflow
- [ ] All guards execute correctly
- [ ] State updates happen at right times
- [ ] Events emitted correctly
- [ ] Autonomy gates work
- [ ] Retries work
- [ ] Resume works
- [ ] Errors handled gracefully

### 11.2 Quality Metrics

- [ ] Protocol document is clear and complete
- [ ] Command documentation is comprehensive
- [ ] Test coverage > 80% for new code
- [ ] No regressions in existing commands
- [ ] Performance within 20% of workflow-execute

### 11.3 Adoption Metrics

- [ ] Positive feedback from initial users
- [ ] Successfully runs 10+ different workflows
- [ ] Used in production for 1+ month
- [ ] Documentation rated helpful

## 12. References

### 12.1 Existing Implementation

- `plugins/faber/commands/workflow-execute.md` - Current execution command
- `plugins/faber/agents/faber-manager.md` - Current orchestration agent (60+ rules)
- `plugins/faber/commands/workflow-plan.md` - Planning command (unchanged)

### 12.2 Workflow System

- `plugins/faber/config/workflows/core.json` - Core workflow definition
- `plugins/faber/config/workflows/default.json` - Default workflow (extends core)
- `plugins/faber/config/workflow.schema.json` - Workflow validation schema

### 12.3 Related Specs

- SPEC-20251219-claude-code-orchestration-architecture - Overall orchestration vision
- SPEC-20251220-claude-code-orchestration-implementation - Implementation details (now superseded by this spec for plugin-based execution)

---

**Document Status:** Draft
**Implementation Status:** Not Started
**Target Completion:** 3 weeks from approval
**Next Review:** After Phase 1 (protocol document) complete
