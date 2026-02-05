---
name: prime-context
description: Reload critical artifacts for active workflow
model: claude-sonnet-4-5
---

# Prime Context Workflow

Reloads critical artifacts for an active or resuming FABER workflow to ensure all essential context is available.

## Input Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `run_id` | string | No | Specific run ID to reload. If omitted, auto-detects from `.fractary/faber/runs/.active-run-id` or searches for active workflows |
| `trigger` | string | No | What triggered this reload: `session_start`, `manual`, `phase_start`. Default: `manual` |
| `artifacts` | string | No | Comma-separated list of specific artifact IDs to load. If omitted, loads all configured artifacts |
| `force` | boolean | No | Force reload even if recently loaded. Default: false |
| `dry_run` | boolean | No | Show what would be loaded without actually loading. Default: false |

## Algorithm

### Step 1: Detect Target Workflow

**Priority order:**
1. If `run_id` parameter provided → Use it directly
2. Else if `.fractary/faber/runs/.active-run-id` exists → Read run ID from file
3. Else search `.fractary/faber/runs/` for state-*.json files with status "in_progress" or "paused"
   - If none found: Return error "No active workflow found"
   - If one found: Use that run_id
   - If multiple found: Prompt user to select which workflow

**Active run ID file format:**
- Path: `.fractary/faber/runs/.active-run-id`
- Content: Single line containing run ID (e.g., `fractary-faber-258-20260105-143022`)

### Step 2: Load State and Workflow Config

1. Read `.fractary/faber/runs/{plan_id}/state-{run_suffix}.json`
2. Extract `workflow_id` from state
3. Load workflow configuration:
   - If workflow_id starts with "fractary-faber:": Load from `plugins/faber/config/workflows/{name}.json`
   - Otherwise: Load from `.fractary/faber/workflows/{name}.json`
4. Extract `critical_artifacts` configuration

Validate state integrity:
- Check required fields exist (run_id, workflow_id, status)
- Check state is valid JSON
- If invalid, return error with recovery suggestions

### Step 3: Detect and Create Session

**Session detection logic:**

1. **Check current session:**
   - Read `state.sessions.current_session_id`
   - If null or missing, session field needs initialization

2. **Generate new session ID:**
   ```
   timestamp = format(now(), "YYYYMMDD-HHMMSS")
   random = generate_random_string(6, "alphanumeric-lowercase")
   new_session_id = "claude-session-${timestamp}-${random}"
   ```

3. **Compare session IDs:**
   - If `new_session_id` != `current_session_id` → New session detected
   - If IDs match → Continue with current session

4. **If new session detected:**
   ```json
   new_session = {
     "session_id": new_session_id,
     "started_at": current_timestamp_iso8601,
     "environment": {
       "hostname": bash("hostname"),
       "platform": bash("uname -s").lowercase(),
       "cwd": bash("pwd"),
       "git_commit": bash("git rev-parse --short HEAD")
     },
     "artifacts_loaded": []
   }
   ```

5. **Update state:**
   - Set `state.sessions.current_session_id = new_session_id`
   - Append `new_session` to `state.sessions.session_history` (if not already present)
   - Increment `state.sessions.total_sessions`

6. **Session continuity check:**
   - If session already exists in history (resume case), update it instead of creating new entry
   - This handles cross-environment workflow resumption

### Step 4: Determine Artifacts to Load

```
artifacts_to_load = []

# Always load artifacts
for artifact in workflow.critical_artifacts.always_load:
  artifacts_to_load.add(artifact)

# Conditional load artifacts
for artifact in workflow.critical_artifacts.conditional_load:
  if evaluate_condition(artifact.condition, state):
    artifacts_to_load.add(artifact)

# Phase-specific artifacts
current_phase = state.current_phase
if workflow.critical_artifacts.phase_specific[current_phase]:
  for artifact in phase_specific[current_phase]:
    artifacts_to_load.add(artifact)

# Filter by requested artifacts if specified
if artifacts_parameter:
  requested_ids = artifacts_parameter.split(',')
  artifacts_to_load = filter(artifacts_to_load, id in requested_ids)
```

### Step 5: Check if Reload Needed

If NOT in force mode:
- For each artifact, check `state.context_metadata.artifacts_in_context`
- If artifact was loaded within last 5 minutes, skip it
- Log skipped artifacts for transparency

### Step 6: Load Each Artifact

For each artifact in `artifacts_to_load`:

**Based on artifact type:**

- **json/markdown**: Use Read tool with resolved path
- **directory**:
  - If `load_strategy` is "latest_only": Load most recent file only
  - If `load_strategy` is "summary": Load summary of directory
  - Otherwise: Load all files
- **work_plugin/skill**: Use Skill tool with interpolated command
- **git_info**: Use Bash tool with git command

**Path resolution:**
Replace placeholders in paths:
- `{project_root}` → Git repository root
- `{run_id}` → Current run ID from state
- `{plan_id}` → Plan ID from state
- `{work_id}` → Work ID from state

**Error handling:**
- If artifact is required and fails: Stop and return error
- If artifact is optional and fails: Log warning and continue

### Step 7: Update State Metadata

Update `state.json` with:

**Context metadata:**
```json
{
  "context_metadata": {
    "last_artifact_reload": "<current_timestamp>",
    "reload_count": "<previous + 1>",
    "artifacts_in_context": [
      {
        "artifact_id": "workflow-state",
        "loaded_at": "<timestamp>",
        "load_trigger": "<trigger parameter value: session_start, manual, or phase_start>",
        "source": ".fractary/faber/runs/xyz/state.json",
        "size_bytes": 4096
      }
    ]
  }
}
```

**Note**: The `load_trigger` field is set to the value of the `trigger` parameter passed to the command.

**Session tracking (if new session):**
```json
{
  "sessions": {
    "current_session_id": "claude-session-<timestamp>-<random>",
    "session_history": [
      {
        "session_id": "claude-session-<id>",
        "started_at": "<timestamp>",
        "environment": {
          "hostname": "<hostname>",
          "platform": "<platform>",
          "cwd": "<current_directory>",
          "git_commit": "<commit_hash>"
        },
        "artifacts_loaded": ["workflow-state", "specification"]
      }
    ]
  }
}
```

### Step 8: Report Results

Output format:
```
✓ Context reloaded for run: {run_id}
  Workflow: {workflow_id}
  Run status: {status}

Artifacts loaded (3):
  ✓ workflow-state - Current workflow state file
  ✓ orchestration-protocol - Workflow execution protocol
  ✓ specification - Technical specification

Session tracking:
  Current session: claude-session-20260104-a1b2c3
  Total sessions: 2
  Environment: dev-machine-1 (linux)

Context metadata:
  Last reload: 2026-01-04T14:30:00Z
  Total reloads: 3
```

## Error Handling

### Critical Errors (Stop Execution)

**Run ID not found:**
```
❌ ERROR: Run not found
Run ID: {run_id}
Path: .fractary/faber/runs/{plan_id}/state-{run_suffix}.json

Recovery:
1. List active runs: find .fractary/runs -name state.json
2. Start new run: /fractary-faber:run {work_id}
```

**State file corrupted:**
```
❌ ERROR: Cannot read state file
Path: .fractary/faber/runs/{plan_id}/state-{run_suffix}.json

Recovery:
1. Check if backup exists: .fractary/faber/runs/{run_id}/state.backup.json
2. Restore from backup if available
```

**Required artifact missing:**
```
❌ ERROR: Required artifact not found
Artifact: {artifact_id}
Path: {resolved_path}

Recovery:
1. Check if path is correct in workflow config
2. Check if artifact was created in earlier phase
3. Run the phase that creates this artifact
```

### Warnings (Continue Execution)

**Optional artifact missing:**
```
⚠️ WARNING: Optional artifact not found
Artifact: {artifact_id}
Path: {resolved_path}

Workflow will continue without this artifact.
```

**Artifact too large:**
```
⚠️ WARNING: Large artifact detected
Artifact: {artifact_id}
Size: {size_mb} MB

Consider using load_strategy: "summary" for large files.
```

## Dry Run Mode

When `--dry-run` is specified, show what would be loaded without loading:

```
Would reload context for run: fractary-faber-258-20260104
Workflow: fractary-faber:default

Artifacts that would be loaded:
  ✓ workflow-state
    Type: json
    Path: .fractary/faber/runs/{plan_id}/state-{run_suffix}.json
    Required: yes
    Exists: yes
    Size: 4.2 KB

  ✓ specification
    Type: markdown
    Path from state: artifacts.spec_path
    Resolved: /path/to/specs/WORK-258.md
    Condition: state.artifacts.spec_path != null
    Required: no
    Exists: yes
    Size: 12.5 KB

Total: 2 artifacts (2 loadable)
Estimated context size: 16.7 KB
```

## Integration with Existing Context Reconstitution

This workflow extends the existing context-reconstitution protocol:

**Existing Protocol** (runs once at workflow start):
- Step 0.1: Load run state and metadata
- Step 0.2: Load specification (if exists)
- Step 0.3: Load issue details (if work_id present)
- Step 0.4: Inspect branch state
- Step 0.5: Review recent events

**NEW: prime-context workflow** (runs on demand):
- Reloads artifacts based on workflow config
- More flexible (configurable per workflow)
- Tracks what was loaded and when
- Handles more artifact types
- Updates session metadata

The prime-context workflow can run:
- At workflow start (via pre_step)
- On session resumption
- Manually when user detects context loss
- On phase transitions

## Examples

### Example 1: Auto-detect and Reload
```bash
/fractary-faber:prime-context
```
Detects active workflow automatically and loads all configured artifacts.

### Example 2: Reload Specific Run
```bash
/fractary-faber:prime-context --run-id fractary-faber-258-20260104
```
Uses specific run ID and loads all artifacts for that run.

### Example 3: Reload Specific Artifacts
```bash
/fractary-faber:prime-context --artifacts workflow-state,specification
```
Only loads specified artifacts for faster targeted reload.

### Example 4: Force Reload
```bash
/fractary-faber:prime-context --force
```
Reloads even if recently loaded, useful after manual state changes.

### Example 5: Dry Run
```bash
/fractary-faber:prime-context --dry-run
```
Shows what would be loaded without actually loading.

## Testing Checklist

- [ ] Auto-detect single active workflow
- [ ] Auto-detect multiple active workflows (prompt user)
- [ ] Handle no active workflows (error)
- [ ] Load all artifact types successfully
- [ ] Handle missing required artifacts (error)
- [ ] Handle missing optional artifacts (warning)
- [ ] Resolve path placeholders correctly
- [ ] Evaluate conditions correctly
- [ ] Track session metadata accurately
- [ ] Update context_metadata correctly
- [ ] Skip redundant loads (non-force mode)
- [ ] Force reload works
- [ ] Dry-run mode works
- [ ] Specific artifact loading works
- [ ] Large artifact warnings work
- [ ] Cross-environment paths resolve correctly

## Related Files

- `plugins/faber/skills/context-manager/SKILL.md` - Parent skill documentation
- `plugins/faber/config/workflow.schema.json` - Artifact schema definition
- `plugins/faber/config/state.schema.json` - Session and metadata schema
- `specs/SPEC-00027-faber-context-management.md` - Full specification
