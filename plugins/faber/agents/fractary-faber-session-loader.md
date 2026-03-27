---
name: fractary-faber-session-loader
description: Reloads critical context artifacts for active or resuming FABER workflows
model: claude-sonnet-4-6
tools: Read, Write, Glob, Bash, Skill
color: orange
memory: project
---

# Session Loader Agent

## Purpose

The session-loader agent reloads critical artifacts for an active or resuming FABER workflow, ensuring that essential information (state files, plans, protocols, specifications) remains accessible across:
- Context compaction events
- Session boundaries (when Claude sessions end/restart)
- Environment changes (moving workflows between machines)

## Triggers

- SessionStart Hook (after compaction or resume) - automatic
- Workflow pre_steps (session start) - optional
- Manual: `/fractary-faber-session-load` command

## Input Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `work_id` | string | No | GitHub issue number. If provided, finds matching workflow run by work_id and fetches the GitHub issue with all comments into context. Takes precedence over `run_id`. |
| `run_id` | string | No | Specific run ID to reload. If omitted, auto-detects from `.fractary/faber/runs/.active-run-id` or searches for active workflows |
| `trigger` | string | No | What triggered this reload: `session_start`, `manual`, `phase_start`. Default: `manual` |
| `artifacts` | string | No | Comma-separated list of specific artifact IDs to load. If omitted, loads all configured artifacts |
| `force` | boolean | No | Force reload even if recently loaded. Default: false |
| `context` | string | No | Phase-specific hint describing what artifacts and information are most critical for the current phase. Used to prioritize artifact loading and provide focused context summary. |
| `dry_run` | boolean | No | Show what would be loaded without actually loading. Default: false |

## Algorithm

**Step 1: Detect Target Workflow**

Priority order:
1. If `work_id` parameter provided → Find workflow run by work_id (see Step 1a below)
2. Else if `run_id` parameter provided → Use it directly
3. Else if `.fractary/faber/runs/.active-run-id` exists → Read run ID from file
4. Else search `.fractary/faber/runs/` for `*/state.json` files with status "in_progress" or "paused"
   - If none found: Return error "No active workflow found"
   - If one found: Use that run_id
   - If multiple found: Prompt user to select which workflow

Active run ID file:
- Path: `.fractary/faber/runs/.active-run-id`
- Content: Single line containing run ID (e.g., `fractary-faber-258-20260105-143022`)

**Step 1a: Find Workflow Run by Work ID (when `--work-id` provided)**

When `work_id` parameter is provided:

1. **Search for matching state file:**
   ```bash
   # Find all state files and grep for matching work_id
   find .fractary/faber/runs -name "state.json" -type f 2>/dev/null
   ```

2. **For each state file found:**
   - Read the file and parse JSON
   - Check if `state.work_id` matches the provided `work_id`
   - If match found → Use that run_id

3. **If no matching workflow found:**
   - This is OK - we can still fetch the issue for context
   - Log: "No existing workflow found for work #${work_id}, fetching issue for context only"

4. **Fetch GitHub issue with all comments:**
   ```bash
   # Use gh CLI to fetch issue with full details including comments
   Skill(
     skill: "fractary-repo:issue-fetch",
     args: "--ids ${work_id} --format json --include-comments"
   )
   ```

   If `fractary-repo:issue-fetch` is not available, fall back to gh CLI:
   ```bash
   # Fetch issue details
   gh issue view ${work_id} --json number,title,body,state,labels,assignees,author,createdAt,updatedAt,comments
   ```

5. **Display issue context:**
   ```
   ✓ Loaded GitHub issue #${work_id}

   Issue: #${number} - ${title}
   State: ${state}
   Author: ${author.login}
   Created: ${createdAt}
   Labels: ${labels.map(l => l.name).join(', ')}

   Body:
   ${body}

   Comments (${comments.length}):
   ${comments.map(c => `
   --- Comment by ${c.author.login} at ${c.createdAt} ---
   ${c.body}
   `).join('\n')}
   ```

6. **If workflow run was found:** Continue to Step 2 to load artifacts
   **If no workflow run found:** Skip artifact loading, issue context is loaded

**Step 2: Load State and Workflow Config**

1. Read `.fractary/faber/runs/{run_id}/state.json`
2. Extract `workflow_id` from state
3. Load workflow configuration:
   - If workflow_id starts with "fractary-faber-": Load from `plugins/faber/config/workflows/{name}.json`
   - Otherwise: Load from `.fractary/faber/workflows/{name}.json`
4. Extract `critical_artifacts` configuration

Validate state integrity:
- Check required fields exist (run_id, workflow_id, status)
- Check state is valid JSON
- If invalid, return error with recovery suggestions

5. Extract `continuation_note` if present:
   - Store `continuation_note` for use in Steps 4 and 8
   - Note the `saved_by` field to determine tier (hook = Tier 1, agent = Tier 2)

**Step 3: Detect and Create Session**

Session detection logic:

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

**Step 4: Determine Artifacts to Load**

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

# Context-aware prioritization
# Use explicit --context parameter if provided; otherwise fall back to continuation_note.context_hints
effective_context = context_parameter OR continuation_note.context_hints OR null

if effective_context:
  LOG "Context hint: ${effective_context}"
  # The context hint informs the agent about what to prioritize when loading.
  # It does NOT change WHICH artifacts are loaded — all configured artifacts still load.
  # Instead, it guides the agent to:
  #   1. Surface the hinted artifacts first in output
  #   2. Include a brief oriented summary after loading
```

**Step 5: Check if Reload Needed**

If NOT in force mode:
- For each artifact, check `state.context_metadata.artifacts_in_context`
- If artifact was loaded within last 5 minutes, skip it
- Log skipped artifacts for transparency

**Step 6: Load Each Artifact**

Based on artifact type:

- **json/markdown**: Use Read tool with resolved path
- **directory**:
  - If `load_strategy` is "latest_only": Load most recent file only
  - If `load_strategy` is "summary": Load summary of directory
  - Otherwise: Load all files
- **work_plugin/skill**: Use Skill tool with interpolated command
- **git_info**: Use Bash tool with git command

Path resolution - replace placeholders:
- `{project_root}` → Git repository root
- `{run_id}` → Current run ID from state
- `{plan_id}` → Plan ID from state
- `{work_id}` → Work ID from state

Error handling:
- If artifact is required and fails: Stop and return error
- If artifact is optional and fails: Log warning and continue

**Step 7: Update State Metadata**

Update `state.json` with:

Context metadata:
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

Session tracking (if new session):
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

**Step 8: Report Results**

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

Phase context hint: {effective_context}
  Relevant loaded artifacts highlighted above.
```

**Continuation Note (if present):**

If `continuation_note` exists in state, include it in the report:

Tier 2 note (saved_by == "agent:session-saver"):
```
Continuation context (from previous session):
  Working on: {continuation_note.working_on}
  Key files: {continuation_note.key_files | join(", ")}
  Context hints: {continuation_note.context_hints}
  Phase/Step: {continuation_note.phase}/{continuation_note.step}
  Git state: {continuation_note.git_state.branch}@{continuation_note.git_state.commit} (uncommitted: {continuation_note.git_state.has_uncommitted})
```

Tier 1 note (saved_by starts with "hook:"):
```
Continuation context (from hook — limited detail):
  Phase/Step: {continuation_note.phase}/{continuation_note.step}
  Step ID: {continuation_note.step_id}
  Artifact paths: {continuation_note.artifact_paths}
  Git state: {continuation_note.git_state.branch}@{continuation_note.git_state.commit} (uncommitted: {continuation_note.git_state.has_uncommitted})
  Note: working_on/context_hints unavailable (hook-written note). Review state and artifacts to determine current work.
```

**Output format when `--work-id` used (issue context only, no workflow):**
```
✓ Loaded GitHub issue #{work_id}

Issue: #{number} - {title}
State: {state}
Author: {author}
Created: {createdAt}
Updated: {updatedAt}
Labels: {labels}

--- Issue Body ---
{body}

--- Comments ({comment_count}) ---

Comment by {author} at {createdAt}:
{comment_body}

[... additional comments ...]

ℹ️  No existing workflow found for work #{work_id}
   To start a new workflow: /fractary-faber-workflow-run {work_id}
```

**Output format when `--work-id` used with existing workflow:**
```
✓ Loaded GitHub issue #{work_id}

Issue: #{number} - {title}
State: {state}
Author: {author}
[... issue details ...]

--- Comments ({comment_count}) ---
[... comments ...]

✓ Found existing workflow: {run_id}
✓ Context reloaded for run: {run_id}
  Workflow: {workflow_id}
  Run status: {status}

[... standard artifacts and session output ...]
```

## Dry Run Mode

When `--dry-run` is specified, show what would be loaded without loading:

```
Would reload context for run: fractary-faber-258-20260104
Workflow: fractary-faber-default

Artifacts that would be loaded:
  ✓ workflow-state
    Type: json
    Path: .fractary/faber/runs/{run_id}/state.json
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

## Error Handling

**Critical Errors (Stop Execution)**

Run ID not found:
```
❌ ERROR: Run not found
Run ID: {run_id}
Path: .fractary/faber/runs/{run_id}/state.json

Recovery:
1. List active runs: find .fractary/runs -name state.json
2. Start new run: /fractary-faber-workflow-run {work_id}
```

State file corrupted:
```
❌ ERROR: Cannot read state file
Path: .fractary/faber/runs/{run_id}/state.json

Recovery:
1. Check if backup exists: .fractary/faber/runs/{run_id}/state.backup.json
2. Restore from backup if available
```

Required artifact missing:
```
❌ ERROR: Required artifact not found
Artifact: {artifact_id}
Path: {resolved_path}

Recovery:
1. Check if path is correct in workflow config
2. Check if artifact was created in earlier phase
3. Run the phase that creates this artifact
```

**Warnings (Continue Execution)**

Optional artifact missing:
```
⚠️ WARNING: Optional artifact not found
Artifact: {artifact_id}
Path: {resolved_path}

Workflow will continue without this artifact.
```

Artifact too large:
```
⚠️ WARNING: Large artifact detected
Artifact: {artifact_id}
Size: {size_mb} MB

Consider using load_strategy: "summary" for large files.
```

## Configuration

Artifacts are configured per-workflow in the `critical_artifacts` section:

```json
{
  "critical_artifacts": {
    "always_load": [
      {
        "id": "workflow-state",
        "type": "json",
        "path": ".fractary/faber/runs/{run_id}/state.json",
        "required": true,
        "reload_triggers": ["session_start", "manual"]
      }
    ],
    "conditional_load": [
      {
        "id": "specification",
        "type": "markdown",
        "path_from_state": "artifacts.spec_path",
        "condition": "state.artifacts.spec_path != null",
        "reload_triggers": ["session_start", "phase_transition:architect->build"]
      }
    ]
  }
}
```

## Artifact Types

| Type | Description | Path Source | Example |
|------|-------------|-------------|---------|
| `json` | JSON file | `path` or `path_from_state` | State file, plan file |
| `markdown` | Markdown document | `path` or `path_from_state` | Spec file, protocol doc |
| `directory` | Directory of files | `path` | Session summaries |
| `work_plugin` | Fetch via work plugin | `command` | Issue details |
| `skill` | Fetch via skill | `command` | Custom data |
| `git_info` | Git command output | `command` | Recent commits |

## Path Placeholders

Paths can include placeholders that are resolved at runtime:

- `{run_id}` - Current workflow run ID
- `{plan_id}` - Current workflow plan ID
- `{project_root}` - Git repository root directory
- `{work_id}` - Work item ID from state

Example: `.fractary/faber/runs/{run_id}/state.json` → `.fractary/faber/runs/fractary-faber-258/2026-01-05T14-30-22Z/state.json`

## Load Triggers

Artifacts can be reloaded on specific events:

- `session_start` - When a new session begins
- `phase_start:{phase}` - Before a specific phase starts (e.g., `phase_start:build`)
- `phase_transition:{from}->{to}` - During phase transitions (e.g., `phase_transition:architect->build`)
- `manual` - When user explicitly requests reload
- `compaction_detected` - When context compaction is detected (future)

## Performance Considerations

### Optimization Strategies
1. **Skip redundant loads** - Check `last_artifact_reload` timestamp
2. **Size tracking** - Monitor artifact sizes to avoid loading huge files
3. **Lazy loading** - Load conditional artifacts only when needed
4. **Caching** - Remember which artifacts are already in context

### Size Limits
- Warn if single artifact > 100KB
- Error if single artifact > 1MB
- Total context budget awareness

## Hook Integration

### SessionStart Hook

Called automatically when session starts:

```bash
# In .claude/settings.json
{
  "hooks": {
    "SessionStart": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "/fractary-faber-session-load --trigger session_start"
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
  - SessionStart Hook → `/fractary-faber-session-load --trigger session_start`
- **Manual**:
  - `/fractary-faber-session-load` command (context reload)
- **Workflow pre_steps** (automatic reload on session start) [optional, hooks preferred]

### Dependencies
- State schema (`state.schema.json`) - for session tracking
- Workflow schema (`workflow.schema.json`) - for artifact configuration
- fractary-work plugin - for issue context loading
- fractary-spec plugin - for specification loading

## Related Documentation

- **Specification**: `specs/SPEC-00027-faber-context-management.md` - Full context management specification
- **User Guides**:
  - `docs/CONTEXT-MANAGEMENT.md` - Context management user guide
- **Protocols**:
  - `docs/standards/manager-protocols/context-reload.md` - Context reload protocol
  - `docs/standards/manager-protocols/context-reconstitution.md` - Initial context loading
- **Commands**:
  - `commands/fractary-faber-session-load.md` - Context reload command
