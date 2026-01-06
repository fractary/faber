# SPEC-00029: Unified Workflow Plan-Run Command

**Status**: Implementation
**Created**: 2026-01-05
**Author**: System
**Related**: SPEC-00027-faber-context-management

## Overview

Create `/fractary-faber:workflow-plan-run` command that combines planning and execution in a single invocation, with intelligent auto-resume capability. This eliminates the need for manual user intervention between planning and execution phases.

## Key Requirements

1. **Single Command Invocation**: User runs one command that does both planning and execution
2. **Auto-Resume Intelligence**: Automatically detect and resume incomplete workflows without user intervention
3. **Comprehensive Todo Tracking**: Main Claude agent maintains complete todo list throughout both phases
4. **No User Intervention**: Seamless progression from planning to execution (unless errors/autonomy gates)
5. **Brief Transition Display**: Show plan summary (ID, workflow, step count) then immediately execute

## User's Key Insight: Auto-Resume by Default

The user wants the system to be smart about resuming. Instead of requiring `--resume <run-id>`, the command should:

- **Check for existing incomplete work** when it starts
- **Automatically resume** from where it left off if found
- **Start fresh** only if no incomplete work exists

This applies to both `workflow-run` and the new `workflow-plan-run` command.

## Implementation Approach

### Part 1: Enhance Auto-Resume for workflow-run

**File**: `/mnt/c/GitHub/fractary/faber/plugins/faber/commands/workflow-run.md`

**Current Behavior**:
- Requires `plan_id` parameter
- Optional `--resume <run-id>` to resume specific run
- Creates new run if no --resume provided

**New Behavior**:
1. Parse `plan_id` from arguments
2. **Auto-detect incomplete runs**: Scan `.fractary/runs/` for state files where:
   - `state.plan_id === plan_id`
   - `state.status in ["in_progress", "failed"]`
3. If found: Use most recent run (by `started_at`), automatically resume
4. If not found: Create new run, start fresh
5. Keep `--resume <run-id>` for manual override (optional)
6. Add `--force-new` flag to bypass auto-resume and force fresh start

**Changes Needed**:
- Add auto-resume detection in Step 1.3 (before current resume logic)
- Keep existing `--resume` logic as override mechanism
- Add `--force-new` flag handling

### Part 2: Modify faber-planner for Auto-Execute Mode

**File**: `/mnt/c/GitHub/fractary/faber/plugins/faber/agents/faber-planner.md`

**Change Location**: Lines 38-57 (INPUTS section) and Lines 470-548 (Step 8c)

**Modification 1 - Add Parameter** (INPUTS section):
```json
{
  "target": "string or null - What to work on",
  "work_id": "string or null - Work item ID",
  ...existing parameters...,
  "auto_execute": "boolean or null - If true, skip user prompt and return execute:true"
}
```

**Modification 2 - Conditional Prompting** (Step 8c):
```
### 8c. Prompt User with AskUserQuestion (CONDITIONAL)

**IF auto_execute parameter is true:**
- Skip AskUserQuestion entirely
- Output plan summary (as normal)
- Include in final response:
  ```
  execute: true
  plan_id: {plan_id}
  ```
- Return immediately

**ELSE (auto_execute is false or not provided):**
- Use AskUserQuestion as currently implemented
- Handle user selection normally
```

**Why This Works**:
- Minimal change (single conditional)
- Backward compatible (workflow-plan doesn't pass this parameter)
- No code duplication

### Part 3: Create workflow-plan-run Command

**File**: `/mnt/c/GitHub/fractary/faber/plugins/faber/commands/workflow-plan-run.md` (NEW)

**Command Structure**:

#### Frontmatter
```yaml
name: fractary-faber:workflow-plan-run
description: Create FABER plan and execute it in one command with auto-resume
argument-hint: '[<target>] [--work-id <id>] [--workflow <id>] [--phase <phases>]'
allowed-tools: Task, Read, Write, Bash, Skill, AskUserQuestion, MCPSearch, TodoWrite
model: claude-sonnet-4-5
```

#### Workflow Steps

**Step 1: Parse Arguments**
- Extract: target, work_id, workflow_override, autonomy_override, phases, step_id, prompt
- Extract: force_new flag (optional, to bypass auto-resume)
- Validate: Either target OR work_id required (unless --resume)
- Validate: Cannot use both --phase and --step

**Step 2: Auto-Resume Detection**
```javascript
// Check for existing incomplete runs for this work_id
const workId = work_id || extractWorkIdFromTarget(target);

// Scan .fractary/runs/ directory for state files
const incompleteRuns = findIncompleteRunsForWorkId(workId);

if (incompleteRuns.length > 0 && !force_new) {
  // Use most recent incomplete run
  const latestRun = incompleteRuns.sort((a, b) =>
    new Date(b.started_at) - new Date(a.started_at)
  )[0];

  console.log("✓ Incomplete run detected");
  console.log(`Run ID: ${latestRun.run_id}`);
  console.log(`Plan ID: ${latestRun.plan_id}`);
  console.log(`Status: ${latestRun.status}`);
  console.log(`Last phase: ${latestRun.current_phase}`);
  console.log(`Last step: ${latestRun.current_step}`);
  console.log("\n→ Auto-resuming from where you left off...\n");

  // Skip planning, load existing plan
  plan_id = latestRun.plan_id;
  resume_run_id = latestRun.run_id;
  skipPlanning = true;
}
```

**Step 3: Planning Phase (CONDITIONAL)**

*If skipPlanning is false:*

```javascript
// Create initial todo
await TodoWrite({
  todos: [{
    content: "Create FABER execution plan",
    status: "in_progress",
    activeForm: "Creating FABER execution plan"
  }]
});

// Invoke faber-planner with auto_execute: true
const plannerResult = await Task({
  subagent_type: "fractary-faber:faber-planner",
  description: `Create FABER plan for work item ${work_id || target}`,
  prompt: `<parameters>
    ${target ? `target: ${target}` : ''}
    ${work_id ? `work_id: ${work_id}` : ''}
    ${workflow_override ? `workflow_override: ${workflow_override}` : ''}
    ${autonomy_override ? `autonomy_override: ${autonomy_override}` : ''}
    ${phases ? `phases: ${phases}` : ''}
    ${step_id ? `step_id: ${step_id}` : ''}
    ${prompt ? `prompt: ${prompt}` : ''}
    working_directory: ${process.cwd()}
    auto_execute: true
  </parameters>`
});

// Extract plan_id from planner response
plan_id = extractPlanId(plannerResult.response);

console.log(`✓ Plan created: ${plan_id}`);
```

**Step 4: Load Plan and Update Todos**

```javascript
// Load the plan file
const planPath = `logs/fractary/plugins/faber/plans/${plan_id}.json`;
const fullPlan = JSON.parse(await Read({ file_path: planPath }));

// Brief summary (per user preference)
console.log(`\nPlan Details:`);
console.log(`  Plan ID: ${plan_id}`);
console.log(`  Workflow: ${fullPlan.workflow.id}`);
console.log(`  Total Steps: ${countSteps(fullPlan.workflow.phases)}`);

// Build and replace todo list with all workflow steps
const allSteps = [];
for (const phaseName of Object.keys(fullPlan.workflow.phases)) {
  const phase = fullPlan.workflow.phases[phaseName];
  if (phase.enabled === false) continue;

  for (const step of phase.steps) {
    allSteps.push({
      content: `[${phaseName}] ${step.name} (${step.id})`,
      status: "pending",
      activeForm: `Executing [${phaseName}] ${step.name}`
    });
  }
}

await TodoWrite({ todos: allSteps });
console.log(`  Phases: ${countEnabledPhases(fullPlan.workflow.phases)}`);
```

**Step 5: Transition Message**

```javascript
console.log("\n" + "=".repeat(60));
console.log("STARTING WORKFLOW EXECUTION");
console.log("=".repeat(60) + "\n");
```

**Step 6: Execute Workflow**

*Inline the complete workflow-run execution logic starting from Step 1.2*

This includes:
1. Load orchestration protocol
2. Initialize or resume run state
3. Track active workflow
4. Load MCP event system
5. Apply phase/step filters (if any)
6. Execute workflow following orchestration protocol:
   - For each phase and step: BEFORE → EXECUTE → AFTER
   - Update state before/after each step
   - Emit events for audit trail
   - Execute guards before each step
   - Handle results based on config
   - Respect autonomy gates
7. Handle completion or failure

**Step 7: Completion**

Same as workflow-run completion handling.

## Auto-Resume Implementation Details

### Finding Incomplete Runs

```javascript
function findIncompleteRunsForWorkId(workId) {
  // Bash command to find all state files
  const output = await Bash({
    command: `find .fractary/runs -name "state.json" -type f`,
    description: "Find all workflow state files"
  });

  const statePaths = output.stdout.trim().split('\n').filter(Boolean);
  const incompleteRuns = [];

  for (const statePath of statePaths) {
    const stateContent = await Read({ file_path: statePath });
    const state = JSON.parse(stateContent);

    // Check if this state matches our work_id and is incomplete
    if (state.work_id === workId &&
        (state.status === "in_progress" || state.status === "failed")) {
      incompleteRuns.push(state);
    }
  }

  return incompleteRuns;
}
```

### Edge Cases Handled

1. **Multiple incomplete runs**: Use most recent (by `started_at`)
2. **No work_id available**: Skip auto-resume for target-based planning
3. **Force new run**: Use `--force-new` flag to bypass auto-resume
4. **Manual resume**: Keep `--resume <run-id>` for explicit run selection
5. **Completed runs**: Only resume "in_progress" or "failed" runs, not "completed"

## Files to Create/Modify

### Create (1 file)
1. `/mnt/c/GitHub/fractary/faber/plugins/faber/commands/workflow-plan-run.md` - New unified command

### Modify (2 files)
1. `/mnt/c/GitHub/fractary/faber/plugins/faber/agents/faber-planner.md`
   - Add `auto_execute` parameter to INPUTS section (lines 38-57)
   - Modify Step 8c to conditionally skip AskUserQuestion (lines 470-548)

2. `/mnt/c/GitHub/fractary/faber/plugins/faber/commands/workflow-run.md`
   - Add auto-resume detection in Step 1.3 (before line 135)
   - Add `--force-new` flag handling in Step 1.1 (after line 70)

## Implementation Order

### Phase 1: Planner Enhancement
1. Modify `faber-planner.md` to add `auto_execute` parameter
2. Test backward compatibility: `/fractary-faber:workflow-plan --work-id 999` should still prompt

### Phase 2: Workflow-Run Auto-Resume
1. Add auto-resume detection to `workflow-run.md`
2. Add `--force-new` flag support
3. Test auto-resume: Run workflow, stop it, run again (should auto-resume)
4. Test force-new: Run workflow, stop it, run with `--force-new` (should start fresh)

### Phase 3: Create Plan-Run Command
1. Create `workflow-plan-run.md` with all steps documented above
2. Test basic flow: `/fractary-faber:workflow-plan-run --work-id 999`
3. Test auto-resume: Run command, stop, run again (should auto-resume)
4. Test force-new: Run command, stop, run with `--force-new` (should re-plan)

### Phase 4: Integration Testing
1. Test phase filters: `--phase build,evaluate`
2. Test step filters: `--step core-implement-solution`
3. Test target-based planning: `/fractary-faber:workflow-plan-run ipeds/admissions`
4. Test error recovery: Trigger failure in build phase, re-run command (should auto-resume)

### Phase 5: Documentation
1. Update plugin README.md
2. Update workflow guide
3. Add decision tree: when to use plan vs run vs plan-run
4. Bump plugin version

## Success Criteria

**Functional**:
- ✓ Single command invocation for plan + execute
- ✓ Auto-resume works for both workflow-run and workflow-plan-run
- ✓ No user intervention between planning and execution
- ✓ Full context maintained throughout
- ✓ Todo list tracks both phases
- ✓ All workflow-run features work (filters, gates, retries)
- ✓ Brief transition display (plan summary, then execution)

**Non-Functional**:
- ✓ Backward compatible (workflow-plan unchanged)
- ✓ Clear error messages with recovery instructions
- ✓ No performance overhead vs separate commands
- ✓ Auto-resume is intelligent (most recent incomplete run)

## Key Design Decisions

### Decision 1: Auto-Resume by Default
**Rationale**: User explicitly requested this. Makes the system smarter and more user-friendly. Users don't need to remember run IDs.

**Implementation**: Scan for incomplete runs matching work_id, use most recent if found.

### Decision 2: Brief Transition Display
**Rationale**: User preference. Faster workflow, less interruption. Users can always check plan file if needed.

**Implementation**: Show plan ID, workflow name, step count. Skip detailed phase/step breakdown.

### Decision 3: Inline Execution Logic
**Rationale**: Maintains full context in main Claude session. No delegation = no context loss.

**Implementation**: Copy workflow-run execution logic directly into plan-run command (starting from Step 1.2).

### Decision 4: Parameter-Based Planner Mode
**Rationale**: No code duplication, single source of truth, minimal modification, clear backward compatibility.

**Implementation**: Add `auto_execute` boolean parameter to faber-planner.

### Decision 5: Keep --resume and Add --force-new
**Rationale**: Provides escape hatches for power users while making auto-resume the default.

**Implementation**:
- `--resume <run-id>` for explicit run selection (overrides auto-resume)
- `--force-new` to bypass auto-resume and force fresh start

## Notes

- The auto-resume feature makes FABER workflows truly resumable by default
- Users can just keep running the same command until the workflow completes
- The todo list evolution provides clear progress visibility
- The planner modification is minimal and backward compatible
- All existing workflow-run features (filters, gates, retries) continue to work

## Related Specifications

- SPEC-00027-faber-context-management: Context management across sessions
- SPEC-00028-faber-worktree-management: Worktree-based workflow isolation
