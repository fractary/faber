# Implementation Plan: Revise Worktree Management to Use Subdirectories

## Overview

Revise the worktree management implementation to use `.worktrees/{work-id}/` subdirectories instead of `../{project}-{work-id}` sibling directories. This enables true automation within a single Claude session while respecting Claude Code's project directory sandbox.

## Context

**Current Implementation**: Uses `../project-258` (sibling directories)
- Follows Claude Code conventions
- **Problem**: Claude can't access `../` (sandboxed to project)
- **Result**: Requires manual cd + new session (defeats automation)

**New Implementation**: Use `.worktrees/issue-258/` (subdirectories)
- Enables automation within single session
- Works with Claude's sandbox restrictions
- Requires careful path resolution for all operations

**Design Decision**: For FABER's automation goals (single-session workflow execution), subdirectories are more appropriate despite being unconventional.

## Files to Modify

### 1. specs/SPEC-00028-FRACTARY-REPO-REQUIREMENTS.md
**Changes needed**:
- Update default location pattern from `../` to `.worktrees/`
- Add configuration schema for path strategies
- Move path generation responsibility to repo plugin
- Document JSON return format for worktree-create
- Remove `cd "$path"` instruction (doesn't work across processes)
- Add path resolution guidance

### 2. plugins/faber/commands/workflow-run.md
**Changes needed**:
- Remove hardcoded path generation logic
- Remove hardcoded branch naming logic
- Simplify worktree creation to just call repo plugin
- Parse JSON response from worktree-create
- Implement path resolution for all file operations
- Add helper function for prefixing paths
- Update all Bash commands to use path-aware execution

### 3. plugins/faber/commands/workflow-plan-run.md
**Changes needed**:
- Same changes as workflow-run.md
- Ensure consistency between both commands

### 4. plugins/faber/docs/WORKTREE-MANAGEMENT.md
**Changes needed**:
- Update all examples to use `.worktrees/` paths
- Document subdirectory approach rationale
- Update configuration examples
- Add section on path resolution
- Update troubleshooting for subdirectory-specific issues

### 5. specs/SPEC-00028-IMPLEMENTATION-NOTE.md
**Changes needed**:
- Document subdirectory design decision
- Note that this differs from Claude Code conventions
- Explain automation vs convention tradeoff

## Implementation Steps

### Step 1: Update Repo Plugin Requirements Spec

**File**: `specs/SPEC-00028-FRACTARY-REPO-REQUIREMENTS.md`

**Changes**:

1. **Update default location pattern**:
   ```
   OLD: ../{project}-{work_id}
   NEW: .worktrees/{work_id}
   ```

2. **Add configuration schema**:
   ```json
   {
     "worktree": {
       "location_pattern": ".worktrees/{work_id}",
       "strategy": "subdirectory",
       "create_parent": true,
       "permissions": "0755"
     }
   }
   ```

3. **Document JSON return format**:
   ```json
   {
     "success": true,
     "path": ".worktrees/258",
     "absolute_path": "/mnt/c/GitHub/fractary/myproject/.worktrees/258",
     "branch": "feature/258",
     "created_at": "2026-01-06T10:30:00Z"
   }
   ```

4. **Remove cd instruction**: Delete the "After creation, cd to the worktree" section

5. **Add path strategy documentation**:
   - Document subdirectory vs sibling approaches
   - Explain when to use each
   - Note automation implications

### Step 2: Create Path Resolution Helper

**File**: `plugins/faber/commands/workflow-run.md`

**Add helper function** (after imports, before main logic):

```javascript
/**
 * Resolve file path relative to worktree
 * @param {string} filePath - Path relative to project root
 * @param {object} state - Workflow state containing worktree info
 * @returns {string} - Resolved absolute path
 */
function resolveWorktreePath(filePath, state) {
  if (!state.worktree || !state.worktree.path) {
    // No worktree, return path as-is
    return filePath;
  }

  const worktreePath = state.worktree.path;

  // If filePath is already absolute, check if it's in worktree
  if (filePath.startsWith('/')) {
    return filePath;
  }

  // If filePath starts with .fractary, it's project-relative
  // Prefix with worktree path
  if (filePath.startsWith('.fractary/') || filePath.startsWith('plugins/')) {
    return `${worktreePath}/${filePath}`;
  }

  // Otherwise, assume it's already correct
  return filePath;
}

/**
 * Execute bash command in worktree context
 * @param {string} command - Command to execute
 * @param {object} state - Workflow state
 * @returns {Promise<string>} - Command output
 */
async function execInWorktree(command, state) {
  if (!state.worktree || !state.worktree.path) {
    // No worktree, execute normally
    return await Bash({ command });
  }

  const worktreePath = state.worktree.path;
  const wrappedCommand = `cd "${worktreePath}" && ${command}`;

  return await Bash({ command: wrappedCommand });
}
```

### Step 3: Simplify Worktree Creation Logic

**File**: `plugins/faber/commands/workflow-run.md`

**Current logic** (lines ~360-440):
```javascript
// Manual path generation
const projectName = path.basename(process.cwd());
const worktreePath = `../${projectName}-${workId}`;
const branchName = `feature/${workId}`;

// Manual git worktree add command
await Bash({
  command: `git worktree add "${worktreePath}" -b ${branchName}`
});
```

**New logic**:
```javascript
console.log("\n→ Creating new worktree...");

// Call repo plugin to create worktree
// Repo plugin handles path generation, branch naming, and git operations
const createResult = await Bash({
  command: `/fractary-repo:worktree-create --work-id ${workId} --format json`,
  description: "Create worktree via repo plugin"
});

let worktreeInfo;
try {
  worktreeInfo = JSON.parse(createResult);
} catch (error) {
  console.error("✗ Failed to parse worktree creation response");
  throw error;
}

if (!worktreeInfo.success) {
  console.error("✗ Failed to create worktree");
  throw new Error("Worktree creation failed");
}

console.log(`✓ Worktree created successfully`);
console.log(`  Path: ${worktreeInfo.path}`);
console.log(`  Branch: ${worktreeInfo.branch}`);

// Update workflow state with worktree metadata
state.worktree = {
  path: worktreeInfo.path,
  absolute_path: worktreeInfo.absolute_path,
  created_by: "fractary-faber",
  created_at: worktreeInfo.created_at || new Date().toISOString(),
  auto_cleanup: true,
  branch: worktreeInfo.branch
};

// Update global tracking
await updateWorktreeTracking({
  path: worktreeInfo.path,
  workflow_run_id: runId,
  work_id: workId,
  status: "active",
  created_at: state.worktree.created_at,
  branch: worktreeInfo.branch,
  created_by: "fractary-faber",
  auto_cleanup: true
});

console.log(`✓ Worktree tracking updated`);
```

### Step 4: Update File Operations for Path Resolution

**File**: `plugins/faber/commands/workflow-run.md`

**Pattern**: Replace all file operations with path-aware versions

**Example 1 - Reading state file**:
```javascript
// OLD:
const stateContent = await Read({
  file_path: `.fractary/runs/${runId}/state.json`
});

// NEW:
const stateContent = await Read({
  file_path: resolveWorktreePath(
    `.fractary/runs/${runId}/state.json`,
    state
  )
});
```

**Example 2 - Writing state file**:
```javascript
// OLD:
await Write({
  file_path: `.fractary/runs/${runId}/state.json`,
  content: JSON.stringify(state, null, 2)
});

// NEW:
await Write({
  file_path: resolveWorktreePath(
    `.fractary/runs/${runId}/state.json`,
    state
  ),
  content: JSON.stringify(state, null, 2)
});
```

**Example 3 - Bash commands**:
```javascript
// OLD:
await Bash({ command: "git status" });

// NEW:
await execInWorktree("git status", state);
```

**Locations to update**:
1. State file reads/writes (multiple locations)
2. Plan file reads (line ~200)
3. Active run ID file operations (lines ~310-350)
4. Git commands (git status, git add, git commit, etc.)
5. Any other file operations within workflow execution

### Step 5: Update Global Worktree Tracking Functions

**File**: `plugins/faber/commands/workflow-run.md`

**Current**: Functions assume main worktree for tracking file

**Update**: Make tracking file location worktree-aware

```javascript
async function updateWorktreeTracking(worktreeRecord) {
  // Global tracking is ALWAYS in main worktree root
  const trackingPath = '.fractary/faber/worktrees.json';

  let tracking = { worktrees: [], last_updated: new Date().toISOString() };

  try {
    const content = await Read({ file_path: trackingPath });
    tracking = JSON.parse(content);
  } catch (error) {
    // File doesn't exist, use empty tracking
  }

  // Add or update worktree record
  const existingIndex = tracking.worktrees.findIndex(
    w => w.path === worktreeRecord.path
  );

  if (existingIndex >= 0) {
    tracking.worktrees[existingIndex] = {
      ...tracking.worktrees[existingIndex],
      ...worktreeRecord,
      updated_at: new Date().toISOString()
    };
  } else {
    tracking.worktrees.push({
      ...worktreeRecord,
      created_at: worktreeRecord.created_at || new Date().toISOString(),
      updated_at: new Date().toISOString()
    });
  }

  tracking.last_updated = new Date().toISOString();

  await Write({
    file_path: trackingPath,
    content: JSON.stringify(tracking, null, 2)
  });
}
```

**Note**: Global tracking file is ALWAYS in main worktree, not in `.worktrees/` subdirectories.

### Step 6: Apply Same Changes to workflow-plan-run.md

**File**: `plugins/faber/commands/workflow-plan-run.md`

**Changes**: Apply all the same modifications as workflow-run.md:
1. Add path resolution helper functions
2. Simplify worktree creation to call repo plugin
3. Update all file operations for path resolution
4. Update bash commands to use execInWorktree
5. Ensure consistency with workflow-run.md

### Step 7: Update Documentation

**File**: `plugins/faber/docs/WORKTREE-MANAGEMENT.md`

**Changes**:

1. **Update all path examples**:
   ```
   OLD: ../myproject-258
   NEW: .worktrees/258
   ```

2. **Add "Design Rationale" section** (after "Overview"):
   ```markdown
   ## Design Rationale: Subdirectories vs Sibling Directories

   FABER uses `.worktrees/{work-id}` subdirectories instead of the conventional
   `../project-{work-id}` sibling directory approach used by Claude Code Desktop.

   **Why Subdirectories?**
   - ✅ Enables automation within single Claude session
   - ✅ Works within Claude's project directory sandbox
   - ✅ No manual cd or session switching required
   - ✅ Simpler for automated workflows

   **Tradeoffs**:
   - ⚠️ Unconventional (differs from Claude Code conventions)
   - ⚠️ Requires careful path resolution in code
   - ⚠️ Worktrees visible in project directory

   **When to Use Sibling Directories**:
   If you're running workflows manually or need true parallel execution
   with separate Claude sessions, you can still use sibling directories:
   1. Configure repo plugin with custom location pattern
   2. Manually create worktree outside `.worktrees/`
   3. Start new Claude session in that directory

   For FABER's automated single-session workflows, subdirectories are recommended.
   ```

3. **Update configuration examples**:
   ```json
   {
     "worktree": {
       "location_pattern": ".worktrees/{work_id}",
       "auto_create": "prompt",
       "auto_cleanup": true
     }
   }
   ```

4. **Update troubleshooting section**:
   - Add: "Why are worktrees in my project directory?"
   - Add: "Can I use sibling directories instead?"
   - Update paths in all examples

### Step 8: Document Design Decision

**File**: `specs/SPEC-00028-IMPLEMENTATION-NOTE.md`

**Add section** (before "Next Steps"):

```markdown
## Design Decision: Subdirectories vs Sibling Directories

### Decision
FABER implementation uses `.worktrees/{work-id}/` subdirectories instead of
`../{project}-{work-id}` sibling directories.

### Rationale
**Goal**: Enable fully automated workflow execution within a single Claude session

**Problem with Sibling Directories**:
- Claude Code sessions are sandboxed to project directory
- Cannot access `../` paths outside project
- Would require manual `cd` + new Claude session
- Defeats automation goal

**Subdirectory Benefits**:
- Works within Claude's sandbox
- Single session can manage all workflows
- True automation without manual intervention
- Paths resolve cleanly with helper functions

**Tradeoffs**:
- Unconventional (differs from Claude Code Desktop conventions)
- Requires path resolution logic in FABER code
- Worktrees visible in project tree (though in hidden `.worktrees/`)

### Alternative for Parallel Workflows
For true parallel execution with separate Claude sessions, users can:
1. Configure repo plugin to use sibling directories or `~/.claude-worktrees/`
2. Manually create worktrees
3. Start separate Claude sessions

This is the conventional approach and is still supported, but not the default
for FABER's single-session automation use case.

### Implementation Impact
- All file operations in workflow-run.md and workflow-plan-run.md use path resolution helpers
- Repo plugin generates paths in `.worktrees/` by default
- Documentation reflects subdirectory approach
- Configuration allows customization for other strategies
```

## Testing Considerations

### Test Cases

1. **Worktree Creation**:
   - [ ] First workflow: no conflict, no worktree created
   - [ ] Second workflow: conflict detected, worktree created in `.worktrees/{work-id}/`
   - [ ] Third workflow: another worktree created, no conflicts

2. **Path Resolution**:
   - [ ] State file reads/writes work in worktree
   - [ ] Plan file reads work in worktree
   - [ ] Git commands execute in worktree context
   - [ ] Global tracking file stays in main worktree

3. **Worktree Cleanup**:
   - [ ] Auto-cleanup prompt appears after Release phase
   - [ ] Cleanup removes worktree directory
   - [ ] Cleanup updates global tracking
   - [ ] Session continues in main worktree after cleanup

4. **Concurrent Workflows**:
   - [ ] Multiple worktrees can coexist
   - [ ] Each has independent `.active-run-id`
   - [ ] Global tracking reflects all active worktrees

5. **Error Handling**:
   - [ ] Worktree creation failure handled gracefully
   - [ ] Invalid paths detected and reported
   - [ ] Cleanup handles missing directories

### Manual Testing Steps

```bash
# 1. Start first workflow (no worktree)
/fractary-faber:workflow-run <plan-id-1>

# 2. In same session, start second workflow (auto-create worktree)
/fractary-faber:workflow-run <plan-id-2> --worktree

# Verify: .worktrees/258/ directory exists
# Verify: workflow-run executes in worktree context

# 3. Complete workflow and test cleanup
# Verify: cleanup prompt appears
# Verify: worktree removed successfully

# 4. Check global tracking
cat .fractary/faber/worktrees.json

# 5. Test path resolution
# Verify: state files in correct locations
# Verify: git commands work in worktree
```

## Risks and Mitigations

### Risk 1: Path Resolution Bugs
**Impact**: High - Could read/write files in wrong locations
**Mitigation**:
- Comprehensive helper functions with clear logic
- Extensive testing of all file operations
- Fail-fast validation of paths

### Risk 2: Git Operations Outside Worktree
**Impact**: Medium - Commands might execute in wrong directory
**Mitigation**:
- Use `execInWorktree` wrapper for all git commands
- Test with multiple worktrees
- Validate current directory before operations

### Risk 3: Global Tracking Corruption
**Impact**: Medium - Could lose track of worktrees
**Mitigation**:
- Atomic writes to tracking file
- Validation before updates
- Backup/recovery strategy

### Risk 4: User Confusion
**Impact**: Low-Medium - Unconventional approach may confuse users
**Mitigation**:
- Clear documentation explaining rationale
- Provide alternative for conventional approach
- Good error messages

## Success Criteria

1. ✅ Workflows execute successfully in `.worktrees/` subdirectories
2. ✅ All file operations resolve paths correctly
3. ✅ Git commands execute in proper worktree context
4. ✅ Global tracking maintains accurate worktree list
5. ✅ Cleanup removes worktrees and updates tracking
6. ✅ Multiple concurrent worktrees don't conflict
7. ✅ Documentation clearly explains approach and tradeoffs
8. ✅ Repo plugin spec provides clear implementation guidance

## Implementation Order

1. Update repo plugin requirements spec (provides contract)
2. Add helper functions to workflow-run.md (foundation)
3. Update worktree creation logic (simplification)
4. Update all file operations for path resolution (critical)
5. Apply same changes to workflow-plan-run.md (consistency)
6. Update documentation (user clarity)
7. Document design decision (maintainer clarity)
8. Test thoroughly (validation)

## Estimated Complexity

**Overall**: Medium-High

**Breakdown**:
- Repo spec updates: Low (mostly documentation)
- Helper functions: Medium (logic needs to be robust)
- Worktree creation simplification: Low (removing code)
- Path resolution updates: High (many locations, must be thorough)
- Documentation updates: Low (find/replace mostly)
- Testing: Medium (need to cover edge cases)

**Critical Path**: Path resolution updates - this is where bugs are most likely

## Notes

- This is a revision of already-committed code on branch `feat/spec-00028-worktree-management`
- Will need to create new commits on same branch or create new branch
- Should update commit messages to reflect subdirectory approach
- Consider squashing commits before final PR if history is messy
