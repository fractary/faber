# SPEC-00027: FABER Workflow Context Management

**Status**: Draft
**Created**: 2026-01-04
**Type**: Feature Specification

## Overview

Design and implement context management for FABER workflows that maintains critical artifacts during workflow execution across context compaction and session boundaries, enabling workflows to move seamlessly between machines and sessions.

## Problem Statement

### Current Pain Points

1. **Context Compaction**: Long-running workflows lose critical artifacts (state, plan, orchestration protocol) when context compacts
2. **Session Boundaries**: Workflows pause/resume across sessions without preserving context
3. **Cross-Environment**: Workflows started on one machine cannot easily continue on another
4. **No Session Tracking**: Cannot see which sessions contributed to a workflow run
5. **No Manual Reload**: No way to manually prime context when picking up a workflow in a new environment

### User Requirements

- Per-workflow configuration of critical artifacts
- Automatic context reload on session start (when workflow is running)
- Manual context priming command
- Session tracking with cross-environment metadata
- Portable state files that work across machines

## Architecture

### Building on Existing Context Reconstitution

```
┌─────────────────────────────────────────────────────────┐
│  NEW: Workflow Context Management                       │
│  - Workflows declare critical_artifacts                 │
│  - Auto-reload on session start/phase transitions       │
│  - Manual reload command                                │
│  - Session tracking and portability                     │
└─────────────────────────────────────────────────────────┘
                          ▲
                          │
┌─────────────────────────────────────────────────────────┐
│  EXISTING: Context Reconstitution Protocol              │
│  (Already in context-reconstitution.md)                 │
│  - Loads state/spec/issue when resuming                 │
│  - Foundation for new context management                │
└─────────────────────────────────────────────────────────┘
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
        "required": true,
        "reload_triggers": ["session_start", "phase_transition"]
      },
      {
        "id": "workflow-plan",
        "type": "json",
        "path": "logs/fractary/plugins/faber/plans/{plan_id}.json",
        "required": true,
        "reload_triggers": ["session_start"]
      },
      {
        "id": "orchestration-protocol",
        "type": "markdown",
        "path": "plugins/faber/docs/workflow-orchestration-protocol.md",
        "required": true,
        "reload_triggers": ["session_start"]
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
| `condition` | string | No | JavaScript expression for conditional loading |
| `reload_triggers` | array | Yes | When to reload: `session_start`, `phase_start:{phase}`, `phase_transition:{from}->{to}`, `manual` |

### 2. State File Enhancement

**New fields** in `.fractary/runs/{run_id}/state.json`:

```json
{
  "run_id": "fractary-faber-258-...",
  "workflow_id": "fractary-faber:default",
  "status": "in_progress",

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
  },

  "context_metadata": {
    "last_artifact_reload": "2025-12-01T12:00:00Z",
    "reload_count": 3,
    "artifacts_in_context": [
      {
        "artifact_id": "workflow-state",
        "loaded_at": "2025-12-01T12:00:00Z",
        "load_trigger": "session_start"
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
/fractary-faber:prime-context --run-id {run_id}

# Reload only specific artifacts
/fractary-faber:prime-context --artifacts workflow-state,specification

# Force reload even if recently loaded
/fractary-faber:prime-context --force
```

**Algorithm**:

1. Detect active workflow (or use specified run_id)
2. Load state file and workflow config
3. Determine which artifacts to load based on config
4. Check if reload needed (unless forced)
5. Load each artifact (Read tool for files, Skill tool for commands)
6. Record artifact load in state metadata
7. Update state with reload timestamp

### 4. Automatic Reload Integration

Add pre_step to Frame phase in default workflows:

```json
{
  "phases": {
    "frame": {
      "pre_steps": [
        {
          "id": "auto-reload-context",
          "prompt": "/fractary-faber:prime-context",
          "description": "Reload critical context on session start"
        }
      ]
    }
  }
}
```

### 5. Portable Path Templates

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

## Files to Create/Modify

| File | Action | Purpose |
|------|--------|---------|
| `plugins/faber/config/workflow.schema.json` | Modify | Add `critical_artifacts` schema |
| `plugins/faber/config/state.schema.json` | Modify | Add `sessions` and `context_metadata` |
| `plugins/faber/config/workflows/default.json` | Modify | Add default critical artifacts |
| `plugins/faber/config/workflows/core.json` | Modify | Add core critical artifacts |
| `plugins/faber/skills/context-manager/SKILL.md` | Create | Context reload skill |
| `plugins/faber/skills/context-manager/workflow/prime-context.md` | Create | Prime context workflow logic |
| `plugins/faber/commands/prime-context.md` | Create | Prime context command |
| `plugins/faber/docs/CONTEXT-MANAGEMENT.md` | Create | User documentation |
| `plugins/faber/docs/standards/manager-protocols/context-reload.md` | Create | Protocol documentation |

## Implementation Steps

1. **Schema Changes**: Update workflow.schema.json and state.schema.json
2. **Workflow Updates**: Add critical_artifacts to default and core workflows
3. **Context Manager Skill**: Create context-manager skill infrastructure
4. **Prime Context Command**: Implement /fractary-faber:prime-context
5. **Auto-Reload**: Add auto-reload step to Frame phase
6. **Documentation**: Create user and developer documentation
7. **Testing**: Test across sessions and machines

## Success Metrics

1. **Context Continuity**: Workflows resume seamlessly after compaction (0 context loss incidents)
2. **Cross-Environment**: 100% of workflows portable between machines
3. **Session Tracking**: Complete audit trail of all workflow sessions
4. **Manual Recovery**: Users can manually reload context in any session
5. **Backward Compatibility**: Existing workflows continue working without changes

## User Experience Examples

### Example 1: Cross-Environment Workflow Resume

```bash
# Day 1: Start workflow on machine A
user@machine-a$ /fractary-faber:run 258

# ... workflow runs through Frame, Architect phases
# ... session ends

# Day 2: Resume on different machine
user@machine-b$ /fractary-faber:run --resume fractary-faber-258-...

# ✓ Context automatically restored:
#   - State file loaded
#   - Plan file loaded
#   - Orchestration protocol loaded
#   - Specification loaded
#   - Session history: 2 sessions (machine-a, machine-b)

# Continue from Build phase with full context
```

### Example 2: Manual Context Reload

```bash
# User notices workflow context is lost after compaction
user$ /fractary-faber:prime-context

# ✓ Context reloaded:
#   - State file
#   - Plan file
#   - Orchestration protocol
#   - Specification

# Continue workflow with full context
```

## Risks and Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Artifacts too large | Performance | Load only essential artifacts, implement size warnings |
| Sync conflicts | Lost state | Use fractary-logs for cloud backup, provide clear sync docs |
| Compaction undetectable | Can't auto-reload | Manual trigger available, auto-reload on session start |
| Path resolution fails | Can't load artifacts | Graceful degradation, clear error messages |

## Future Possibilities (Out of Scope)

This architecture could be generalized in the future to:
- General context profiles for any AI task (not just workflows)
- Lightweight CLAUDE.md as index to context profiles
- Context loading for manual coding, debugging, code review
- Agent-specific context to reduce bloat

**These are explicitly out of scope for this implementation.**

## Acceptance Criteria

- [ ] Workflow schema supports `critical_artifacts` configuration
- [ ] State schema tracks `sessions` and `context_metadata`
- [ ] Default workflows declare critical artifacts
- [ ] `/fractary-faber:prime-context` command works
- [ ] Auto-reload on session start functions correctly
- [ ] Session history tracked across environments
- [ ] Portable paths resolve correctly
- [ ] Documentation complete
- [ ] Backward compatible with existing workflows

## Related Documentation

- `plugins/faber/docs/standards/manager-protocols/context-reconstitution.md` - Existing context loading protocol
- `plugins/faber/docs/workflow-orchestration-protocol.md` - Workflow execution protocol
- `plugins/faber/docs/RUN-ID-SYSTEM.md` - Run isolation system
- `plugins/faber/docs/STATE-TRACKING.md` - State management
