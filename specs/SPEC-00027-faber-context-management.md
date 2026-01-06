# SPEC-00027: FABER Workflow Context Management with Claude Code Hooks

**Status**: In Progress
**Created**: 2026-01-04
**Updated**: 2026-01-05
**Type**: Feature Specification
**Related**: SPEC-00028 (Automated Worktree Management)

## Overview

Implement **hook-based context management** for FABER workflows using Claude Code's PreCompact, SessionStart, and SessionEnd hooks to automatically preserve and restore critical artifacts across context compaction and session boundaries, enabling seamless workflow continuation across machines and sessions.

## Problem Statement

### Current Pain Points

1. **Context Compaction**: Long-running workflows lose critical artifacts (state, spec, orchestration protocol) when context compacts mid-execution
2. **No Pre-Compaction Saving**: Session metadata is lost when compaction occurs - no record of what was done before compaction
3. **No Automatic Recovery**: After compaction or session end, context must be manually restored
4. **Session Boundaries**: Workflows pause/resume across sessions without preserving or restoring context
5. **Cross-Environment**: Workflows started on one machine cannot easily continue on another
6. **No Session Tracking**: Cannot see which sessions contributed to a workflow run

### User Requirements

- Automatic context reload **only on actual session boundaries** (not every phase)
- Save session metadata **before compaction occurs** (PreCompact hook)
- Restore context **when new session starts** (SessionStart hook with `compact` or `resume` matchers)
- Track which sessions contributed to workflow run
- Manual context priming command for edge cases
- Portable state files that work across machines

## Design Decisions

### One Workflow Per Worktree Limitation

**Design Decision**: FABER workflows are limited to **one active workflow per worktree** at a time.

**Rationale**:
- Uses a single `.fractary/faber/.active-run-id` file to track which workflow is active in the worktree
- When hooks fire (PreCompact, SessionStart, SessionEnd), they read this file to know which workflow to operate on
- If multiple workflows ran simultaneously in the same worktree, they would overwrite each other's `.active-run-id` file, causing conflicts

**Solution for Concurrent Workflows**:
Users who need to work on multiple issues in parallel should use **git worktrees**:

```bash
# Create separate worktrees for each workflow
git worktree add ../myproject-issue-258 -b feature/258
git worktree add ../myproject-issue-259 -b feature/259

# Terminal 1: Work on issue 258
cd ../myproject-issue-258
/fractary-faber:workflow-run --work-id 258

# Terminal 2: Work on issue 259 in parallel (different worktree)
cd ../myproject-issue-259
/fractary-faber:workflow-run --work-id 259
```

**Benefits of This Design**:
1. **Simplicity**: Single file tracking, no complex session-to-workflow mapping
2. **Reliability**: No race conditions or file conflicts
3. **Best Practices**: Aligns with git's recommended workflow (one task per worktree)
4. **Clear UX**: Easy to understand and explain

**Future Enhancement**: See SPEC-00028 for automated worktree lifecycle management to make this limitation transparent to users.

### Active Run ID Tracking Mechanism

**File**: `.fractary/faber/.active-run-id`

**Format**: Single line containing the active workflow run ID
```
fractary-faber-258-20260105-143022-a1b2c3
```

**Lifecycle**:
1. **Workflow Start**: `workflow-run` command writes run ID to `.fractary/faber/.active-run-id`
2. **During Execution**: Hooks read `.fractary/faber/.active-run-id` to know which workflow to operate on
3. **Workflow End**: File remains for manual operations, overwritten by next workflow

**Hook Access**:
```bash
# In PreCompact hook
ACTIVE_RUN_ID=$(cat .fractary/faber/.active-run-id 2>/dev/null)
if [ -z "$ACTIVE_RUN_ID" ]; then
  echo "No active workflow found, skipping session-end"
  exit 0
fi
/fractary-faber:session-end --run-id "$ACTIVE_RUN_ID" --reason compaction

# In SessionStart hook
ACTIVE_RUN_ID=$(cat .fractary/faber/.active-run-id 2>/dev/null)
if [ -z "$ACTIVE_RUN_ID" ]; then
  echo "No active workflow found, skipping prime-context"
  exit 0
fi
/fractary-faber:prime-context --run-id "$ACTIVE_RUN_ID" --trigger session_start
```

## Architecture

### Hook-Based Context Management

```
SESSION 1                    COMPACTION EVENT              SESSION 2
  ↓                               ↓                           ↓
  Frame phase                     │                           │
  Architect phase                 │                           │
  Build phase (long)              │                           │
    ├─ context filling up         │                           │
    ├─ auto-compact triggered ────┤                           │
    │                              │                           │
    │  [PreCompact Hook]           │                           │
    │  ├─ /faber:session-end       │                           │
    │  ├─ Update state.json        │                           │
    │  └─ Mark session ended       │                           │
    │                              │                           │
    ├─ [COMPACTION OCCURS] ────────┤                           │
    │                              │  [SessionStart Hook]      │
    │                              │  ├─ matcher: "compact"    │
    │                              │  ├─ /faber:prime-context  │
    │                              │  ├─ Load artifacts        │
    │                              │  └─ New session created   │
    │                              │                           │
  Build phase continues ───────────────────────────────────────┤
  Evaluate phase                                               │
  Release phase                                                │
                                                               │
                                   [SessionEnd Hook]           │
                                   ├─ /faber:session-end       │
                                   ├─ Update state.json        │
                                   └─ Mark session ended       │
```

### Three Claude Code Hooks

1. **PreCompact Hook**: Saves session state before context compacts
   - Triggers: Before auto-compact (full context window)
   - Action: Call `/fractary-faber:session-end --reason compaction`
   - Updates: state.json with session end metadata

2. **SessionStart Hook**: Restores context when new session begins
   - Triggers: After compaction (`compact` matcher) or workflow resume (`resume` matcher)
   - Action: Call `/fractary-faber:prime-context --trigger session_start`
   - Updates: Loads critical artifacts, creates new session record

3. **SessionEnd Hook**: Saves final session state on normal exit
   - Triggers: On session termination (logout, clear, exit)
   - Action: Call `/fractary-faber:session-end --reason normal`
   - Updates: state.json with final session metadata

### Building on Existing Context Reconstitution

```
┌──────────────────────────────────────────────────────────┐
│  NEW: Hook-Based Context Management                      │
│  - PreCompact hook saves session before compaction       │
│  - SessionStart hook restores context after compaction   │
│  - SessionEnd hook saves final session state             │
│  - Automatic session boundary detection                  │
└──────────────────────────────────────────────────────────┘
                          ▲
                          │
┌──────────────────────────────────────────────────────────┐
│  EXISTING: Manual Context Management                     │
│  - /fractary-faber:prime-context command                 │
│  - critical_artifacts configuration                      │
│  - Manual reload at Frame phase start (optional)         │
└──────────────────────────────────────────────────────────┘
                          ▲
                          │
┌──────────────────────────────────────────────────────────┐
│  EXISTING: Context Reconstitution Protocol               │
│  (Already in context-reconstitution.md)                  │
│  - Loads state/spec/issue when resuming workflow         │
│  - Foundation for context management                     │
└──────────────────────────────────────────────────────────┘
```

## Implementation Design

### 1. Workflow Configuration Schema

**New field**: `critical_artifacts` in workflow configuration

**Example** (`plugins/faber/config/workflows/default.json`):

```json
{
  "id": "default",
  "critical_artifacts": {
    "always_load": [
      {
        "id": "workflow-state",
        "type": "json",
        "path": ".fractary/runs/{run_id}/state.json",
        "description": "Current workflow state file - essential for continuation",
        "required": true,
        "reload_triggers": ["session_start", "manual"]
      },
      {
        "id": "orchestration-protocol",
        "type": "markdown",
        "path": "plugins/faber/docs/workflow-orchestration-protocol.md",
        "description": "Workflow execution protocol - defines how to execute steps",
        "required": true,
        "reload_triggers": ["session_start"]
      }
    ],
    "conditional_load": [
      {
        "id": "specification",
        "type": "markdown",
        "path_from_state": "artifacts.spec_path",
        "description": "Technical specification for the work",
        "required": false,
        "condition": "state.artifacts.spec_path != null",
        "reload_triggers": ["session_start", "phase_transition:architect->build"]
      }
    ]
  }
}
```

**Artifact Definition Fields**:

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `id` | string | Yes | Unique identifier for this artifact |
| `type` | enum | Yes | `json`, `markdown`, `directory`, `work_plugin`, `skill`, `git_info` |
| `path` | string | Conditional | Static file path (supports `{run_id}`, `{plan_id}`, `{project_root}` placeholders) |
| `path_from_state` | string | Conditional | JSONPath to extract path from state file |
| `command` | string | Conditional | Slash command to fetch artifact |
| `description` | string | Yes | Human-readable purpose |
| `required` | boolean | Yes | If true, workflow cannot proceed without it |
| `condition` | string | No | Expression for conditional loading |
| `reload_triggers` | array | Yes | When to reload: `session_start`, `manual` |

### 2. State File Enhancement

**New fields** in `.fractary/runs/{run_id}/state.json`:

```json
{
  "run_id": "fractary-faber-258-20260105-143022",
  "workflow_id": "fractary-faber:default",
  "status": "in_progress",

  "sessions": {
    "current_session_id": "claude-session-20260105-143022-abc123",
    "total_sessions": 2,
    "session_history": [
      {
        "session_id": "claude-session-20260104-xyz789",
        "started_at": "2026-01-04T10:00:00Z",
        "ended_at": "2026-01-04T11:30:00Z",
        "phases_completed": ["frame", "architect"],
        "environment": {
          "hostname": "dev-machine-1",
          "platform": "linux",
          "cwd": "/mnt/c/GitHub/fractary/faber",
          "git_commit": "a1b2c3d4"
        },
        "artifacts_loaded": ["workflow-state", "orchestration-protocol", "specification"]
      }
    ]
  },

  "context_metadata": {
    "last_artifact_reload": "2026-01-05T14:30:00Z",
    "reload_count": 3,
    "artifacts_in_context": [
      {
        "artifact_id": "workflow-state",
        "loaded_at": "2026-01-05T14:30:00Z",
        "load_trigger": "session_start",
        "source": ".fractary/runs/fractary-faber-258-20260105/state.json",
        "size_bytes": 4096
      }
    ]
  }
}
```

### 3. Context Priming Command

**Command**: `/fractary-faber:prime-context`

**Purpose**: Manually reload all critical artifacts for active or resuming workflow

**Usage**:
```bash
# Auto-detect active workflow and reload
/fractary-faber:prime-context

# Reload for specific run
/fractary-faber:prime-context --run-id fractary-faber-258-20260105-143022

# Reload only specific artifacts (faster)
/fractary-faber:prime-context --artifacts workflow-state,specification

# Force reload even if recently loaded
/fractary-faber:prime-context --force

# Dry-run to see what would be loaded
/fractary-faber:prime-context --dry-run
```

**Algorithm**:

1. **Detect active workflow**:
   - If `--run-id` provided, use it
   - Otherwise, read from `.fractary/faber/.active-run-id`
   - If neither exists, use existing auto-detection (search `.fractary/runs/`)
2. Load `state.json` and workflow config
3. Check `sessions.current_session_id`
4. Generate new session ID (timestamp-based)
5. If new session ID != current session ID:
   - Create new session record with session_id, started_at, environment
   - Set as `current_session_id`
   - Increment `total_sessions`
6. Determine which artifacts to load based on config
7. Check if reload needed (skip if loaded within 5 minutes, unless `--force`)
8. Load each artifact using appropriate tool
9. Record loaded artifacts in current session
10. Update `context_metadata` with reload timestamp

### 4. Session-End Command

**Command**: `/fractary-faber:session-end`

**Purpose**: Save session metadata to state.json before session ends or compaction occurs

**Usage**:
```bash
# Called by PreCompact hook
/fractary-faber:session-end --reason compaction

# Called by SessionEnd hook
/fractary-faber:session-end --reason normal

# Manual (edge cases)
/fractary-faber:session-end --run-id fractary-faber-258-20260105-143022
```

**Algorithm**:

1. **Detect active workflow**:
   - If `--run-id` provided, use it
   - Otherwise, read from `.fractary/faber/.active-run-id`
   - If neither exists, exit gracefully (no active workflow)
2. Load `state.json`
3. Get current session info from `state.sessions.current_session_id`
4. Update current session record:
   - Set `ended_at` timestamp
   - Record `phases_completed` (from `state.phases`)
   - Save `artifacts_loaded` list
5. Move current session to `session_history`
6. Write updated `state.json`

### 5. Workflow-Run Modifications

**Modifications to `workflow-run` command**:

**New functionality**:
```bash
# Ensure .fractary/faber/ directory exists
mkdir -p .fractary/faber

# At workflow start, write active run ID to tracking file
echo "$RUN_ID" > .fractary/faber/.active-run-id

# Before starting, check if another workflow is active
if [ -f .fractary/faber/.active-run-id ]; then
  EXISTING_RUN_ID=$(cat .fractary/faber/.active-run-id)
  if [ "$EXISTING_RUN_ID" != "$RUN_ID" ]; then
    echo "⚠️  WARNING: Another workflow is active in this worktree"
    echo "   Active: $EXISTING_RUN_ID"
    echo "   New: $RUN_ID"
    echo ""
    echo "Recommendation: Use separate worktrees for concurrent workflows:"
    echo "  git worktree add ../myproject-issue-259 -b feature/259"
    echo ""
    # Ask user if they want to proceed
    # If yes: overwrite .fractary/faber/.active-run-id
    # If no: exit
  fi
fi
```

### 6. Automatic Reload Integration

**Only Frame phase** has auto-reload (not all phases):

```json
{
  "phases": {
    "frame": {
      "pre_steps": [
        {
          "id": "auto-reload-context",
          "name": "Reload Context",
          "description": "Automatically reload critical artifacts for session continuity",
          "prompt": "/fractary-faber:prime-context"
        }
      ]
    }
  }
}
```

**Why only Frame phase**:
- Frame is the workflow entry point
- Provides initial context load when starting workflow
- Hook-based approach handles mid-execution compaction
- No need for per-phase reloading (too frequent, doesn't detect actual session boundaries)

### 7. Claude Code Hook Configuration

**Hook configurations** (in `.claude/settings.json` or project settings):

#### PreCompact Hook
```json
{
  "hooks": {
    "PreCompact": [
      {
        "matcher": "auto",
        "hooks": [
          {
            "type": "command",
            "command": "/fractary-faber:session-end --reason compaction",
            "timeout": 60
          }
        ]
      }
    ]
  }
}
```

#### SessionStart Hook
```json
{
  "hooks": {
    "SessionStart": [
      {
        "matcher": "compact",
        "hooks": [
          {
            "type": "command",
            "command": "/fractary-faber:prime-context --trigger session_start"
          }
        ]
      },
      {
        "matcher": "resume",
        "hooks": [
          {
            "type": "command",
            "command": "/fractary-faber:prime-context --trigger session_start"
          }
        ]
      }
    ]
  }
}
```

#### SessionEnd Hook
```json
{
  "hooks": {
    "SessionEnd": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "/fractary-faber:session-end --reason normal"
          }
        ]
      }
    ]
  }
}
```

### 8. Portable Path Templates

**Path Templates**: Store portable paths in state using placeholders

```json
{
  "artifacts": {
    "spec_path": "{project_root}/specs/WORK-00258.md"
  }
}
```

**Runtime Resolution**:
- `{project_root}` → git root directory
- `{run_id}` → current run ID
- `{plan_id}` → current plan ID
- `{work_id}` → work item ID from state

## Implementation Phases

### Phase 1: Remove Incorrect Per-Phase Auto-Reload

**Files to modify:**
- `plugins/faber/config/workflows/core.json`
- `plugins/faber/config/workflows/default.json`

**Changes:**
- Remove `auto-reload-context` pre_step from Architect, Build, Evaluate, Release phases
- Keep only in Frame phase as optional initial context load for workflow start

### Phase 2: Create Session Management Command and Active Run Tracking

**New command**: `/fractary-faber:session-end`

**Files to create:**
- `plugins/faber/commands/session-end.md`
- `plugins/faber/skills/context-manager/workflow/session-end.md`

**Files to modify:**
- `plugins/faber/skills/faber-manager/` (Add `.active-run-id` tracking to workflow-run)

**Files created automatically:**
- `.fractary/faber/.active-run-id` (created by workflow-run)

### Phase 3: Enhance Prime-Context Command

**Files to modify:**
- `plugins/faber/commands/prime-context.md` (Add `--trigger` parameter, session detection)
- `plugins/faber/skills/context-manager/workflow/prime-context.md` (Add session detection logic)

### Phase 4: Configure Claude Code Hooks

**Files to create/modify:**
- `.claude/settings.json` or project-specific settings (Add PreCompact, SessionStart, SessionEnd hooks)
- `plugins/faber/docs/HOOKS-SETUP.md` (Step-by-step hook configuration guide)

### Phase 5: Schema Updates (Already Done)

**Files already modified:**
- ✅ `plugins/faber/config/workflow.schema.json` - Has `critical_artifacts`
- ✅ `plugins/faber/config/state.schema.json` - Has `sessions` and `context_metadata`
- ✅ `plugins/faber/config/workflows/default.json` - Has `critical_artifacts` config
- ✅ `plugins/faber/config/workflows/core.json` - Has `critical_artifacts` config
- ✅ `plugins/faber/skills/context-manager/SKILL.md` - Context manager skill
- ✅ `plugins/faber/skills/context-manager/workflow/prime-context.md` - Prime context algorithm
- ✅ `plugins/faber/commands/prime-context.md` - Prime context command
- ✅ `plugins/faber/docs/CONTEXT-MANAGEMENT.md` - User documentation
- ✅ `plugins/faber/docs/standards/manager-protocols/context-reload.md` - Protocol documentation

### Phase 6: Documentation Updates

**Files to update:**
- `plugins/faber/docs/CONTEXT-MANAGEMENT.md` - Add hook setup instructions and one-workflow-per-worktree limitation
- `plugins/faber/docs/standards/manager-protocols/context-reload.md` - Update to reflect hook-based approach
- `specs/SPEC-00027-faber-context-management.md` - This file (updated)

**New files to create:**
- `plugins/faber/docs/HOOKS-SETUP.md` - Step-by-step hook configuration guide

### Phase 7: Update Existing Documentation

**Files to modify:**
- `plugins/faber/skills/context-manager/SKILL.md` - Add session-end workflow reference
- `plugins/faber/commands/prime-context.md` - Add `--trigger` parameter docs and `--run-id` details

### Phase 8: Git Configuration

**Files to modify:**
- `.gitignore` - Should NOT ignore `.fractary/faber/.active-run-id` (needs to be tracked for cross-environment workflows)

**Note**: The `.fractary/faber/.active-run-id` file should be committed to git so that workflows can be resumed across machines.

## Files to Create/Modify

| File | Action | Purpose | Status |
|------|--------|---------|--------|
| **Phase 1: Revert Incorrect Changes** |
| `plugins/faber/config/workflows/core.json` | Modify | Remove auto-reload from Architect/Build/Evaluate/Release | TODO |
| `plugins/faber/config/workflows/default.json` | Modify | Remove auto-reload from Architect/Build/Evaluate/Release | TODO |
| **Phase 2: New Session Management and Active Run Tracking** |
| `plugins/faber/commands/session-end.md` | Create | Session-end command documentation | TODO |
| `plugins/faber/skills/context-manager/workflow/session-end.md` | Create | Session-end workflow algorithm | TODO |
| `plugins/faber/skills/faber-manager/` | Modify | Add .active-run-id tracking to workflow-run | TODO |
| `.fractary/faber/.active-run-id` | Create | Track active workflow run ID (created by workflow-run) | AUTO |
| **Phase 3: Enhance Prime-Context** |
| `plugins/faber/commands/prime-context.md` | Modify | Add --trigger parameter, session detection | TODO |
| `plugins/faber/skills/context-manager/workflow/prime-context.md` | Modify | Add session detection logic | TODO |
| **Phase 4: Hook Configuration** |
| `.claude/settings.json` or project settings | Modify | Add PreCompact, SessionStart, SessionEnd hooks | TODO |
| `plugins/faber/docs/HOOKS-SETUP.md` | Create | Step-by-step hook setup guide | TODO |
| **Phase 5: Already Complete** |
| `plugins/faber/config/workflow.schema.json` | ✅ Done | Has `critical_artifacts` schema | DONE |
| `plugins/faber/config/state.schema.json` | ✅ Done | Has `sessions` and `context_metadata` | DONE |
| `plugins/faber/config/workflows/default.json` | ✅ Done | Has `critical_artifacts` config | DONE |
| `plugins/faber/config/workflows/core.json` | ✅ Done | Has `critical_artifacts` config | DONE |
| `plugins/faber/skills/context-manager/SKILL.md` | ✅ Done | Context manager skill | DONE |
| `plugins/faber/skills/context-manager/workflow/prime-context.md` | ✅ Done | Prime context algorithm | DONE |
| `plugins/faber/commands/prime-context.md` | ✅ Done | Prime context command | DONE |
| `plugins/faber/docs/CONTEXT-MANAGEMENT.md` | ✅ Done | User documentation | DONE |
| `plugins/faber/docs/standards/manager-protocols/context-reload.md` | ✅ Done | Protocol documentation | DONE |
| **Phase 6 & 7: Documentation Updates** |
| `plugins/faber/docs/CONTEXT-MANAGEMENT.md` | Modify | Add hook setup section | TODO |
| `plugins/faber/docs/standards/manager-protocols/context-reload.md` | Modify | Update for hook-based approach | TODO |
| `specs/SPEC-00027-faber-context-management.md` | Modify | This file - updated with hook integration | DONE |
| `plugins/faber/skills/context-manager/SKILL.md` | Modify | Add session-end reference | TODO |
| **Phase 8: Git Configuration** |
| `.gitignore` | Verify | Ensure .fractary/faber/.active-run-id is NOT ignored | TODO |

## User Experience Examples

### Example 1: Automatic Recovery from Mid-Execution Compaction

```bash
# User starts workflow
user$ /fractary-faber:workflow-run --work-id 258

# Workflow creates: .fractary/faber/.active-run-id with "fractary-faber-258-20260105-143022"
# Frame phase: auto-reload-context runs (initial context load)
# Architect phase: spec generated
# Build phase: long implementation, many messages...

# [Context fills up, auto-compact triggered]
# PreCompact Hook executes:
#   ACTIVE_RUN_ID=$(cat .fractary/faber/.active-run-id)
#   → /fractary-faber:session-end --run-id $ACTIVE_RUN_ID --reason compaction
#   ✓ Saves session metadata to state.json
#   ✓ Marks session as ended
#   ✓ Records phases completed: ["frame", "architect", "build"]

# [COMPACTION OCCURS - context cleared]

# SessionStart Hook (matcher: "compact") executes:
#   ACTIVE_RUN_ID=$(cat .fractary/faber/.active-run-id)
#   → /fractary-faber:prime-context --run-id $ACTIVE_RUN_ID --trigger session_start
#   ✓ Detects new session
#   ✓ Creates new session record in state.json
#   ✓ Loads critical artifacts:
#     - workflow-state
#     - orchestration-protocol
#     - specification
#   ✓ Context restored automatically

# Build phase continues seamlessly with full context
# User never notices the compaction occurred
```

### Example 2: Cross-Environment Workflow Continuity

```bash
# Day 1: Start workflow on laptop
user@laptop$ /fractary-faber:workflow-run --work-id 258
# Creates: .fractary/faber/.active-run-id with "fractary-faber-258-20260105-143022"
# ... Frame, Architect phases complete
# ... User closes laptop

# SessionEnd Hook executes on logout:
#   → /fractary-faber:session-end --reason normal
#   ✓ Saves final session metadata

# Day 2: Resume on desktop (different machine)
user@desktop$ cd /path/to/project
user@desktop$ git pull  # sync state files and .active-run-id
user@desktop$ /fractary-faber:workflow-run --resume fractary-faber-258-20260105-143022

# Updates .fractary/faber/.active-run-id (already matches, no warning)
# SessionStart Hook (matcher: "resume") executes:
#   ACTIVE_RUN_ID=$(cat .fractary/faber/.active-run-id)
#   → /fractary-faber:prime-context --run-id $ACTIVE_RUN_ID --trigger session_start
#   ✓ Detects new session (different machine)
#   ✓ Creates session record with new environment:
#     - hostname: "desktop"
#     - platform: "linux"
#     - cwd: "/home/user/myproject"
#   ✓ Loads all critical artifacts
#   ✓ Session history now shows: 2 sessions (laptop, desktop)

# Workflow continues from Build phase with full context
# Cross-environment tracking complete
```

### Example 3: Manual Context Reload (Edge Case)

```bash
# User manually edited state.json to fix an issue
# Needs to reload context with fresh data

user$ /fractary-faber:prime-context --force

# ✓ Context reloaded (bypassing 5-minute cache)
# ✓ All critical artifacts refreshed
# ✓ Session metadata updated

# Continue workflow with corrected context
```

### Example 4: One Workflow Per Worktree (Limitation Warning)

```bash
# Terminal 1: Start workflow for issue 258
user$ /fractary-faber:workflow-run --work-id 258
# Creates: .fractary/faber/.active-run-id with "fractary-faber-258-20260105-143022"
# Workflow starts...

# Terminal 2: Try to start workflow for issue 259 in SAME worktree
user$ /fractary-faber:workflow-run --work-id 259

⚠️  WARNING: Another workflow is active in this worktree
   Active: fractary-faber-258-20260105-143022
   New: fractary-faber-259-20260105-144500

Recommendation: Use separate worktrees for concurrent workflows:
  git worktree add ../myproject-issue-259 -b feature/259
  cd ../myproject-issue-259
  /fractary-faber:workflow-run --work-id 259

Do you want to proceed anyway? This will take over context management
for this worktree, potentially interfering with the other workflow. [y/N]:

# User enters 'n' (recommended)
Workflow start cancelled. Use separate worktrees for concurrent workflows.

# Correct approach:
user$ git worktree add ../myproject-issue-259 -b feature/259
user$ cd ../myproject-issue-259
user$ /fractary-faber:workflow-run --work-id 259
# Creates separate: ../myproject-issue-259/.fractary/faber/.active-run-id
# Now both workflows can run in parallel without conflicts
```

## Success Metrics

1. **Automatic Compaction Recovery**: Workflows continue seamlessly after auto-compact (0 manual intervention needed)
2. **Session Boundary Detection**: 100% accurate detection of new sessions (post-compaction, resume, cross-environment)
3. **Pre-Compaction Saving**: Session metadata saved before every compaction event
4. **Cross-Environment**: Workflows portable between machines with complete session tracking
5. **Zero Manual Intervention**: Users never need to manually reload context (hooks handle automatically)
6. **Backward Compatibility**: Existing workflows work without hooks (manual fallback available)

## Risks and Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| **Hook configuration complexity** | Users don't set up hooks | Provide HOOKS-SETUP.md with step-by-step guide, make hooks optional |
| **Hooks fail silently** | Context not restored | Add logging, provide manual fallback (`/prime-context`) |
| **Session ID collisions** | Wrong session tracking | Use timestamp + random suffix for uniqueness |
| **Artifacts too large** | Performance impact | Keep existing size warnings, use smart reload (5-min cache) |
| **Path resolution fails** | Can't load artifacts | Graceful degradation, clear error messages, manual override |
| **Hook timeout** | Session-end truncated | Set 60s timeout for PreCompact hook, make saves fast |
| **Users try multiple workflows in same worktree** | Conflicts, lost context | Detect active workflow, warn user, suggest git worktrees |
| **`.active-run-id` file conflicts** | Wrong workflow loaded | One workflow per worktree design prevents this |
| **Forgot to commit `.active-run-id`** | Can't resume cross-environment | Document that file should be committed, not in .gitignore |
| **`.fractary/faber/` directory not created** | File write fails | Ensure directory exists (mkdir -p) before writing |

## Worktree Management Integration

**Status**: Implemented (FABER side)
**See**: `specs/SPEC-00028-faber-worktree-management.md`
**Documentation**: `plugins/faber/docs/WORKTREE-MANAGEMENT.md`

The one-workflow-per-worktree limitation is by design for simplicity and reliability. To make concurrent workflows easier, **automated worktree lifecycle management** has been implemented:

- ✅ **Auto-detection**: Detect worktree conflicts and offer to create new worktree
- ✅ **Auto-creation**: Seamlessly create and switch to new worktree for concurrent workflow
- ✅ **Auto-cleanup**: Remove worktrees after workflow completes and PR merges
- ⏳ **Orphan detection**: Identify and clean up forgotten worktrees (requires fractary-repo plugin)

**Implementation Status:**
- ✅ State schema includes worktree metadata
- ✅ Global worktree tracking (`.fractary/faber/worktrees.json`)
- ✅ Workflow-run command offers worktree creation on conflict
- ✅ Release phase cleanup step
- ⏳ Fractary-repo worktree commands (separate repository)

This enhancement makes worktrees transparent to users while maintaining the simple one-workflow-per-worktree design.

**Note**: Full functionality requires fractary-repo plugin v4.0+ with worktree commands. See [SPEC-00028 Implementation Note](./SPEC-00028-IMPLEMENTATION-NOTE.md).

## Acceptance Criteria

- [ ] Workflow schema supports `critical_artifacts` configuration
- [ ] State schema tracks `sessions` and `context_metadata`
- [ ] Default workflows declare critical artifacts
- [ ] `/fractary-faber:prime-context` command works with `--run-id` and `--trigger` parameters
- [ ] `/fractary-faber:session-end` command saves session metadata
- [ ] `workflow-run` command writes `.fractary/faber/.active-run-id`
- [ ] `workflow-run` command detects and warns about workflow conflicts
- [ ] PreCompact hook saves session before compaction
- [ ] SessionStart hook restores context after compaction
- [ ] SessionEnd hook saves final session state
- [ ] Auto-reload only on Frame phase (not all phases)
- [ ] Session history tracked across environments
- [ ] Portable paths resolve correctly
- [ ] `.fractary/faber/.active-run-id` committed to git
- [ ] Documentation complete (including hook setup guide)
- [ ] Backward compatible with existing workflows

## Related Documentation

- `plugins/faber/docs/CONTEXT-MANAGEMENT.md` - User guide for context management
- `plugins/faber/docs/HOOKS-SETUP.md` - Claude Code hook configuration guide
- `plugins/faber/docs/standards/manager-protocols/context-reconstitution.md` - Existing context loading protocol
- `plugins/faber/docs/workflow-orchestration-protocol.md` - Workflow execution protocol
- `plugins/faber/docs/RUN-ID-SYSTEM.md` - Run isolation system
- `plugins/faber/docs/STATE-TRACKING.md` - State management
- `specs/SPEC-00028-faber-worktree-management.md` - Future worktree automation enhancement
