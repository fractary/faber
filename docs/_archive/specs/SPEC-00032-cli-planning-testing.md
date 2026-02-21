# SPEC-00032: CLI-Driven Planning Feature Testing Guide

**Status**: Active
**Created**: 2026-01-07
**Author**: System
**Related**: SPEC-00029 (planning architecture), SPEC-00031 (SDK integration)

## Overview

FABER recently implemented a two-phase workflow architecture that separates planning from execution:
- **Phase 1: Planning** - CLI batch creates workflow plans for multiple issues
- **Phase 2: Execution** - Claude Code executes pre-made plans

This specification outlines comprehensive testing procedures to validate the CLI-driven planning feature.

## Background/Context

### Architecture Change

**Old Approach:**
- Claude Code does both planning and execution in one session
- Sequential: plan → execute for each issue
- Planning is implicit/in-memory

**New Approach (commits 5541ad6, 698c363, 0a0bc5e):**
- CLI creates explicit plan artifacts (JSON files)
- Batch planning: process 10+ issues upfront
- Claude Code reads and executes pre-made plans
- Plans stored at: `logs/fractary/plugins/faber/plans/{plan_id}.json`

### Key Components

**Commands:**
- `/fractary-faber:plan` - Create workflow plans (uses faber-planner agent)
- `/fractary-faber:workflow-run` - Execute existing plans (uses faber-manager agent)

**Agents:**
- `faber-planner` - Planning engine (creates plan artifacts)
- `faber-manager` - Execution orchestrator (follows orchestration protocol)

**Key Files:**
- `cli/src/commands/plan/index.ts` - CLI plan command implementation
- `plugins/faber/agents/faber-planner.md` - Planner agent definition
- `plugins/faber/config/schemas/plan.schema.json` - Plan artifact schema
- `logs/fractary/plugins/faber/plans/*.json` - Generated plans

## Testing Scenarios

### Test 1: Basic Planning with Work ID

**Goal:** Verify plan creation for a single GitHub issue

**Commands:**
```bash
# In Claude Code
/fractary-faber:plan --work-id 258
```

**Expected Results:**
1. ✅ Plan ID generated (format: `fractary-faber-258-title-YYYYMMDDTHHMMSS`)
2. ✅ Plan file created at `logs/fractary/plugins/faber/plans/{plan_id}.json`
3. ✅ User prompted with options:
   - Execute plan now
   - Review plan details
   - Exit without executing
4. ✅ Plan contains:
   - Resolved workflow with inheritance chain
   - Issue metadata (title, URL, labels)
   - Branch name (format: `feat/258-issue-title`)
   - Worktree path (if applicable)
   - Autonomy settings

**Validation:**
```bash
# Check plan file exists
ls -la logs/fractary/plugins/faber/plans/
cat logs/fractary/plugins/faber/plans/{plan_id}.json | jq '.'

# Verify required fields
jq '.id, .workflow.id, .items[0].work_id' logs/fractary/plugins/faber/plans/{plan_id}.json
```

---

### Test 2: Batch Planning (Multiple Issues)

**Goal:** Test batch planning capability

**Commands:**
```bash
/fractary-faber:plan --work-id 258,259,260
```

**Expected Results:**
1. ✅ Three separate plan files created
2. ✅ Each plan has unique plan ID
3. ✅ User shown summary of all plans
4. ✅ Option to execute all or review individually

**Validation:**
```bash
# Count plan files
ls -1 logs/fractary/plugins/faber/plans/*.json | wc -l

# Check each plan has correct work_id
for file in logs/fractary/plugins/faber/plans/*.json; do
  jq '.items[0].work_id' "$file"
done
```

---

### Test 3: Target-Based Planning (No Work ID)

**Goal:** Test planning without GitHub issue

**Commands:**
```bash
/fractary-faber:plan ipeds/admissions
```

**Expected Results:**
1. ✅ Target matcher identifies target type
2. ✅ Plan created with target context (no issue metadata)
3. ✅ Branch named from target (e.g., `feat/ipeds-admissions`)
4. ✅ Plan shows `"planning_mode": "target"`

**Validation:**
```bash
# Check target-based plan structure
jq '.source.planning_mode, .source.target_match' logs/fractary/plugins/faber/plans/{plan_id}.json
```

---

### Test 4: Plan Execution

**Goal:** Execute a pre-created plan

**Setup:**
First create a plan:
```bash
/fractary-faber:plan --work-id 258
```

**Commands:**
```bash
# Execute the plan
/fractary-faber:workflow-run 258
```

**Expected Results:**
1. ✅ Planner loads existing plan from logs directory
2. ✅ Shows plan summary to user
3. ✅ Executes workflow following orchestration protocol
4. ✅ Updates state file at `.fractary/runs/{run_id}/state.json`
5. ✅ Emits events to `.fractary/runs/{run_id}/events/`
6. ✅ Respects autonomy gates and guards

**Validation:**
```bash
# Check state file
cat .fractary/runs/*/state.json | jq '.status, .current_phase'

# Check event log
ls -la .fractary/runs/*/events/
```

---

### Test 5: Workflow Resolution & Inheritance

**Goal:** Verify workflow inheritance merging

**Commands:**
```bash
/fractary-faber:plan --work-id 258 --workflow fractary-faber:default
```

**Expected Results:**
1. ✅ Plan contains `"inheritance_chain"` array
2. ✅ Plan shows merged workflow with all steps from parent workflows
3. ✅ Steps have `source` metadata showing origin workflow

**Validation:**
```bash
# Check inheritance chain
jq '.workflow.inheritance_chain' logs/fractary/plugins/faber/plans/{plan_id}.json

# Verify merged steps from multiple sources
jq '.workflow.phases.architect.steps[] | {id, name, source}' logs/fractary/plugins/faber/plans/{plan_id}.json
```

---

### Test 6: Auto-Resume After Interruption

**Goal:** Test resume functionality

**Steps:**
1. Start workflow execution:
   ```bash
   /fractary-faber:workflow-run 258
   ```
2. Interrupt during Build phase (Ctrl+C)
3. Resume same workflow:
   ```bash
   /fractary-faber:workflow-run 258
   ```

**Expected Results:**
1. ✅ Second run detects incomplete execution
2. ✅ Shows "Incomplete run detected" message
3. ✅ Automatically resumes from last completed step
4. ✅ State file shows correct resume point

**Validation:**
```bash
# Check state shows resume context
jq '.steps[] | {step_id, status, completed_at}' .fractary/runs/*/state.json
```

---

### Test 7: Plan Review Without Execution

**Goal:** Create and review plan without executing

**Commands:**
```bash
/fractary-faber:plan --work-id 258
# User selects "Review plan details"
```

**Expected Results:**
1. ✅ Full plan JSON displayed to user
2. ✅ User can review workflow structure
3. ✅ User re-prompted to execute or exit
4. ✅ Plan remains saved for later

**Validation:**
Plan file exists but no run state:
```bash
ls logs/fractary/plugins/faber/plans/{plan_id}.json
ls .fractary/runs/ | wc -l  # Should be 0 or unchanged
```

---

### Test 8: Error Handling

**Goal:** Test error cases

**Test Cases:**

#### Invalid Work ID
```bash
/fractary-faber:plan --work-id 99999
```
Expected: Error message about issue not found

#### Invalid Workflow
```bash
/fractary-faber:plan --work-id 258 --workflow nonexistent-workflow
```
Expected: Error message about unknown workflow

#### Missing Configuration
```bash
# Temporarily rename config
mv .fractary/plugins/faber/config.json .fractary/plugins/faber/config.json.bak
/fractary-faber:plan --work-id 258
```
Expected: Error about missing configuration

---

### Test 9: Plan Schema Validation

**Goal:** Verify plan conforms to schema

**Commands:**
```bash
# Create a plan
/fractary-faber:plan --work-id 258

# Validate against schema
npm run validate-plan logs/fractary/plugins/faber/plans/{plan_id}.json
```

**Expected Results:**
1. ✅ Plan passes schema validation
2. ✅ All required fields present
3. ✅ Field types correct (strings, numbers, booleans, arrays)

---

### Test 10: Orchestration Protocol Execution

**Goal:** Verify execution follows protocol

**Commands:**
```bash
/fractary-faber:workflow-run 258
```

**Check Points:**
1. ✅ BEFORE Step: State updated, events emitted, guards executed
2. ✅ EXECUTE Step: Commands invoked correctly (full command strings)
3. ✅ AFTER Step: Result evaluated, state updated, events emitted
4. ✅ TodoWrite updates show progress
5. ✅ Phase transitions recorded

**Validation:**
```bash
# Check event sequence
ls -lt .fractary/runs/*/events/ | head -20

# Verify state updates
jq '.steps[] | {step_id, status, message}' .fractary/runs/*/state.json
```

---

## Quick Start Testing Guide

### Minimal Test (5 minutes)

1. **Create a plan:**
   ```bash
   /fractary-faber:plan --work-id 258
   ```

2. **Review plan file:**
   ```bash
   cat logs/fractary/plugins/faber/plans/fractary-faber-258-*.json | jq '.'
   ```

3. **Execute plan:**
   ```bash
   /fractary-faber:workflow-run 258
   ```

4. **Check state:**
   ```bash
   cat .fractary/runs/*/state.json | jq '.status, .current_phase'
   ```

### Comprehensive Test (30 minutes)

Run all 10 test scenarios above in sequence.

---

## Success Criteria

The CLI planning feature is working correctly if:

- ✅ Plans are created as valid JSON files
- ✅ Workflow inheritance is correctly resolved
- ✅ Plan execution loads pre-created plans
- ✅ Orchestration protocol is followed (BEFORE → EXECUTE → AFTER)
- ✅ State management works (updates before/after steps)
- ✅ Event emission provides audit trail
- ✅ Resume functionality works after interruption
- ✅ Error handling is graceful
- ✅ Batch planning works for multiple issues
- ✅ Target-based planning works without work IDs

---

## Key Files to Monitor

During testing, watch these locations:

```
logs/fractary/plugins/faber/plans/     # Plan artifacts
.fractary/runs/{run_id}/state.json     # Execution state
.fractary/runs/{run_id}/events/        # Event audit trail
.fractary/plugins/faber/config.json    # Configuration
```

---

## Troubleshooting

### Plan Not Created
- Check faber-planner agent is available
- Verify work_id exists in GitHub
- Check configuration file exists

### Execution Fails
- Verify plan file exists
- Check workflow resolution succeeded
- Review error in state file

### Resume Not Working
- Check state file has resume context
- Verify run_id matches
- Look for step completion records

---

## Next Steps After Testing

Once testing confirms the feature works:

1. Document any bugs found
2. Create test automation scripts
3. Update user-facing documentation
4. Train team on new workflow
5. Migrate existing processes to use CLI planning

---

## Plan Artifact Structure

Plans are JSON files with the following structure:

```json
{
  "id": "fractary-claude-plugins-csv-export-20251208T160000",
  "created": "2025-12-08T16:00:00Z",
  "created_by": "faber-planner",

  "metadata": {
    "org": "fractary",
    "project": "claude-plugins",
    "subproject": "csv-export",
    "year": "2025", "month": "12", "day": "08"
  },

  "source": {
    "work_id": "123",
    "planning_mode": "work_id",
    "target_match": null
  },

  "workflow": {
    "id": "fractary-faber:default",
    "resolved_at": "2025-12-08T16:00:00Z",
    "inheritance_chain": ["fractary-faber:default", "fractary-faber:core"],
    "phases": { /* full resolved workflow */ }
  },

  "autonomy": "guarded",
  "items": [
    {
      "work_id": "123",
      "target": "resolved-target-name",
      "issue": { "number": 123, "title": "...", "url": "..." },
      "branch": { "name": "feat/123-...", "status": "new|ready|resume" },
      "worktree": "../repo-wt-feat-123-..."
    }
  ],

  "execution": {
    "mode": "parallel",
    "max_concurrent": 5,
    "status": "pending",
    "results": []
  }
}
```
