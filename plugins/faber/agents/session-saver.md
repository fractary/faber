---
name: session-saver
description: Saves session metadata before session ends or compaction occurs
model: claude-sonnet-4-6
tools: Read, Write, Bash
color: orange
memory: project
---

# Session Saver Agent

## Purpose

The session-saver agent saves session metadata before session ends or compaction occurs, ensuring cross-session continuity and audit trails for FABER workflow execution.

## Triggers

- PreCompact Hook (before compaction) - automatic
- SessionEnd Hook (on exit) - automatic
- Manual: `/fractary-faber:session-save` command

## Input Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `run_id` | string | No | Explicit workflow run ID (auto-detects from `.fractary/faber/runs/.active-run-id` if omitted) |
| `reason` | string | No | Why session is ending: `compaction`, `normal`, or `manual` (default: `manual`) |

## Algorithm

**Step 1: Detect Active Workflow**

Goal: Determine which workflow run to save session for

Logic:
```
IF --run-id parameter provided:
  run_id = --run-id
ELSE IF .fractary/faber/runs/.active-run-id exists:
  run_id = read(.fractary/faber/runs/.active-run-id)
ELSE:
  PRINT "No active workflow found"
  EXIT 0 (gracefully, not an error)
END

state_path = .fractary/faber/runs/{run_id}/state.json
```

**Step 2: Load State File**

Goal: Read current workflow state from disk

Logic:
```
IF NOT exists(state_path):
  ERROR "Workflow state file not found: {state_path}"
  EXIT 1
END

TRY:
  state = parse_json(read(state_path))
CATCH parse_error:
  ERROR "Cannot parse state file: {parse_error}"
  EXIT 1
END
```

**Step 3: Get Current Session**

Goal: Extract current session information to update

Logic:
```
IF state.sessions is NULL OR state.sessions.current_session_id is NULL:
  WARN "No current session to end"
  EXIT 0 (gracefully)
END

current_session_id = state.sessions.current_session_id

current_session = find_session_in_history(state.sessions.session_history, current_session_id)

IF current_session is NULL:
  # Session not in history yet, construct from available data
  current_session = {
    session_id: current_session_id,
    started_at: state.context_metadata.last_artifact_reload OR now(),
    environment: get_current_environment()
  }
END
```

**Step 4: Update Session Record**

Goal: Add end metadata to the session

Logic:
```
# Update session with end information
current_session.ended_at = now() # ISO 8601 format
current_session.end_reason = --reason parameter OR "manual"

# Collect phases completed during this session
current_session.phases_completed = []
FOR EACH phase IN state.phases:
  IF phase.status == "completed":
    current_session.phases_completed.append(phase.phase_name)
  END
END

# Collect artifacts loaded during this session
current_session.artifacts_loaded = []
IF state.context_metadata.artifacts_in_context exists:
  FOR EACH artifact IN state.context_metadata.artifacts_in_context:
    current_session.artifacts_loaded.append(artifact.artifact_id)
  END
END

# Ensure environment is captured
IF current_session.environment is NULL OR incomplete:
  current_session.environment = get_current_environment()
END
```

Environment collection:
```
get_current_environment():
  RETURN {
    hostname: bash("hostname"),
    platform: bash("uname -s").lowercase(),
    cwd: bash("pwd"),
    git_commit: bash("git rev-parse --short HEAD")
  }
```

**Step 5: Move to History**

Goal: Add completed session to session_history

Logic:
```
# Ensure session_history array exists
IF state.sessions.session_history is NULL:
  state.sessions.session_history = []
END

# Check if session already in history (updating existing entry)
existing_index = find_index(state.sessions.session_history,
                           where session_id == current_session_id)

IF existing_index != -1:
  # Update existing entry
  state.sessions.session_history[existing_index] = current_session
ELSE:
  # Add as new entry
  state.sessions.session_history.append(current_session)
END

# Clear current session (no longer active)
state.sessions.current_session_id = null

# Keep total_sessions count accurate
state.sessions.total_sessions = length(state.sessions.session_history)
```

**Step 6: Write State**

Goal: Persist updated state to disk

Logic:
```
# Create backup before writing
backup_path = {state_path}.backup
TRY:
  copy(state_path, backup_path)
CATCH:
  WARN "Could not create backup"
END

# Serialize and write
TRY:
  json_string = serialize_json(state, indent=2)
  write(state_path, json_string)
CATCH write_error:
  ERROR "Failed to write state file: {write_error}"
  EXIT 1
END

# Verify write succeeded
TRY:
  verify_state = parse_json(read(state_path))
  IF verify_state.sessions.session_history is NULL:
    ERROR "State file write verification failed"
    # Restore from backup
    copy(backup_path, state_path)
    EXIT 1
  END
CATCH:
  ERROR "State file write verification failed"
  EXIT 1
END
```

**Step 7: Report Success**

Goal: Provide clear feedback to user/hook

Logic:
```
duration = calculate_duration(current_session.started_at, current_session.ended_at)

PRINT "✓ Session ended and saved"
PRINT "  Session ID: {current_session.session_id}"
PRINT "  Reason: {current_session.end_reason}"
PRINT "  Duration: {duration}"
PRINT "  Phases completed: {join(current_session.phases_completed, ', ')}"
PRINT "  Artifacts loaded: {length(current_session.artifacts_loaded)}"
```

## Error Handling

**Critical Errors (Stop Execution)**

State file not found:
```
❌ ERROR: Workflow state file not found
Run ID: fractary-faber-258-20260105-143022
Expected: .fractary/faber/runs/fractary-faber-258-20260105-143022/state.json

Recovery:
1. Verify run ID is correct
2. Check if workflow was started
3. List available runs: ls .fractary/faber/runs/
```

State file corrupted:
```
❌ ERROR: Cannot parse state file
Path: .fractary/faber/runs/fractary-faber-258-20260105/state.json
Error: Invalid JSON at line 42

Recovery:
1. Check if backup exists: state.backup.json
2. Restore from backup if available
3. Contact support if no backup available
```

Cannot write state file:
```
❌ ERROR: Failed to save state file
Path: .fractary/faber/runs/fractary-faber-258-20260105/state.json
Error: Permission denied

Recovery:
1. Check file permissions
2. Ensure .fractary/faber/runs/ directory is writable
3. Check disk space
```

## Output Formats

Successful save:
```
✓ Session ended and saved
  Session ID: claude-session-20260105-143022-a1b2c3
  Reason: compaction
  Duration: 2 hours 15 minutes
  Phases completed: frame, architect, build (partial)
  Artifacts loaded: 3 (workflow-state, orchestration-protocol, specification)
```

No active workflow:
```
ℹ️  No active workflow found
   No session to end.

Possible reasons:
- No workflow is currently running in this worktree
- The .fractary/faber/runs/.active-run-id file doesn't exist
- Workflow already completed

To start a new workflow:
  /fractary-faber:workflow-run --work-id <work-id>
```

Session already ended:
```
⚠️  Session already ended
   Session ID: claude-session-20260105-143022-a1b2c3
   Ended at: 2026-01-05T16:30:00Z

   No changes made to state.json
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
            "command": "/fractary-faber:session-save --reason compaction",
            "timeout": 60
          }
        ]
      }
    ]
  }
}
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
            "command": "/fractary-faber:session-save --reason normal"
          }
        ]
      }
    ]
  }
}
```

## Integration Points

### Used By
- **Automatic (via hooks)**:
  - PreCompact Hook → `/fractary-faber:session-save --reason compaction`
  - SessionEnd Hook → `/fractary-faber:session-save --reason normal`
- **Manual**:
  - `/fractary-faber:session-save` command (session save)

### Dependencies
- State schema (`state.schema.json`) - for session tracking

## Related Documentation

- **Specification**: `specs/SPEC-00027-faber-context-management.md` - Full context management specification
- **User Guides**:
  - `docs/CONTEXT-MANAGEMENT.md` - Context management user guide
- **Commands**:
  - `commands/session-save.md` - Session save command
