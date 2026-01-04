# Migration Guide

This guide helps you migrate between major versions of FABER.

---

## Migration: v3.1.0 - Workflow Command Rationalization (Plugin)

**Released**: 2026-01-03
**Breaking Changes**: ✅ Yes - Command removal
**Affects**: Plugin `fractary-faber` v3.1.0+

### Overview

FABER v3.1 removes standalone workflow commands in favor of the unified orchestrator pattern. The `workflow-run` command now handles all phases directly with full context, eliminating the need for separate build/review/archive/execute commands.

### What Changed

#### Removed Commands

The following commands have been **REMOVED** (no deprecation period):

| Removed Command | Replacement | Migration |
|----------------|-------------|-----------|
| `/fractary-faber:workflow-build` | `/fractary-faber:workflow-run <plan-id> --phase build` | Use `--phase` argument for granular control |
| `/fractary-faber:workflow-review` | `/fractary-faber:workflow-run <plan-id>` | Review is automatic in evaluate phase |
| `/fractary-faber:workflow-archive` | *(removed entirely)* | Archive functionality removed |
| `/fractary-faber:workflow-execute` | `/fractary-faber:workflow-run <plan-id>` | Use `workflow-run` directly |
| `/fractary-faber:workflow-execute-deterministic` | `/fractary-faber:workflow-run <plan-id>` | Protocol-based execution prevents step skipping |

#### New Capabilities

`workflow-run` now supports granular execution via new arguments:

```bash
# Full workflow (all phases)
/fractary-faber:workflow-run <plan-id>

# Execute specific phase
/fractary-faber:workflow-run <plan-id> --phase build

# Execute multiple phases
/fractary-faber:workflow-run <plan-id> --phases build,evaluate

# Execute specific step
/fractary-faber:workflow-run <plan-id> --step core-implement-solution

# Execute multiple steps
/fractary-faber:workflow-run <plan-id> --steps step1,step2

# Resume from failure
/fractary-faber:workflow-run <plan-id> --resume <run-id>
```

#### Archive Functionality Removed

All archive-related functionality has been removed:
- `workflow-archive` command removed
- Archive steps removed from workflows
- Archive skill removed
- Archive configuration options removed

If you need archival, use external tools or the `fractary-logs` plugin directly.

### Why This Change?

**Problem**: The old delegation pattern (workflow-execute → faber-manager agent) caused:
- Context loss between phases
- Step skipping due to hallucinated completion
- Confusion about which command to use when

**Solution**: The orchestrator pattern (workflow-run with protocol) provides:
- Full context maintained throughout workflow
- Protocol-based execution prevents step skipping
- Single command with granular control via arguments
- Better decision-making with complete context

### Migration Steps

#### 1. Update Scripts and Automation

If you have scripts that call removed commands:

```bash
# OLD (no longer works)
fractary-faber workflow-build --work-id 123
fractary-faber workflow-execute <plan-id>

# NEW (use workflow-run with filters)
fractary-faber workflow-run <plan-id> --phase build
fractary-faber workflow-run <plan-id>
```

#### 2. Update Custom Workflows

If you have custom workflow definitions that reference removed commands:

```json
// OLD (in workflow JSON)
{
  "id": "my-step",
  "prompt": "/fractary-faber:workflow-build"
}

// NEW (direct instruction)
{
  "id": "my-step",
  "prompt": "Implement the solution according to the specification. Create atomic commits for each logical unit of work. Run tests to verify the implementation."
}
```

#### 3. Remove Archive References

If your workflows or configs reference archive:
- Remove archive steps from custom workflows
- Remove archive configuration from config files
- Use `fractary-logs` plugin if you need log management

### No Functionality Lost

All capabilities are preserved:
- ✅ Full workflow execution: `workflow-run <plan-id>`
- ✅ Single phase execution: `workflow-run <plan-id> --phase build`
- ✅ Multiple phase execution: `workflow-run <plan-id> --phases build,evaluate`
- ✅ Step-level control: `workflow-run <plan-id> --step <step-id>`
- ✅ Resume capability: `workflow-run <plan-id> --resume <run-id>`

### Getting Help

If you encounter issues migrating:
1. Review the [workflow-run documentation](plugins/faber/commands/workflow-run.md)
2. Check the [orchestration protocol](plugins/faber/docs/workflow-orchestration-protocol.md)
3. File an issue at https://github.com/fractary/faber/issues

---

## Migration: Command Alignment v2.1 / v1.1

**Released**: 2024-12-20
**Breaking Changes**: ⚠️ No (deprecation period)
**Affects**: All FABER interfaces

This guide helps you migrate to the new noun-first, verb-second command naming convention introduced in:
- `@fractary/faber` v2.1.0
- `@fractary/faber-cli` v1.1.0
- `@fractary/faber-mcp` v1.1.0
- Plugin `fractary-faber` v3.2.0
- Plugin `fractary-faber-cloud` v2.3.0

## Overview

All FABER interfaces now use consistent **noun-first, verb-second** naming:
- **SDK**: Noun-grouped methods (`state.workflow.create()` instead of `createWorkflow()`)
- **CLI**: Noun-verb commands (`workflow-run` instead of `run`)
- **MCP**: Noun-verb tools (`fractary_faber_event_consolidate` instead of `events_consolidate`)
- **Plugins**: Noun-verb commands (`fractary-faber:workflow-run` instead of `fractary-faber:run`)

## Backwards Compatibility

**All old APIs continue to work** with deprecation warnings. No breaking changes in this release.
- Old method/command names trigger console warnings
- Full removal planned for v3.0 (SDK) and v2.0 (CLI/MCP/Plugins)
- Recommended: Update your code now to avoid future breaking changes

---

## SDK Migration (`@fractary/faber`)

### StateManager API Changes

The StateManager now groups methods by noun (workflow, phase, checkpoint, manifest).

#### Workflow Operations

| Old API (Deprecated) | New API | Status |
|---------------------|---------|--------|
| `state.createWorkflow(workId)` | `state.workflow.create(workId)` | ⚠️ Deprecated |
| `state.saveWorkflow(state)` | `state.workflow.save(state)` | ⚠️ Deprecated |
| `state.getWorkflow(id)` | `state.workflow.get(id)` | ⚠️ Deprecated |
| `state.getActiveWorkflow(workId)` | `state.workflow.getActive(workId)` | ⚠️ Deprecated |
| `state.listWorkflows(options)` | `state.workflow.list(options)` | ⚠️ Deprecated |
| `state.deleteWorkflow(id)` | `state.workflow.delete(id)` | ⚠️ Deprecated |
| `state.pauseWorkflow(id)` | `state.workflow.pause(id)` | ⚠️ Deprecated |
| `state.resumeWorkflow(id)` | `state.workflow.resume(id)` | ⚠️ Deprecated |
| `state.recoverWorkflow(id, opts)` | `state.workflow.recover(id, opts)` | ⚠️ Deprecated |

#### Phase Operations

| Old API (Deprecated) | New API | Status |
|---------------------|---------|--------|
| `state.updatePhase(id, phase, updates, opts)` | `state.phase.update(id, phase, updates, opts)` | ⚠️ Deprecated |
| `state.startPhase(id, phase)` | `state.phase.start(id, phase)` | ⚠️ Deprecated |
| `state.completePhase(id, phase, outputs)` | `state.phase.complete(id, phase, outputs)` | ⚠️ Deprecated |
| `state.failPhase(id, phase, error)` | `state.phase.fail(id, phase, error)` | ⚠️ Deprecated |
| `state.skipPhase(id, phase, reason)` | `state.phase.skip(id, phase, reason)` | ⚠️ Deprecated |

#### Checkpoint Operations

| Old API (Deprecated) | New API | Status |
|---------------------|---------|--------|
| `state.createCheckpoint(id, phase, step, data)` | `state.checkpoint.create(id, phase, step, data)` | ⚠️ Deprecated |
| `state.getCheckpoint(checkpointId)` | `state.checkpoint.get(checkpointId)` | ⚠️ Deprecated |
| `state.listCheckpoints(workflowId)` | `state.checkpoint.list(workflowId)` | ⚠️ Deprecated |
| `state.getLatestCheckpoint(workflowId)` | `state.checkpoint.getLatest(workflowId)` | ⚠️ Deprecated |

#### Manifest Operations

| Old API (Deprecated) | New API | Status |
|---------------------|---------|--------|
| `state.createManifest(workflowId, workId)` | `state.manifest.create(workflowId, workId)` | ⚠️ Deprecated |
| `state.saveManifest(manifest)` | `state.manifest.save(manifest)` | ⚠️ Deprecated |
| `state.getManifest(manifestId)` | `state.manifest.get(manifestId)` | ⚠️ Deprecated |
| `state.addPhaseToManifest(id, phase)` | `state.manifest.addPhase(id, phase)` | ⚠️ Deprecated |
| `state.addArtifactToManifest(id, artifact)` | `state.manifest.addArtifact(id, artifact)` | ⚠️ Deprecated |
| `state.completeManifest(id, status)` | `state.manifest.complete(id, status)` | ⚠️ Deprecated |

### FaberWorkflow API Changes

| Old API (Deprecated) | New API | Status |
|---------------------|---------|--------|
| `workflow.getStatus(workflowId)` | `workflow.status.get(workflowId)` | ⚠️ Deprecated |

### Migration Example

**Before:**
```typescript
import { StateManager, FaberWorkflow } from '@fractary/faber';

const state = new StateManager();
const workflow = new FaberWorkflow();

// Create and manage workflow
const wf = state.createWorkflow('123');
state.startPhase(wf.workflow_id, 'frame');
state.completePhase(wf.workflow_id, 'frame', { spec: 'path/to/spec.md' });

// Get status
const status = workflow.getStatus(wf.workflow_id);
```

**After:**
```typescript
import { StateManager, FaberWorkflow } from '@fractary/faber';

const state = new StateManager();
const workflow = new FaberWorkflow();

// Create and manage workflow
const wf = state.workflow.create('123');
state.phase.start(wf.workflow_id, 'frame');
state.phase.complete(wf.workflow_id, 'frame', { spec: 'path/to/spec.md' });

// Get status
const status = workflow.status.get(wf.workflow_id);
```

---

## CLI Migration (`@fractary/faber-cli`)

### Command Renames

All workflow commands now have a `workflow-` prefix:

| Old Command (Deprecated) | New Command | Status |
|-------------------------|-------------|--------|
| `faber init` | `faber workflow-init` | ⚠️ Deprecated |
| `faber run --work-id 123` | `faber workflow-run --work-id 123` | ⚠️ Deprecated |
| `faber status` | `faber workflow-status` | ⚠️ Deprecated |
| `faber pause <id>` | `faber workflow-pause <id>` | ⚠️ Deprecated |
| `faber resume <id>` | `faber workflow-resume <id>` | ⚠️ Deprecated |
| `faber recover <id>` | `faber workflow-recover <id>` | ⚠️ Deprecated |
| `faber cleanup` | `faber workflow-cleanup` | ⚠️ Deprecated |

### Migration Example

**Before:**
```bash
# Initialize project
faber init

# Run workflow
faber run --work-id 123 --autonomy supervised

# Check status
faber status --work-id 123

# Pause/resume
faber pause WF-ABC123
faber resume WF-ABC123
```

**After:**
```bash
# Initialize project
faber workflow-init

# Run workflow
faber workflow-run --work-id 123 --autonomy supervised

# Check status
faber workflow-status --work-id 123

# Pause/resume
faber workflow-pause WF-ABC123
faber workflow-resume WF-ABC123
```

---

## MCP Server Migration (`@fractary/faber-mcp`)

### Tool Renames

| Old Tool Name (Deprecated) | New Tool Name | Status |
|---------------------------|---------------|--------|
| `fractary_faber_events_consolidate` | `fractary_faber_event_consolidate` | ⚠️ Deprecated |

All other MCP tools were already using the correct naming convention.

### Migration Example

**Before:**
```json
{
  "tool": "fractary_faber_events_consolidate",
  "arguments": {
    "run_id": "org/project/uuid"
  }
}
```

**After:**
```json
{
  "tool": "fractary_faber_event_consolidate",
  "arguments": {
    "run_id": "org/project/uuid"
  }
}
```

---

## Plugin Migration

### fractary-faber Plugin

All workflow commands now have a `workflow-` prefix:

| Old Command (Deprecated) | New Command | Status |
|-------------------------|-------------|--------|
| `/fractary-faber:init` | `/fractary-faber:workflow-init` | ✅ Renamed (no alias) |
| `/fractary-faber:run` | `/fractary-faber:workflow-run` | ✅ Renamed (no alias) |
| `/fractary-faber:plan` | `/fractary-faber:workflow-plan` | ✅ Renamed (no alias) |
| `/fractary-faber:execute` | `/fractary-faber:workflow-execute` | ✅ Renamed (no alias) |
| `/fractary-faber:execute-deterministic` | `/fractary-faber:workflow-execute-deterministic` | ✅ Renamed (no alias) |
| `/fractary-faber:archive` | `/fractary-faber:workflow-archive` | ✅ Renamed (no alias) |
| `/fractary-faber:review` | `/fractary-faber:workflow-review` | ✅ Renamed (no alias) |
| `/fractary-faber:build` | `/fractary-faber:workflow-build` | ✅ Renamed (no alias) |

**Note**: Plugin commands are hard renames without backwards compatibility aliases. Update all references immediately.

### fractary-faber-cloud Plugin

**UPDATE (v2.3.1+)**: The `cloud-` prefix has been **removed** as redundant since the plugin namespace already provides context. Commands are now simpler and more consistent with other plugins.

| Old Command (v2.3.0) | New Command (v2.3.1+) | Status |
|----------------------|----------------------|--------|
| `/fractary-faber-cloud:cloud-init` | `/fractary-faber-cloud:init` | ✅ Renamed (no alias) |
| `/fractary-faber-cloud:cloud-direct` | `/fractary-faber-cloud:direct` | ✅ Renamed (no alias) |
| `/fractary-faber-cloud:cloud-manage` | `/fractary-faber-cloud:manage` | ✅ Renamed (no alias) |
| `/fractary-faber-cloud:cloud-architect` | `/fractary-faber-cloud:architect` | ✅ Renamed (no alias) |
| `/fractary-faber-cloud:cloud-engineer` | `/fractary-faber-cloud:engineer` | ✅ Renamed (no alias) |
| `/fractary-faber-cloud:cloud-adopt` | `/fractary-faber-cloud:adopt` | ✅ Renamed (no alias) |
| `/fractary-faber-cloud:cloud-test` | `/fractary-faber-cloud:test` | ✅ Renamed (no alias) |
| `/fractary-faber-cloud:cloud-audit` | `/fractary-faber-cloud:audit` | ✅ Renamed (no alias) |
| `/fractary-faber-cloud:cloud-teardown` | `/fractary-faber-cloud:teardown` | ✅ Renamed (no alias) |
| `/fractary-faber-cloud:cloud-validate` | `/fractary-faber-cloud:validate` | ✅ Renamed (no alias) |
| `/fractary-faber-cloud:cloud-debug` | `/fractary-faber-cloud:debug` | ✅ Renamed (no alias) |
| `/fractary-faber-cloud:cloud-status` | `/fractary-faber-cloud:status` | ✅ Renamed (no alias) |
| `/fractary-faber-cloud:cloud-list` | `/fractary-faber-cloud:list` | ✅ Renamed (no alias) |

**Already Correct** (no changes):
- `/fractary-faber-cloud:deploy-plan`
- `/fractary-faber-cloud:deploy-apply`

### fractary-faber-article Plugin

All commands were already correctly named with the `content-` prefix. No changes needed.

---

## Deprecation Timeline

### Current Release (v2.1 / v1.1)
- **SDK**: Old methods work with console warnings
- **CLI**: Old commands work with deprecation notices
- **MCP**: Old tool names work (if aliases added)
- **Plugins**: Hard renames (no backwards compatibility)

### Future Releases

**v2.2 / v1.2** (3-6 months):
- Increased deprecation warning visibility
- "Will be removed" notices

**v3.0 / v2.0** (6-12 months):
- Old SDK methods removed
- Old CLI commands removed
- Breaking changes for users who haven't migrated

---

## Testing Your Migration

### SDK Tests
```typescript
import { StateManager } from '@fractary/faber';

const state = new StateManager();
const wf = state.workflow.create('test-123');
console.assert(wf.workflow_id.startsWith('WF-'));
```

### CLI Tests
```bash
# Should work without deprecation warnings
faber workflow-init --preset minimal
faber workflow-status --help

# Should show deprecation warnings
faber init --preset minimal  # ⚠️  DEPRECATED
```

### Plugin Tests
- Verify new command names appear in command palette
- Test execution of renamed commands
- Check that old command names no longer autocomplete

---

## Need Help?

- **Documentation**: See `/docs` for detailed API references
- **Issues**: Report migration problems at https://github.com/fractary/faber/issues
- **Spec**: Full implementation details in `specs/WORK-00020-align-command-naming-across-interfaces.md`

---

## Summary of Changes

- ✅ **55 renames** completed across all interfaces
- ✅ **Backwards compatibility** maintained in SDK and CLI
- ✅ **Deprecation warnings** guide users to new APIs
- ✅ **No breaking changes** in this release
- ✅ **Consistent naming** across SDK, CLI, MCP, and Plugins
