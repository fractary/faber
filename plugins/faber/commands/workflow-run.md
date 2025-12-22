---
name: fractary-faber:workflow-run
description: Execute a FABER workflow with Claude Code as the primary orchestrator
argument-hint: '<work-id> [--workflow <id>] [--resume <run-id>]'
tools: Read, Write, Bash, Skill, AskUserQuestion, MCPSearch
model: claude-sonnet-4-5
---

# FABER Workflow Run Command

<CONTEXT>
You are executing a FABER workflow with YOU as the primary orchestrator.

This is NOT delegation - YOU will execute each step by following the orchestration protocol.
You maintain full context throughout the entire workflow execution.

This command replaces the old workflow-execute pattern (command → skill → agent) with direct orchestration by the main Claude agent.
</CONTEXT>

<CRITICAL_RULES>
1. **YOU ARE THE ORCHESTRATOR** - Not delegating to sub-agent. You execute the workflow.
2. **FOLLOW THE PROTOCOL** - The orchestration protocol is your instruction manual. Follow it exactly.
3. **MAINTAIN STATE** - Update state file BEFORE and AFTER every step. State is sacred.
4. **EXECUTE GUARDS** - All guards are mandatory. Never skip them.
5. **USE TODOWRITE** - Track progress with TodoWrite for all steps.
6. **EMIT EVENTS** - Every significant action emits an event for audit trail.
7. **HANDLE ERRORS GRACEFULLY** - Use retry logic when configured, stop when appropriate.
8. **RESPECT AUTONOMY GATES** - Get user approval when required.
</CRITICAL_RULES>

<INPUTS>

**Syntax:**
```bash
/fractary-faber:workflow-run <work-id> [options]
```

**Arguments:**
| Argument | Type | Required | Description |
|----------|------|----------|-------------|
| `<work-id>` | string/number | Yes | Work item ID (issue number) to execute |

**Options:**
| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `--workflow <id>` | string | "default" | Workflow definition ID to use |
| `--resume <run-id>` | string | none | Resume previous run from where it stopped |

**Examples:**
```bash
# Execute default workflow for issue #123
/fractary-faber:workflow-run 123

# Execute specific workflow for issue #456
/fractary-faber:workflow-run 456 --workflow custom-workflow

# Resume previous run
/fractary-faber:workflow-run 123 --resume abc123-def456-789
```

</INPUTS>

<WORKFLOW>

## Phase 1: Initialization

### Step 1.1: Parse Arguments

Extract from user input:
1. `work_id`: First positional argument (required)
2. `workflow_id`: Value of `--workflow` flag (default: "default")
3. `resume_run_id`: Value of `--resume` flag (optional)

**Validation:**
- If no `work_id`: Show error and usage
- `work_id` must be a valid issue number

### Step 1.2: Load Orchestration Protocol

**YOU MUST READ THE ORCHESTRATION PROTOCOL INTO YOUR CONTEXT.**

The protocol defines how you execute workflows. It is your operating manual.

```javascript
// Read the orchestration protocol
const protocolPath = "plugins/faber/docs/workflow-orchestration-protocol.md";
const protocol = await Read({ file_path: protocolPath });

// Display confirmation to user
console.log("✓ Loaded orchestration protocol");
console.log(`Protocol: ${protocolPath}`);
```

**The protocol contains:**
- Core principles (you are orchestrator, execute don't improvise, state is sacred, guards mandatory)
- Execution loop (before/execute/after for each step)
- State management (when/how to update state file)
- Event emission (what events to emit and when)
- Guards (all 4 guard implementations)
- Result handling (success/warning/failure/pending_input)
- Retry logic (when/how to retry failed steps)
- Autonomy gates (approval procedures)
- Error recovery (what to do when things go wrong)

### Step 1.3: Load or Resume Workflow

**If resuming (`--resume` provided):**

```javascript
// Resume from previous run
const runId = resume_run_id;
const statePath = `.fractary/runs/${runId}/state.json`;

// Read existing state
const state = JSON.parse(await Read({ file_path: statePath }));

console.log("✓ Resuming workflow");
console.log(`Run ID: ${runId}`);
console.log(`Workflow: ${state.workflow_name}`);
console.log(`Current phase: ${state.current_phase}`);
console.log(`Current step: ${state.current_step}`);

// Load the workflow plan from state
const plan = state.workflow_plan; // Plan is stored in state for resume
```

**If starting new run (`--resume` not provided):**

```javascript
// Generate unique run ID
const runId = `${workflow_id}-${work_id}-${Date.now()}`;
const statePath = `.fractary/runs/${runId}/state.json`;

// Invoke workflow-plan to resolve and merge workflow definition
console.log("Resolving workflow definition...");

// Use Read tool to load workflow directly
const workflowPath = `plugins/faber/config/workflows/${workflow_id}.json`;
const plan = JSON.parse(await Read({ file_path: workflowPath }));

console.log("✓ Workflow resolved");
console.log(`Workflow: ${plan.name}`);
console.log(`Phases: ${plan.phases.map(p => p.name).join(", ")}`);

// Initialize state file
const initialState = {
  run_id: runId,
  workflow_id: workflow_id,
  workflow_name: plan.name || workflow_id,
  workflow_plan: plan, // Store plan for resume capability
  status: "pending",
  current_phase: null,
  current_step: null,
  work_id: work_id,
  branch: null, // Will be set by branch creation step
  phases: Object.keys(plan.phases).map(phaseName => {
    const p = plan.phases[phaseName];
    return {
      name: phaseName,
      status: "pending",
      enabled: p.enabled !== false,
      autonomy_gate: p.autonomy_gate,
      max_retries: p.max_retries || 0,
      retry_count: 0
    };
  }),
  steps: [],
  started_at: new Date().toISOString(),
  updated_at: new Date().toISOString()
};

// Create state directory
await Bash({
  command: `mkdir -p .fractary/runs/${runId}`,
  description: "Create run directory"
});

// Write initial state
await Write({
  file_path: statePath,
  content: JSON.stringify(initialState, null, 2)
});

console.log("✓ State initialized");
console.log(`State file: ${statePath}`);

// Update state to in_progress
initialState.status = "in_progress";
initialState.updated_at = new Date().toISOString();
await Write({
  file_path: statePath,
  content: JSON.stringify(initialState, null, 2)
});
```

### Step 1.4: Load MCP Event Tool

```javascript
// Load the fractary_faber_event_emit MCP tool
await MCPSearch({ query: "select:fractary_faber_event_emit" });

// Emit workflow_start event
await fractary_faber_event_emit({
  run_id: runId,
  type: "workflow_start",
  metadata: {
    workflow_id: workflow_id,
    workflow_name: plan.name,
    work_id: work_id,
    branch: state.branch
  }
});

console.log("✓ Event system ready");
```

### Step 1.5: Initialize TodoWrite

```javascript
// Flatten all steps from all phases into a single todo list
const allSteps = [];
for (const phaseName of Object.keys(plan.phases)) {
  const phase = plan.phases[phaseName];
  if (phase.enabled === false) continue;

  const phaseSteps = [
    ...(phase.pre_steps || []),
    ...(phase.steps || []),
    ...(phase.post_steps || [])
  ];

  for (const step of phaseSteps) {
    allSteps.push({
      content: `[${phaseName}] ${step.name}`,
      status: "pending",
      activeForm: `Executing [${phaseName}] ${step.name}`
    });
  }
}

await TodoWrite({ todos: allSteps });

console.log("✓ Progress tracking initialized");
console.log(`Total steps: ${allSteps.length}`);
```

## Phase 2: Workflow Execution

**NOW FOLLOW THE ORCHESTRATION PROTOCOL TO EXECUTE THE WORKFLOW.**

The protocol (`plugins/faber/docs/workflow-orchestration-protocol.md`) defines the exact execution loop.

**High-level flow:**

For each phase in the workflow:
1. Check if phase is enabled
2. Execute "before" autonomy gate if configured
3. Update state: phase starting
4. Emit phase_start event
5. Execute all steps in phase (pre_steps + steps + post_steps)
   - For each step, follow the protocol's Execution Loop:
     - BEFORE: Update state, emit event, execute guards
     - EXECUTE: Follow the step's prompt
     - AFTER: Evaluate result, handle based on config
6. Update state: phase complete
7. Emit phase_complete event
8. Execute "after" autonomy gate if configured

**Reference the protocol document for complete implementation details, including:**
- Execution loop (before/execute/after pattern)
- State management (when/how to update)
- Guard execution (all 4 guards)
- Result handling (success/warning/failure/pending_input)
- Retry logic (Build-Evaluate loop)
- Autonomy gates (approval procedures)
- Error recovery (what to do on errors)

## Phase 3: Workflow Completion

### On Successful Completion:

```javascript
// Update state to completed
const completedState = {
  ...state,
  status: "completed",
  completed_at: new Date().toISOString()
};

await Write({
  file_path: statePath,
  content: JSON.stringify(completedState, null, 2)
});

// Calculate duration
const durationSeconds = Math.floor(
  (new Date(completedState.completed_at).getTime() -
   new Date(completedState.started_at).getTime()) / 1000
);

// Emit completion event
await fractary_faber_event_emit({
  run_id: runId,
  type: "workflow_complete",
  metadata: {
    duration_seconds: durationSeconds,
    phases_completed: state.phases.filter(p => p.status === "completed").length,
    total_phases: state.phases.length
  }
});

// Report success
console.log("\n✓ Workflow completed successfully!");
console.log(`Run ID: ${runId}`);
console.log(`Total duration: ${durationSeconds}s`);
console.log(`Phases completed: ${state.phases.filter(p => p.status === "completed").length}/${state.phases.length}`);
console.log(`\nState file: ${statePath}`);
```

### On Workflow Failure:

```javascript
// Update state to failed
const failedState = {
  ...state,
  status: "failed",
  error: errorMessage,
  failed_at_step: currentStep.step_id,
  failed_at_phase: currentPhase.name,
  completed_at: new Date().toISOString()
};

await Write({
  file_path: statePath,
  content: JSON.stringify(failedState, null, 2)
});

// Emit failure event
await fractary_faber_event_emit({
  run_id: runId,
  type: "workflow_failed",
  phase: currentPhase.name,
  step_id: currentStep.step_id,
  metadata: {
    error: errorMessage
  }
});

// Report failure with actionable information
console.error("\n✗ Workflow failed");
console.error(`Run ID: ${runId}`);
console.error(`Phase: ${currentPhase.name}`);
console.error(`Step: ${currentStep.name}`);
console.error(`Error: ${errorMessage}`);
console.error(`\nTo resume after fixing:`);
console.error(`  /fractary-faber:workflow-run ${work_id} --resume ${runId}`);
console.error(`\nState file: ${statePath}`);
```

</WORKFLOW>

<OUTPUTS>

**Success:**
```
✓ Loaded orchestration protocol
✓ Workflow resolved
✓ State initialized
✓ Event system ready
✓ Progress tracking initialized

=== Phase: frame ===
[Execution output...]

=== Phase: architect ===
[Execution output...]

=== Phase: build ===
[Execution output...]

=== Phase: evaluate ===
[Execution output...]

=== Phase: release ===
[Execution output...]

✓ Workflow completed successfully!
Run ID: default-123-1703001234567
Total duration: 245s
Phases completed: 5/5

State file: .fractary/runs/default-123-1703001234567/state.json
```

**Failure with Resume Instructions:**
```
✗ Workflow failed
Run ID: default-123-1703001234567
Phase: build
Step: implement-solution
Error: Tests failed (3 failures)

To resume after fixing:
  /fractary-faber:workflow-run 123 --resume default-123-1703001234567

State file: .fractary/runs/default-123-1703001234567/state.json
```

**Missing Work ID Error:**
```
Error: Work ID is required

Usage: /fractary-faber:workflow-run <work-id> [options]

Examples:
  /fractary-faber:workflow-run 123
  /fractary-faber:workflow-run 456 --workflow custom-workflow
  /fractary-faber:workflow-run 123 --resume abc123-def456-789
```

</OUTPUTS>

<ARCHITECTURE_NOTES>

## Old vs New Architecture

### Old: workflow-execute (Delegation Pattern)

```
User invokes: /fractary-faber:execute <plan-id>
    ↓
workflow-execute command (Haiku) parses args
    ↓
Invokes faber-executor skill (Haiku)
    ↓
Executor spawns faber-manager agent(s) (Sonnet) via Task tool
    ↓
Each agent executes one work item
    ↓
Results aggregated by executor
```

**Issues:**
- Context split across 3 layers (command/skill/agent)
- Agent receives faber-manager.md (60+ rules) which may be incomplete
- No way for agent to access full orchestration logic
- Limited token budget per agent instance

### New: workflow-run (Orchestrator Pattern)

```
User invokes: /fractary-faber:workflow-run <work-id>
    ↓
workflow-run command loads orchestration protocol into context
    ↓
Main Claude agent (THIS) executes entire workflow
    ↓
Full context maintained throughout
    ↓
Protocol defines all orchestration logic explicitly
```

**Benefits:**
- Single Claude session with full context
- All orchestration logic explicit in protocol document
- No context loss between layers
- Direct tool access (Read, Write, Bash, Skill, etc.)
- Natural execution with intelligent guardrails

## Key Differences

| Aspect | workflow-execute | workflow-run |
|--------|------------------|--------------|
| **Orchestrator** | faber-manager agent | Main Claude (you) |
| **Context** | Split across 3 layers | Single session |
| **Logic Source** | faber-manager.md rules | Protocol document |
| **Execution** | Agent interprets rules | Claude follows protocol |
| **State** | Agent-managed | File-based (Read/Write) |
| **Guards** | Agent heuristics | Explicit bash checks |
| **Resume** | Agent state file | Run state file |
| **Tool Access** | Via agent's tools | Direct (all tools) |

## Protocol-Based Orchestration

The orchestration protocol (`plugins/faber/docs/workflow-orchestration-protocol.md`) is a comprehensive document that defines:

1. **Core Principles** - Your role, execution philosophy, state management
2. **Execution Loop** - Exact before/execute/after sequence for each step
3. **State Management** - When/how to update state file, JSON schema
4. **Event Emission** - What events to emit and when
5. **Guards** - All 4 guard implementations (execution evidence, state validation, branch safety, destructive approval)
6. **Result Handling** - How to handle success/warning/failure/pending_input
7. **Retry Logic** - When/how to retry failed steps (Build-Evaluate loop)
8. **Autonomy Gates** - Approval procedures before/after phases
9. **Error Recovery** - What to do when things go wrong
10. **TodoWrite Integration** - How to track progress

**This protocol is your operating manual.** When executing a workflow, you MUST follow it exactly.

## State File Structure

State is persisted to `.fractary/runs/{run_id}/state.json`:

```json
{
  "run_id": "default-123-1703001234567",
  "workflow_id": "default",
  "workflow_name": "Default FABER Workflow",
  "workflow_plan": { /* full resolved workflow */ },
  "status": "in_progress",
  "current_phase": "build",
  "current_step": "implement-solution",
  "work_id": "123",
  "branch": "feature/issue-123",
  "phases": [
    {
      "name": "frame",
      "status": "completed",
      "enabled": true,
      "retry_count": 0
    },
    {
      "name": "build",
      "status": "in_progress",
      "enabled": true,
      "max_retries": 3,
      "retry_count": 1
    }
  ],
  "steps": [
    {
      "step_id": "fetch-issue",
      "phase": "frame",
      "status": "success",
      "message": "Issue #123 fetched",
      "completed_at": "2024-12-22T10:30:00Z"
    }
  ],
  "started_at": "2024-12-22T10:25:00Z",
  "updated_at": "2024-12-22T10:35:00Z"
}
```

This state enables:
- Resume from exact step
- Retry tracking
- Audit trail
- Progress monitoring
- Error diagnosis

</ARCHITECTURE_NOTES>

<PROTOCOL_REFERENCE>

**Full Protocol:** `plugins/faber/docs/workflow-orchestration-protocol.md`

**You MUST read and follow this protocol when executing workflows.**

Key sections to reference during execution:

- **Execution Loop** - The before/execute/after pattern for each step
- **State Management Protocol** - When to update state file
- **Guard Execution Protocol** - All 4 guards with implementations
- **Result Handling Protocol** - How to handle different result types
- **Retry Logic Protocol** - Build-Evaluate retry loop
- **Autonomy Gate Protocol** - User approval procedures
- **Error Recovery Protocol** - What to do on errors

The protocol is comprehensive and prescriptive. Trust it.

</PROTOCOL_REFERENCE>

<IMPORTANT_REMINDERS>

1. **You are the orchestrator** - Not delegating to sub-agent. YOU execute the workflow.

2. **Follow the protocol exactly** - It's not a suggestion, it's the operational contract.

3. **Update state before and after every step** - State is the source of truth.

4. **Guards are mandatory** - Never skip guard checks.

5. **Emit events for audit trail** - Every significant action gets an event.

6. **Use TodoWrite for progress** - User needs to see what's happening.

7. **Handle errors gracefully** - Retry when configured, stop when appropriate, report clearly.

8. **Respect autonomy gates** - Get approval when required.

9. **Trust the protocol** - When in doubt, re-read the relevant section.

10. **Run ID is sacred** - Never modify it, use it for resume capability.

</IMPORTANT_REMINDERS>

<SEE_ALSO>

- `/fractary-faber:workflow-plan` - Resolve and merge workflow definitions
- `plugins/faber/docs/workflow-orchestration-protocol.md` - Complete orchestration protocol
- `plugins/faber/config/workflows/` - Workflow definitions
- `.fractary/runs/{run-id}/state.json` - Workflow execution state

</SEE_ALSO>
