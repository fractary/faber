---
name: context-manager
description: Manages critical context artifacts during FABER workflow execution
version: 1.0.0
author: Fractary
model: claude-sonnet-4-5
---

# Context Manager Skill

## Purpose

The context-manager skill manages critical context artifacts during FABER workflow execution, ensuring that essential information (state files, plans, protocols, specifications) remains accessible across:
- Context compaction events
- Session boundaries (when Claude sessions end/restart)
- Environment changes (moving workflows between machines)

## Core Capabilities

### 1. Artifact Loading
- Load critical artifacts based on workflow configuration
- Support multiple artifact types (JSON, Markdown, directories, commands)
- Resolve path templates (`{run_id}`, `{plan_id}`, `{project_root}`)
- Conditional loading based on state

### 2. Session Tracking
- Track which sessions contributed to a workflow run
- Record environment metadata (hostname, platform, git commit)
- Maintain cross-session continuity

### 3. Context Metadata
- Track when artifacts were loaded
- Record reload triggers (session_start, manual, phase_transition)
- Monitor context size for optimization

## Workflows

### prime-context
Reloads critical artifacts into context. See `workflow/prime-context.md`.

**Triggers**:
- SessionStart Hook (after compaction or resume) - automatic
- Workflow pre_steps (session start) - optional
- Manual: `/fractary-faber:prime-context` command

### session-end
Saves session metadata before session ends or compaction occurs. See `workflow/session-end.md`.

**Triggers**:
- PreCompact Hook (before compaction) - automatic
- SessionEnd Hook (on exit) - automatic
- Manual: `/fractary-faber:session-end` command

## Integration Points

### Used By
- **Automatic (via hooks)**:
  - PreCompact Hook → `/fractary-faber:session-end --reason compaction`
  - SessionStart Hook → `/fractary-faber:prime-context --trigger session_start`
  - SessionEnd Hook → `/fractary-faber:session-end --reason normal`
- **Manual**:
  - `/fractary-faber:prime-context` command (context reload)
  - `/fractary-faber:session-end` command (session save)
- **Workflow pre_steps** (automatic reload on session start) [optional, hooks preferred]

### Dependencies
- State schema (`state.schema.json`) - for session tracking
- Workflow schema (`workflow.schema.json`) - for artifact configuration
- fractary-work plugin - for issue context loading
- fractary-spec plugin - for specification loading

## Configuration

Artifacts are configured per-workflow in the `critical_artifacts` section:

```json
{
  "critical_artifacts": {
    "always_load": [
      {
        "id": "workflow-state",
        "type": "json",
        "path": ".fractary/faber/runs/{plan_id}/state-{run_suffix}.json",
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

Example: `.fractary/faber/runs/{plan_id}/state-{run_suffix}.json` → `.fractary/faber/runs/fractary-faber-258-20260104/state-2026-01-05T14-30-22Z.json`

## Load Triggers

Artifacts can be reloaded on specific events:

- `session_start` - When a new session begins
- `phase_start:{phase}` - Before a specific phase starts (e.g., `phase_start:build`)
- `phase_transition:{from}->{to}` - During phase transitions (e.g., `phase_transition:architect->build`)
- `manual` - When user explicitly requests reload
- `compaction_detected` - When context compaction is detected (future)

## Error Handling

### Required Artifacts
If a required artifact cannot be loaded:
1. Log detailed error message
2. Update state with error
3. Stop workflow execution
4. Provide recovery suggestions

### Optional Artifacts
If an optional artifact cannot be loaded:
1. Log warning message
2. Continue workflow execution
3. Record missing artifact in context_metadata

### Graceful Degradation
The skill uses graceful degradation:
- Missing optional artifacts don't stop the workflow
- Invalid paths are logged but workflow continues
- Failed conditions skip artifact loading

## State Updates

The skill updates state.json with:

### Session Record
```json
{
  "sessions": {
    "current_session_id": "claude-session-abc123",
    "session_history": [
      {
        "session_id": "claude-session-xyz789",
        "started_at": "2025-12-01T10:00:00Z",
        "ended_at": "2025-12-01T11:30:00Z",
        "phases_completed": ["frame", "architect"],
        "environment": {
          "hostname": "dev-machine-1",
          "platform": "linux",
          "cwd": "/home/user/projects/myproject",
          "git_commit": "a1b2c3d4"
        }
      }
    ]
  }
}
```

### Context Metadata
```json
{
  "context_metadata": {
    "last_artifact_reload": "2025-12-01T12:00:00Z",
    "reload_count": 3,
    "artifacts_in_context": [
      {
        "artifact_id": "workflow-state",
        "loaded_at": "2025-12-01T12:00:00Z",
        "load_trigger": "session_start",
        "source": ".fractary/faber/runs/xyz/state.json",
        "size_bytes": 4096
      }
    ]
  }
}
```

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

## Examples

### Example 1: Automatic Reload on Session Start
```markdown
# In workflow Frame phase pre_steps:
{
  "id": "auto-reload-context",
  "prompt": "/fractary-faber:prime-context"
}
```

### Example 2: Manual Reload
```bash
# User notices context loss
/fractary-faber:prime-context

# Reload specific artifacts
/fractary-faber:prime-context --artifacts workflow-state,specification

# Force reload all
/fractary-faber:prime-context --force
```

### Example 3: Phase-Specific Reload
```json
{
  "phase_specific": {
    "build": [
      {
        "id": "coding-standards",
        "type": "markdown",
        "path": "docs/CODING_STANDARDS.md",
        "reload_triggers": ["phase_start:build"]
      }
    ]
  }
}
```

## Testing

### Test Scenarios
1. Load all artifact types successfully
2. Handle missing required artifacts
3. Handle missing optional artifacts
4. Resolve path placeholders correctly
5. Track session metadata accurately
6. Update context_metadata correctly
7. Handle large artifacts gracefully

### Manual Testing
```bash
# Test basic reload
/fractary-faber:prime-context --run-id {run_id}

# Test dry-run mode
/fractary-faber:prime-context --dry-run

# Test specific artifacts
/fractary-faber:prime-context --artifacts workflow-state
```

## Related Documentation

- **Specification**: `SPEC-00027-faber-context-management.md` - Full context management specification
- **User Guides**:
  - `docs/CONTEXT-MANAGEMENT.md` - Context management user guide
- **Protocols**:
  - `docs/standards/manager-protocols/context-reload.md` - Context reload protocol
  - `docs/standards/manager-protocols/context-reconstitution.md` - Initial context loading
- **Algorithms**:
  - `workflow/prime-context.md` - Context reload algorithm
  - `workflow/session-end.md` - Session end algorithm
- **Commands**:
  - `commands/prime-context.md` - Context reload command
  - `commands/session-end.md` - Session end command
