# SPEC-00028-REPO: Fractary-Repo Worktree Commands

**Status**: Implementation Required
**Priority**: High
**Target Plugin**: fractary-repo
**Target Version**: v4.0.0
**Related**: SPEC-00028 (FABER Worktree Management)
**Date**: 2026-01-06

## Executive Summary

Implement four git worktree management commands in the fractary-repo plugin to enable automated worktree lifecycle management for FABER workflows. These commands provide safe, user-friendly abstractions over git worktree operations.

## Background

**Context**: FABER workflows follow a one-workflow-per-worktree design for reliable context management. To enable concurrent workflows without manual git worktree management, FABER needs programmatic worktree operations.

**Integration Point**: FABER's workflow-run command will call these fractary-repo commands when:
- User starts a workflow while another is active (conflict detection)
- User completes a workflow in an auto-created worktree (cleanup)
- User manually manages worktrees (maintenance)

**Current State**: FABER plugin has implemented worktree automation logic but gracefully degrades to manual instructions when these commands are unavailable.

## Requirements

### Command 1: `/fractary-repo:worktree-create`

Create a new git worktree for workflow execution.

#### Command Signature

```bash
/fractary-repo:worktree-create --work-id <id> --branch <name> [options]
```

#### Arguments

| Argument | Type | Required | Description |
|----------|------|----------|-------------|
| `--work-id` | string | Yes | Work item identifier (e.g., issue number, plan ID) |
| `--branch` | string | Yes | Branch name to create in worktree |
| `--path` | string | No | Custom worktree path (default: auto-generated) |
| `--base` | string | No | Base branch to create from (default: current branch or main) |
| `--no-checkout` | flag | No | Create worktree without checking out files |

#### Behavior

**Path Generation** (if `--path` not provided):
```javascript
// Get project name from git root directory
const projectName = basename(git rev-parse --show-toplevel)

// Generate path: ../{project-name}-{work-id}
const worktreePath = `../${projectName}-${workId}`

// Example: ../myproject-258
```

**Validation**:
1. Must be in a git repository
2. Target path must not already exist
3. Branch name must be valid git ref
4. If branch exists remotely, checkout from remote
5. If branch exists locally, fail with error (prevent conflicts)
6. Base branch must exist (if specified)

**Operations**:
```bash
# 1. Resolve base branch
if [[ -n "$base" ]]; then
  BASE_BRANCH="$base"
else
  # Try to detect main/master
  BASE_BRANCH=$(git symbolic-ref refs/remotes/origin/HEAD 2>/dev/null | sed 's@^refs/remotes/origin/@@')
  if [[ -z "$BASE_BRANCH" ]]; then
    BASE_BRANCH=$(git rev-parse --abbrev-ref HEAD)
  fi
fi

# 2. Check if branch exists remotely
if git ls-remote --heads origin "$branch" | grep -q "$branch"; then
  # Branch exists remotely, check it out
  git worktree add "$path" "$branch"
else
  # Create new branch
  git worktree add -b "$branch" "$path" "$BASE_BRANCH"
fi

# 3. Change directory to new worktree (important for workflow continuation)
cd "$path"

# 4. Output confirmation
echo "✓ Worktree created: $path"
echo "✓ Branch: $branch"
echo "✓ Based on: $BASE_BRANCH"
```

#### Output

**Success**:
```
✓ Worktree created: ../myproject-258
✓ Branch: feature/258
✓ Based on: main
✓ Current directory: ../myproject-258
```

**Return Value**: JSON object (for programmatic access)
```json
{
  "success": true,
  "worktree_path": "../myproject-258",
  "absolute_path": "/mnt/c/GitHub/fractary/myproject-258",
  "branch": "feature/258",
  "base_branch": "main",
  "created_new_branch": true
}
```

#### Error Cases

| Error | Exit Code | Message |
|-------|-----------|---------|
| Not in git repo | 1 | `Error: Not in a git repository` |
| Path already exists | 2 | `Error: Path already exists: {path}` |
| Branch exists locally | 3 | `Error: Branch '{branch}' already exists. Use different branch name or remove existing worktree.` |
| Invalid branch name | 4 | `Error: Invalid branch name: {branch}` |
| Base branch not found | 5 | `Error: Base branch '{base}' not found` |
| Git worktree command failed | 6 | `Error: Git worktree creation failed: {git_error}` |
| Permission denied | 7 | `Error: Permission denied creating worktree at {path}` |

#### Examples

```bash
# Basic usage
$ /fractary-repo:worktree-create --work-id 258 --branch feature/258
✓ Worktree created: ../myproject-258

# Custom path
$ /fractary-repo:worktree-create --work-id 259 --branch feature/259 --path ~/work/issue-259
✓ Worktree created: ~/work/issue-259

# Specific base branch
$ /fractary-repo:worktree-create --work-id 260 --branch feature/260 --base develop
✓ Worktree created: ../myproject-260
✓ Based on: develop

# No checkout (faster for large repos)
$ /fractary-repo:worktree-create --work-id 261 --branch feature/261 --no-checkout
✓ Worktree created: ../myproject-261 (no files checked out)
```

---

### Command 2: `/fractary-repo:worktree-list`

List all git worktrees with metadata and FABER workflow associations.

#### Command Signature

```bash
/fractary-repo:worktree-list [options]
```

#### Arguments

| Argument | Type | Required | Description |
|----------|------|----------|-------------|
| `--format` | string | No | Output format: `table` (default), `json`, `simple` |
| `--show-faber` | flag | No | Show FABER workflow associations (reads `.fractary/faber/worktrees.json`) |
| `--porcelain` | flag | No | Machine-readable output (implies --format json) |

#### Behavior

**Operations**:
```bash
# 1. Get all worktrees from git
git worktree list --porcelain

# 2. Parse output to extract:
#    - worktree path
#    - HEAD commit
#    - branch name
#    - locked status

# 3. If --show-faber: Read .fractary/faber/worktrees.json and correlate

# 4. Enrich with metadata:
#    - Is main worktree?
#    - Last activity (git log -1 --format=%at)
#    - Uncommitted changes (git status --short)
#    - FABER workflow run ID (if tracked)
#    - Work ID (if tracked)
```

#### Output Formats

**Table Format** (default):
```
Active Worktrees:
  📁 /mnt/c/GitHub/fractary/myproject (main)
     Branch: main
     Status: ✓ Main worktree
     Last activity: 2 hours ago

  📁 /mnt/c/GitHub/fractary/myproject-258
     Branch: feature/258
     Status: 🔄 FABER workflow running
     Workflow: fractary-faber-258-20260105-143022
     Work ID: 258
     Created: 2 hours ago
     Last activity: 5 minutes ago
     Changes: 3 uncommitted files

  📁 /mnt/c/GitHub/fractary/myproject-259
     Branch: feature/259
     Status: ✓ Clean
     Last activity: 3 days ago

Total: 3 worktrees (1 main + 2 feature worktrees)
Disk usage: ~450 MB
```

**JSON Format** (`--format json`):
```json
{
  "worktrees": [
    {
      "path": "/mnt/c/GitHub/fractary/myproject",
      "is_main": true,
      "branch": "main",
      "head_commit": "a1b2c3d",
      "locked": false,
      "last_activity": "2024-01-05T14:30:00Z",
      "uncommitted_changes": 0,
      "faber_workflow": null
    },
    {
      "path": "/mnt/c/GitHub/fractary/myproject-258",
      "is_main": false,
      "branch": "feature/258",
      "head_commit": "e4f5g6h",
      "locked": false,
      "last_activity": "2024-01-05T16:25:00Z",
      "uncommitted_changes": 3,
      "faber_workflow": {
        "run_id": "fractary-faber-258-20260105-143022",
        "work_id": "258",
        "status": "active",
        "created_at": "2024-01-05T14:30:00Z"
      }
    }
  ],
  "summary": {
    "total": 3,
    "main": 1,
    "feature": 2,
    "disk_usage_bytes": 471859200
  }
}
```

**Simple Format** (`--format simple`):
```
/mnt/c/GitHub/fractary/myproject
/mnt/c/GitHub/fractary/myproject-258
/mnt/c/GitHub/fractary/myproject-259
```

#### Examples

```bash
# Default table view
$ /fractary-repo:worktree-list
[table output]

# JSON for scripting
$ /fractary-repo:worktree-list --format json | jq '.worktrees[].path'

# Simple paths only
$ /fractary-repo:worktree-list --format simple

# With FABER tracking
$ /fractary-repo:worktree-list --show-faber
[includes FABER workflow associations]
```

---

### Command 3: `/fractary-repo:worktree-remove`

Safely remove a git worktree.

#### Command Signature

```bash
/fractary-repo:worktree-remove <path> [options]
```

#### Arguments

| Argument | Type | Required | Description |
|----------|------|----------|-------------|
| `<path>` | string | Yes | Path to worktree to remove |
| `--force` | flag | No | Force removal even with uncommitted changes |
| `--update-tracking` | flag | No | Update `.fractary/faber/worktrees.json` if exists (default: auto) |

#### Behavior

**Validation**:
1. Worktree path must exist
2. Path must be a git worktree (not main worktree)
3. Cannot remove current worktree (must cd out first)
4. Check for uncommitted changes (unless --force)
5. Check for unpushed commits (warn user)

**Operations**:
```bash
# 1. Validate worktree exists
if ! git worktree list | grep -q "$path"; then
  echo "Error: Not a git worktree: $path"
  exit 1
fi

# 2. Check if current worktree
CURRENT_WORKTREE=$(git rev-parse --show-toplevel)
if [[ "$CURRENT_WORKTREE" == "$path" ]]; then
  echo "Error: Cannot remove current worktree. Change directory first."
  exit 1
fi

# 3. Check for uncommitted changes (unless --force)
if [[ ! "$force" ]]; then
  cd "$path"
  if ! git diff-index --quiet HEAD --; then
    echo "Error: Uncommitted changes in worktree. Commit or use --force"
    exit 1
  fi
  cd -
fi

# 4. Check for unpushed commits (warn only)
cd "$path"
UNPUSHED=$(git log --branches --not --remotes --oneline)
if [[ -n "$UNPUSHED" ]]; then
  echo "⚠️  Warning: Worktree has unpushed commits:"
  echo "$UNPUSHED"
  echo ""
  read -p "Continue removing worktree? [y/N]: " confirm
  if [[ "$confirm" != "y" ]]; then
    echo "Cancelled"
    exit 0
  fi
fi
cd -

# 5. Remove worktree
git worktree remove "$path"

# 6. Update FABER tracking (if exists and --update-tracking)
if [[ -f ".fractary/faber/worktrees.json" ]]; then
  # Remove entry from worktrees.json
  # Mark as "removed" with removed_at timestamp
fi

echo "✓ Worktree removed: $path"
```

#### Output

**Success**:
```
✓ Worktree removed: ../myproject-258
✓ Updated FABER tracking
```

**With warnings**:
```
⚠️  Warning: Worktree has unpushed commits:
  e4f5g6h Implement feature X
  a1b2c3d Fix bug Y

Continue removing worktree? [y/N]: y

✓ Worktree removed: ../myproject-258
```

#### Error Cases

| Error | Exit Code | Message |
|-------|-----------|---------|
| Path doesn't exist | 1 | `Error: Path not found: {path}` |
| Not a worktree | 2 | `Error: Not a git worktree: {path}` |
| Current worktree | 3 | `Error: Cannot remove current worktree. Change directory first.` |
| Uncommitted changes | 4 | `Error: Uncommitted changes in worktree. Commit or use --force` |
| Main worktree | 5 | `Error: Cannot remove main worktree` |
| Git command failed | 6 | `Error: Git worktree removal failed: {git_error}` |

#### Examples

```bash
# Basic removal
$ /fractary-repo:worktree-remove ../myproject-258
✓ Worktree removed

# Force removal (ignores uncommitted changes)
$ /fractary-repo:worktree-remove ../myproject-259 --force
✓ Worktree removed (uncommitted changes discarded)

# Remove and update tracking
$ /fractary-repo:worktree-remove ../myproject-260 --update-tracking
✓ Worktree removed
✓ Updated FABER tracking
```

---

### Command 4: `/fractary-repo:worktree-prune`

Clean up stale and orphaned worktrees.

#### Command Signature

```bash
/fractary-repo:worktree-prune [options]
```

#### Arguments

| Argument | Type | Required | Description |
|----------|------|----------|-------------|
| `--dry-run` | flag | No | Show what would be removed without actually removing |
| `--auto` | flag | No | Automatically remove without prompting (dangerous) |
| `--max-age` | number | No | Consider worktrees older than N days as stale (default: 30) |
| `--include-active` | flag | No | Include active FABER workflows in scan (not recommended) |

#### Behavior

**Detection Criteria**:

A worktree is considered **orphaned** or **stale** if:
1. **Branch deleted on remote** AND no local changes
2. **No git activity** for > `--max-age` days (default 30)
3. **FABER workflow completed** but worktree not removed (status: "completed" in worktrees.json)
4. **Git error** (worktree directory missing but git tracking exists)

**Operations**:
```bash
# 1. Get all worktrees
WORKTREES=$(git worktree list --porcelain)

# 2. For each non-main worktree:
for worktree in $WORKTREES; do
  # Skip main worktree
  if is_main_worktree; then continue; fi

  # Check if branch exists on remote
  BRANCH_ON_REMOTE=$(git ls-remote --heads origin "$branch")

  # Check last activity
  LAST_COMMIT_DATE=$(cd "$worktree" && git log -1 --format=%at)
  DAYS_SINCE_ACTIVITY=$(( ($(date +%s) - $LAST_COMMIT_DATE) / 86400 ))

  # Check FABER workflow status
  if [[ -f ".fractary/faber/worktrees.json" ]]; then
    WORKFLOW_STATUS=$(jq -r ".worktrees[] | select(.path == \"$worktree\") | .status" .fractary/faber/worktrees.json)
  fi

  # Determine if orphaned/stale
  if [[ -z "$BRANCH_ON_REMOTE" ]] && [[ no uncommitted changes ]]; then
    REASON="branch_deleted"
    ORPHANED+=("$worktree:$REASON")
  elif [[ $DAYS_SINCE_ACTIVITY -gt $MAX_AGE ]]; then
    REASON="no_activity_${DAYS_SINCE_ACTIVITY}_days"
    ORPHANED+=("$worktree:$REASON")
  elif [[ "$WORKFLOW_STATUS" == "completed" ]]; then
    REASON="workflow_completed"
    ORPHANED+=("$worktree:$REASON")
  fi
done

# 3. Display findings
echo "Found ${#ORPHANED[@]} orphaned/stale worktrees:"
for item in "${ORPHANED[@]}"; do
  IFS=':' read -r path reason <<< "$item"
  echo "  📁 $path - $reason"
done

# 4. Prompt for removal (unless --auto or --dry-run)
if [[ ! "$dry_run" ]]; then
  for item in "${ORPHANED[@]}"; do
    IFS=':' read -r path reason <<< "$item"

    if [[ "$auto" ]]; then
      git worktree remove "$path"
      echo "✓ Removed: $path"
    else
      echo ""
      echo "Worktree: $path"
      echo "Reason: $reason"
      du -sh "$path" 2>/dev/null
      read -p "Remove this worktree? [y/N]: " confirm

      if [[ "$confirm" == "y" ]]; then
        git worktree remove "$path" --force
        echo "✓ Removed: $path"
        REMOVED_COUNT=$((REMOVED_COUNT + 1))
      else
        echo "Skipped: $path"
      fi
    fi
  done
fi

# 5. Also run git worktree prune (cleanup git metadata)
git worktree prune

# 6. Summary
echo ""
echo "Summary:"
echo "  ✓ $REMOVED_COUNT worktrees removed"
echo "  💾 Disk space freed: ~${DISK_FREED}MB"
```

#### Output

**Interactive Mode**:
```
Scanning for orphaned worktrees...

Found 3 worktrees:
  1. ../myproject-258 - ACTIVE (workflow running)
  2. ../myproject-259 - ORPHANED (branch deleted, no uncommitted changes)
  3. ../myproject-260 - STALE (no activity for 45 days)

Worktree: ../myproject-259
Branch: feature/259 (deleted on remote)
Reason: branch_deleted
Size: 150M
Remove this worktree? [y/N]: y
✓ Removed: ../myproject-259

Worktree: ../myproject-260
Branch: feature/260
Reason: no_activity_45_days
Last activity: 45 days ago
Size: 148M
Remove this worktree? [y/N]: y
✓ Removed: ../myproject-260

Summary:
  ✓ 2 worktrees removed
  ✓ 1 active worktree kept
  💾 Disk space freed: ~298 MB
```

**Dry Run Mode** (`--dry-run`):
```
[DRY RUN] Would remove the following worktrees:

  📁 ../myproject-259
     Reason: branch_deleted
     Size: 150M

  📁 ../myproject-260
     Reason: no_activity_45_days
     Size: 148M

Total to remove: 2 worktrees (~298 MB)

Run without --dry-run to actually remove these worktrees.
```

**Auto Mode** (`--auto`):
```
Scanning for orphaned worktrees...

✓ Removed: ../myproject-259 (branch_deleted)
✓ Removed: ../myproject-260 (no_activity_45_days)

Summary:
  ✓ 2 worktrees removed
  💾 Disk space freed: ~298 MB
```

#### Examples

```bash
# Interactive cleanup (prompts for each)
$ /fractary-repo:worktree-prune
[interactive prompts]

# See what would be removed
$ /fractary-repo:worktree-prune --dry-run
[DRY RUN] Would remove 2 worktrees...

# Automatic cleanup (no prompts)
$ /fractary-repo:worktree-prune --auto
✓ Removed 2 worktrees

# Custom max age (7 days)
$ /fractary-repo:worktree-prune --max-age 7
[removes worktrees with no activity for 7+ days]
```

---

## Integration with FABER

### How FABER Uses These Commands

#### 1. **Workflow Start** (workflow-run.md)

```javascript
// When conflict detected
if (existingRunId && existingRunId !== runId) {
  const answer = await AskUserQuestion(/* ... */);

  if (answer === "Create new worktree") {
    // Call fractary-repo:worktree-create
    await Skill({
      skill: "fractary-repo:worktree-create",
      args: `--work-id ${work_id} --branch ${branchName} --path ${worktreePath}`
    });

    // Update state with worktree metadata
    state.worktree = {
      path: worktreePath,
      created_by: "fractary-faber",
      created_at: new Date().toISOString(),
      auto_cleanup: true,
      branch: branchName
    };

    // Update global tracking
    // ... (write to .fractary/faber/worktrees.json)
  }
}
```

#### 2. **Workflow Completion** (Release phase post_step)

```javascript
// In Release phase cleanup step
if (state.worktree && state.worktree.created_by === "fractary-faber") {
  const answer = await AskUserQuestion(/* remove worktree? */);

  if (answer === "Yes") {
    // Return to main worktree first
    await Bash({
      command: `cd ${mainWorktreePath}`,
      description: "Return to main worktree"
    });

    // Call fractary-repo:worktree-remove
    await Skill({
      skill: "fractary-repo:worktree-remove",
      args: `${state.worktree.path} --update-tracking`
    });
  }
}
```

#### 3. **Manual Cleanup** (user-initiated)

```bash
# User runs this directly
$ /fractary-repo:worktree-prune

# Or from FABER docs as recommendation
$ /fractary-repo:worktree-list
$ /fractary-repo:worktree-remove <path>
```

### Error Handling

All commands should:
1. **Return non-zero exit codes** on error
2. **Write errors to stderr**
3. **Provide actionable error messages**
4. **Support `--help` flag** for documentation

FABER will catch errors and:
- Log the error message
- Provide fallback manual instructions
- Not fail the entire workflow

Example error handling in FABER:
```javascript
try {
  await Skill({
    skill: "fractary-repo:worktree-create",
    args: `--work-id ${work_id} --branch ${branchName}`
  });
} catch (error) {
  console.error("\n✗ Failed to create worktree");
  console.error(`Error: ${error.message}`);
  console.error("\nFalling back to manual instructions:");
  console.error(`  git worktree add ${worktreePath} -b ${branchName}`);
  console.error(`  cd ${worktreePath}`);
  console.error("  /fractary-faber:workflow-run <plan-id>");
  throw new Error("Worktree creation failed");
}
```

---

## Implementation Guidelines

### Plugin Structure

```
fractary-repo/
├── commands/
│   ├── worktree-create.md
│   ├── worktree-list.md
│   ├── worktree-remove.md
│   └── worktree-prune.md
├── skills/
│   └── git-manager/
│       └── workflow/
│           ├── worktree-create.md
│           ├── worktree-list.md
│           ├── worktree-remove.md
│           └── worktree-prune.md
└── docs/
    └── WORKTREE-COMMANDS.md
```

### Command Structure (Example)

**File**: `commands/worktree-create.md`

```markdown
---
name: fractary-repo:worktree-create
description: Create a new git worktree for workflow execution
argument-hint: '--work-id <id> --branch <name> [--path <path>]'
allowed-tools: Bash, Read, Write, AskUserQuestion
model: claude-haiku-4
---

# Worktree Create Command

[Implementation instructions for Claude...]
```

### Shell Script Helpers

Consider creating bash helper scripts that commands can call:

```bash
# scripts/worktree-helpers.sh

worktree_get_project_name() {
  basename "$(git rev-parse --show-toplevel)"
}

worktree_generate_path() {
  local work_id="$1"
  local project_name=$(worktree_get_project_name)
  echo "../${project_name}-${work_id}"
}

worktree_check_exists() {
  local path="$1"
  git worktree list | grep -q "$path"
}

# ... more helpers
```

### Testing Requirements

#### Unit Tests

Each command should have:
- ✅ Happy path test (command succeeds)
- ✅ Error case tests (all error codes)
- ✅ Validation tests (bad inputs)
- ✅ Edge case tests (special characters, long paths, etc.)

#### Integration Tests

- ✅ Create → List → Remove workflow
- ✅ Create → Prune orphaned
- ✅ Multiple concurrent worktrees
- ✅ FABER tracking integration
- ✅ Cross-platform (Linux, macOS, Windows/WSL)

#### Performance Tests

- ✅ Large repository (1GB+)
- ✅ Many worktrees (10+)
- ✅ Prune with large worktree count

### Git Version Compatibility

**Minimum**: Git 2.5.0 (worktree support introduced)

**Recommended**: Git 2.15.0+ (improved worktree features)

Test on:
- Git 2.5.0 (minimum)
- Git 2.25.0 (common in Ubuntu 20.04)
- Git 2.30.0+ (latest features)

### Platform Compatibility

Test on:
- ✅ Linux (Ubuntu 20.04+, Debian 10+)
- ✅ macOS (Big Sur+)
- ✅ Windows WSL2 (Ubuntu 20.04+)
- ⚠️ Windows native Git Bash (if possible)

### Security Considerations

1. **Path Traversal**: Validate paths don't escape project boundaries
2. **Command Injection**: Properly escape all user inputs passed to shell
3. **Permission Checks**: Verify write permissions before operations
4. **Symlink Attacks**: Resolve symlinks before operations
5. **Cleanup on Failure**: Don't leave partial worktrees on error

---

## Acceptance Criteria

### Functional Requirements

- [ ] All four commands implemented and functional
- [ ] All error cases handled with appropriate exit codes
- [ ] JSON output mode for programmatic use
- [ ] Help text for all commands (`--help` flag)
- [ ] Update `.fractary/faber/worktrees.json` when appropriate
- [ ] Git worktree prune called after removals
- [ ] Proper directory switching after worktree creation

### Quality Requirements

- [ ] Unit test coverage > 80%
- [ ] Integration tests pass
- [ ] Works on Linux, macOS, Windows WSL
- [ ] Git 2.5+ compatibility verified
- [ ] Performance acceptable on large repos (< 5s for create/remove)
- [ ] Security review passed
- [ ] Documentation complete

### Integration Requirements

- [ ] FABER integration tested end-to-end
- [ ] Error handling verified (FABER graceful degradation)
- [ ] State tracking integration verified
- [ ] Concurrent workflow scenario tested

---

## Deliverables

1. **Commands**: Four markdown command files
2. **Skills**: Corresponding skill implementations
3. **Tests**: Unit and integration test suite
4. **Documentation**: User guide (WORKTREE-COMMANDS.md)
5. **Examples**: Usage examples in docs
6. **Migration Guide**: For upgrading from v3.x

---

## Timeline Estimate

**Total**: 2-3 weeks

- **Week 1**: Commands 1-2 (create, list)
- **Week 2**: Commands 3-4 (remove, prune)
- **Week 3**: Testing, documentation, FABER integration testing

---

## References

- **Git Worktree Docs**: https://git-scm.com/docs/git-worktree
- **SPEC-00028**: FABER Worktree Management (full specification)
- **SPEC-00028 Implementation Note**: What's implemented in FABER
- **FABER Worktree Docs**: plugins/faber/docs/WORKTREE-MANAGEMENT.md

---

## Questions / Clarifications

Please reach out if you need:
- Clarification on any command behavior
- Examples of specific edge cases
- FABER integration code review
- Testing strategy discussion
- Performance requirements details

**Contact**: [Your contact info or issue tracker]

## Appendix: State Schemas

### FABER State File Worktree Object

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

### Global Worktree Tracking File

**Location**: `.fractary/faber/worktrees.json`

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

Schema: `plugins/faber/schemas/worktrees.schema.json`
