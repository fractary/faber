# SPEC-00028 Implementation Note

**Date**: 2026-01-06
**Status**: Partial Implementation (FABER side only)

## Implementation Scope

This implementation covers **Phase 2-4** of SPEC-00028 (FABER plugin integration).

**Phase 1 (Fractary-Repo Worktree Commands) is NOT in this repository.**

## What's Included (This Repo - FABER Plugin)

✓ Updated state.schema.json with worktree metadata
✓ Created worktrees.schema.json for global tracking
✓ Enhanced workflow-run.md with worktree automation prompts
✓ Added worktree cleanup to Release phase post_steps
✓ Created worktree management documentation
✓ Updated context management docs with worktree references

## What's NOT Included (Requires Fractary-Repo Plugin)

The following commands need to be implemented in the **fractary-repo repository**:

### Required Commands (Phase 1 from SPEC-00028)

1. **`/fractary-repo:worktree-create`**
   - Create a new git worktree for workflow execution
   - Arguments: `--work-id <id> --branch <name> [--path <path>]`
   - Default path: `../{project-name}-{work-id}`
   - Creates branch if it doesn't exist
   - Returns worktree path

2. **`/fractary-repo:worktree-list`**
   - List all git worktrees with metadata
   - Arguments: `[--format json]`
   - Shows worktree path, branch, status, and FABER workflow association
   - Includes main worktree

3. **`/fractary-repo:worktree-remove`**
   - Remove a git worktree safely
   - Arguments: `<path> [--force]`
   - Validates worktree is not current directory
   - Checks for uncommitted changes unless --force
   - Updates worktrees.json tracking

4. **`/fractary-repo:worktree-prune`**
   - Clean up orphaned/stale worktrees
   - Arguments: `[--dry-run]`
   - Detects: deleted branches, no activity for 7+ days, completed workflows
   - Interactive prompts for each worktree
   - Shows disk space savings

### Integration Points

The FABER plugin calls these commands at key points:

1. **Workflow Start** (workflow-run.md):
   - Detects conflict via `.active-run-id` check
   - Offers to call `/fractary-repo:worktree-create`
   - Updates state with worktree metadata

2. **Workflow Complete** (Release phase post_steps):
   - Detects auto-created worktree via state.worktree.created_by
   - Prompts user to call `/fractary-repo:worktree-remove`
   - Updates worktrees.json

3. **Manual Cleanup** (user-initiated):
   - User runs `/fractary-repo:worktree-prune`
   - Identifies FABER-created worktrees via worktrees.json
   - Cross-references with workflow state files

## Implementation Order

To complete SPEC-00028:

1. ✅ **DONE**: Implement FABER side (this PR)
2. ⏳ **TODO**: Implement fractary-repo commands (separate PR in fractary-repo repository)
3. ⏳ **TODO**: Integration testing across both plugins
4. ⏳ **TODO**: End-to-end validation with real workflows

## Testing Strategy

### Phase 1: FABER Plugin Testing (This Repo)
- ✅ Verify state.schema.json schema validation
- ✅ Verify worktrees.schema.json schema validation
- ✅ Test worktree conflict detection logic
- ✅ Test state file worktree metadata persistence
- ⏳ Mock fractary-repo commands for integration tests

### Phase 2: Fractary-Repo Testing (Other Repo)
- ⏳ Unit tests for each worktree command
- ⏳ Test git worktree operations
- ⏳ Test error handling (permissions, conflicts, etc.)

### Phase 3: Integration Testing
- ⏳ End-to-end: Start concurrent workflows with auto-worktree
- ⏳ End-to-end: Complete workflow with auto-cleanup
- ⏳ End-to-end: Prune orphaned worktrees
- ⏳ Cross-machine: Worktree tracking across environments

## Dependencies

- **Git Version**: Requires git 2.5+ (worktree support)
- **Fractary-Repo**: Needs v4.0+ with worktree commands
- **FABER**: v3.3.0+ (context management from SPEC-00027)

## Migration Path

For users upgrading:

1. **FABER Plugin Update**: Automatic (schemas, enhanced commands)
2. **Fractary-Repo Update**: Manual (install updated plugin)
3. **Global Tracking**: Auto-created on first workflow run
4. **Existing Worktrees**: Compatible (no migration needed)

## Known Limitations

1. **Cross-Repository**: FABER and fractary-repo are separate plugins
2. **Git Requirement**: Worktrees require git 2.5+
3. **Manual Creation**: Users can still manually create worktrees (won't be tracked unless via commands)
4. **Cleanup**: Orphaned worktrees require manual prune command

## References

- **SPEC-00028**: Full specification for worktree management
- **SPEC-00027**: Context management prerequisite
- **Git Worktree Docs**: https://git-scm.com/docs/git-worktree
- **Fractary-Repo Plugin**: (TODO: add repository link)
