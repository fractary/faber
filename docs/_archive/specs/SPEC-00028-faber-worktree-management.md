# SPEC-00028: Automated Worktree Management for FABER Workflows

**Status**: Draft
**Created**: 2026-01-05
**Related**: SPEC-00027 (Context Management)
**Priority**: High (Next Phase after Context Management)

## Executive Summary

Make the one-workflow-per-worktree limitation transparent to users by **automating worktree lifecycle management** directly in FABER workflows. Users should be able to start concurrent workflows without manually managing git worktrees.

## Problem Statement

### Current State (After SPEC-00027 Implementation)

**Design Decision**: One workflow per worktree
- Simple `.active-run-id` tracking mechanism
- Reliable hook-based context management
- BUT: Requires manual worktree creation for concurrent workflows

**Current User Experience**:
```bash
# Want to work on two issues in parallel
user$ /fractary-faber:workflow-run --work-id 258

⚠️  WARNING: Another workflow is active in this worktree
Recommendation: Use separate worktrees for concurrent workflows:
  git worktree add ../myproject-issue-259 -b feature/259
  cd ../myproject-issue-259
  /fractary-faber:workflow-run --work-id 259

# User must manually:
# 1. Create worktree
# 2. Switch directory
# 3. Start workflow
# 4. Remember to clean up worktree later
```

**Pain Points**:
1. **Manual worktree management** - Users must know git worktree commands
2. **Context switching** - Need to cd between directories
3. **Cleanup burden** - Easy to forget to remove worktrees after PR merge
4. **Cognitive overhead** - Tracking which worktree has which workflow

### Desired State

**Automated User Experience**:
```bash
# Want to work on two issues in parallel
user$ /fractary-faber:workflow-run --work-id 258
# Automatically creates worktree, starts workflow

user$ /fractary-faber:workflow-run --work-id 259
# Detects conflict, offers to auto-create worktree
⚠️  Another workflow (258) is active in this worktree.

Would you like to:
  1. Create new worktree and start workflow there (Recommended)
  2. Take over this worktree (stop workflow 258)
  3. Cancel

Choice [1]: 1

✓ Created worktree: ../faber-259
✓ Started workflow in new worktree
✓ Return to this directory when done: cd /original/path

# Later: Workflow completes, PR merges
# Automatic cleanup removes worktree
```

## Design Questions

### Q1: Where Should Worktree Management Live?

**Option A: Fractary-Repo Plugin**
- **Pros**: Generic, useful for non-workflow dev work, already has git operations
- **Cons**: fractary-repo may not know about FABER workflow lifecycle
- **Integration**: FABER calls fractary-repo commands for worktree operations

**Option B: FABER Plugin**
- **Pros**: Tight integration with workflow lifecycle, knows workflow state
- **Cons**: Less reusable for non-workflow scenarios
- **Integration**: FABER has built-in worktree management

**Option C: Hybrid (Recommended)**
- **Fractary-Repo**: Low-level worktree operations (create, list, remove)
- **FABER**: Workflow-aware orchestration (when to create, cleanup triggers)
- **Integration**: FABER delegates to fractary-repo but controls lifecycle

**Recommendation**: Option C (Hybrid)
- Separation of concerns
- Reusable primitives in fractary-repo
- Workflow intelligence in FABER
- Best of both worlds

### Q2: Historical Context - What Did Branch-Create Do?

**Need to investigate**:
- Did `fractary-repo:branch-create` create worktrees?
- If yes, what was the command syntax?
- Why was it removed in simplification?
- Can we restore/improve it?

**Action**: Review fractary-repo git history for previous worktree functionality

### Q3: Worktree Naming and Location

**Options**:
- `../{project-name}-{work-id}` - e.g., `../myproject-258`
- `../{project-name}-{workflow-run-id}` - e.g., `../myproject-fractary-faber-258-20260105`
- `.worktrees/{work-id}` - Keep worktrees inside project
- User-configurable pattern

**Recommendation**: `../{project-name}-{work-id}` (Simple, clear, git convention)

### Q4: Automatic vs Manual Worktree Creation

**Automatic** (Transparent):
```bash
/fractary-faber:workflow-run --work-id 259
# Auto-detects conflict, auto-creates worktree, auto-starts workflow
```
**Pros**: Zero friction, truly transparent
**Cons**: Surprising behavior, creates directories user didn't ask for

**Prompted** (Semi-Automatic):
```bash
/fractary-faber:workflow-run --work-id 259
# Detects conflict, asks if user wants worktree created
Would you like to create a new worktree? [Y/n]: y
```
**Pros**: User control, clear about what's happening
**Cons**: Still requires user input

**Explicit Flag** (Manual Trigger):
```bash
/fractary-faber:workflow-run --work-id 259 --worktree
# Creates worktree because user said so
```
**Pros**: Clear, predictable
**Cons**: User must know about worktrees

**Recommendation**: Prompted (Semi-Automatic)
- Good balance of automation and control
- Educates users about worktrees
- Can add `--auto-worktree` flag to skip prompt for power users

## Proposed Architecture

### Component Responsibilities

```
┌─────────────────────────────────────────────────────────┐
│  FABER Workflow Manager                                 │
│  - Detects worktree conflicts                          │
│  - Decides when worktree needed                         │
│  - Tracks workflow-to-worktree mapping                  │
│  - Triggers cleanup on workflow complete                │
└─────────────────────────────────────────────────────────┘
                          ↓
                    delegates to
                          ↓
┌─────────────────────────────────────────────────────────┐
│  Fractary-Repo Worktree Commands                        │
│  - /fractary-repo:worktree-create                       │
│  - /fractary-repo:worktree-list                         │
│  - /fractary-repo:worktree-remove                       │
│  - /fractary-repo:worktree-prune                        │
└─────────────────────────────────────────────────────────┘
                          ↓
                    uses git
                          ↓
┌─────────────────────────────────────────────────────────┐
│  Git Worktree Commands                                  │
│  - git worktree add                                     │
│  - git worktree list                                    │
│  - git worktree remove                                  │
│  - git worktree prune                                   │
└─────────────────────────────────────────────────────────┘
```

### Workflow-to-Worktree Mapping

**State Tracking** (in state.json):
```json
{
  "worktree": {
    "path": "../myproject-258",
    "created_by": "fractary-faber",
    "created_at": "2026-01-05T14:30:00Z",
    "auto_cleanup": true,
    "branch": "feature/258"
  }
}
```

**Global Mapping** (in .fractary/faber/worktrees.json):
```json
{
  "worktrees": [
    {
      "path": "../myproject-258",
      "workflow_run_id": "fractary-faber-258-20260105-143022",
      "work_id": "258",
      "status": "active",
      "created_at": "2026-01-05T14:30:00Z"
    },
    {
      "path": "../myproject-259",
      "workflow_run_id": "fractary-faber-259-20260105-144500",
      "work_id": "259",
      "status": "active",
      "created_at": "2026-01-05T14:45:00Z"
    }
  ]
}
```

### Lifecycle Phases

#### Phase 1: Workflow Start (Conflict Detection)

```bash
/fractary-faber:workflow-run --work-id 259

→ Check .fractary/faber/runs/.active-run-id in current worktree
→ If exists and different: Conflict detected
→ Prompt user:
    1. Create new worktree (recommended)
    2. Take over this worktree
    3. Cancel
→ If user chooses 1:
    → /fractary-repo:worktree-create --work-id 259 --branch feature/259
    → Write state.json in new worktree with worktree metadata
    → Add entry to .fractary/faber/worktrees.json
    → Continue workflow in new worktree
```

#### Phase 2: During Workflow (No Changes)

- Context management works as designed (SPEC-00027)
- `.active-run-id` in each worktree tracks its workflow
- Hooks operate within worktree context

#### Phase 3: Workflow Complete (Cleanup Trigger Points)

**Trigger Points for Cleanup**:
1. **PR Merged** - Workflow completed successfully
2. **PR Closed** - User cancelled workflow
3. **Branch Deleted** - Git indicates branch is gone
4. **Manual** - User runs cleanup command

**Automatic Cleanup Flow**:
```bash
# At end of Release phase
→ Check if worktree was auto-created (state.worktree.created_by == "fractary-faber")
→ If yes, prompt user:
    "This workflow was run in an auto-created worktree.
     Would you like to remove it? [Y/n]: y"
→ If yes:
    → cd back to main worktree
    → /fractary-repo:worktree-remove ../myproject-258
    → Remove from .fractary/faber/worktrees.json
    → Mark as cleaned up in workflow run archive
```

#### Phase 4: Orphaned Worktree Cleanup

**Problem**: Worktrees left behind if workflow crashed or was abandoned

**Solution**: Periodic cleanup command
```bash
/fractary-repo:worktree-prune

→ List all git worktrees
→ Check each worktree for:
    - Orphaned (branch deleted on remote)
    - Inactive (no workflow activity in 7+ days)
    - Completed (workflow marked complete but worktree not removed)
→ Prompt user to remove each one
```

## Implementation Plan

### Phase 1: Fractary-Repo Worktree Commands

**New commands**:
- `/fractary-repo:worktree-create --work-id <id> --branch <name> [--path <path>]`
- `/fractary-repo:worktree-list [--format json]`
- `/fractary-repo:worktree-remove <path> [--force]`
- `/fractary-repo:worktree-prune [--dry-run]`

**Files to create**:
- `plugins/repo/commands/worktree-create.md`
- `plugins/repo/commands/worktree-list.md`
- `plugins/repo/commands/worktree-remove.md`
- `plugins/repo/commands/worktree-prune.md`
- `plugins/repo/skills/git-manager/workflow/worktree-*.md`

### Phase 2: FABER Worktree Integration

**Modify workflow-run command**:
- Add worktree conflict detection
- Add worktree creation prompt
- Add state.worktree metadata

**Modify Release phase post_steps**:
- Add worktree cleanup prompt

**Files to modify**:
- `plugins/faber/skills/faber-manager/` (workflow-run implementation)
- `plugins/faber/config/workflows/core.json` (Release phase post_steps)
- `plugins/faber/config/state.schema.json` (Add worktree object)

### Phase 3: Global Worktree Tracking

**New file**: `.fractary/faber/worktrees.json`
- Maps worktrees to workflow runs
- Enables cross-worktree operations
- Helps with orphaned worktree detection

**Files to create**:
- `.fractary/faber/worktrees.schema.json`

### Phase 4: Documentation

**Files to create**:
- `plugins/faber/docs/WORKTREE-MANAGEMENT.md` - User guide
- `plugins/repo/docs/WORKTREE-COMMANDS.md` - Command reference

**Files to update**:
- `plugins/faber/docs/CONTEXT-MANAGEMENT.md` - Add worktree integration section
- `specs/SPEC-00027-faber-context-management.md` - Add reference to worktree management

## User Experience Examples

### Example 1: Starting Concurrent Workflows (Auto-Worktree)

```bash
# Terminal 1: Start first workflow in main worktree
user$ /fractary-faber:workflow-run --work-id 258
✓ Workflow started in current worktree
✓ Created: .fractary/.active-run-id (fractary-faber-258-...)

# Terminal 2: Start second workflow (detects conflict)
user$ /fractary-faber:workflow-run --work-id 259

⚠️  Another workflow (258) is active in this worktree.

Would you like to:
  1. Create new worktree and start workflow there (Recommended)
  2. Take over this worktree (stop workflow 258)
  3. Cancel

Choice [1]: 1

✓ Creating worktree: ../myproject-259
✓ Creating branch: feature/259
✓ Setting up workflow in new worktree
✓ Workflow started

📁 Worktree location: ../myproject-259
📌 Return to main worktree: cd /mnt/c/GitHub/fractary/myproject

# Now both workflows run independently in separate worktrees
```

### Example 2: Workflow Completion with Auto-Cleanup

```bash
# Workflow completes Release phase
# PR #34 merged successfully

✓ PR merged and issue closed
✓ Workflow complete

This workflow was run in an auto-created worktree.
Worktree: ../myproject-258
Branch: feature/258 (merged and deleted on remote)

Would you like to remove this worktree? [Y/n]: y

✓ Returned to main worktree: /mnt/c/GitHub/fractary/myproject
✓ Removed worktree: ../myproject-258
✓ Cleaned up workflow metadata

💡 Tip: You can manually clean up worktrees with:
   /fractary-repo:worktree-prune
```

### Example 3: Orphaned Worktree Cleanup

```bash
# User forgot to clean up old worktrees
user$ /fractary-repo:worktree-prune

Scanning for orphaned worktrees...

Found 3 worktrees:
  1. ../myproject-258 - ACTIVE (workflow running)
  2. ../myproject-259 - ORPHANED (branch deleted, no activity 10 days)
  3. ../myproject-260 - COMPLETED (workflow done, not removed)

Remove orphaned worktree #2 (../myproject-259)? [y/N]: y
✓ Removed ../myproject-259

Remove completed worktree #3 (../myproject-260)? [y/N]: y
✓ Removed ../myproject-260

Summary:
  ✓ 2 worktrees removed
  ✓ 1 active worktree kept
  💾 Disk space freed: ~150 MB
```

### Example 4: List All Worktrees

```bash
user$ /fractary-repo:worktree-list

Active Worktrees:
  📁 /mnt/c/GitHub/fractary/myproject (main)
     Branch: main
     Status: ✓ Main worktree

  📁 ../myproject-258
     Branch: feature/258
     Status: 🔄 Workflow running (fractary-faber-258-20260105-143022)
     Created: 2 hours ago
     Work ID: 258

  📁 ../myproject-259
     Branch: feature/259
     Status: 🔄 Workflow running (fractary-faber-259-20260105-144500)
     Created: 1 hour ago
     Work ID: 259

Total: 3 worktrees (1 main + 2 workflow worktrees)
```

## Configuration

### Worktree Creation Settings

**In project settings** (`.fractary/settings.json`):
```json
{
  "worktree": {
    "auto_create": "prompt",  // "always" | "prompt" | "never"
    "location_pattern": "../{project}-{work_id}",
    "auto_cleanup": true,
    "cleanup_prompt": true,
    "max_age_days": 30  // Warn about worktrees older than this
  }
}
```

### Per-Workflow Settings

**In workflow config**:
```json
{
  "worktree_management": {
    "enabled": true,
    "auto_cleanup_on_release": true,
    "warn_on_orphaned": true
  }
}
```

## Success Metrics

1. **User Friction**: Users can start concurrent workflows without knowing git worktree commands
2. **Cleanup Rate**: 90%+ of auto-created worktrees are automatically cleaned up
3. **Disk Space**: No worktree sprawl (orphaned worktrees detected and removed)
4. **Adoption**: Users naturally use worktrees for concurrent workflows
5. **Discovery**: Users learn about git worktrees through FABER prompts

## Benefits Beyond FABER Workflows

**General Development**:
- Worktree commands useful for any feature branch work
- Cleanup helps prevent disk space issues
- List command helps track parallel work

**fractary-repo plugin value**:
- Reusable worktree primitives
- Works with or without FABER workflows
- Enhances general git workflow

## Open Questions

1. **Historical**: Did fractary-repo:branch-create have worktree support? If so, why removed?
2. **Naming**: Should we use work-id or workflow-run-id in worktree names?
3. **Scope**: Should fractary-work:issue-fetch be worktree-aware?
4. **Git Config**: Should worktrees share git config or have independent config?
5. **Hooks**: Do Claude Code hooks work correctly in worktrees? (Needs testing)

## Dependencies

- **Requires**: SPEC-00027 (Context Management) implementation complete
- **Blocks**: None (pure enhancement)
- **Integrates With**: fractary-repo plugin, fractary-work plugin

## Risks and Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| **Git worktree bugs** | Worktrees get corrupted | Validate git version, document known issues |
| **Disk space usage** | Worktrees consume space | Auto-cleanup, periodic prune prompts |
| **User confusion** | Don't understand worktrees | Clear prompts, education in docs |
| **Orphaned worktrees** | Forgotten worktrees accumulate | Detection and cleanup tools |
| **Context switching** | Users forget which worktree they're in | Shell integration, clear prompts |

## Implementation Timeline

**Estimated Effort**: 2-3 weeks (after SPEC-00027 complete)

**Phase 1** (Week 1): Fractary-repo worktree commands
**Phase 2** (Week 2): FABER integration and conflict detection
**Phase 3** (Week 2): Global tracking and cleanup automation
**Phase 4** (Week 3): Documentation and testing

## Related Specs

- **SPEC-00027**: Context Management (prerequisite)
- **SPEC-00028**: This spec (Worktree Management)

## References

- Git Worktree Documentation: https://git-scm.com/docs/git-worktree
- Previous fractary-repo implementation: (TODO: investigate git history)
