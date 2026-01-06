# FABER Worktree Management

**Status**: Implemented
**Version**: 3.4.0+
**Architecture**: CLI-first (planning) + Claude Code (execution)
**Related**: [SPEC-00029](../../../specs/SPEC-00029-FABER-CLI-PLANNING.md), [SPEC-00028](../../../specs/SPEC-00028-faber-worktree-management.md), [Context Management](./CONTEXT-MANAGEMENT.md)

## Overview

FABER workflows follow a **one-workflow-per-worktree** design for reliable context management. Worktrees are created automatically by the **FABER CLI** during the planning phase, enabling seamless concurrent workflow execution.

**Key Benefits:**
- ✅ Run multiple workflows concurrently without conflicts
- ✅ Worktrees created automatically during planning (CLI)
- ✅ Tracked worktree metadata for audit and cleanup
- ✅ Automatic cleanup prompts after workflow completion
- ✅ Centralized worktree location (`~/.claude-worktrees/`)
- ✅ Organization-scoped paths prevent conflicts

## New Architecture (v3.4.0+)

### Two-Phase Workflow

**Phase 1: Planning (CLI)**
```bash
# CLI creates: plan + branch + worktree
faber plan --work-id 258

# Output:
✓ Plan: fractary-faber-258-20260106-143022
  Branch: feature/258
  Worktree: ~/.claude-worktrees/fractary-myproject-258
```

**Phase 2: Execution (Claude Code)**
```bash
# Navigate to worktree
cd ~/.claude-worktrees/fractary-myproject-258

# Start Claude session
claude

# Run workflow (uses work-id, fetches plan from issue)
/fractary-faber:workflow-run 258
```

### Worktree Path Pattern

**Default:** `~/.claude-worktrees/{organization}-{project}-{work-id}/`

**Examples:**
```
~/.claude-worktrees/fractary-myproject-258/
~/.claude-worktrees/fractary-myproject-259/
~/.claude-worktrees/acme-webapp-42/
```

**Why include organization?**
- Prevents conflicts across projects with same name
- Supports working on multiple organizations simultaneously
- Clear ownership and isolation

**Configuration:**
- Respects Claude Code settings (if configured)
- Fallback: `~/.claude-worktrees/`
- Configurable via `.fractary/settings.json`

## How It Works

### Workflow Start: Conflict Detection

When you start a workflow (`/fractary-faber:workflow-run`), FABER checks if another workflow is already active in the current worktree by reading `.fractary/faber/.active-run-id`.

**If conflict detected:**
```
⚠️  WARNING: Another workflow is active in this worktree
   Active: fractary-faber-258-20260105-143022
   New: fractary-faber-259-20260105-144500

For concurrent workflows, use separate worktrees.

Recommended approach:
  1. Use 'faber plan --work-id 259' to create plan + worktree
  2. Navigate to worktree: cd ~/.claude-worktrees/fractary-myproject-259
  3. Run workflow: /fractary-faber:workflow-run 259

How would you like to proceed?
  1. Cancel and use CLI (Recommended)
  2. Take over this worktree
```

### Option 1: Cancel and Use CLI (Recommended)

The proper way to run concurrent workflows is via CLI planning:

```bash
# Plan workflow (creates worktree automatically)
faber plan --work-id 259

# Execute in new worktree
cd ~/.claude-worktrees/fractary-myproject-259
claude
/fractary-faber:workflow-run 259
```

### Option 2: Take Over This Worktree

Overrides the active workflow tracking. This may cause issues with the other workflow's context management.

**Use case**: When you're sure the other workflow is no longer running or you want to stop it.

## Workflow Completion: Automatic Cleanup

After a workflow completes (Release phase), if the workflow was run in an auto-created worktree, FABER prompts you to remove it:

```
✓ PR merged and issue closed
✓ Workflow complete

This workflow was run in an auto-created worktree.
Worktree: ../myproject-258
Branch: feature/258 (merged and deleted on remote)

Would you like to remove this worktree? [Y/n]: y

✓ Returned to main worktree: /mnt/c/GitHub/fractary/myproject
✓ Removed worktree: ../myproject-258
✓ Cleaned up workflow metadata
```

The cleanup step:
1. Checks `state.worktree.created_by === "fractary-faber"`
2. Prompts user for confirmation
3. Calls `/fractary-repo:worktree-remove` to remove worktree
4. Updates global worktree tracking
5. Returns to main worktree

## State File Metadata

When a workflow runs in a dedicated worktree, the state file includes:

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

**Fields:**
- `path`: Relative or absolute path to worktree
- `created_by`: Who created worktree (`fractary-faber` | `manual` | `unknown`)
- `created_at`: Creation timestamp (ISO 8601)
- `auto_cleanup`: Whether to prompt for cleanup after completion
- `branch`: Git branch in this worktree

## Global Worktree Tracking

All FABER worktrees are tracked in `.fractary/faber/worktrees.json`:

```json
{
  "worktrees": [
    {
      "path": "../myproject-258",
      "workflow_run_id": "fractary-faber-258-20260105-143022",
      "work_id": "258",
      "status": "active",
      "created_at": "2026-01-05T14:30:00Z",
      "updated_at": "2026-01-05T14:30:00Z",
      "branch": "feature/258",
      "created_by": "fractary-faber",
      "auto_cleanup": true,
      "last_activity": "2026-01-05T14:30:00Z"
    }
  ],
  "last_updated": "2026-01-05T14:30:00Z"
}
```

**Purpose:**
- Cross-worktree operations
- Orphaned worktree detection
- Audit trail
- Disk space tracking

## Manual Worktree Management

### List Worktrees

```bash
/fractary-repo:worktree-list
```

Shows all worktrees with FABER workflow associations:

```
Active Worktrees:
  📁 /mnt/c/GitHub/fractary/myproject (main)
     Branch: main
     Status: ✓ Main worktree

  📁 ../myproject-258
     Branch: feature/258
     Status: 🔄 Workflow running (fractary-faber-258-20260105-143022)
     Created: 2 hours ago
     Work ID: 258

Total: 2 worktrees (1 main + 1 workflow worktree)
```

### Remove Worktree

```bash
/fractary-repo:worktree-remove <path>
```

Safely removes a worktree:
- Validates worktree is not current directory
- Checks for uncommitted changes
- Updates global tracking

**Example:**
```bash
$ /fractary-repo:worktree-remove ../myproject-258

✓ Removed worktree: ../myproject-258
✓ Updated tracking
```

### Prune Orphaned Worktrees

```bash
/fractary-repo:worktree-prune
```

Detects and cleans up orphaned worktrees:

```
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

**Orphaned worktree criteria:**
- Branch deleted on remote
- No workflow activity for 7+ days
- Workflow marked complete but worktree not removed

## Use Cases

### Planning and Running Multiple Issues Concurrently

**New Approach (CLI-first):**

```bash
# Step 1: Plan multiple workflows at once
$ faber plan --work-id 258,259,260

✓ Planned 3 workflows successfully:

[1/3] Issue #258: Load IPEDS HD dataset
      Worktree: ~/.claude-worktrees/fractary-myproject-258
      To execute: cd ~/.claude-worktrees/fractary-myproject-258 && claude

[2/3] Issue #259: Load IPEDS IC dataset
      Worktree: ~/.claude-worktrees/fractary-myproject-259
      To execute: cd ~/.claude-worktrees/fractary-myproject-259 && claude

[3/3] Issue #260: Fix authentication timeout
      Worktree: ~/.claude-worktrees/fractary-myproject-260
      To execute: cd ~/.claude-worktrees/fractary-myproject-260 && claude

# Step 2: Execute workflows in parallel (different terminals/sessions)
# Terminal 1:
$ cd ~/.claude-worktrees/fractary-myproject-258
$ claude
> /fractary-faber:workflow-run 258

# Terminal 2:
$ cd ~/.claude-worktrees/fractary-myproject-259
$ claude
> /fractary-faber:workflow-run 259

# Terminal 3:
$ cd ~/.claude-worktrees/fractary-myproject-260
$ claude
> /fractary-faber:workflow-run 260
```

### Switching Between Workflows

```bash
# Work on issue 258
$ cd ~/.claude-worktrees/fractary-myproject-258
$ claude
> /fractary-faber:workflow-run 258 --resume

# Switch to issue 259
$ cd ~/.claude-worktrees/fractary-myproject-259
$ claude
> /fractary-faber:workflow-run 259 --resume

# Return to main worktree
$ cd /mnt/c/GitHub/fractary/myproject
```

### Batch Planning with Label Filters

```bash
# Plan all approved ETL workflows
$ faber plan --work-label "workflow:etl,status:approved"

# Plan all high-priority bugs
$ faber plan --work-label "workflow:bugfix,priority:high"

# Plan with workflow override
$ faber plan --work-id 258,259 --workflow custom-etl
```

### Cleaning Up After Merge

```bash
# After PR merges
✓ Workflow complete

This workflow was run in an auto-created worktree.
Would you like to remove this worktree? [Y/n]: y

✓ Returned to main worktree
✓ Removed worktree
```

### Finding Forgotten Worktrees

```bash
# Periodic cleanup
$ /fractary-repo:worktree-prune

Found 2 orphaned worktrees (branch deleted, no activity)
Would you like to remove them? [Y/n]: y

✓ Removed 2 worktrees
💾 Disk space freed: ~300 MB
```

## Requirements

### Git Version
- **Minimum**: Git 2.5+ (worktree support)
- **Recommended**: Git 2.15+ (improved worktree features)

### Plugin Dependencies
- **fractary-faber**: v3.3.0+ (this plugin)
- **fractary-repo**: v4.0+ (with worktree commands)

**Note**: The fractary-repo worktree commands (`worktree-create`, `worktree-list`, `worktree-remove`, `worktree-prune`) must be implemented separately. See [SPEC-00028 Implementation Note](../../../specs/SPEC-00028-IMPLEMENTATION-NOTE.md).

## Configuration

### Auto-Worktree Creation

Control worktree creation behavior in `.fractary/settings.json`:

```json
{
  "worktree": {
    "auto_create": "prompt",
    "location_pattern": "../{project}-{work_id}",
    "auto_cleanup": true,
    "cleanup_prompt": true,
    "max_age_days": 30
  }
}
```

**Settings:**
- `auto_create`: `"always"` | `"prompt"` | `"never"` (default: `"prompt"`)
- `location_pattern`: Path template (default: `"../{project}-{work_id}"`)
- `auto_cleanup`: Enable cleanup prompts (default: `true`)
- `cleanup_prompt`: Ask before cleanup (default: `true`)
- `max_age_days`: Warn about old worktrees (default: `30`)

### Per-Workflow Settings

In workflow config (e.g., `workflows/core.json`):

```json
{
  "worktree_management": {
    "enabled": true,
    "auto_cleanup_on_release": true,
    "warn_on_orphaned": true
  }
}
```

## Troubleshooting

### Worktree Creation Fails

**Error**: `faber plan` command fails to create worktree

**Cause**: The fractary-repo plugin doesn't have worktree commands yet, or git worktree creation failed.

**Solution**:
1. Check fractary-repo plugin version: `fractary-repo --version`
2. Update to v4.0+: `fractary plugin update fractary-repo`
3. Or manually create worktree:
   ```bash
   git worktree add ~/.claude-worktrees/fractary-myproject-259 -b feature/259
   cd ~/.claude-worktrees/fractary-myproject-259
   /fractary-faber:workflow-run 259
   ```

### Can't Remove Worktree

**Error**: `Cannot remove worktree: uncommitted changes`

**Cause**: Worktree has uncommitted changes.

**Solution**:
1. Commit or stash changes in worktree
2. Use `--force` flag (caution: loses uncommitted work):
   ```bash
   /fractary-repo:worktree-remove ~/.claude-worktrees/fractary-myproject-259 --force
   ```

### Orphaned Worktrees Accumulating

**Symptom**: Old worktrees taking up disk space.

**Solution**: Run periodic cleanup:
```bash
/fractary-repo:worktree-prune
```

**Prevention**: Enable auto-cleanup in settings.

### Multiple Workflows in Same Worktree

**Warning**: `Another workflow is active in this worktree`

**Cause**: Trying to start a second workflow without creating new worktree.

**Solution**: Use CLI to plan and create a new worktree:
```bash
faber plan --work-id 260
cd ~/.claude-worktrees/fractary-myproject-260
claude
/fractary-faber:workflow-run 260
```

## Best Practices

1. **Use CLI for Planning (Recommended)**
   - Plan workflows using `faber plan` command before execution
   - Enables batch planning and automated worktree setup
   - Separates planning from execution for better clarity

2. **Always Use Separate Worktrees for Concurrent Work**
   - One worktree per active workflow
   - Prevents context management conflicts

3. **Enable Auto-Cleanup**
   - Set `auto_cleanup: true` in settings
   - Accept cleanup prompts after workflow completion

4. **Run Periodic Prune**
   - Monthly: `/fractary-repo:worktree-prune`
   - Keeps disk space under control

5. **Check Active Worktrees**
   - Before starting new work: `/fractary-repo:worktree-list`
   - Identify abandoned workflows

6. **Don't Manually Delete Worktree Directories**
   - Use `/fractary-repo:worktree-remove`
   - Ensures git metadata is cleaned up

## Integration with Context Management

Worktree management integrates seamlessly with FABER's context management:

- **`.active-run-id` per worktree**: Each worktree tracks its own active workflow
- **Session continuity**: Context artifacts reload correctly after worktree switches
- **Hooks work per-worktree**: PreCompact, SessionStart, SessionEnd operate independently

See [Context Management](./CONTEXT-MANAGEMENT.md) for details.

## Future Enhancements

Planned improvements (see SPEC-00028):

1. **Shell Integration**: Show current worktree in prompt
2. **IDE Integration**: Auto-switch IDE workspace on worktree change
3. **Smart Cleanup**: Auto-cleanup after PR merge without prompt
4. **Disk Usage Dashboard**: Visualize worktree disk usage
5. **Cross-Machine Sync**: Sync worktree state across machines

## References

- [SPEC-00029](../../../specs/SPEC-00029-FABER-CLI-PLANNING.md) - CLI planning architecture
- [SPEC-00028](../../../specs/SPEC-00028-faber-worktree-management.md) - Full specification
- [SPEC-00028 Implementation Note](../../../specs/SPEC-00028-IMPLEMENTATION-NOTE.md) - Implementation status
- [Context Management](./CONTEXT-MANAGEMENT.md) - Related context management docs
- [Git Worktree Docs](https://git-scm.com/docs/git-worktree) - Official git worktree documentation

## Support

Issues or questions?
- GitHub Issues: https://github.com/fractary/faber/issues
- Discord: https://discord.gg/fractary (if available)
