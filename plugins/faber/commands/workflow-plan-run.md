---
name: fractary-faber:workflow-plan-run
description: Create FABER plan and execute it in one command with intelligent auto-resume
argument-hint: '[<target>] [--work-id <id>] [--workflow <id>] [--phase <phases>] [--step <step-id>] [--resume <run-id>] [--worktree] [--force-new]'
allowed-tools: Task, Read, Write, Bash, Skill, AskUserQuestion, MCPSearch, TodoWrite
model: claude-sonnet-4-5
---

# FABER Plan-Run Command

<CONTEXT>
You are executing a unified FABER workflow that combines planning and execution in a single invocation.

**Your job**: Create a plan (or auto-resume existing work), then execute the workflow with YOU as the primary orchestrator.

This command eliminates the manual step of running plan then run separately. It intelligently detects incomplete work and resumes automatically.
</CONTEXT>

<CRITICAL_RULES>
1. **AUTO-RESUME INTELLIGENCE** - Check for incomplete runs matching the work_id before planning
2. **YOU ARE THE ORCHESTRATOR** - Not delegating to sub-agent for execution. You execute the workflow.
3. **FOLLOW THE PROTOCOL** - The orchestration protocol is your instruction manual for execution
4. **MAINTAIN STATE** - Update state file BEFORE and AFTER every step
5. **EXECUTE GUARDS** - All guards are mandatory during execution
6. **USE TODOWRITE** - Track progress throughout both planning and execution phases
7. **EMIT EVENTS** - Every significant action emits an event for audit trail
8. **BRIEF TRANSITION** - Show plan summary (ID, workflow, steps) then immediately execute
</CRITICAL_RULES>

<INPUTS>

**Syntax:**
```bash
/fractary-faber:workflow-plan-run [<target>] [options]
```

**Arguments:**
| Argument | Type | Required | Description |
|----------|------|----------|-------------|
| `<target>` | string | No | What to work on. Supports wildcards (e.g., `ipeds/*`) |

**Options:**
| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `--work-id <id>` | string | - | Work item ID(s). Comma-separated for multiple |
| `--workflow <id>` | string | (from config) | Workflow to use |
| `--autonomy <level>` | string | `guarded` | Autonomy level |
| `--phase <phases>` | string | all | Comma-separated phases to execute |
| `--step <step-id>` | string | - | Specific step(s) to execute (format: `phase:step-name`) |
| `--prompt "<text>"` | string | - | Additional instructions |
| `--resume <run-id>` | string | - | Resume specific run ID (skips planning, goes straight to execution) |
| `--force-new` | flag | false | Force fresh start, bypass auto-resume |
| `--worktree` | flag | false | Automatically create worktree on conflict without prompting |

**Examples:**
```bash
# Single work item - most common
/fractary-faber:workflow-plan-run --work-id 24

# Target-based (no work_id)
/fractary-faber:workflow-plan-run ipeds/admissions

# Specific phases only
/fractary-faber:workflow-plan-run --work-id 24 --phase build,evaluate

# Force new run (bypass auto-resume)
/fractary-faber:workflow-plan-run --work-id 24 --force-new

# Resume specific run (skips planning)
/fractary-faber:workflow-plan-run --work-id 24 --resume fractary-faber-24-...-run-20260105-143022

# With workflow override
/fractary-faber:workflow-plan-run --work-id 24 --workflow data-pipeline

# Auto-create worktree on conflict (no prompt)
/fractary-faber:workflow-plan-run --work-id 24 --worktree
```

</INPUTS>

<WORKFLOW>

## Phase 1: Initialization and Auto-Resume Detection

### Step 1.1: Parse Arguments

Extract from user input:
1. `target`: First positional argument (optional)
2. `work_id`: Value of `--work-id` flag
3. `workflow_override`: Value of `--workflow` flag
4. `autonomy_override`: Value of `--autonomy` flag
5. `phases`: Value of `--phase` flag
6. `step_id`: Value of `--step` flag
7. `prompt`: Value of `--prompt` flag
8. `resume_run_id`: Value of `--resume` flag (optional)
9. `force_new`: Boolean flag for `--force-new` (default false)
10. `auto_worktree`: Boolean flag for `--worktree` (default false)

**Validation:**
- Either `target` OR `work_id` must be provided (unless `--resume` is specified)
- If both `--phase` and `--step`: show error (mutually exclusive)
- If `force_new` is true: note that auto-resume will be bypassed
- If `resume_run_id` is provided: skip planning phase entirely, go straight to execution
- Cannot specify both `--resume` and `--force-new` (mutually exclusive)

```javascript
// Parse arguments
const target = extractPositionalArg(userInput);
const work_id = extractFlag(userInput, '--work-id');
const workflow_override = extractFlag(userInput, '--workflow');
const autonomy_override = extractFlag(userInput, '--autonomy');
const phases = extractFlag(userInput, '--phase');
const step_id = extractFlag(userInput, '--step');
const prompt = extractFlag(userInput, '--prompt');
const force_new = hasFlag(userInput, '--force-new');

// Validation
if (!target && !work_id) {
  console.error("Error: Either <target> or --work-id is required\n");
  console.error("Usage: /fractary-faber:workflow-plan-run [<target>] [options]\n");
  console.error("Examples:");
  console.error("  /fractary-faber:workflow-plan-run customer-pipeline");
  console.error("  /fractary-faber:workflow-plan-run --work-id 158");
  return;
}

if (phases && step_id) {
  console.error("Error: Cannot specify both --phase and --step");
  return;
}
```

### Step 1.2: Handle Explicit Resume or Auto-Resume Detection

**Initialize workflow state variables:**

```javascript
// Declare workflow control variables at start
let plan_id = null;
let skipPlanning = false;
```

**If --resume provided, skip planning and go straight to execution:**

```javascript
if (resume_run_id) {
  console.log("\n→ Explicit resume requested");
  console.log(`Resume run ID: ${resume_run_id}`);

  // Validate the run exists
  const statePath = `.fractary/runs/${resume_run_id}/state.json`;
  try {
    const stateContent = await Read({ file_path: statePath });
    const state = JSON.parse(stateContent);

    console.log(`✓ Found run: ${resume_run_id}`);
    console.log(`  Status: ${state.status}`);
    console.log(`  Current phase: ${state.current_phase || 'not started'}`);
    console.log(`  Plan ID: ${state.plan_id}`);

    // Set plan_id from the state
    plan_id = state.plan_id;

    // Skip planning phases - go straight to execution
    skipPlanning = true;
    console.log("\n→ Skipping planning, resuming execution...\n");

  } catch (error) {
    console.error(`\n✗ Error: Run ID not found: ${resume_run_id}`);
    console.error(`State file: ${statePath}`);
    console.error(`\nUse /fractary-faber:status to list available runs`);
    throw new Error("Invalid run ID");
  }
}

// Only do auto-resume detection if --resume not provided
if (!resume_run_id && !force_new && work_id) {
  console.log("→ Checking for incomplete runs...\n");

  // Find all state files
  const findOutput = await Bash({
    command: `find .fractary/runs -name "state.json" -type f 2>/dev/null || true`,
    description: "Find all workflow state files"
  });

  if (findOutput.stdout.trim()) {
    const statePaths = findOutput.stdout.trim().split('\n').filter(Boolean);
    const incompleteRuns = [];

    for (const statePath of statePaths) {
      try {
        const stateContent = await Read({ file_path: statePath });
        const state = JSON.parse(stateContent);

        // Validate state structure before using
        if (!state || typeof state !== 'object') {
          console.log(`Warning: Invalid state structure at ${statePath}, skipping`);
          continue;
        }

        // Check if this state matches our work_id and is incomplete
        if (state.work_id === work_id &&
            (state.status === "in_progress" || state.status === "failed")) {
          incompleteRuns.push(state);
        }
      } catch (error) {
        // Skip corrupted, unreadable, or malformed state files
        console.log(`Warning: Skipping corrupted state file at ${statePath}: ${error.message}`);
        continue;
      }
    }

    if (incompleteRuns.length > 0) {
      // Use most recent incomplete run (by started_at timestamp)
      incompleteRuns.sort((a, b) =>
        new Date(b.started_at) - new Date(a.started_at)
      );
      const latestRun = incompleteRuns[0];

      console.log("✓ Incomplete run detected");
      console.log(`  Run ID: ${latestRun.run_id}`);
      console.log(`  Plan ID: ${latestRun.plan_id}`);
      console.log(`  Status: ${latestRun.status}`);
      console.log(`  Last phase: ${latestRun.current_phase || 'not started'}`);
      console.log(`  Last step: ${latestRun.current_step || 'not started'}`);
      console.log("\n→ Auto-resuming from where you left off...\n");

      // Skip planning, use existing plan
      plan_id = latestRun.plan_id;
      resume_run_id = latestRun.run_id;
      skipPlanning = true;
    } else {
      console.log("  No incomplete runs found. Creating new plan.\n");
    }
  } else {
    console.log("  No previous runs found. Creating new plan.\n");
  }
} else if (force_new) {
  console.log("→ --force-new specified. Bypassing auto-resume.\n");
} else {
  // Target-based planning without work_id - skip auto-resume
  console.log("→ Target-based planning. Creating new plan.\n");
}
```

## Phase 2: Planning (CONDITIONAL)

**If skipPlanning is false (no auto-resume detected):**

### Step 2.1: Initialize Planning Todo

```javascript
await TodoWrite({
  todos: [{
    content: "Create FABER execution plan",
    status: "in_progress",
    activeForm: "Creating FABER execution plan"
  }]
});
```

### Step 2.2: Invoke faber-planner with Auto-Execute

```javascript
console.log("→ Creating execution plan...\n");

// Build parameters object (only include provided parameters)
const plannerParams = `<parameters>
  ${target ? `target: ${target}` : ''}
  ${work_id ? `work_id: ${work_id}` : ''}
  ${workflow_override ? `workflow_override: ${workflow_override}` : ''}
  ${autonomy_override ? `autonomy_override: ${autonomy_override}` : ''}
  ${phases ? `phases: ${phases}` : ''}
  ${step_id ? `step_id: ${step_id}` : ''}
  ${prompt ? `prompt: ${prompt}` : ''}
  working_directory: ${process.cwd()}
  auto_execute: true
</parameters>`;

// Invoke planner agent
try {
  const plannerResult = await Task({
    subagent_type: "fractary-faber:faber-planner",
    description: `Create FABER plan for ${work_id ? `work item ${work_id}` : `target ${target}`}`,
    prompt: plannerParams
  });

  // Extract plan_id from planner response
  // Look for pattern: "plan_id: {id}"
  const planIdMatch = plannerResult.response.match(/plan_id:\s*([^\s\n]+)/);
  if (planIdMatch) {
    plan_id = planIdMatch[1];
    console.log(`\n✓ Plan created: ${plan_id}`);
  } else {
    console.error("Error: Failed to extract plan_id from planner response");
    throw new Error("Planning failed - no plan_id returned");
  }
} catch (error) {
  // Planning failed
  await TodoWrite({
    todos: [{
      content: "Create FABER execution plan",
      status: "completed",
      activeForm: "Planning failed"
    }]
  });

  console.error("\n✗ Planning failed");
  console.error(`Error: ${error.message}`);
  console.error("\nYou can try:");
  console.error(`  /fractary-faber:workflow-plan ${work_id ? `--work-id ${work_id}` : target}`);
  throw error;
}
```

## Phase 3: Load Plan and Update Todos

### Step 3.1: Load Plan File

```javascript
// Load the plan file
const planPath = `logs/fractary/plugins/faber/plans/${plan_id}.json`;
let fullPlan;

try {
  const planContent = await Read({ file_path: planPath });
  fullPlan = JSON.parse(planContent);
} catch (error) {
  console.error(`\n✗ Failed to load plan file: ${planPath}`);
  console.error(`Error: ${error.message}`);
  throw error;
}
```

### Step 3.2: Display Brief Plan Summary

```javascript
// Count total steps across all phases
let totalSteps = 0;
let enabledPhases = 0;

for (const phaseName of Object.keys(fullPlan.workflow.phases)) {
  const phase = fullPlan.workflow.phases[phaseName];
  if (phase.enabled !== false) {
    enabledPhases++;
    totalSteps += (phase.steps || []).length;
  }
}

console.log("\n" + "=".repeat(60));
console.log("PLAN DETAILS");
console.log("=".repeat(60));
console.log(`Plan ID: ${plan_id}`);
console.log(`Workflow: ${fullPlan.workflow.id}`);
console.log(`Phases: ${enabledPhases}`);
console.log(`Total Steps: ${totalSteps}`);
console.log("=".repeat(60) + "\n");
```

### Step 3.3: Build and Update Todo List

```javascript
// Build todo list from all workflow steps
const allSteps = [];

for (const phaseName of Object.keys(fullPlan.workflow.phases)) {
  const phase = fullPlan.workflow.phases[phaseName];
  if (phase.enabled === false) continue;

  const phaseSteps = phase.steps || [];
  for (const step of phaseSteps) {
    allSteps.push({
      content: `[${phaseName}] ${step.name} (${step.id})`,
      status: "pending",
      activeForm: `Executing [${phaseName}] ${step.name}`
    });
  }
}

await TodoWrite({ todos: allSteps });

console.log(`✓ ${allSteps.length} steps ready for execution\n`);
```

## Phase 4: Transition to Execution

```javascript
console.log("=".repeat(60));
console.log("STARTING WORKFLOW EXECUTION");
console.log("=".repeat(60) + "\n");
```

## Phase 5: Execute Workflow

**NOW INLINE THE COMPLETE WORKFLOW-RUN EXECUTION LOGIC**

Starting from workflow-run.md Step 1.2 (Load Orchestration Protocol) through completion.

### Step 5.1: Load Orchestration Protocol

**YOU MUST READ THE ORCHESTRATION PROTOCOL INTO YOUR CONTEXT.**

The protocol defines how you execute workflows. It is your operating manual.

```bash
# Determine marketplace root (where all plugin marketplaces live)
MARKETPLACE_ROOT="${CLAUDE_MARKETPLACE_ROOT:-$HOME/.claude/plugins/marketplaces}"

# Read the orchestration protocol from the marketplace
Read(file_path: "${MARKETPLACE_ROOT}/fractary-faber/plugins/faber/docs/workflow-orchestration-protocol.md")

# Output confirmation to user
✓ Loaded orchestration protocol
Protocol: ${MARKETPLACE_ROOT}/fractary-faber/plugins/faber/docs/workflow-orchestration-protocol.md
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

### Step 5.2: Initialize or Resume Run State

**Extract workflow and work items from plan:**

```javascript
const workflow = fullPlan.workflow;
const workItems = fullPlan.items;
const autonomy = fullPlan.autonomy || "guarded";
const work_id = workItems.length === 1 ? workItems[0].work_id : null;
```

**If resuming (resume_run_id is set from auto-detection):**

```javascript
if (resume_run_id) {
  // Resume from previous run
  const runId = resume_run_id;
  const statePath = `.fractary/runs/${runId}/state.json`;

  // Read existing state
  const state = JSON.parse(await Read({ file_path: statePath }));

  console.log("✓ Resuming workflow");
  console.log(`Run ID: ${runId}`);
  console.log(`Plan ID: ${state.plan_id}`);
  console.log(`Current phase: ${state.current_phase}`);
  console.log(`Current step: ${state.current_step}`);

  // Verify plan_id matches
  if (state.plan_id !== plan_id) {
    console.error(`Error: Plan ID mismatch. State has ${state.plan_id}, current ${plan_id}`);
    throw new Error("Plan ID mismatch");
  }
} else {
  // Create new run
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
  const runId = `${plan_id}-run-${timestamp}`;
  const statePath = `.fractary/runs/${runId}/state.json`;

  console.log("✓ Starting new workflow execution");
  console.log(`Run ID: ${runId}`);

  // Initialize state file
  const initialState = {
    run_id: runId,
    plan_id: plan_id,
    workflow_id: workflow.id,
    workflow_name: workflow.id,
    status: "pending",
    current_phase: null,
    current_step: null,
    work_id: work_id,
    work_items: workItems,
    branch: null,
    autonomy: autonomy,
    phases: Object.keys(workflow.phases).map(phaseName => {
      const p = workflow.phases[phaseName];
      return {
        name: phaseName,
        status: "pending",
        enabled: p.enabled !== false,
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
}
```

### Step 5.3: Track Active Workflow

**Track this workflow as the active workflow in the worktree:**

```javascript
// Ensure .fractary/faber directory exists
await Bash({
  command: "mkdir -p .fractary/faber",
  description: "Create faber tracking directory"
});

// Check if another workflow is active
const activeRunIdPath = ".fractary/faber/.active-run-id";
let existingRunId = null;

try {
  const existingContent = await Read({ file_path: activeRunIdPath });
  existingRunId = existingContent.trim();
} catch (error) {
  existingRunId = null;
}

// If another workflow is active and different from current
if (existingRunId && existingRunId !== runId) {
  console.log("\n⚠️  WARNING: Another workflow is active in this worktree");
  console.log(`   Active: ${existingRunId}`);
  console.log(`   New: ${runId}`);
  console.log("");
  console.log("For concurrent workflows, it's recommended to use separate worktrees.");
  console.log("");

  // If --worktree flag provided, automatically create worktree without prompting
  let answer;
  if (auto_worktree) {
    console.log("→ --worktree flag detected: automatically creating new worktree");
    answer = "Create new worktree (Recommended)";
  } else {
    // Ask user what they want to do
    const confirmation = await AskUserQuestion({
      questions: [{
        question: "How would you like to proceed?",
        header: "Action",
        multiSelect: false,
        options: [
          {
            label: "Create new worktree (Recommended)",
            description: "Automatically create a new git worktree and start workflow there"
          },
          {
            label: "Take over this worktree",
            description: "Stop tracking other workflow and use this worktree (may cause conflicts)"
          },
          {
            label: "Cancel",
            description: "Stop and manually manage worktrees"
          }
        ]
      }]
    });

    answer = confirmation.answers["0"];
  }

  if (answer === "Cancel") {
    console.log("\n❌ Workflow start cancelled.");
    console.log("\nTo manually create a worktree:");
    console.log("  git worktree add ../myproject-issue-XXX -b feature/XXX");
    console.log("  cd ../myproject-issue-XXX");
    console.log("  /fractary-faber:workflow-plan-run --work-id XXX");
    throw new Error("User cancelled due to active workflow conflict");
  }

  if (answer === "Create new worktree (Recommended)") {
    console.log("\n→ Creating new worktree...");

    // Determine worktree path
    const projectName = await Bash({
      command: "basename $(git rev-parse --show-toplevel)",
      description: "Get project name"
    });
    const worktreePath = `../${projectName.stdout.trim()}-${work_id || 'workflow'}`;

    // Determine branch name
    const branchName = work_id ? `feature/${work_id}` : `workflow/${Date.now()}`;

    console.log(`Worktree path: ${worktreePath}`);
    console.log(`Branch: ${branchName}`);
    console.log("");

    // Call fractary-repo:worktree-create
    try {
      await Skill({
        skill: "fractary-repo:worktree-create",
        args: `--work-id ${work_id || 'workflow'} --branch ${branchName} --path ${worktreePath}`
      });

      console.log("✓ Worktree created successfully");

      // Note: State will be created in new worktree with worktree metadata
      // Global tracking will be updated below

      console.log("\n✓ Worktree tracking will be updated after state initialization");
      console.log(`\n📁 Worktree location: ${worktreePath}`);
      console.log(`📌 To return to main worktree: cd ${process.cwd()}`);
      console.log(`\n→ Continuing workflow in new worktree...\n`);

    } catch (error) {
      console.error("\n✗ Failed to create worktree");
      console.error(`Error: ${error.message}`);
      console.error("\nNote: The /fractary-repo:worktree-create command may not be available yet.");
      console.error("Falling back to manual worktree creation instructions.");
      console.error("\nTo manually create a worktree:");
      console.error(`  git worktree add ${worktreePath} -b ${branchName}`);
      console.error(`  cd ${worktreePath}`);
      console.error("  /fractary-faber:workflow-plan-run --work-id XXX");
      throw new Error("Worktree creation failed");
    }
  } else {
    // User chose "Take over this worktree"
    console.log("\n⚠️  Taking over this worktree...");
    console.log("   The other workflow's context management will be interrupted.");
  }
}

// Write current run_id to active-run-id file
await Write({
  file_path: activeRunIdPath,
  content: runId
});

console.log("✓ Workflow tracked as active");
console.log(`Active run ID: ${runId}`);
```

### Step 5.4: Load MCP Event Tool

```javascript
// Load the fractary_faber_event_emit MCP tool
await MCPSearch({ query: "select:fractary_faber_event_emit" });

// Emit workflow_start event
await fractary_faber_event_emit({
  run_id: runId,
  type: "workflow_start",
  metadata: {
    plan_id: plan_id,
    workflow_id: workflow.id,
    work_id: work_id,
    work_items_count: workItems.length
  }
});

console.log("✓ Event system ready");
```

### Step 5.5: Apply Phase/Step Filters

**If phase or step filters were provided in original arguments:**

```javascript
// If phase or step filters are specified, filter the workflow
if (phases || step_id) {
  console.log("✓ Applying filters...");

  const phaseFilter = phases ? phases.split(',').map(p => p.trim()) : null;
  const stepFilter = step_id ? step_id.split(',').map(s => s.trim()) : null;

  if (phaseFilter) {
    console.log(`Filtering to phases: ${phaseFilter.join(', ')}`);

    // Validate and disable phases not in filter
    for (const phaseName of Object.keys(workflow.phases)) {
      if (!phaseFilter.includes(phaseName)) {
        workflow.phases[phaseName].enabled = false;
      }
    }
  }

  if (stepFilter) {
    console.log(`Filtering to steps: ${stepFilter.join(', ')}`);

    // Filter steps in each phase
    for (const phaseName of Object.keys(workflow.phases)) {
      const phase = workflow.phases[phaseName];
      const phaseSteps = phase.steps || [];

      const filteredSteps = phaseSteps.filter(step => stepFilter.includes(step.step_id));

      if (filteredSteps.length === 0) {
        phase.enabled = false;
      } else {
        phase.steps = filteredSteps;
      }
    }
  }

  console.log("✓ Filters applied");
}
```

### Step 5.6: Execute Workflow Following Orchestration Protocol

**YOU MUST NOW EXECUTE THE WORKFLOW FOLLOWING THE ORCHESTRATION PROTOCOL.**

The protocol (`plugins/faber/docs/workflow-orchestration-protocol.md`) that you loaded in Step 5.1 defines the exact execution loop. You should follow that protocol directly - this section provides guidance on the high-level flow, but the protocol document contains the complete implementation details that you must follow.

**High-level flow (see protocol for complete details):**

For each phase in the workflow:
1. Check if phase is enabled
2. Execute "before" autonomy gate if configured
3. Update state: phase starting
4. Emit phase_start event
5. Execute all steps in phase (pre_steps + steps + post_steps)
   - For each step, follow the protocol's Execution Loop:
     - BEFORE: Update todo to in_progress, update state, emit event, execute guards
     - EXECUTE: Follow the step's prompt (slash command or freeform)
     - AFTER: Evaluate result, update todo to completed, update state, emit event, handle per config
6. Update state: phase complete
7. Emit phase_complete event
8. Execute "after" autonomy gate if configured

**Reference the orchestration protocol document for complete implementation details:**
- Execution loop (before/execute/after pattern)
- State management (when/how to update)
- Guard execution (all 4 guards)
- Result handling (success/warning/failure/pending_input)
- Retry logic (Build-Evaluate loop)
- Autonomy gates (approval procedures)
- Error recovery (what to do on errors)

### Step 5.7: Completion Handling

**On successful completion:**

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
console.log(`State file: ${statePath}`);
```

**On workflow failure:**

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

// Report failure with resume instructions
console.error("\n✗ Workflow failed");
console.error(`Run ID: ${runId}`);
console.error(`Phase: ${currentPhase.name}`);
console.error(`Step: ${currentStep.name}`);
console.error(`Error: ${errorMessage}`);
console.error(`\nTo resume: Just run the same command again - auto-resume will pick up where you left off`);
console.error(`State file: ${statePath}`);
```

</WORKFLOW>

<OUTPUTS>

**Success:**
```
→ Checking for incomplete runs...
  No incomplete runs found. Creating new plan.

→ Creating execution plan...

✓ Plan created: fractary-faber-24-create-test-file-20251224T015229

============================================================
PLAN DETAILS
============================================================
Plan ID: fractary-faber-24-create-test-file-20251224T015229
Workflow: fractary-faber:default
Phases: 5
Total Steps: 12
============================================================

✓ 12 steps ready for execution

============================================================
STARTING WORKFLOW EXECUTION
============================================================

✓ Loaded orchestration protocol
✓ Starting new workflow execution
Run ID: fractary-faber-24-create-test-file-20251224T015229-run-2026-01-05T12-00-00
✓ State initialized
✓ Workflow tracked as active
✓ Event system ready

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
Run ID: fractary-faber-24-create-test-file-20251224T015229-run-2026-01-05T12-00-00
Total duration: 245s
State file: .fractary/runs/fractary-faber-24-create-test-file-20251224T015229-run-2026-01-05T12-00-00/state.json
```

**With Auto-Resume:**
```
→ Checking for incomplete runs...

✓ Incomplete run detected
  Run ID: fractary-faber-24-create-test-file-20251224T015229-run-2026-01-05T11-30-00
  Plan ID: fractary-faber-24-create-test-file-20251224T015229
  Status: failed
  Last phase: build
  Last step: implement-solution

→ Auto-resuming from where you left off...

============================================================
PLAN DETAILS
============================================================
Plan ID: fractary-faber-24-create-test-file-20251224T015229
Workflow: fractary-faber:default
Phases: 5
Total Steps: 12
============================================================

✓ 12 steps ready for execution

============================================================
STARTING WORKFLOW EXECUTION
============================================================

✓ Loaded orchestration protocol
✓ Resuming workflow
Run ID: fractary-faber-24-create-test-file-20251224T015229-run-2026-01-05T11-30-00
Plan ID: fractary-faber-24-create-test-file-20251224T015229
Current phase: build
Current step: implement-solution
...
```

**Missing Work ID Error:**
```
Error: Either <target> or --work-id is required

Usage: /fractary-faber:workflow-plan-run [<target>] [options]

Examples:
  /fractary-faber:workflow-plan-run customer-pipeline
  /fractary-faber:workflow-plan-run --work-id 158
```

</OUTPUTS>

<ARCHITECTURE_NOTES>

## Unified Workflow Experience

This command combines the best of both worlds:
- **Planning intelligence** from faber-planner (Opus 4.5)
- **Execution control** from workflow-run orchestrator (Sonnet 4.5)

## Auto-Resume Makes It Smart

Users don't need to remember run IDs or manually resume. Just run the same command again:

```bash
# First run - creates plan and starts execution
/fractary-faber:workflow-plan-run --work-id 24

# Workflow fails or stops

# Second run - automatically resumes from where it left off
/fractary-faber:workflow-plan-run --work-id 24
```

The system:
1. Detects incomplete run for work_id 24
2. Skips planning (uses existing plan)
3. Resumes execution from last checkpoint

## When to Use Each Command

| Command | Use Case |
|---------|----------|
| `/fractary-faber:workflow-plan` | Review plan before deciding to execute |
| `/fractary-faber:workflow-run` | Execute a specific plan by ID |
| `/fractary-faber:workflow-plan-run` | **Most common** - plan and execute in one go |

## Escape Hatches

- `--force-new`: Bypass auto-resume, start fresh run
- Manual `workflow-run`: Execute specific plan_id directly

</ARCHITECTURE_NOTES>

<IMPORTANT_REMINDERS>

1. **Auto-resume is the default** - Check for incomplete runs before planning
2. **You are the orchestrator** - Not delegating for execution
3. **Follow the protocol exactly** - It's your operating manual
4. **Update state before and after every step** - State is sacred
5. **Guards are mandatory** - Never skip guard checks
6. **Emit events for audit trail** - Every significant action
7. **Use TodoWrite for progress** - User visibility throughout
8. **Brief transition** - Show plan summary, then execute
9. **Trust the protocol** - When in doubt, re-read relevant section

</IMPORTANT_REMINDERS>

<SEE_ALSO>

- `/fractary-faber:workflow-plan` - Create plan only (for review)
- `/fractary-faber:workflow-run` - Execute specific plan
- `plugins/faber/docs/workflow-orchestration-protocol.md` - Execution protocol
- `specs/SPEC-00029-workflow-plan-run.md` - This feature's specification

</SEE_ALSO>
