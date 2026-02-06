# FABER Context Management Guide

Complete guide to managing critical context artifacts during FABER workflow execution.

## Overview

FABER's context management system ensures that critical artifacts (state files, specifications, protocols, issue details) remain accessible throughout workflow execution, even across:

- **Context compaction** - When LLM context window is compacted to save tokens
- **Session boundaries** - When workflows pause and resume in new Claude sessions
- **Environment changes** - When workflows move between different machines
- **Phase transitions** - When moving between workflow phases that need specific context

### Key Features

- 📦 **Configurable artifacts** - Each workflow declares what context is critical
- 🔄 **Auto-reload on session start** - Critical artifacts automatically restored when resuming
- 🎯 **Manual reload command** - `/fractary-faber:session-load` for on-demand context restoration
- 🌍 **Cross-environment portability** - Path templates enable workflows to move between machines
- 📊 **Session tracking** - Know which sessions and environments contributed to each workflow run
- ⚡ **Smart reloading** - Skip recently loaded artifacts to avoid redundant work

## Why Context Management Matters

### Problem: Context Loss During Execution

Long-running FABER workflows can lose critical context when:

1. **Context compaction occurs** - LLM automatically removes older messages to stay within token limits
2. **Sessions end unexpectedly** - Browser closes, network issues, or reaching conversation limits
3. **Workflows pause overnight** - Resume next day in fresh session without prior context
4. **Moving between machines** - Starting workflow on laptop, continuing on desktop

**Without context management**, this results in:
- ❌ Lost workflow state - Don't know what phase we're in or what's been completed
- ❌ Missing specifications - Can't see the technical design we're implementing
- ❌ Unknown protocols - Forget how to execute workflow steps correctly
- ❌ Broken continuity - Cannot seamlessly continue work across sessions

**With context management**, you get:
- ✅ Preserved state across sessions and compaction events
- ✅ Automatic restoration of critical artifacts when needed
- ✅ Portable workflows that work across machines
- ✅ Complete audit trail of all sessions that contributed to workflow

## Automatic Context Management with Hooks

**RECOMMENDED**: Configure Claude Code hooks for automatic context management. This provides seamless workflow continuity without manual intervention.

### What Hooks Do

Claude Code hooks enable fully automatic context management:

1. **PreCompact Hook** - Saves session metadata before context compaction occurs
2. **SessionStart Hook** - Restores critical artifacts when new session begins (after compaction or resume)
3. **SessionEnd Hook** - Saves final session state when Claude Code exits

**Result**: Workflows continue seamlessly across compaction events and session boundaries without any manual context restoration.

### Setup Hooks (5 Minutes)

**Quick setup**: Add to `.claude/settings.json` in your project:

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

### How Hooks Work

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
    │  ├─ Saves session metadata   │                           │
    │  ├─ Records phases completed │                           │
    │  └─ Updates state.json       │                           │
    │                              │                           │
    ├─ [COMPACTION OCCURS] ────────┤                           │
    │                              │  [SessionStart Hook]      │
    │                              │  ├─ Detects new session   │
    │                              │  ├─ Loads all artifacts   │
    │                              │  └─ Context restored      │
    │                              │                           │
  Build phase continues ───────────────────────────────────────┤
  Evaluate phase                                               │
  Release phase                                                │
                                                               │
                                   [SessionEnd Hook]           │
                                   └─ Saves final session      │
```

### One Workflow Per Worktree

**Design Limitation**: FABER supports **one active workflow per git worktree** at a time.

**Why**: Hooks use a single `.fractary/faber/runs/.active-run-id` file to track which workflow is active. Multiple workflows in the same worktree would conflict.

**Solution for Concurrent Workflows**: Use **git worktrees**:

```bash
# Create separate worktrees for each workflow
git worktree add ../myproject-issue-258 -b feature/258
git worktree add ../myproject-issue-259 -b feature/259

# Terminal 1: Work on issue 258
cd ../myproject-issue-258
/fractary-faber:workflow-run <plan-id-258>

# Terminal 2: Work on issue 259 in parallel (different worktree)
cd ../myproject-issue-259
/fractary-faber:workflow-run <plan-id-259>
```

**Automatic Detection**: The `workflow-run` command detects if another workflow is active and warns you:

```
⚠️  WARNING: Another workflow is active in this worktree
   Active: fractary-faber-258-20260104-143022
   New: fractary-faber-259-20260105-151500

Recommendation: Use separate worktrees for concurrent workflows
```

### Cross-Environment Workflow Continuity

The `.fractary/faber/runs/.active-run-id` file enables workflows to resume across machines:

**On Machine A**:
```bash
/fractary-faber:workflow-run <plan-id>
# Creates: .fractary/faber/runs/.active-run-id
# Workflow progresses through Frame, Architect phases
```

**On Machine B** (after syncing via git):
```bash
git pull  # Syncs .active-run-id and state files
# Hooks automatically detect active workflow
# Context automatically restored on session start
# Continue workflow seamlessly
```

**Important**: Commit `.fractary/faber/runs/.active-run-id` to git (not in `.gitignore`) for cross-environment continuity.

## Quick Start

### 1. Configure Critical Artifacts (Optional)

Workflows already come with sensible defaults. To customize, add `critical_artifacts` to your workflow config:

```json
{
  "id": "my-workflow",
  "extends": "fractary-faber:default",
  "critical_artifacts": {
    "always_load": [
      {
        "id": "coding-standards",
        "type": "markdown",
        "path": "docs/CODING_STANDARDS.md",
        "description": "Project coding standards",
        "required": true,
        "reload_triggers": ["session_start"]
      }
    ]
  }
}
```

### 2. Use Auto-Reload (Recommended)

Add automatic context reload to your workflow's Frame phase:

```json
{
  "phases": {
    "frame": {
      "pre_steps": [
        {
          "id": "auto-reload-context",
          "name": "Reload Context",
          "description": "Automatically reload critical artifacts on session start",
          "prompt": "/fractary-faber:session-load"
        }
      ]
    }
  }
}
```

### 3. Manual Reload When Needed

If you notice context has been lost during execution:

```bash
/fractary-faber:session-load
```

## Configuring Critical Artifacts

### Artifact Configuration Structure

Critical artifacts are declared in the `critical_artifacts` section of workflow configuration files:

```json
{
  "critical_artifacts": {
    "always_load": [
      /* Artifacts that should always be loaded */
    ],
    "conditional_load": [
      /* Artifacts loaded only when certain conditions are met */
    ],
    "phase_specific": {
      /* Artifacts specific to certain phases */
    }
  }
}
```

### Artifact Definition

Each artifact has these properties:

```json
{
  "id": "unique-artifact-id",
  "type": "json|markdown|directory|work_plugin|skill|git_info",
  "path": "path/to/artifact",
  "path_from_state": "state.field.path",
  "command": "/skill:command {args}",
  "description": "Human-readable description",
  "required": true|false,
  "reload_triggers": ["session_start", "manual", "phase_transition:X->Y"],
  "load_strategy": "all|latest_only|summary",
  "condition": "state.field != null"
}
```

**Field descriptions**:
- `id` - Unique identifier for this artifact
- `type` - Type of artifact (determines how to load it)
- `path` - File path (supports placeholders like `{run_id}`)
- `path_from_state` - Get path from state file field (alternative to `path`)
- `command` - Command to execute for `work_plugin`, `skill`, or `git_info` types
- `description` - Human-readable description shown when loading
- `required` - If true, workflow stops if artifact can't be loaded
- `reload_triggers` - Events that trigger reloading this artifact
- `load_strategy` - How to load directory artifacts (`all`, `latest_only`, `summary`)
- `condition` - JavaScript expression to evaluate (for conditional artifacts)

### Artifact Types

| Type | Description | Path/Command | Example |
|------|-------------|--------------|---------|
| `json` | JSON file | `path` or `path_from_state` | State file, plan file |
| `markdown` | Markdown doc | `path` or `path_from_state` | Specification, protocol, README |
| `directory` | Directory of files | `path` | Session summaries, logs |
| `work_plugin` | Work item data | `command` | `/fractary-work:issue-fetch {work_id}` |
| `skill` | Custom skill | `command` | `/my-plugin:custom-loader` |
| `git_info` | Git command output | `command` | `git log --oneline -10` |

### Always Load Artifacts

Artifacts in `always_load` are loaded every time context is reloaded:

```json
{
  "always_load": [
    {
      "id": "workflow-state",
      "type": "json",
      "path": ".fractary/faber/runs/{plan_id}/state-{run_suffix}.json",
      "description": "Current workflow state - essential for continuation",
      "required": true,
      "reload_triggers": ["session_start", "manual"]
    },
    {
      "id": "orchestration-protocol",
      "type": "markdown",
      "path": "plugins/faber/docs/workflow-orchestration-protocol.md",
      "description": "How to execute workflow steps",
      "required": true,
      "reload_triggers": ["session_start"]
    }
  ]
}
```

### Conditional Load Artifacts

Artifacts in `conditional_load` are loaded only when a condition is true:

```json
{
  "conditional_load": [
    {
      "id": "specification",
      "type": "markdown",
      "path_from_state": "artifacts.spec_path",
      "description": "Technical specification for the work",
      "required": false,
      "condition": "state.artifacts.spec_path != null",
      "reload_triggers": ["session_start", "phase_transition:architect->build"]
    },
    {
      "id": "issue-context",
      "type": "work_plugin",
      "command": "/fractary-work:issue-fetch {work_id}",
      "description": "Issue details and context",
      "required": false,
      "condition": "state.work_id != null",
      "reload_triggers": ["session_start"]
    }
  ]
}
```

### Phase-Specific Artifacts

Artifacts in `phase_specific` are loaded only during specific phases:

```json
{
  "phase_specific": {
    "build": [
      {
        "id": "coding-standards",
        "type": "markdown",
        "path": "docs/CODING_STANDARDS.md",
        "description": "Project coding standards",
        "required": false,
        "reload_triggers": ["phase_start:build"]
      }
    ],
    "evaluate": [
      {
        "id": "testing-checklist",
        "type": "markdown",
        "path": "docs/TESTING_CHECKLIST.md",
        "description": "Testing requirements",
        "required": false,
        "reload_triggers": ["phase_start:evaluate"]
      }
    ]
  }
}
```

## Path Placeholders

Artifact paths can include placeholders that are resolved at runtime:

| Placeholder | Resolves To | Example |
|------------|-------------|---------|
| `{run_id}` | Current workflow run ID | `fractary-faber-258-20260104` |
| `{plan_id}` | Current workflow plan ID | `fractary-faber-258-plan-001` |
| `{project_root}` | Git repository root | `/home/user/projects/myapp` |
| `{work_id}` | Work item ID from state | `PROJ-258` |

**Example usage**:

```json
{
  "path": ".fractary/faber/runs/{plan_id}/state-{run_suffix}.json"
}
```

Resolves to: `.fractary/faber/runs/fractary-faber-258-20260104/state-2026-01-04T15-30-22Z.json`

**Why this matters**: Path placeholders enable workflows to be portable across different environments and machines. State files can reference artifacts using placeholders, and they'll resolve correctly regardless of the absolute path.

## Reload Triggers

Reload triggers control when artifacts are loaded:

| Trigger | When It Fires | Use For |
|---------|---------------|---------|
| `session_start` | New Claude session begins | Core artifacts needed immediately |
| `manual` | User runs `/fractary-faber:session-load` | User-initiated reload |
| `phase_start:X` | Before phase X starts | Phase-specific artifacts |
| `phase_transition:X->Y` | Moving from phase X to Y | Context needed for next phase |
| `compaction_detected` | Context compaction detected (future) | Auto-recovery from compaction |

**Examples**:

```json
{
  "reload_triggers": ["session_start"]  // Load at session start only
}

{
  "reload_triggers": ["session_start", "manual"]  // Load at session start and manual reload
}

{
  "reload_triggers": ["phase_transition:architect->build"]  // Load when moving from architect to build
}

{
  "reload_triggers": ["phase_start:evaluate"]  // Load before evaluate phase starts
}
```

## Using the Prime Context Command

The `/fractary-faber:session-load` command manually reloads critical artifacts.

### Basic Usage

```bash
# Auto-detect active workflow and reload all critical artifacts
/fractary-faber:session-load
```

### Command Options

| Option | Type | Description |
|--------|------|-------------|
| `--run-id` | string | Specific run ID to reload |
| `--artifacts` | string | Comma-separated list of artifact IDs |
| `--force` | boolean | Force reload even if recently loaded |
| `--dry-run` | boolean | Show what would be loaded without loading |

### Usage Examples

**Auto-detect and reload all artifacts**:
```bash
/fractary-faber:session-load
```

**Reload specific workflow run**:
```bash
/fractary-faber:session-load --run-id fractary-faber-258-20260104
```

**Reload only specific artifacts** (faster):
```bash
/fractary-faber:session-load --artifacts workflow-state,specification
```

**Force reload all artifacts**:
```bash
/fractary-faber:session-load --force
```

**Dry-run to preview what would be loaded**:
```bash
/fractary-faber:session-load --dry-run
```

## Session Tracking

Context management tracks which sessions contributed to each workflow run.

### Session Record Structure

Each session is recorded in `state.json`:

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
        "artifacts_loaded": [
          "workflow-state",
          "orchestration-protocol",
          "specification"
        ]
      }
    ]
  }
}
```

### What Session Tracking Enables

1. **Cross-environment workflows** - See which machines contributed to the workflow
2. **Debugging** - Understand context across multiple sessions
3. **Audit trail** - Complete record of workflow execution
4. **Recovery** - Know what artifacts were loaded in each session

## Context Metadata

Context metadata tracks what artifacts are currently in context:

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
        "source": ".fractary/faber/runs/fractary-faber-258-20260104/state-2026-01-04T10-15-30Z.json",
        "size_bytes": 4096
      },
      {
        "artifact_id": "specification",
        "loaded_at": "2026-01-05T14:30:00Z",
        "load_trigger": "manual",
        "source": "specs/WORK-00258-add-context-management.md",
        "size_bytes": 12800
      }
    ]
  }
}
```

### What Context Metadata Enables

1. **Skip redundant loads** - Don't reload artifacts that were just loaded
2. **Performance optimization** - Track artifact sizes and optimize loading
3. **Debugging** - See exactly what's in context and when it was loaded
4. **Recovery** - Know what needs to be reloaded after compaction

## Common Use Cases

### Use Case 1: Resume After Context Compaction

**Scenario**: Long build phase causes context compaction, losing state and spec files.

**Solution**:
```bash
# Context was compacted, critical artifacts lost
# Manually reload context

/fractary-faber:session-load
# ✓ Reloads workflow state, spec, protocol, and any other critical artifacts
```

### Use Case 2: Continue Workflow on Different Machine

**Scenario**: Started workflow on laptop, want to continue on desktop.

**Setup**:
1. Ensure state files synced (via fractary-logs or git)
2. Pull latest code on desktop

**Commands**:
```bash
# On desktop machine
cd /path/to/project
git pull

# Reload context for specific run
/fractary-faber:session-load --run-id fractary-faber-258-20260104

# ✓ Loads all artifacts, records environment change in session history
# ✓ Can now continue workflow seamlessly
```

### Use Case 3: Resume After Session Ends

**Scenario**: Browser closed unexpectedly during architect phase, need to resume.

**Solution**:
```bash
# New session, no context from previous session
# Start workflow command which auto-reloads context

/fractary-faber:run --resume fractary-faber-258-20260104

# OR manually reload if needed
/fractary-faber:session-load
```

### Use Case 4: Quick Targeted Reload

**Scenario**: Made changes to specification, need to reload just that file.

**Solution**:
```bash
# Only reload specification, skip other artifacts
/fractary-faber:session-load --artifacts specification --force

# ✓ Fast reload of just the spec file
```

### Use Case 5: Debug Context Issues

**Scenario**: Workflow seems confused, want to verify what's in context.

**Solution**:
```bash
# Dry-run to see what artifacts are loaded
/fractary-faber:session-load --dry-run

# Shows:
# - Which artifacts are in context
# - When they were loaded
# - What would be loaded/skipped
# - Artifact sizes
```

## Best Practices

### 1. Configure Auto-Reload

**Always** add automatic context reload to your workflows:

```json
{
  "phases": {
    "frame": {
      "pre_steps": [
        {
          "id": "auto-reload-context",
          "prompt": "/fractary-faber:session-load"
        }
      ]
    }
  }
}
```

This ensures context is automatically restored when resuming workflows.

### 2. Keep Artifacts Small

Large artifacts slow down context loading and consume token budget:

- ✅ Use `load_strategy: "summary"` for large directories
- ✅ Use `load_strategy: "latest_only"` for log directories
- ✅ Keep specifications concise and focused
- ❌ Don't load entire codebases as artifacts

### 3. Use Conditional Loading

Don't load artifacts that aren't always needed:

```json
{
  "conditional_load": [
    {
      "id": "api-docs",
      "type": "markdown",
      "path": "docs/API.md",
      "condition": "state.current_phase === 'build'",
      "required": false
    }
  ]
}
```

### 4. Mark Required vs Optional

Be explicit about which artifacts are critical:

```json
{
  "required": true   // Workflow stops if this can't be loaded
}

{
  "required": false  // Workflow continues with warning if missing
}
```

### 5. Use Path Placeholders for Portability

Always use placeholders instead of absolute paths:

```json
// ✅ Good - Portable across environments
{
  "path": ".fractary/faber/runs/{plan_id}/state-{run_suffix}.json"
}

// ❌ Bad - Breaks on different machines
{
  "path": "/home/user/projects/myapp/.fractary/faber/runs/fractary-faber-258/state-2026-01-04T15-30-22Z.json"
}
```

### 6. Target Specific Artifacts When Possible

For faster reloads, specify exactly what you need:

```bash
# ✅ Fast - Only loads what you need
/fractary-faber:session-load --artifacts workflow-state,specification

# ⚠️ Slower - Loads everything
/fractary-faber:session-load
```

### 7. Use Force Reload Sparingly

Only use `--force` when you know artifacts have changed:

```bash
# ✅ Good - Force reload after manual state edit
# (edited state-*.json to fix issue)
/fractary-faber:session-load --force

# ❌ Wasteful - Force reload for no reason
/fractary-faber:session-load --force
```

### 8. Leverage Dry-Run for Debugging

Preview what would be loaded before loading:

```bash
/fractary-faber:session-load --dry-run
```

This helps debug context issues without actually loading artifacts.

## Troubleshooting

### Problem: No Active Workflow Found

**Error**:
```
❌ ERROR: No active workflow found
```

**Causes**:
- No workflows currently in progress
- State file missing or in wrong location
- Wrong working directory

**Solutions**:
```bash
# 1. Check for available runs
ls .fractary/faber/runs/

# 2. If runs exist, specify run ID explicitly
/fractary-faber:session-load --run-id fractary-faber-258-20260104

# 3. If no runs exist, start new workflow
/fractary-faber:run {work_id}
```

### Problem: Required Artifact Not Found

**Error**:
```
❌ ERROR: Required artifact not found
Artifact: specification
Path: specs/WORK-00258.md
```

**Causes**:
- Artifact file doesn't exist
- Wrong path in configuration
- Path placeholder didn't resolve correctly

**Solutions**:
```bash
# 1. Check if file exists
ls -la specs/WORK-00258.md

# 2. Check state for path information
cat .fractary/faber/runs/{plan_id}/state-{run_suffix}.json | jq '.artifacts.spec_path'

# 3. If using path_from_state, verify state field exists
cat .fractary/faber/runs/{plan_id}/state-{run_suffix}.json | jq '.artifacts'

# 4. If spec doesn't exist yet, mark as optional in config
# Edit workflow config: "required": false
```

### Problem: State File Corrupted

**Error**:
```
❌ ERROR: Cannot read state file
Path: .fractary/faber/runs/{plan_id}/state-{run_suffix}.json
Error: Invalid JSON at line 42
```

**Causes**:
- Manual edit with syntax error
- File corruption
- Incomplete write operation

**Solutions**:
```bash
# 1. Check for backup
ls -la .fractary/faber/runs/{run_id}/state.backup.json

# 2. Restore from backup if available
cp .fractary/faber/runs/{run_id}/state.backup.json .fractary/faber/runs/{plan_id}/state-{run_suffix}.json

# 3. Validate JSON syntax
cat .fractary/faber/runs/{plan_id}/state-{run_suffix}.json | jq '.'

# 4. If no backup, manually fix JSON errors
# Open in editor and fix syntax issues
```

### Problem: Multiple Active Workflows

**Prompt**:
```
Multiple active workflows found. Please select:

1. fractary-faber-258-20260104 (build phase, started 2 days ago)
2. fractary-faber-259-20260105 (architect phase, started 1 hour ago)

Which workflow? [1-2]:
```

**Solution**: Select the workflow you want to reload context for, or specify run ID explicitly:

```bash
/fractary-faber:session-load --run-id fractary-faber-259-20260105
```

### Problem: Artifact Too Large Warning

**Warning**:
```
⚠️ WARNING: Large artifact detected
Artifact: session-summaries
Size: 250 KB

Consider using load_strategy: "summary" for large directories.
```

**Solution**: Update workflow config to use a load strategy:

```json
{
  "id": "session-summaries",
  "type": "directory",
  "path": "logs/sessions",
  "load_strategy": "summary",  // Only load summary instead of all files
  "required": false
}
```

Or:

```json
{
  "load_strategy": "latest_only"  // Only load most recent file
}
```

### Problem: Cross-Environment Path Issues

**Error**:
```
❌ ERROR: Required artifact not found
Path: /home/alice/projects/myapp/specs/WORK-258.md
```

**Cause**: Absolute path in state file doesn't exist on current machine.

**Solution**: Use path placeholders instead of absolute paths:

```json
{
  "artifacts": {
    "spec_path": "{project_root}/specs/WORK-258.md"  // ✅ Portable
  }
}
```

Not:

```json
{
  "artifacts": {
    "spec_path": "/home/alice/projects/myapp/specs/WORK-258.md"  // ❌ Not portable
  }
}
```

## Advanced Topics

### Custom Load Strategies

For directory artifacts, you can customize how files are loaded:

```json
{
  "id": "logs",
  "type": "directory",
  "path": "logs/workflow",
  "load_strategy": "latest_only",  // Only load most recent file
  "required": false
}
```

Available strategies:
- `all` - Load all files in directory (default)
- `latest_only` - Load only most recently modified file
- `summary` - Load summary/overview instead of individual files

### Conditional Expressions

Conditional artifacts support JavaScript-like expressions:

```json
{
  "condition": "state.current_phase === 'build'"
}

{
  "condition": "state.artifacts.spec_path != null"
}

{
  "condition": "state.work_id != null && state.status === 'in_progress'"
}
```

**Supported operators**:
- Comparison: `===`, `!==`, `==`, `!=`, `>`, `<`, `>=`, `<=`
- Logical: `&&`, `||`, `!`
- Null checks: `!= null`, `=== null`

### Phase Transition Triggers

Target specific phase transitions:

```json
{
  "reload_triggers": ["phase_transition:architect->build"]
}
```

This loads the artifact only when moving from architect to build phase.

**Use cases**:
- Load specifications when starting implementation (architect→build)
- Load testing checklist when starting evaluation (build→evaluate)
- Load deployment docs when starting release (evaluate→release)

### Workflow Inheritance and Artifacts

When extending workflows, artifacts are inherited and can be overridden:

**Base workflow** (`fractary-faber:core`):
```json
{
  "critical_artifacts": {
    "always_load": [
      { "id": "workflow-state", "type": "json", "path": "..." }
    ]
  }
}
```

**Extended workflow** (`my-workflow`):
```json
{
  "extends": "fractary-faber:core",
  "critical_artifacts": {
    "always_load": [
      // Inherits workflow-state from core
      { "id": "custom-artifact", "type": "markdown", "path": "..." }
    ]
  }
}
```

## See Also

- **Command References**:
  - `plugins/faber/commands/session-load.md` - Manual context reload command
  - `plugins/faber/commands/session-save.md` - Session save command
- **Skill Documentation**: `plugins/faber/skills/context-manager/SKILL.md`
- **Algorithm Details**:
  - `plugins/faber/agents/session-manager.md` - Session management agent
- **Schemas**:
  - `plugins/faber/config/workflow.schema.json` - Workflow configuration schema
  - `plugins/faber/config/state.schema.json` - State file schema
- **Full Specification**: `specs/SPEC-00027-faber-context-management.md`
- **Other Guides**:
  - [STATE-TRACKING.md](./STATE-TRACKING.md) - State tracking guide
  - [configuration.md](./configuration.md) - Configuration guide
  - [workflow-guide.md](./workflow-guide.md) - Workflow guide
