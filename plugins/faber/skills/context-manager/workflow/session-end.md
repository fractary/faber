# Session-End Workflow Algorithm

**Purpose**: Save session metadata before session ends or compaction occurs

**Command**: `/fractary-faber:session-end`

**Parameters**:
- `--run-id <run-id>` (optional) - Explicit workflow run ID
- `--reason <reason>` (optional) - Why session is ending: `compaction`, `normal`, or `manual`

## High-Level Flow

```
Input: --run-id (optional), --reason (optional)
  ↓
Detect Active Workflow
  ↓
Load State File
  ↓
Get Current Session
  ↓
Update Session Record
  ↓
Move to History
  ↓
Write State
  ↓
Output: Success message
```

## Step 1: Detect Active Workflow

**Goal**: Determine which workflow run to save session for

**Logic**:
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

**Tools**: Bash (read file), parameter parsing

**Edge Cases**:
- **No active workflow**: Exit gracefully with informative message
- **File read error**: Treat as no active workflow
- **Empty file**: Treat as no active workflow

## Step 2: Load State File

**Goal**: Read current workflow state from disk

**Logic**:
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

**Tools**: Read tool for file access

**Edge Cases**:
- **File missing**: Critical error, cannot proceed
- **JSON parse error**: Critical error, possibly corrupted file
- **Empty file**: Treat as corrupted

**Validation**:
- Check `state.run_id` matches expected run_id
- Check `state.sessions` object exists

## Step 3: Get Current Session

**Goal**: Extract current session information to update

**Logic**:
```
IF state.sessions is NULL OR state.sessions.current_session_id is NULL:
  WARN "No current session to end"
  EXIT 0 (gracefully)
END

current_session_id = state.sessions.current_session_id

# Current session might be:
# 1. Already in session_history (resumed session)
# 2. Not yet in session_history (new session from this run)
# 3. Need to construct from context_metadata

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

**Tools**: JSON parsing, environment detection

**Edge Cases**:
- **No current session**: Exit gracefully
- **Session not in history**: Construct from context metadata
- **Missing started_at**: Use current timestamp or last_artifact_reload

## Step 4: Update Session Record

**Goal**: Add end metadata to the session

**Logic**:
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

**Environment Collection**:
```
get_current_environment():
  RETURN {
    hostname: bash("hostname"),
    platform: bash("uname -s").lowercase(),
    cwd: bash("pwd"),
    git_commit: bash("git rev-parse --short HEAD")
  }
```

**Tools**: Bash for environment detection, JSON manipulation

**Edge Cases**:
- **No phases completed**: Empty array is valid
- **No artifacts loaded**: Empty array is valid
- **Git command fails**: Set git_commit to null

## Step 5: Move to History

**Goal**: Add completed session to session_history

**Logic**:
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

**Tools**: JSON array manipulation

**Edge Cases**:
- **Session already in history**: Update existing entry (session was resumed)
- **First session**: Create session_history array
- **Multiple sessions**: Append to array

## Step 6: Write State

**Goal**: Persist updated state to disk

**Logic**:
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

**Tools**: Write tool, Bash for file operations

**Edge Cases**:
- **Write permission denied**: Critical error with recovery steps
- **Disk full**: Critical error
- **Backup fails**: Warn but continue (not critical)

## Step 7: Report Success

**Goal**: Provide clear feedback to user/hook

**Logic**:
```
duration = calculate_duration(current_session.started_at, current_session.ended_at)

PRINT "✓ Session ended and saved"
PRINT "  Session ID: {current_session.session_id}"
PRINT "  Reason: {current_session.end_reason}"
PRINT "  Duration: {duration}"
PRINT "  Phases completed: {join(current_session.phases_completed, ', ')}"
PRINT "  Artifacts loaded: {length(current_session.artifacts_loaded)}"
```

**Output Format**: Human-readable summary

## Complete Pseudocode

```python
def session_end(run_id=None, reason="manual"):
    # Step 1: Detect Active Workflow
    if run_id is None:
        if exists(".fractary/faber/runs/.active-run-id"):
            run_id = read(".fractary/faber/runs/.active-run-id").strip()
        else:
            print("ℹ️  No active workflow found")
            return 0

    state_path = f".fractary/faber/runs/{run_id}/state.json"

    # Step 2: Load State File
    if not exists(state_path):
        error(f"Workflow state file not found: {state_path}")
        return 1

    try:
        state = json.parse(read(state_path))
    except JSONError as e:
        error(f"Cannot parse state file: {e}")
        return 1

    # Step 3: Get Current Session
    if state["sessions"]["current_session_id"] is None:
        print("⚠️  No current session to end")
        return 0

    current_session_id = state["sessions"]["current_session_id"]
    current_session = find_in_array(
        state["sessions"]["session_history"],
        lambda s: s["session_id"] == current_session_id
    )

    if current_session is None:
        # Construct new session from available data
        current_session = {
            "session_id": current_session_id,
            "started_at": state["context_metadata"]["last_artifact_reload"] or now_iso(),
            "environment": get_environment()
        }

    # Step 4: Update Session Record
    current_session["ended_at"] = now_iso()
    current_session["end_reason"] = reason
    current_session["phases_completed"] = [
        phase["phase_name"]
        for phase in state["phases"]
        if phase["status"] == "completed"
    ]
    current_session["artifacts_loaded"] = [
        artifact["artifact_id"]
        for artifact in state["context_metadata"]["artifacts_in_context"]
    ]

    # Step 5: Move to History
    if "session_history" not in state["sessions"]:
        state["sessions"]["session_history"] = []

    existing_index = find_index(
        state["sessions"]["session_history"],
        lambda s: s["session_id"] == current_session_id
    )

    if existing_index != -1:
        state["sessions"]["session_history"][existing_index] = current_session
    else:
        state["sessions"]["session_history"].append(current_session)

    state["sessions"]["current_session_id"] = None
    state["sessions"]["total_sessions"] = len(state["sessions"]["session_history"])

    # Step 6: Write State
    backup_path = state_path + ".backup"
    try:
        copy(state_path, backup_path)
    except IOError:
        warn("Could not create backup")

    try:
        write(state_path, json.serialize(state, indent=2))
    except IOError as e:
        error(f"Failed to write state file: {e}")
        return 1

    # Step 7: Report Success
    duration = calculate_duration(
        current_session["started_at"],
        current_session["ended_at"]
    )

    print("✓ Session ended and saved")
    print(f"  Session ID: {current_session['session_id']}")
    print(f"  Reason: {reason}")
    print(f"  Duration: {duration}")
    print(f"  Phases completed: {', '.join(current_session['phases_completed'])}")
    print(f"  Artifacts loaded: {len(current_session['artifacts_loaded'])}")

    return 0


def get_environment():
    return {
        "hostname": bash("hostname").strip(),
        "platform": bash("uname -s").lower().strip(),
        "cwd": bash("pwd").strip(),
        "git_commit": bash("git rev-parse --short HEAD 2>/dev/null").strip() or None
    }
```

## Testing Checklist

- [ ] Works with --run-id parameter
- [ ] Works with .fractary/faber/runs/.active-run-id auto-detection
- [ ] Gracefully handles no active workflow
- [ ] Handles missing state file with clear error
- [ ] Handles corrupted JSON with clear error
- [ ] Handles no current session gracefully
- [ ] Captures all phases completed
- [ ] Captures all artifacts loaded
- [ ] Captures environment correctly
- [ ] Creates backup before writing
- [ ] Verifies write succeeded
- [ ] Updates session_history correctly
- [ ] Clears current_session_id
- [ ] Updates total_sessions count
- [ ] Handles session already in history (resume case)
- [ ] Reports success with clear summary

## Performance Considerations

- **File I/O**: Minimize reads/writes (batch state updates)
- **Backup**: Skip if state file is small (<1MB)
- **Environment detection**: Cache results if called multiple times
- **JSON parsing**: Use efficient parser for large state files

## Security Considerations

- **File permissions**: Respect existing permissions on state.json
- **Path traversal**: Validate run_id doesn't contain path traversal
- **JSON injection**: Use proper JSON serialization (no string concatenation)
- **Backup cleanup**: Don't leave sensitive data in backups indefinitely

## Integration Points

**Called by**:
- PreCompact hook (automatic)
- SessionEnd hook (automatic)
- Manual user invocation

**Updates**:
- `.fractary/faber/runs/{run_id}/state.json` - Session metadata

**Reads**:
- `.fractary/faber/runs/.active-run-id` - Active workflow detection

**Coordinates with**:
- `/fractary-faber:prime-context` - Session start (opposite operation)
- `/fractary-faber:workflow-run` - Sets .active-run-id initially
