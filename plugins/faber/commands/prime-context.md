---
model: claude-sonnet-4-5
---

# /fractary-faber:prime-context

Reload critical artifacts for an active FABER workflow to ensure essential context is available.

## What This Does

Restores critical workflow context by loading essential artifacts into the current session:
- **Workflow state file** - Current execution state and progress
- **Orchestration protocol** - Workflow execution rules
- **Specification** - Technical design (if exists)
- **Issue context** - Work item details (if exists)
- **Custom artifacts** - Workflow-specific critical files

**Features**:
- 🔍 Auto-detect active workflows
- ⚡ Smart reload (skip recently loaded artifacts)
- 🎯 Target specific artifacts
- 🔄 Force reload all artifacts
- 📊 Track what was loaded and when
- 🌍 Cross-environment support via path templates

## When to Use This

Use this command when:
- **Context loss detected** - Workflow lost critical files after context compaction
- **Resuming workflow** - Starting a new session to continue existing workflow
- **Cross-environment** - Continuing workflow on a different machine
- **Manual recovery** - Need to ensure all critical artifacts are loaded
- **Phase transitions** - Moving between workflow phases that need fresh context

## Your Mission

1. **Detect target workflow** - Auto-detect active workflow or use provided run_id
2. **Load workflow config** - Get critical_artifacts configuration
3. **Determine artifacts** - Figure out what needs to be loaded
4. **Check reload status** - Skip recently loaded artifacts (unless forced)
5. **Load each artifact** - Use appropriate tool for each artifact type
6. **Update state metadata** - Record what was loaded, when, and by whom
7. **Report results** - Show what was loaded with clear status

## Usage

```bash
# Auto-detect active workflow and reload all critical artifacts
/fractary-faber:prime-context

# Reload specific workflow run
/fractary-faber:prime-context --run-id fractary-faber-258-20260104

# Reload only specific artifacts (faster)
/fractary-faber:prime-context --artifacts workflow-state,specification

# Force reload even if recently loaded
/fractary-faber:prime-context --force

# Dry-run to see what would be loaded
/fractary-faber:prime-context --dry-run

# Combine options
/fractary-faber:prime-context --run-id xyz --force --artifacts workflow-state
```

## Implementation

This command delegates to the **context-manager skill** for execution. See:
- `plugins/faber/skills/context-manager/SKILL.md` - Skill documentation
- `plugins/faber/skills/context-manager/workflow/prime-context.md` - Detailed algorithm

### High-Level Algorithm

```
1. Detect Target Workflow
   ├─ If run_id provided → Use it
   ├─ If no run_id → Search .fractary/runs/ for active workflows
   └─ If multiple found → Prompt user to select

2. Load State and Workflow Config
   ├─ Read .fractary/runs/{run_id}/state.json
   ├─ Extract workflow_id
   └─ Load workflow config (fractary-faber:X or custom)

3. Determine Artifacts to Load
   ├─ Always load: workflow-state, orchestration-protocol, etc.
   ├─ Conditional load: Based on state (e.g., spec_path exists)
   ├─ Phase-specific: Load artifacts for current phase
   └─ Filter by --artifacts if specified

4. Check Reload Status
   ├─ Check state.context_metadata.artifacts_in_context
   ├─ Skip if loaded within last 5 minutes (unless --force)
   └─ Log skipped artifacts

5. Load Each Artifact
   ├─ JSON/Markdown → Use Read tool
   ├─ Directory → Load based on load_strategy
   ├─ Work plugin → Use Skill tool
   └─ Git info → Use Bash tool

6. Update State Metadata
   ├─ Update context_metadata.last_artifact_reload
   ├─ Increment context_metadata.reload_count
   ├─ Add/update artifacts_in_context entries
   └─ Track current session in sessions.session_history

7. Report Results
   └─ Show loaded artifacts with status and metadata
```

## Output Format

### Successful Reload

```
✓ Context reloaded for run: fractary-faber-258-20260104
  Workflow: fractary-faber:default
  Run status: in_progress
  Current phase: build

Artifacts loaded (3):
  ✓ workflow-state - Current workflow state file
    Source: .fractary/runs/fractary-faber-258-20260104/state.json
    Size: 4.2 KB

  ✓ orchestration-protocol - Workflow execution protocol
    Source: plugins/faber/docs/workflow-orchestration-protocol.md
    Size: 15.8 KB

  ✓ specification - Technical specification
    Source: specs/WORK-00258-add-context-management.md
    Size: 12.5 KB

Session tracking:
  Current session: claude-session-20260105-a1b2c3
  Total sessions: 2
  Environment: dev-machine-1 (linux)
  Working directory: /mnt/c/GitHub/fractary/faber

Context metadata:
  Last reload: 2026-01-05T14:30:00Z
  Total reloads: 3
```

### Dry-Run Output

```
Would reload context for run: fractary-faber-258-20260104
Workflow: fractary-faber:default
Run status: in_progress

Artifacts that would be loaded:

  ✓ workflow-state
    Type: json
    Path: .fractary/runs/{run_id}/state.json
    Required: yes
    Exists: yes
    Size: 4.2 KB
    Last loaded: 2 minutes ago
    Action: SKIP (recently loaded)

  ✓ specification
    Type: markdown
    Path from state: artifacts.spec_path
    Resolved: /mnt/c/GitHub/fractary/faber/specs/WORK-258.md
    Condition: state.artifacts.spec_path != null
    Required: no
    Exists: yes
    Size: 12.5 KB
    Last loaded: never
    Action: LOAD

Total: 2 artifacts (1 would be loaded, 1 skipped)
Estimated context size: 12.5 KB
```

## Artifact Types

The command can load different artifact types:

| Type | Description | Tool Used | Example |
|------|-------------|-----------|---------|
| `json` | JSON file | Read | State file, plan file |
| `markdown` | Markdown doc | Read | Spec, protocol, README |
| `directory` | Directory of files | Read (multiple) | Session summaries |
| `work_plugin` | Issue/work data | Skill | `/fractary-work:issue-fetch` |
| `skill` | Custom skill | Skill | Custom data fetchers |
| `git_info` | Git command | Bash | Recent commits |

## Path Placeholders

Paths in workflow config can use placeholders:

- `{run_id}` - Current workflow run ID
- `{plan_id}` - Current workflow plan ID
- `{project_root}` - Git repository root directory
- `{work_id}` - Work item ID from state

**Example**: `.fractary/runs/{run_id}/state.json`
→ `.fractary/runs/fractary-faber-258-20260104/state.json`

## Command Flags

| Flag | Type | Description |
|------|------|-------------|
| `--run-id` | string | Specific run ID to reload (auto-detects if omitted) |
| `--artifacts` | string | Comma-separated list of artifact IDs to load |
| `--force` | boolean | Force reload even if recently loaded |
| `--dry-run` | boolean | Show what would be loaded without loading |

## Error Handling

### Critical Errors (Stop Execution)

**No active workflow found**:
```
❌ ERROR: No active workflow found

Recovery:
1. List all runs: ls .fractary/runs/
2. Specify run ID: /fractary-faber:prime-context --run-id {run_id}
3. Start new workflow: /fractary-faber:run {work_id}
```

**Run ID not found**:
```
❌ ERROR: Run not found
Run ID: fractary-faber-258-20260104
Path: .fractary/runs/fractary-faber-258-20260104/state.json

Recovery:
1. Check available runs: ls .fractary/runs/
2. Verify run ID spelling
3. Use auto-detection: /fractary-faber:prime-context
```

**State file corrupted**:
```
❌ ERROR: Cannot read state file
Path: .fractary/runs/{run_id}/state.json
Error: Invalid JSON at line 42

Recovery:
1. Check backup: .fractary/runs/{run_id}/state.backup.json
2. Restore from backup if available
3. Contact support if backup unavailable
```

**Required artifact missing**:
```
❌ ERROR: Required artifact not found
Artifact: orchestration-protocol
Path: plugins/faber/docs/workflow-orchestration-protocol.md

Recovery:
1. Check if path is correct in workflow config
2. Verify file exists in repository
3. Check if you're in correct git repository
```

### Warnings (Continue Execution)

**Optional artifact missing**:
```
⚠️ WARNING: Optional artifact not found
Artifact: specification
Path: specs/WORK-00258.md

Workflow will continue without this artifact.
```

**Artifact too large**:
```
⚠️ WARNING: Large artifact detected
Artifact: session-summaries
Size: 250 KB

Consider using load_strategy: "summary" for large directories.
```

**Multiple active workflows**:
```
Multiple active workflows found. Please select:

1. fractary-faber-258-20260104 (build phase, started 2 days ago)
2. fractary-faber-259-20260105 (architect phase, started 1 hour ago)

Which workflow? [1-2]: _
```

## Integration with Context Reconstitution

This command extends the existing context reconstitution protocol:

**Existing Protocol** (automatic, runs at workflow start):
- Loads state, spec, issue when resuming workflow
- Defined in `context-reconstitution.md`
- Always runs for workflow continuity

**prime-context** (manual/automatic, runs on demand):
- More flexible and configurable per workflow
- Tracks what was loaded and when
- Handles more artifact types
- Updates session metadata
- Can run multiple times per session

**When prime-context runs**:
- Automatically at workflow start (via pre_steps)
- Automatically on phase transitions (if configured)
- Manually when user runs `/fractary-faber:prime-context`
- Manually after context compaction detected

## Use Cases

**Use Case 1: Resume After Context Compaction**
```bash
# Context was compacted during long build phase
# User notices state/spec are no longer in context

/fractary-faber:prime-context
# → Reloads all critical artifacts for active workflow
```

**Use Case 2: Continue on Different Machine**
```bash
# Started workflow on machine-a, continuing on machine-b
# State files synced via fractary-logs or git

user@machine-b$ cd /path/to/project
user@machine-b$ /fractary-faber:prime-context --run-id fractary-faber-258-20260104
# → Loads all artifacts, tracks environment change in session history
```

**Use Case 3: Quick Targeted Reload**
```bash
# Only need to reload state and spec, skip other artifacts

/fractary-faber:prime-context --artifacts workflow-state,specification
# → Faster reload of just the specified artifacts
```

**Use Case 4: Verify What Would Load**
```bash
# Want to see what artifacts would be loaded before loading them

/fractary-faber:prime-context --dry-run
# → Shows artifact list, sizes, and load decisions without loading
```

## Session Tracking

The command updates `state.json` with session information:

```json
{
  "sessions": {
    "current_session_id": "claude-session-20260105-a1b2c3",
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
  }
}
```

This enables:
- Cross-environment workflow continuity
- Audit trail of all sessions
- Understanding which machine/session did what work

## Context Metadata

The command updates context tracking:

```json
{
  "context_metadata": {
    "last_artifact_reload": "2026-01-05T14:30:00Z",
    "reload_count": 3,
    "artifacts_in_context": [
      {
        "artifact_id": "workflow-state",
        "loaded_at": "2026-01-05T14:30:00Z",
        "load_trigger": "manual",
        "source": ".fractary/runs/fractary-faber-258-20260104/state.json",
        "size_bytes": 4096
      }
    ]
  }
}
```

This enables:
- Skip redundant loads (performance optimization)
- Track when artifacts were last loaded
- Debug context issues
- Monitor context size for optimization

## Best Practices

1. **Auto-reload on session start** - Add to Frame pre_steps for automatic context reload
2. **Force reload sparingly** - Only use `--force` when you know artifacts changed
3. **Target specific artifacts** - Use `--artifacts` for faster targeted reloads
4. **Dry-run first** - Use `--dry-run` to preview what will be loaded
5. **Monitor sizes** - Watch for warnings about large artifacts
6. **Track sessions** - Session metadata helps debug cross-environment issues

## Configuration

Workflows configure critical artifacts in their config files:

```json
{
  "critical_artifacts": {
    "always_load": [
      {
        "id": "workflow-state",
        "type": "json",
        "path": ".fractary/runs/{run_id}/state.json",
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

See `plugins/faber/config/workflow.schema.json` for full schema.

## What This Command Does NOT Do

- Does NOT modify artifacts (read-only)
- Does NOT execute workflow steps
- Does NOT detect context compaction automatically (manual trigger only)
- Does NOT sync files across machines (use fractary-logs or git)

## See Also

- **Skill**: `plugins/faber/skills/context-manager/SKILL.md`
- **Algorithm**: `plugins/faber/skills/context-manager/workflow/prime-context.md`
- **Schema**: `plugins/faber/config/workflow.schema.json`
- **State Schema**: `plugins/faber/config/state.schema.json`
- **Spec**: `specs/SPEC-00027-faber-context-management.md`
- **Protocol**: `docs/standards/manager-protocols/context-reconstitution.md`
