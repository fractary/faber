---
model: claude-sonnet-4-5
---

# /fractary-faber:session-end

Save session metadata to state.json before session ends or compaction occurs.

## What This Does

Captures the current session's work and environment before a session ends, ensuring complete audit trail of all sessions that contributed to a workflow run.

**Saved Metadata**:
- Session end timestamp
- Phases completed during this session
- Artifacts that were loaded
- Environment information (hostname, platform, working directory)

**When It Runs**:
- **PreCompact Hook** - Automatically before context compaction
- **SessionEnd Hook** - Automatically on session termination (logout, clear, exit)
- **Manual** - When you need to explicitly save session state

## Usage

```bash
# Called by PreCompact hook (automatic)
/fractary-faber:session-end --reason compaction

# Called by SessionEnd hook (automatic)
/fractary-faber:session-end --reason normal

# Manual invocation with explicit run ID
/fractary-faber:session-end --run-id fractary-faber-258-20260105-143022

# Manual invocation (auto-detects active workflow)
/fractary-faber:session-end
```

## Your Mission

1. **Detect active workflow** - Find which workflow to save session for
2. **Load current state** - Read `.fractary/runs/{run_id}/state.json`
3. **Update session record** - Add `ended_at`, `phases_completed`, `artifacts_loaded`
4. **Move to history** - Add completed session to `session_history`
5. **Save state** - Write updated state.json back to disk

## Command Flags

| Flag | Type | Required | Description |
|------|------|----------|-------------|
| `--run-id` | string | No | Explicit workflow run ID (auto-detects from `.fractary/faber/.active-run-id` if omitted) |
| `--reason` | string | No | Why session is ending: `compaction`, `normal`, or `manual` (default: `manual`) |

## Workflow Detection

The command detects which workflow to operate on using this priority:

1. **`--run-id` parameter** - If provided, use explicitly
2. **`.fractary/faber/.active-run-id` file** - Read active workflow from tracking file
3. **Graceful exit** - If neither exists, exit with message "No active workflow found"

## Algorithm

```
1. Detect Target Workflow
   ├─ If --run-id provided → Use it
   ├─ Else read .fractary/faber/.active-run-id
   └─ If neither exists → Exit gracefully (no active workflow)

2. Load State File
   ├─ Read .fractary/runs/{run_id}/state.json
   └─ Parse JSON

3. Get Current Session
   ├─ Extract state.sessions.current_session_id
   ├─ Find session in state.sessions (might not be in history yet)
   └─ If no current session → Log warning and exit

4. Update Session Record
   ├─ Set ended_at: current timestamp (ISO 8601)
   ├─ Set phases_completed: from state.phases (array of completed phase names)
   ├─ Set artifacts_loaded: from state.context_metadata.artifacts_in_context (array of artifact IDs)
   └─ Set end_reason: from --reason parameter

5. Move to History
   ├─ Add updated session to state.sessions.session_history
   ├─ Clear state.sessions.current_session_id (set to null)
   └─ Keep total_sessions count

6. Write State
   ├─ Serialize state to JSON
   └─ Write to .fractary/runs/{run_id}/state.json

7. Report Success
   └─ Log "Session ended: {session_id} (reason: {reason})"
```

## Output Format

### Successful Save

```
✓ Session ended and saved
  Session ID: claude-session-20260105-143022-a1b2c3
  Reason: compaction
  Duration: 2 hours 15 minutes
  Phases completed: frame, architect, build (partial)
  Artifacts loaded: 3 (workflow-state, orchestration-protocol, specification)
```

### No Active Workflow

```
ℹ️  No active workflow found
   No session to end.

Possible reasons:
- No workflow is currently running in this worktree
- The .fractary/faber/.active-run-id file doesn't exist
- Workflow already completed

To start a new workflow:
  /fractary-faber:workflow-run --work-id <work-id>
```

### Session Already Ended

```
⚠️  Session already ended
   Session ID: claude-session-20260105-143022-a1b2c3
   Ended at: 2026-01-05T16:30:00Z

   No changes made to state.json
```

## What Gets Saved

The session record in `state.json` includes:

```json
{
  "sessions": {
    "current_session_id": null,
    "total_sessions": 1,
    "session_history": [
      {
        "session_id": "claude-session-20260105-143022-a1b2c3",
        "started_at": "2026-01-05T14:00:00Z",
        "ended_at": "2026-01-05T16:15:00Z",
        "end_reason": "compaction",
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
  }
}
```

## Error Handling

### Critical Errors (Stop Execution)

**State file not found**:
```
❌ ERROR: Workflow state file not found
Run ID: fractary-faber-258-20260105-143022
Expected: .fractary/runs/fractary-faber-258-20260105-143022/state.json

Recovery:
1. Verify run ID is correct
2. Check if workflow was started
3. List available runs: ls .fractary/runs/
```

**State file corrupted**:
```
❌ ERROR: Cannot parse state file
Path: .fractary/runs/fractary-faber-258-20260105/state.json
Error: Invalid JSON at line 42

Recovery:
1. Check if backup exists: state.backup.json
2. Restore from backup if available
3. Contact support if no backup available
```

**Cannot write state file**:
```
❌ ERROR: Failed to save state file
Path: .fractary/runs/fractary-faber-258-20260105/state.json
Error: Permission denied

Recovery:
1. Check file permissions
2. Ensure .fractary/runs/ directory is writable
3. Check disk space
```

## Hook Integration

### PreCompact Hook

Called automatically before context compaction:

```bash
# In .claude/settings.json
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

**Hook script**:
```bash
#!/bin/bash
# PreCompact hook saves session before context clears
ACTIVE_RUN_ID=$(cat .fractary/faber/.active-run-id 2>/dev/null)
if [ -z "$ACTIVE_RUN_ID" ]; then
  echo "No active workflow found, skipping session-end"
  exit 0
fi
/fractary-faber:session-end --run-id "$ACTIVE_RUN_ID" --reason compaction
```

### SessionEnd Hook

Called automatically on session termination:

```bash
# In .claude/settings.json
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

**Hook script**:
```bash
#!/bin/bash
# SessionEnd hook saves final session state
ACTIVE_RUN_ID=$(cat .fractary/faber/.active-run-id 2>/dev/null)
if [ -z "$ACTIVE_RUN_ID" ]; then
  echo "No active workflow found, skipping session-end"
  exit 0
fi
/fractary-faber:session-end --run-id "$ACTIVE_RUN_ID" --reason normal
```

## Use Cases

### Use Case 1: Automatic Pre-Compaction Save

```bash
# Long-running Build phase fills context window
# Claude Code triggers auto-compact

# PreCompact hook automatically calls:
/fractary-faber:session-end --reason compaction

# Session metadata saved before context clears
# SessionStart hook will restore context in new session
```

### Use Case 2: Normal Session Exit

```bash
# User completes work for the day
user$ exit  # or /clear, or logout

# SessionEnd hook automatically calls:
/fractary-faber:session-end --reason normal

# Final session state saved
# Workflow can be resumed later with full history
```

### Use Case 3: Manual Session Checkpoint

```bash
# User wants to explicitly save session state
user$ /fractary-faber:session-end

✓ Session ended and saved
  Session ID: claude-session-20260105-143022-a1b2c3

# Useful before:
# - Switching to different workflow
# - Making manual state.json edits
# - Testing workflow resume
```

## Best Practices

1. **Let hooks handle it** - In normal workflow execution, hooks call this automatically
2. **Manual only for edge cases** - Use manual invocation only when debugging or testing
3. **Check output** - Verify session was saved successfully before exiting
4. **Preserve state files** - Don't delete .fractary/runs/ directories with unsaved sessions

## What This Command Does NOT Do

- Does NOT reload artifacts (use `/fractary-faber:prime-context` for that)
- Does NOT start a new session (SessionStart hook does that)
- Does NOT modify workflow phase state (only session metadata)
- Does NOT affect .fractary/faber/.active-run-id file (workflow-run manages that)

## Implementation Details

This command delegates to the **context-manager skill** for execution. See:
- `plugins/faber/skills/context-manager/workflow/session-end.md` - Detailed algorithm
- `plugins/faber/skills/context-manager/SKILL.md` - Skill documentation

## See Also

- **SessionStart**: `/fractary-faber:prime-context` - Restores context when new session begins
- **Hook Setup**: `plugins/faber/docs/HOOKS-SETUP.md` - Configure hooks for automatic session management
- **State Schema**: `plugins/faber/config/state.schema.json` - Session metadata structure
- **Spec**: `specs/SPEC-00027-faber-context-management.md` - Full context management spec
