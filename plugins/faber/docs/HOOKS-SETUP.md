# FABER Workflow Hooks Setup Guide

Step-by-step guide to configure Claude Code hooks for automatic FABER workflow context management.

## What Hooks Do

Hooks enable **automatic context management** for FABER workflows across session boundaries:

- **PreCompact Hook**: Saves session metadata before context compaction occurs
- **SessionStart Hook**: Restores critical artifacts when new session begins (after compaction or resume)
- **SessionEnd Hook**: Saves final session state when Claude Code exits

**Result**: Workflows continue seamlessly across compaction events and session resumptions without manual intervention.

## Prerequisites

- Claude Code installed and configured
- FABER plugin installed from fractary-faber marketplace
- At least one FABER workflow executed (to understand what you're automating)

## Hook Configuration

### Method 1: Project-Specific Hooks (Recommended)

Configure hooks in your project's `.claude/settings.json` file. This keeps hook configuration version-controlled with your project.

**Location**: `.claude/settings.json` in your project root

**Configuration**:

```json
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
    ],
    "SessionStart": [
      {
        "matcher": "compact",
        "hooks": [
          {
            "type": "command",
            "command": "/fractary-faber:session-load --trigger session_start"
          }
        ]
      },
      {
        "matcher": "resume",
        "hooks": [
          {
            "type": "command",
            "command": "/fractary-faber:session-load --trigger session_start"
          }
        ]
      }
    ],
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

### Method 2: Global Hooks

Configure hooks globally in Claude Code's user settings. This applies to all projects.

**Location**: `~/.claude/settings.json` (or `%USERPROFILE%\.claude\settings.json` on Windows)

**Configuration**: Same as Method 1 above

**When to use global hooks**:
- You work exclusively with FABER workflows
- You want hooks active across all projects
- You don't want per-project configuration

**When to use project-specific hooks** (recommended):
- You work on multiple types of projects (some use FABER, some don't)
- You want hooks version-controlled with the project
- Team members should have the same hook configuration

## Step-by-Step Setup

### Step 1: Check for Existing Hooks

```bash
# For project-specific hooks
cat .claude/settings.json 2>/dev/null || echo "No project settings file found"

# For global hooks
cat ~/.claude/settings.json 2>/dev/null || echo "No global settings file found"
```

If settings file exists and already has hooks, you'll need to merge the FABER hooks with existing hooks.

### Step 2: Create or Update Settings File

**For project-specific hooks**:

```bash
# Create .claude directory if it doesn't exist
mkdir -p .claude

# Create or edit .claude/settings.json
# Copy the hook configuration from Method 1 above
```

**For global hooks**:

```bash
# Create .claude directory if it doesn't exist
mkdir -p ~/.claude

# Create or edit ~/.claude/settings.json
# Copy the hook configuration from Method 1 above
```

### Step 3: Verify Hook Configuration

```bash
# Check if hooks are properly formatted
cat .claude/settings.json | jq '.hooks'

# Should output the hooks configuration without errors
```

### Step 4: Test Hooks

**Test PreCompact Hook**:

1. Start a FABER workflow:
   ```bash
   /fractary-faber:workflow-run <plan-id>
   ```

2. During a long-running phase (Build), deliberately fill up context with messages

3. When auto-compact triggers, watch for:
   ```
   ✓ Session ended and saved
     Session ID: claude-session-YYYYMMDD-HHMMSS-xxxxxx
     Reason: compaction
   ```

**Test SessionStart Hook**:

1. After compaction occurs, verify context restoration:
   ```
   ✓ Context reloaded for run: fractary-faber-XXX-YYYYMMDD-HHMMSS
     Workflow: fractary-faber:default
   ```

2. Check that critical artifacts are back in context:
   - Workflow state file
   - Orchestration protocol
   - Specification (if exists)

**Test SessionEnd Hook**:

1. Exit Claude Code normally:
   ```bash
   /clear  # or close the session
   ```

2. Check state file was updated:
   ```bash
   # Find your most recent workflow run
   ls -lt .fractary/runs/

   # Check that session has ended_at timestamp
   cat .fractary/runs/fractary-faber-XXX-YYYYMMDD-HHMMSS/state.json | jq '.sessions.session_history[-1].ended_at'
   ```

## Hook Details

### PreCompact Hook

**Trigger**: Before context compaction occurs (when context window fills up)

**Action**: Calls `/fractary-faber:session-save --reason compaction`

**What it does**:
1. Reads `.fractary/faber/.active-run-id` to detect active workflow
2. Loads current state.json
3. Updates current session with:
   - `ended_at` timestamp
   - `phases_completed` array
   - `artifacts_loaded` array
4. Moves session to `session_history`
5. Clears `current_session_id`

**Timeout**: 60 seconds (should complete in <10 seconds normally)

**Failure handling**: If hook fails, compaction still occurs. Session metadata may be lost but workflow can continue.

### SessionStart Hook

**Triggers**:
- **compact matcher**: After context compaction
- **resume matcher**: When resuming a previous session

**Action**: Calls `/fractary-faber:session-load --trigger session_start`

**What it does**:
1. Reads `.fractary/faber/.active-run-id` to detect active workflow
2. Loads state.json and workflow config
3. Detects new session (generates new session ID)
4. Creates new session record with environment info
5. Loads all critical artifacts:
   - workflow-state
   - orchestration-protocol
   - specification (if exists)
   - Any custom artifacts configured in workflow
6. Updates state.json with session and context metadata

**No timeout**: Runs until complete (typically 10-30 seconds)

**Failure handling**: If hook fails, you can manually run `/fractary-faber:session-load` to restore context

### SessionEnd Hook

**Trigger**: When Claude Code session ends (logout, clear, exit)

**Action**: Calls `/fractary-faber:session-save --reason normal`

**What it does**: Same as PreCompact hook, but with `reason: "normal"` instead of `"compaction"`

**No timeout**: Runs until complete

**Failure handling**: If hook fails, session metadata for final session may be lost. Not critical for workflow continuity.

## Troubleshooting

### Hooks Not Running

**Symptom**: Context lost after compaction, no automatic reload

**Check**:
```bash
# Verify hooks are configured
cat .claude/settings.json | jq '.hooks'

# Check for syntax errors
jq . .claude/settings.json
```

**Fix**:
- Ensure JSON is valid (no trailing commas, proper quotes)
- Verify command paths are correct
- Check that FABER plugin is installed

### Hooks Running But Failing

**Symptom**: Hook executes but shows errors

**Check**:
```bash
# Check if active run ID file exists
cat .fractary/faber/.active-run-id

# Check if state file exists
ls -l .fractary/runs/$(cat .fractary/faber/.active-run-id)/state.json
```

**Fix**:
- Ensure workflow was started with `/fractary-faber:workflow-run` (creates `.active-run-id` file)
- Verify state file is valid JSON: `jq . .fractary/runs/{run_id}/state.json`

### Context Still Lost After Compaction

**Symptom**: Hooks run but context not restored

**Check**:
```bash
# Check if artifacts were loaded
cat .fractary/runs/$(cat .fractary/faber/.active-run-id)/state.json | jq '.context_metadata.artifacts_in_context'

# Check if session was created
cat .fractary/runs/$(cat .fractary/faber/.active-run-id)/state.json | jq '.sessions.current_session_id'
```

**Fix**:
- Manually run `/fractary-faber:session-load --force` to reload context
- Check workflow config has `critical_artifacts` defined
- Verify artifact paths are correct in workflow config

### Hook Timeout

**Symptom**: PreCompact hook times out (60 seconds)

**Cause**: State file too large or disk I/O slow

**Fix**:
- Increase timeout in hook configuration: `"timeout": 120`
- Check state file size: `ls -lh .fractary/runs/{run_id}/state.json`
- Consider archiving old sessions if state file >1MB

## Manual Fallback

If hooks fail or aren't configured, you can manually trigger the commands:

**After context compaction**:
```bash
/fractary-faber:session-load
```

**Before exiting session**:
```bash
/fractary-faber:session-save
```

**Check which workflow is active**:
```bash
cat .fractary/faber/.active-run-id
```

## Best Practices

1. **Use project-specific hooks**: Keep hook configuration in `.claude/settings.json` within your project repository

2. **Commit settings file**: Add `.claude/settings.json` to git so team members get hook configuration automatically

3. **Test hooks early**: Run a test workflow and trigger compaction deliberately to verify hooks work

4. **Monitor state file size**: Large state files (>1MB) slow down hooks. Archive old sessions periodically.

5. **Don't edit state.json manually**: If you must edit, run `/fractary-faber:session-save` first to save current session

6. **One workflow per worktree**: Use git worktrees for concurrent workflows to avoid conflicts

## Git Configuration

**Important**: The `.fractary/faber/.active-run-id` file should be committed to git for cross-environment workflow continuity.

**Check .gitignore**:
```bash
# This should NOT be in .gitignore
grep ".fractary/faber/.active-run-id" .gitignore
```

**If it is ignored, update .gitignore**:
```bash
# Remove this line if present:
# .fractary/faber/.active-run-id

# Or add exception:
!.fractary/faber/.active-run-id
```

**Why commit .active-run-id**:
- Enables workflow resumption across machines
- Hooks work immediately on new machine
- No secrets stored (just a workflow run ID)
- Different worktrees have different files (no conflicts)

## What Gets Tracked

### Session Metadata

Each session records:
- **session_id**: Unique identifier (e.g., `claude-session-20260105-143022-a1b2c3`)
- **started_at**: ISO 8601 timestamp
- **ended_at**: ISO 8601 timestamp
- **phases_completed**: Array of phase names completed during session
- **artifacts_loaded**: Array of artifact IDs loaded
- **environment**: Hostname, platform, working directory, git commit

### Context Metadata

Tracks what artifacts are currently in context:
- **last_artifact_reload**: When artifacts were last loaded
- **reload_count**: How many times context has been reloaded
- **artifacts_in_context**: Array of artifacts with:
  - `artifact_id`
  - `loaded_at`
  - `load_trigger` (session_start, manual, phase_start)
  - `source` (file path)
  - `size_bytes`

## See Also

- **Spec**: `specs/SPEC-00027-faber-context-management.md` - Full context management specification
- **Commands**:
  - `plugins/faber/commands/session-load.md` - Context reload command
  - `plugins/faber/commands/session-save.md` - Session save command
- **Protocols**: `plugins/faber/docs/standards/manager-protocols/context-reload.md` - Context management protocol
- **Claude Code Hooks**: See Claude Code documentation for hook system details
