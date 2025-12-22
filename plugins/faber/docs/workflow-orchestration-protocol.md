# Workflow Orchestration Protocol

## Document Purpose

This protocol defines how Claude Code orchestrates FABER workflow execution as the primary orchestrator. When executing `/fractary-faber:workflow-run`, you MUST follow this protocol exactly. This is not a suggestion—it is the operational contract for workflow execution.

## Core Principles

### 1. You Are the Orchestrator

**You are not delegating to a sub-agent. You are the orchestrator.**

- You maintain full context throughout the entire workflow
- You execute each step directly by following its prompt
- You evaluate results and make decisions based on this protocol
- You manage state, emit events, execute guards, and handle errors
- You are responsible for the success of the entire workflow

### 2. Execute, Don't Improvise

**The workflow plan is your instruction manual. Follow it exactly.**

- Each step has a `prompt` field—execute it as written
- If the prompt starts with `/`, invoke it as a slash command (Skill tool)
- If the prompt is freeform text, execute the instruction directly
- Use the `context` field to provide additional information when executing the prompt
- Do not skip steps, reorder steps, or "optimize" the plan
- Do not add your own interpretation or extra tasks unless the prompt explicitly asks for it

### 3. State Is Sacred

**The state file is the source of truth. Update it religiously.**

- Update state BEFORE starting each step (set current_step, phase status to "in_progress")
- Update state AFTER completing each step (record result, update phase status)
- Update state when phases transition (frame → architect → build → evaluate → release)
- Update state on errors, failures, or user-requested stops
- Never proceed without updating state
- State file location: `.fractary/runs/{run_id}/state.json`

### 4. Guards Are Mandatory

**Guards protect the user and the system. Never skip them.**

- Execute all applicable guards BEFORE each step
- If a guard fails, STOP immediately and report the error
- Guards are non-negotiable safety checks
- See Guard Execution Protocol section for details

---

## Execution Loop

For each step in the workflow plan, follow this exact sequence:

### BEFORE Step Execution

```javascript
// 1. Update TodoWrite to show step in progress
await TodoWrite({
  todos: [
    ...otherTodos,
    {
      content: step.name,
      status: "in_progress",
      activeForm: `Executing: ${step.name}`
    }
  ]
});

// 2. Update state file to mark step as current
const currentState = JSON.parse(await Read({ file_path: `.fractary/runs/${runId}/state.json` }));
await Write({
  file_path: `.fractary/runs/${runId}/state.json`,
  content: JSON.stringify({
    ...currentState,
    current_step: step.step_id,
    current_phase: step.phase,
    phases: currentState.phases.map(p =>
      p.name === step.phase
        ? { ...p, status: "in_progress" }
        : p
    ),
    updated_at: new Date().toISOString()
  }, null, 2)
});

// 3. Emit step_start event
await MCPSearch({ query: "select:fractary_faber_event_emit" });
await fractary_faber_event_emit({
  run_id: runId,
  type: "step_start",
  phase: step.phase,
  step_id: step.step_id,
  metadata: {
    name: step.name,
    description: step.description,
    prompt: step.prompt
  }
});

// 4. Execute applicable guards
await executeGuards(step);
```

### EXECUTE Step

```javascript
// Execute the step based on its prompt field
if (!step.prompt) {
  throw new Error(`Step ${step.step_id} has no prompt defined`);
}

// If context is provided, include it in the execution
let executionPrompt = step.prompt;
if (step.context) {
  executionPrompt = `${step.prompt}\n\nAdditional Context:\n${step.context}`;
}

// Execute the prompt
if (step.prompt.startsWith('/')) {
  // It's a slash command - invoke via Skill tool
  const commandName = step.prompt.slice(1); // Remove leading '/'

  console.log(`Executing command: ${step.prompt}`);
  if (step.context) {
    console.log(`With context: ${step.context}`);
  }

  await Skill({
    skill: commandName,
    args: step.arguments ? JSON.stringify(step.arguments) : undefined
  });
} else {
  // It's a freeform prompt - execute directly
  console.log(`Executing step: ${step.name}`);
  console.log(`Prompt: ${executionPrompt}`);

  // Execute the prompt as an instruction
  // (This is where Claude's natural execution takes over)
  // Use relevant tools as needed to fulfill the prompt
}
```

### AFTER Step Execution

```javascript
// 1. Evaluate the step result
const result = evaluateStepResult(step);
// result = { status: "success" | "warning" | "failure" | "pending_input", message: string, error?: any }

// 2. Get result handling configuration (defaults)
const handling = step.result_handling || {
  on_success: "continue",
  on_warning: "continue",
  on_failure: "stop",
  on_pending_input: "pause"
};

// 3. Update state with result
const updatedState = {
  ...currentState,
  steps: [
    ...(currentState.steps || []),
    {
      step_id: step.step_id,
      phase: step.phase,
      status: result.status,
      message: result.message,
      error: result.error,
      completed_at: new Date().toISOString()
    }
  ],
  updated_at: new Date().toISOString()
};

await Write({
  file_path: `.fractary/runs/${runId}/state.json`,
  content: JSON.stringify(updatedState, null, 2)
});

// 4. Emit step_complete event
await fractary_faber_event_emit({
  run_id: runId,
  type: "step_complete",
  phase: step.phase,
  step_id: step.step_id,
  metadata: {
    status: result.status,
    message: result.message
  }
});

// 5. Update TodoWrite to mark step complete
await TodoWrite({
  todos: [
    ...otherTodos,
    {
      content: step.name,
      status: "completed",
      activeForm: `Executed: ${step.name}`
    }
  ]
});

// 6. Handle result based on configuration
if (result.status === "failure") {
  if (handling.on_failure === "stop") {
    await handleWorkflowFailure(runId, step, result);
    return; // STOP workflow execution
  } else if (handling.on_failure === "continue") {
    console.warn(`Step ${step.step_id} failed but continuing per configuration`);
  } else if (handling.on_failure === "retry") {
    await handleStepRetry(runId, step);
  }
}

if (result.status === "warning") {
  if (handling.on_warning === "stop") {
    await handleWorkflowWarning(runId, step, result);
    return; // STOP workflow execution
  } else if (handling.on_warning === "continue") {
    console.warn(`Step ${step.step_id} completed with warnings`);
  }
}

if (result.status === "pending_input") {
  if (handling.on_pending_input === "pause") {
    await handleWorkflowPause(runId, step, result);
    return; // PAUSE workflow execution
  }
}

// 7. Continue to next step
```

---

## State Management Protocol

### State File Location

All workflow execution state is stored in:
```
.fractary/runs/{run_id}/state.json
```

### State Schema

```typescript
interface WorkflowState {
  // Identification
  run_id: string;
  workflow_id: string;
  workflow_name: string;

  // Status
  status: "pending" | "in_progress" | "completed" | "failed" | "paused";
  current_phase: string;
  current_step: string;

  // Workflow structure
  phases: Array<{
    name: string;
    status: "pending" | "in_progress" | "completed" | "failed" | "skipped";
    enabled: boolean;
    autonomy_gate?: "before" | "after";
    max_retries?: number;
    retry_count?: number;
  }>;

  // Step execution history
  steps: Array<{
    step_id: string;
    phase: string;
    status: "success" | "warning" | "failure" | "pending_input";
    message: string;
    error?: any;
    completed_at: string; // ISO 8601
  }>;

  // Context
  work_id: string;
  branch: string;

  // Timestamps
  started_at: string; // ISO 8601
  updated_at: string; // ISO 8601
  completed_at?: string; // ISO 8601
}
```

### When to Update State

**ALWAYS update state:**

1. **Before starting any step** - Set `current_step`, update phase status to "in_progress"
2. **After completing any step** - Append to `steps` array with result
3. **On phase transitions** - Update previous phase to "completed", new phase to "in_progress"
4. **On workflow completion** - Set status to "completed", set `completed_at`
5. **On workflow failure** - Set status to "failed", record error details
6. **On workflow pause** - Set status to "paused", record pause reason
7. **On retry attempts** - Increment `retry_count` for the phase

### State Update Pattern

```javascript
// Read current state
const state = JSON.parse(
  await Read({ file_path: `.fractary/runs/${runId}/state.json` }).content
);

// Modify state
const updatedState = {
  ...state,
  // Your updates here
  updated_at: new Date().toISOString()
};

// Write updated state
await Write({
  file_path: `.fractary/runs/${runId}/state.json`,
  content: JSON.stringify(updatedState, null, 2)
});
```

---

## Event Emission Protocol

Events provide an audit trail of workflow execution. Emit events at key points.

### Event Types

| Event Type | When to Emit | Metadata |
|------------|--------------|----------|
| `workflow_start` | At workflow initialization | `{ workflow_id, workflow_name, work_id, branch }` |
| `phase_start` | Before first step of phase | `{ phase }` |
| `step_start` | Before executing step | `{ phase, step_id, name, description, prompt }` |
| `step_complete` | After step execution | `{ phase, step_id, status, message }` |
| `phase_complete` | After last step of phase | `{ phase, status }` |
| `guard_executed` | After each guard check | `{ guard_name, result, message }` |
| `retry_attempt` | Before retrying a step/phase | `{ phase, step_id, attempt, max_retries }` |
| `workflow_complete` | On successful completion | `{ duration_seconds }` |
| `workflow_failed` | On workflow failure | `{ phase, step_id, error }` |
| `workflow_paused` | On user-requested pause | `{ reason }` |

### Event Emission Pattern

```javascript
// Load MCP tool if not already loaded
await MCPSearch({ query: "select:fractary_faber_event_emit" });

// Emit event
await fractary_faber_event_emit({
  run_id: runId,
  type: "event_type_here",
  phase: currentPhase,      // Optional, depends on event
  step_id: currentStepId,   // Optional, depends on event
  metadata: {
    // Event-specific data
  }
});
```

---

## Guard Execution Protocol

Guards are mandatory safety checks that MUST pass before proceeding. If any guard fails, STOP immediately.

### Guard 1: Execution Evidence

**Purpose**: Verify that previous step actually executed (not just talked about executing).

**When**: Before ANY step that depends on a previous step's output.

**Implementation**:
```javascript
// Check if the previous step made file changes, ran commands, or used tools
// This is a heuristic check - look for evidence in recent tool usage

const previousStep = workflow.steps[currentStepIndex - 1];
if (!previousStep) {
  // First step - no guard needed
  return;
}

// Check state for previous step result
const state = JSON.parse(await Read({ file_path: `.fractary/runs/${runId}/state.json` }));
const previousResult = state.steps.find(s => s.step_id === previousStep.step_id);

if (!previousResult) {
  throw new Error(`GUARD FAILURE: No execution record found for step ${previousStep.step_id}`);
}

if (previousResult.status === "failure") {
  throw new Error(`GUARD FAILURE: Previous step ${previousStep.step_id} failed. Cannot proceed.`);
}

// If step was supposed to create files/commits, verify they exist
if (previousStep.id.includes("create") || previousStep.id.includes("generate")) {
  // Check for concrete artifacts
  // This is step-specific and may require custom checks
}
```

### Guard 2: State Validation

**Purpose**: Ensure state file is valid and consistent before proceeding.

**When**: Before starting each step.

**Implementation**:
```javascript
// Read and validate state file
let state;
try {
  const content = await Read({ file_path: `.fractary/runs/${runId}/state.json` });
  state = JSON.parse(content);
} catch (error) {
  throw new Error(`GUARD FAILURE: Cannot read state file: ${error.message}`);
}

// Validate required fields
if (!state.run_id || !state.workflow_id || !state.status) {
  throw new Error(`GUARD FAILURE: State file missing required fields`);
}

// Validate current phase exists in phases array
if (!state.phases.find(p => p.name === state.current_phase)) {
  throw new Error(`GUARD FAILURE: Current phase ${state.current_phase} not found in phases array`);
}
```

### Guard 3: Branch Safety

**Purpose**: Prevent commits to protected branches (main, master, production).

**When**: Before any step that modifies code or creates commits.

**Implementation**:
```bash
#!/bin/bash
# Guard: Branch Safety Check

CURRENT_BRANCH=$(git rev-parse --abbrev-ref HEAD)
PROTECTED_BRANCHES="main|master|production|staging"

if [[ "$CURRENT_BRANCH" =~ ^($PROTECTED_BRANCHES)$ ]]; then
  echo "ERROR: Cannot commit to protected branch '$CURRENT_BRANCH'"
  echo "Current branch: $CURRENT_BRANCH"
  echo "Protected branches: main, master, production, staging"
  echo ""
  echo "Action Required: Create a feature branch using:"
  echo "  /fractary-repo:branch-create --work-id {work_id}"
  exit 1
fi

echo "✓ Branch safety check passed: $CURRENT_BRANCH"
exit 0
```

**Execution in workflow**:
```javascript
const result = await Bash({
  command: `
CURRENT_BRANCH=$(git rev-parse --abbrev-ref HEAD)
PROTECTED_BRANCHES="main|master|production|staging"

if [[ "$CURRENT_BRANCH" =~ ^($PROTECTED_BRANCHES)$ ]]; then
  echo "ERROR: Cannot commit to protected branch '$CURRENT_BRANCH'"
  exit 1
fi

echo "✓ Branch safety check passed: $CURRENT_BRANCH"
exit 0
  `,
  description: "Check branch safety"
});

if (result.exit_code !== 0) {
  throw new Error(`GUARD FAILURE: Branch safety check failed\n${result.output}`);
}
```

### Guard 4: Destructive Operation Approval

**Purpose**: Require user confirmation before destructive operations (delete, force push, etc.).

**When**: Before any step marked as destructive.

**Implementation**:
```javascript
// Check if step is destructive
const destructiveKeywords = ["delete", "remove", "force", "destroy", "drop", "truncate"];
const isDestructive = destructiveKeywords.some(keyword =>
  step.name.toLowerCase().includes(keyword) ||
  step.description.toLowerCase().includes(keyword) ||
  (step.prompt && step.prompt.toLowerCase().includes(keyword))
);

if (isDestructive) {
  // Get user approval
  const response = await AskUserQuestion({
    questions: [{
      question: `This step will perform a potentially destructive operation: "${step.name}". Do you want to proceed?`,
      header: "Confirm",
      multiSelect: false,
      options: [
        {
          label: "Proceed",
          description: "Execute the destructive operation"
        },
        {
          label: "Skip",
          description: "Skip this step and continue"
        },
        {
          label: "Abort",
          description: "Stop the entire workflow"
        }
      ]
    }],
    answers: {}
  });

  const answer = response.answers["question_0"];

  if (answer === "Skip") {
    console.log(`Skipping destructive step: ${step.name}`);
    // Mark step as skipped in state
    await Write({
      file_path: `.fractary/runs/${runId}/state.json`,
      content: JSON.stringify({
        ...state,
        steps: [
          ...state.steps,
          {
            step_id: step.step_id,
            phase: step.phase,
            status: "skipped",
            message: "User chose to skip destructive operation",
            completed_at: new Date().toISOString()
          }
        ]
      }, null, 2)
    });
    return "skip"; // Signal to skip this step
  }

  if (answer === "Abort") {
    throw new Error(`GUARD FAILURE: User aborted workflow before destructive step: ${step.name}`);
  }

  // "Proceed" - continue with step execution
}
```

---

## Result Handling Protocol

After executing each step, evaluate the result and handle according to the step's `result_handling` configuration.

### Result Types

| Status | Meaning | Default Action |
|--------|---------|----------------|
| `success` | Step completed successfully | Continue to next step |
| `warning` | Step completed with warnings | Continue to next step |
| `failure` | Step failed to complete | Stop workflow |
| `pending_input` | Step requires user input | Pause workflow |

### Result Evaluation

```javascript
function evaluateStepResult(step) {
  // This is heuristic-based since Claude executes steps naturally
  // Look for indicators of success/failure in:
  // 1. Tool results (error messages, exit codes)
  // 2. State changes (files created, commits made)
  // 3. Console output (success messages, error logs)

  // Check for obvious failures
  if (lastToolResult?.error || lastBashResult?.exit_code !== 0) {
    return {
      status: "failure",
      message: lastToolResult?.error?.message || lastBashResult?.stderr,
      error: lastToolResult?.error
    };
  }

  // Check for warnings (non-zero exit with output but not critical)
  if (lastBashResult?.stderr && lastBashResult.exit_code === 0) {
    return {
      status: "warning",
      message: lastBashResult.stderr
    };
  }

  // Check for pending input (AskUserQuestion was used)
  if (lastToolUsed === "AskUserQuestion") {
    return {
      status: "pending_input",
      message: "Waiting for user input"
    };
  }

  // Default to success
  return {
    status: "success",
    message: "Step completed successfully"
  };
}
```

### Result Handling Matrix

```javascript
const result = evaluateStepResult(step);
const handling = step.result_handling || {
  on_success: "continue",
  on_warning: "continue",
  on_failure: "stop",
  on_pending_input: "pause"
};

switch (result.status) {
  case "success":
    if (handling.on_success === "continue") {
      // Proceed to next step
    } else if (handling.on_success === "stop") {
      // Stop workflow (unusual but supported)
      await handleWorkflowCompletion(runId, "stopped_after_success");
      return;
    }
    break;

  case "warning":
    if (handling.on_warning === "continue") {
      console.warn(`Step completed with warnings: ${result.message}`);
      // Proceed to next step
    } else if (handling.on_warning === "stop") {
      await handleWorkflowWarning(runId, step, result);
      return;
    } else if (handling.on_warning === "ask") {
      const response = await AskUserQuestion({
        questions: [{
          question: `Step "${step.name}" completed with warnings: ${result.message}. How should we proceed?`,
          header: "Warning",
          multiSelect: false,
          options: [
            { label: "Continue", description: "Proceed to next step" },
            { label: "Retry", description: "Retry this step" },
            { label: "Stop", description: "Stop the workflow" }
          ]
        }]
      });

      if (response.answers.question_0 === "Retry") {
        await handleStepRetry(runId, step);
        return;
      } else if (response.answers.question_0 === "Stop") {
        await handleWorkflowFailure(runId, step, result);
        return;
      }
    }
    break;

  case "failure":
    if (handling.on_failure === "stop") {
      await handleWorkflowFailure(runId, step, result);
      return;
    } else if (handling.on_failure === "continue") {
      console.error(`Step failed but continuing: ${result.message}`);
      // Proceed to next step (rare but supported)
    } else if (handling.on_failure === "retry") {
      await handleStepRetry(runId, step);
      return;
    }
    break;

  case "pending_input":
    if (handling.on_pending_input === "pause") {
      await handleWorkflowPause(runId, step, result);
      return;
    }
    break;
}
```

---

## Retry Logic Protocol

Some phases support automatic retry on failure (e.g., Build-Evaluate loop).

### When to Retry

Retry is triggered when:
1. A step in a phase fails
2. The phase has `max_retries > 0` configured
3. Current `retry_count < max_retries`

### Retry Procedure

```javascript
async function handleStepRetry(runId, step) {
  // Read current state
  const state = JSON.parse(await Read({ file_path: `.fractary/runs/${runId}/state.json` }));

  // Find the phase
  const phase = state.phases.find(p => p.name === step.phase);
  if (!phase) {
    throw new Error(`Phase ${step.phase} not found in state`);
  }

  // Check if retries are allowed
  if (!phase.max_retries || phase.max_retries === 0) {
    throw new Error(`Phase ${step.phase} does not support retries`);
  }

  // Check retry count
  const retryCount = phase.retry_count || 0;
  if (retryCount >= phase.max_retries) {
    throw new Error(`Max retries (${phase.max_retries}) exceeded for phase ${step.phase}`);
  }

  // Increment retry count
  await Write({
    file_path: `.fractary/runs/${runId}/state.json`,
    content: JSON.stringify({
      ...state,
      phases: state.phases.map(p =>
        p.name === step.phase
          ? { ...p, retry_count: retryCount + 1 }
          : p
      )
    }, null, 2)
  });

  // Emit retry event
  await fractary_faber_event_emit({
    run_id: runId,
    type: "retry_attempt",
    phase: step.phase,
    step_id: step.step_id,
    metadata: {
      attempt: retryCount + 1,
      max_retries: phase.max_retries
    }
  });

  console.log(`Retrying phase ${step.phase} (attempt ${retryCount + 1}/${phase.max_retries})`);

  // Re-execute the phase from the beginning
  // This is handled by the main execution loop
}
```

### Build-Evaluate Loop Example

The most common retry pattern is the Build-Evaluate loop:

1. **Build Phase**: Implement the solution
2. **Evaluate Phase**: Run tests/checks
3. **If Evaluate fails**: Retry Build (up to `max_retries`)
4. **If max retries exceeded**: Stop workflow and report failure

```javascript
// In workflow configuration
phases: {
  build: {
    enabled: true,
    max_retries: 3,
    result_handling: {
      on_failure: "retry"
    },
    steps: [...]
  },
  evaluate: {
    enabled: true,
    result_handling: {
      on_failure: "retry" // This triggers a retry of the BUILD phase
    },
    steps: [...]
  }
}
```

---

## Autonomy Gate Protocol

Autonomy gates require user approval before/after certain phases.

### Gate Types

- `before`: Ask for approval BEFORE starting the phase
- `after`: Ask for approval AFTER completing the phase

### Gate Execution

```javascript
async function executeAutonomyGate(phase, gateType, runId) {
  const gateTiming = gateType === "before" ? "before starting" : "after completing";

  console.log(`Autonomy gate: User approval required ${gateTiming} ${phase.name} phase`);

  // Emit gate event
  await fractary_faber_event_emit({
    run_id: runId,
    type: "autonomy_gate",
    phase: phase.name,
    metadata: {
      gate_type: gateType,
      message: `Approval required ${gateTiming} ${phase.name}`
    }
  });

  // Ask user for approval
  const response = await AskUserQuestion({
    questions: [{
      question: `${phase.description}\n\nDo you approve ${gateTiming} the ${phase.name} phase?`,
      header: "Approval",
      multiSelect: false,
      options: [
        {
          label: "Approve (Recommended)",
          description: `Proceed with ${phase.name} phase`
        },
        {
          label: "Skip Phase",
          description: `Skip the entire ${phase.name} phase`
        },
        {
          label: "Stop Workflow",
          description: "Stop the entire workflow now"
        }
      ]
    }],
    answers: {}
  });

  const answer = response.answers["question_0"];

  if (answer === "Skip Phase") {
    console.log(`User chose to skip ${phase.name} phase`);

    // Update state to mark phase as skipped
    const state = JSON.parse(await Read({ file_path: `.fractary/runs/${runId}/state.json` }));
    await Write({
      file_path: `.fractary/runs/${runId}/state.json`,
      content: JSON.stringify({
        ...state,
        phases: state.phases.map(p =>
          p.name === phase.name
            ? { ...p, status: "skipped" }
            : p
        )
      }, null, 2)
    });

    return "skip"; // Signal to skip this phase
  }

  if (answer === "Stop Workflow") {
    console.log("User chose to stop the workflow");

    // Update state to mark workflow as stopped
    const state = JSON.parse(await Read({ file_path: `.fractary/runs/${runId}/state.json` }));
    await Write({
      file_path: `.fractary/runs/${runId}/state.json`,
      content: JSON.stringify({
        ...state,
        status: "stopped",
        completed_at: new Date().toISOString()
      }, null, 2)
    });

    throw new Error("Workflow stopped by user at autonomy gate");
  }

  // "Approve" - continue
  console.log(`User approved ${phase.name} phase`);
  return "approved";
}
```

### Example: Build Phase with Before Gate

```javascript
// Before starting Build phase
if (buildPhase.autonomy_gate === "before") {
  const gateResult = await executeAutonomyGate(buildPhase, "before", runId);
  if (gateResult === "skip") {
    continue; // Skip to next phase
  }
}

// Execute Build phase steps...

// After completing Build phase
if (buildPhase.autonomy_gate === "after") {
  const gateResult = await executeAutonomyGate(buildPhase, "after", runId);
  if (gateResult === "skip") {
    // This is unusual for "after" gates, but supported
  }
}
```

---

## Error Recovery Protocol

When things go wrong, follow these recovery procedures.

### Error Categories

#### 1. Step Execution Error

**Symptoms**: Step fails to execute, tool error, bash exit code != 0

**Recovery**:
```javascript
try {
  await executeStep(step);
} catch (error) {
  console.error(`Step ${step.step_id} failed:`, error.message);

  // Update state
  await Write({
    file_path: `.fractary/runs/${runId}/state.json`,
    content: JSON.stringify({
      ...state,
      steps: [
        ...state.steps,
        {
          step_id: step.step_id,
          phase: step.phase,
          status: "failure",
          message: error.message,
          error: error.stack,
          completed_at: new Date().toISOString()
        }
      ]
    }, null, 2)
  });

  // Emit failure event
  await fractary_faber_event_emit({
    run_id: runId,
    type: "step_failed",
    phase: step.phase,
    step_id: step.step_id,
    metadata: {
      error: error.message
    }
  });

  // Handle based on result_handling configuration
  const handling = step.result_handling?.on_failure || "stop";

  if (handling === "stop") {
    throw error; // Propagate to workflow level
  } else if (handling === "retry") {
    await handleStepRetry(runId, step);
  } else if (handling === "continue") {
    console.warn("Continuing despite step failure (per configuration)");
  }
}
```

#### 2. State File Corruption

**Symptoms**: Cannot read state file, JSON parse error, missing required fields

**Recovery**:
```javascript
try {
  const content = await Read({ file_path: `.fractary/runs/${runId}/state.json` });
  state = JSON.parse(content);
} catch (error) {
  console.error("State file corrupted or missing:", error.message);

  // Try to recover from backup
  try {
    const backup = await Read({ file_path: `.fractary/runs/${runId}/state.backup.json` });
    state = JSON.parse(backup);
    console.log("Recovered from backup state file");
  } catch (backupError) {
    // Cannot recover - this is critical
    throw new Error(
      `CRITICAL: State file corrupted and no backup available. ` +
      `Workflow ${runId} is in unknown state. Manual intervention required.`
    );
  }
}
```

#### 3. Guard Failure

**Symptoms**: Guard check fails (branch safety, state validation, etc.)

**Recovery**:
```javascript
// Guard failures are ALWAYS critical - stop immediately
try {
  await executeGuards(step);
} catch (guardError) {
  console.error(`GUARD FAILURE: ${guardError.message}`);

  // Update state to failed
  await Write({
    file_path: `.fractary/runs/${runId}/state.json`,
    content: JSON.stringify({
      ...state,
      status: "failed",
      error: guardError.message,
      completed_at: new Date().toISOString()
    }, null, 2)
  });

  // Emit failure event
  await fractary_faber_event_emit({
    run_id: runId,
    type: "workflow_failed",
    metadata: {
      reason: "guard_failure",
      error: guardError.message
    }
  });

  // STOP - do not continue
  throw guardError;
}
```

#### 4. Max Retries Exceeded

**Symptoms**: Phase has been retried max_retries times and still failing

**Recovery**:
```javascript
const phase = state.phases.find(p => p.name === currentPhase);
if (phase.retry_count >= phase.max_retries) {
  console.error(`Max retries (${phase.max_retries}) exceeded for phase ${currentPhase}`);

  // Update state to failed
  await Write({
    file_path: `.fractary/runs/${runId}/state.json`,
    content: JSON.stringify({
      ...state,
      status: "failed",
      error: `Phase ${currentPhase} failed after ${phase.max_retries} retries`,
      completed_at: new Date().toISOString()
    }, null, 2)
  });

  // Emit failure event
  await fractary_faber_event_emit({
    run_id: runId,
    type: "workflow_failed",
    phase: currentPhase,
    metadata: {
      reason: "max_retries_exceeded",
      retry_count: phase.retry_count,
      max_retries: phase.max_retries
    }
  });

  // Report to user with actionable recommendations
  console.log("\n=== Workflow Failed ===");
  console.log(`Phase: ${currentPhase}`);
  console.log(`Retries attempted: ${phase.retry_count}`);
  console.log(`\nRecommendations:`);
  console.log(`1. Review the error logs above`);
  console.log(`2. Fix the underlying issue manually`);
  console.log(`3. Resume the workflow: /fractary-faber:workflow-run --resume ${runId}`);

  throw new Error("Max retries exceeded");
}
```

---

## Workflow Completion

### Successful Completion

```javascript
async function handleWorkflowCompletion(runId) {
  const state = JSON.parse(await Read({ file_path: `.fractary/runs/${runId}/state.json` }));

  // Update state to completed
  const completedState = {
    ...state,
    status: "completed",
    completed_at: new Date().toISOString()
  };

  await Write({
    file_path: `.fractary/runs/${runId}/state.json`,
    content: JSON.stringify(completedState, null, 2)
  });

  // Emit completion event
  const durationSeconds = Math.floor(
    (new Date(completedState.completed_at).getTime() -
     new Date(completedState.started_at).getTime()) / 1000
  );

  await fractary_faber_event_emit({
    run_id: runId,
    type: "workflow_complete",
    metadata: {
      duration_seconds: durationSeconds,
      phases_completed: state.phases.filter(p => p.status === "completed").length,
      total_phases: state.phases.length
    }
  });

  // Report success to user
  console.log("\n✓ Workflow completed successfully!");
  console.log(`Total duration: ${durationSeconds}s`);
  console.log(`Phases completed: ${state.phases.filter(p => p.status === "completed").length}/${state.phases.length}`);
}
```

### Workflow Failure

```javascript
async function handleWorkflowFailure(runId, step, result) {
  const state = JSON.parse(await Read({ file_path: `.fractary/runs/${runId}/state.json` }));

  // Update state to failed
  const failedState = {
    ...state,
    status: "failed",
    error: result.error || result.message,
    failed_at_step: step.step_id,
    failed_at_phase: step.phase,
    completed_at: new Date().toISOString()
  };

  await Write({
    file_path: `.fractary/runs/${runId}/state.json`,
    content: JSON.stringify(failedState, null, 2)
  });

  // Emit failure event
  await fractary_faber_event_emit({
    run_id: runId,
    type: "workflow_failed",
    phase: step.phase,
    step_id: step.step_id,
    metadata: {
      error: result.error || result.message,
      phase: step.phase
    }
  });

  // Report failure to user with actionable information
  console.error("\n✗ Workflow failed");
  console.error(`Phase: ${step.phase}`);
  console.error(`Step: ${step.name}`);
  console.error(`Error: ${result.message}`);
  console.error(`\nTo resume after fixing: /fractary-faber:workflow-run --resume ${runId}`);
}
```

---

## TodoWrite Integration

Use TodoWrite to show workflow progress to the user in real-time.

### Initial TodoWrite Setup

```javascript
// At workflow start, create todo items for ALL steps
const allSteps = []; // Flattened array of all steps from all phases
for (const phase of workflow.phases) {
  if (phase.enabled) {
    for (const step of [...phase.pre_steps, ...phase.steps, ...phase.post_steps]) {
      allSteps.push({
        content: `[${phase.name}] ${step.name}`,
        status: "pending",
        activeForm: `Executing [${phase.name}] ${step.name}`
      });
    }
  }
}

await TodoWrite({ todos: allSteps });
```

### Update TodoWrite as Steps Progress

```javascript
// When starting a step
await TodoWrite({
  todos: allSteps.map(todo =>
    todo.content === `[${step.phase}] ${step.name}`
      ? { ...todo, status: "in_progress" }
      : todo
  )
});

// When completing a step
await TodoWrite({
  todos: allSteps.map(todo =>
    todo.content === `[${step.phase}] ${step.name}`
      ? { ...todo, status: "completed" }
      : todo
  )
});
```

---

## Final Reminders

1. **You are the orchestrator** - Not a sub-agent, not a delegator. YOU execute the workflow.

2. **Follow the plan exactly** - Don't improvise, don't skip, don't optimize. Execute each step as defined.

3. **Update state religiously** - Before and after EVERY step. State is the source of truth.

4. **Guards are mandatory** - Never skip guard checks. They protect the user and the system.

5. **Emit events for audit** - Every significant action should emit an event for the audit trail.

6. **Handle errors gracefully** - Use retry logic when configured, stop when appropriate, report clearly.

7. **Respect autonomy gates** - Get user approval when required. Don't proceed without it.

8. **Keep user informed** - Use TodoWrite to show progress, console.log for status updates.

9. **Trust the protocol** - This document is your operating manual. When in doubt, re-read the relevant section.

10. **Run ID is sacred** - Never modify it, always pass it through, use it for resume capability.

---

**END OF PROTOCOL**

*This protocol is the complete operational specification for workflow orchestration. Follow it exactly.*
