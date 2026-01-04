# SPEC-20260103: Rationalize FABER Workflow Commands

**Status**: Approved
**Created**: 2026-01-03
**Author**: Claude Code
**Version**: 1.0

## Summary

Based on the migration to the workflow-plan → workflow-run orchestrator pattern, we need to remove the standalone `workflow-build`, `workflow-review`, `workflow-archive`, and `workflow-execute` commands. These were designed for the old delegation pattern where faber-manager agents executed individual phases. In the new pattern, Claude Code (via workflow-run) orchestrates all phases directly with full context.

## Background

### Primary Workflow (New Pattern)
- **workflow-plan**: Creates execution plan using faber-planner agent
- **workflow-run**: Claude Code acts as orchestrator, executes all 5 phases directly
  - Loads orchestration protocol (workflow-orchestration-protocol.md)
  - Executes Frame → Architect → Build → Evaluate → Release phases
  - Maintains full context throughout
  - Manages state, guards, events, and TodoWrite progress tracking

### Standalone Commands (Old Pattern Remnants)
- **workflow-build**: Delegates Build phase to faber-manager agent
- **workflow-review**: Delegates review step to faber-manager agent
- **workflow-archive**: Delegates archive operation to faber-manager agent
- **workflow-execute**: Delegates full workflow to faber-manager agent

### The Problem

The orchestration protocol in `workflow-orchestration-protocol.md` defines how workflow-run should execute all phases **directly** without delegating to these standalone commands. The protocol states:

> "You are the orchestrator. Not delegating to a sub-agent. YOU execute the workflow."

But the existence of workflow-build/review/archive/execute creates confusion:
1. Should workflow-run call these as skills?
2. Are they for manual/granular control?
3. Do they serve any purpose in the new pattern?

## Decisions

1. **workflow-execute**: ✅ REMOVE in favor of workflow-run
   - workflow-execute uses the delegation pattern (command → skill → agent)
   - workflow-run uses the orchestrator pattern (direct execution)

2. **Archive operations**: ✅ REMOVE entirely
   - Archive functionality is not well understood and not needed
   - Remove workflow-archive command
   - Remove any archive steps from workflow definitions
   - Remove archive-related documentation

3. **Granular control**: ✅ Add --phase and --steps arguments to workflow-run
   - `--phase <phase>` or `--phases <phase1,phase2>` - Run specific phase(s)
   - `--step <step-id>` or `--steps <step-id1,step-id2>` - Run specific step(s)
   - This replaces the need for workflow-build, workflow-review, etc.

## Implementation Plan

### Phase 1: Update workflow-run Implementation

**Goal**: Add --phase and --steps arguments for granular control.

**Files to modify**:
- `plugins/faber/commands/workflow-run.md`
- `plugins/faber/docs/workflow-orchestration-protocol.md`

**Changes**:
1. **Add new arguments** to workflow-run:
   - `--phase <phase>` or `--phases <phase1,phase2>` - Execute only specified phase(s)
   - `--step <step-id>` or `--steps <step-id1,step-id2>` - Execute only specified step(s)
   - Update argument parsing logic in workflow-run.md
   - Update state management to track partial execution
   - Examples:
     ```bash
     # Run only build phase
     /fractary-faber:workflow-run <plan-id> --phase build

     # Run build and evaluate phases
     /fractary-faber:workflow-run <plan-id> --phases build,evaluate

     # Run specific step
     /fractary-faber:workflow-run <plan-id> --step core-implement-solution
     ```

2. **Clarify direct execution**:
   - ALL phases are executed directly by Claude Code (no delegation to faber-manager)
   - Add explicit examples in the orchestration protocol showing how to execute:
     - Build phase steps (implement code, create commits, push)
     - Evaluate phase steps (run tests, review code, create PR)
     - Release phase steps (merge PR, delete branch)
   - Remove any references to delegating to faber-manager for these phases

3. **Remove archive references**:
   - Remove any archive-related steps from workflow definitions
   - Remove archive from orchestration protocol
   - Ensure step prompts in workflow definitions are freeform instructions or skill calls to primitive operations

### Phase 2: Remove Standalone Commands

**Goal**: Remove workflow-build, workflow-review, workflow-archive, and workflow-execute commands.

**Files to modify**:
- `plugins/faber/commands/workflow-build.md` - DELETE
- `plugins/faber/commands/workflow-review.md` - DELETE
- `plugins/faber/commands/workflow-archive.md` - DELETE
- `plugins/faber/commands/workflow-execute.md` - DELETE
- `plugins/faber/commands/workflow-execute-deterministic.md` - EVALUATE (may also need to remove)
- `plugins/faber/marketplace-config.json` - Remove deleted commands from manifest

**Recommended**: Remove immediately rather than deprecate (clean break):
- Delete the command files entirely
- Remove from marketplace-config.json
- Add migration note explaining the removal
- Users on old versions can continue using old commands; new users get clean command set

### Phase 3: Update Workflow Definitions

**Goal**: Ensure workflow step definitions don't reference the removed commands and remove all archive-related steps.

**Files to check/modify**:
- `plugins/faber/config/workflows/core.json`
- `plugins/faber/config/workflows/default.json`
- Any custom workflow definitions

**Changes**:
1. **Remove archive steps entirely**:
   - Delete any archive-related steps from all phases
   - Remove archive phase if it exists
   - Remove archive-related configuration

2. **Review all step prompts** in build/evaluate/release phases:
   - Replace any references to `/fractary-faber:workflow-build`, `/fractary-faber:workflow-review`, or `/fractary-faber:workflow-archive` with direct instructions
   - Example transformations:
     ```json
     // OLD (delegating to command)
     {
       "step_id": "build-implementation",
       "prompt": "/fractary-faber:workflow-build"
     }

     // NEW (direct instruction)
     {
       "step_id": "build-implementation",
       "prompt": "Implement the solution according to the specification. Create atomic commits for each logical unit of work. Run tests to verify the implementation."
     }
     ```

3. **Verify workflow integrity** after removing archive:
   - Ensure release phase has proper completion steps
   - Ensure no steps depend on archive outputs

### Phase 4: Update Documentation

**Goal**: Update all documentation to reflect the simplified command structure and new --phase/--steps arguments.

**Files to modify**:
- `README.md`
- `plugins/faber/README.md`
- `plugins/faber/docs/workflow-guide.md`
- `plugins/faber/docs/architecture.md`
- `MIGRATION.md` (add section about command removal)

**Changes**:
1. **Update command reference** to show workflow-plan and workflow-run as ONLY commands
2. **Remove entirely**: workflow-build, workflow-review, workflow-archive, workflow-execute
3. **Document new arguments** for workflow-run:
   ```markdown
   ## Workflow Execution

   Execute workflows with full or granular control:

   ```bash
   # Full workflow (all phases)
   /fractary-faber:workflow-run <plan-id>

   # Specific phase
   /fractary-faber:workflow-run <plan-id> --phase build

   # Multiple phases
   /fractary-faber:workflow-run <plan-id> --phases build,evaluate

   # Specific step
   /fractary-faber:workflow-run <plan-id> --step core-implement-solution

   # Resume from failure
   /fractary-faber:workflow-run <plan-id> --resume <run-id>
   ```
   ```

4. **Add migration guide section**:
   ```markdown
   ## Migration: Removed Commands (v3.1+)

   The following commands have been REMOVED in favor of the unified orchestrator pattern:

   - `/fractary-faber:workflow-build` → Use `/fractary-faber:workflow-run <plan-id> --phase build`
   - `/fractary-faber:workflow-review` → Use `/fractary-faber:workflow-run <plan-id>` (review is part of evaluate phase)
   - `/fractary-faber:workflow-archive` → REMOVED (archive functionality removed entirely)
   - `/fractary-faber:workflow-execute` → Use `/fractary-faber:workflow-run <plan-id>`

   **Why?** The orchestrator pattern (workflow-run) maintains full context across all phases, enabling better decision-making and eliminating context loss between phase boundaries. Granular control is now available via --phase and --steps arguments.

   **Breaking Change**: If you have scripts or automation that call these commands, update them to use workflow-run with appropriate arguments.
   ```

5. **Update architecture diagrams** to show simplified command flow (workflow-plan → workflow-run only)
6. **Update all examples** to use workflow-run exclusively with new arguments

### Phase 5: Review and Test

**Goal**: Ensure nothing breaks and the new approach works as intended.

**Tasks**:
1. Review all references to removed commands across the codebase
2. Check for any scripts or automation that call workflow-build/review/archive/execute
3. Test workflow-run to ensure it properly executes:
   - Full workflow (all phases)
   - Single phase (--phase build)
   - Multiple phases (--phases build,evaluate)
   - Single step (--step core-implement-solution)
4. Verify that the orchestration protocol provides sufficient guidance for executing these phases directly

## Critical Files

### Commands
- `plugins/faber/commands/workflow-run.md` - Primary execution command (ADD --phase and --steps arguments)
- `plugins/faber/commands/workflow-plan.md` - Planning command (KEEP as-is)
- `plugins/faber/commands/workflow-build.md` - REMOVE
- `plugins/faber/commands/workflow-review.md` - REMOVE
- `plugins/faber/commands/workflow-archive.md` - REMOVE
- `plugins/faber/commands/workflow-execute.md` - REMOVE
- `plugins/faber/commands/workflow-execute-deterministic.md` - EVALUATE (may also need to remove)

### Documentation
- `plugins/faber/docs/workflow-orchestration-protocol.md` - Protocol definition (remove archive references)
- `plugins/faber/docs/workflow-guide.md` - User guide (update command references)
- `plugins/faber/docs/architecture.md` - Architecture docs (update diagrams)
- `MIGRATION.md` - Migration guide (add removal section)

### Configuration
- `plugins/faber/config/workflows/core.json` - Core workflow definition (remove archive steps, update prompts)
- `plugins/faber/config/workflows/default.json` - Default workflow (remove archive steps, update prompts)
- `plugins/faber/marketplace-config.json` - Plugin manifest (remove deleted commands)

### Agents
- `plugins/faber/agents/faber-planner.md` - Planning agent (keep, used by workflow-plan)
- `plugins/faber/agents/faber-manager.md` - Legacy manager (evaluate if still needed)

## Success Criteria

After implementation:
1. ✅ workflow-run executes all phases (Frame → Architect → Build → Evaluate → Release) directly without delegation
2. ✅ workflow-run supports --phase and --steps arguments for granular control
3. ✅ workflow-build, workflow-review, workflow-archive, workflow-execute are REMOVED
4. ✅ Archive functionality removed entirely from all workflow definitions and documentation
5. ✅ Documentation reflects simplified command structure (workflow-plan + workflow-run as ONLY commands)
6. ✅ Workflow definitions use direct instructions instead of delegating to removed commands
7. ✅ Migration guide exists explaining the removal and how to migrate
8. ✅ No functionality is lost (granular control available via --phase/--steps arguments)
9. ✅ All archive-related code/config/docs removed from codebase

## Breaking Changes

This is a **breaking change** for users who:
- Have scripts or automation that call `/fractary-faber:workflow-build`
- Have scripts or automation that call `/fractary-faber:workflow-review`
- Have scripts or automation that call `/fractary-faber:workflow-archive`
- Have scripts or automation that call `/fractary-faber:workflow-execute`
- Rely on archive functionality

**Migration path**: Update scripts to use `/fractary-faber:workflow-run` with appropriate `--phase` or `--steps` arguments.

## Version

This change should be released as **v3.1.0** with clear migration notes.
