---
id: WORK-00020
title: Align Command Naming Across SDK, CLI, MCP, and Plugin Interfaces
type: feature
status: draft
created: 2025-12-17
work_id: "20"
issue_url: https://github.com/fractary/faber/issues/20
branch: feat/20-align-command-naming-across-sdk-cli-mcp-and-plugin
template: feature
refined: 2025-12-17
---

# Align Command Naming Across SDK, CLI, MCP, and Plugin Interfaces

## Overview

Refactor FABER-specific interfaces (SDK, CLI, MCP Server, Plugin) to use a consistent **noun-first, verb-second** naming pattern. This ensures all commands within the FABER project are aligned and follow the same convention.

**Important Scope Limitation:** This spec covers only FABER-specific components. The common core plugins (work, repo, logs, file, docs, spec, status) have been moved to the `fractary/core` project and are **out of scope** for this work.

## Problem Statement

An audit of FABER interfaces revealed naming inconsistencies:

| Interface | Current Pattern | Issue |
|-----------|-----------------|-------|
| SDK | Workflow methods use verb-first (`workflow.run()`, `workflow.getStatus()`) | Some methods inconsistent |
| CLI | Top-level workflow commands (`run`, `status`, `init`) | Commands lack noun context |
| MCP | Mixed (`workflow_run`, `events_consolidate`) | Inconsistent noun-verb ordering in events |
| Plugin | Verb-first (`fractary-faber:run`, `fractary-faber:plan`) | Commands don't indicate what they operate on |

## Solution

Standardize all FABER-specific interfaces to use **noun-first, verb-second** naming:

### Target Naming Patterns

| Interface | Pattern | Example |
|-----------|---------|---------|
| SDK | `{module}.{noun}.{verb}()` or `{module}.{verb}()` | `workflow.run()`, `state.workflow.create()` |
| CLI | `{noun}-{verb}` with domain groups | `workflow-run`, `workflow-status` |
| MCP | `fractary_faber_{noun}_{verb}` | `fractary_faber_workflow_run`, `fractary_faber_event_emit` |
| Plugin | `fractary-faber:{noun}-{verb}` | `fractary-faber:workflow-run`, `fractary-faber:workflow-plan` |

## In-Scope Components

### FABER SDK (`@fractary/faber`)
- Workflow module
- State module
- Storage module

### FABER CLI (`@fractary/faber-cli`)
- Workflow commands only

### FABER MCP Server (`@fractary/faber-mcp`)
- Workflow tools
- Event gateway tools

### FABER Plugins
- `fractary-faber` (main FABER plugin)
- `fractary-faber-cloud` (cloud infrastructure)
- `fractary-faber-article` (content creation)

## Out-of-Scope Components (In fractary/core)

The following are managed in the `fractary/core` project and should have their own alignment issues:
- `@fractary/work` - Work tracking SDK/Plugin
- `@fractary/repo` - Repository SDK/Plugin
- `@fractary/logs` - Logging SDK/Plugin
- `@fractary/spec` - Specification SDK/Plugin
- `@fractary/docs` - Documentation SDK/Plugin
- `@fractary/file` - File storage SDK/Plugin
- `@fractary/codex` - Knowledge management SDK/Plugin

## Detailed Scope

### SDK Refactoring

**Workflow Module (FaberWorkflow class):**
| Current | Target | Status |
|---------|--------|--------|
| `workflow.run()` | `workflow.run()` | ✅ Already correct |
| `workflow.getStatus()` | `workflow.status.get()` | 🔄 Rename |
| `workflow.pause()` | `workflow.pause()` | ✅ Already correct |
| `workflow.resume()` | `workflow.resume()` | ✅ Already correct |

**State Module (StateManager class):**
| Current | Target |
|---------|--------|
| `createWorkflow()` | `workflow.create()` |
| `saveWorkflow()` | `workflow.save()` |
| `getWorkflow()` | `workflow.get()` |
| `getActiveWorkflow()` | `workflow.getActive()` |
| `listWorkflows()` | `workflow.list()` |
| `deleteWorkflow()` | `workflow.delete()` |
| `pauseWorkflow()` | `workflow.pause()` |
| `resumeWorkflow()` | `workflow.resume()` |
| `recoverWorkflow()` | `workflow.recover()` |
| `updatePhase()` | `phase.update()` |
| `startPhase()` | `phase.start()` |
| `completePhase()` | `phase.complete()` |
| `failPhase()` | `phase.fail()` |
| `skipPhase()` | `phase.skip()` |
| `createCheckpoint()` | `checkpoint.create()` |
| `getCheckpoint()` | `checkpoint.get()` |
| `listCheckpoints()` | `checkpoint.list()` |
| `getLatestCheckpoint()` | `checkpoint.getLatest()` |
| `createManifest()` | `manifest.create()` |
| `saveManifest()` | `manifest.save()` |
| `getManifest()` | `manifest.get()` |
| `addPhaseToManifest()` | `manifest.addPhase()` |
| `addArtifactToManifest()` | `manifest.addArtifact()` |
| `completeManifest()` | `manifest.complete()` |
| `cleanup()` | `cleanup()` | ✅ Already correct |

**Total SDK Changes:** ~25 renames in State module, ~1 in Workflow module

### CLI Refactoring

**Workflow Commands (all need rename):**
| Current | Target |
|---------|--------|
| `init` | `workflow-init` |
| `run` | `workflow-run` |
| `status` | `workflow-status` |
| `pause` | `workflow-pause` |
| `resume` | `workflow-resume` |
| `recover` | `workflow-recover` |
| `cleanup` | `workflow-cleanup` |

**CLI Structure Decision:** Keep domain groups (e.g., `faber workflow-run`) for organization.

**Total CLI Changes:** 7 renames

### MCP Server Refactoring

**Existing Tools (rename):**
| Current | Target |
|---------|--------|
| `fractary_faber_events_consolidate` | `fractary_faber_event_consolidate` |

**Tools Already Correct:**
- `fractary_faber_workflow_run` ✅
- `fractary_faber_workflow_status` ✅
- `fractary_faber_workflow_pause` ✅
- `fractary_faber_workflow_resume` ✅
- `fractary_faber_workflow_recover` ✅
- `fractary_faber_workflow_cleanup` ✅
- `fractary_faber_event_emit` ✅
- `fractary_faber_run_get` ✅
- `fractary_faber_run_list` ✅

**Total MCP Changes:** 1 rename

### Plugin Refactoring

**fractary-faber (8 renames):**
| Current | Target |
|---------|--------|
| `fractary-faber:init` | `fractary-faber:workflow-init` |
| `fractary-faber:run` | `fractary-faber:workflow-run` |
| `fractary-faber:plan` | `fractary-faber:workflow-plan` |
| `fractary-faber:execute` | `fractary-faber:workflow-execute` |
| `fractary-faber:execute-deterministic` | `fractary-faber:workflow-execute-deterministic` |
| `fractary-faber:archive` | `fractary-faber:workflow-archive` |
| `fractary-faber:review` | `fractary-faber:workflow-review` |
| `fractary-faber:build` | `fractary-faber:workflow-build` |

**fractary-faber-cloud (13 renames):**
| Current | Target |
|---------|--------|
| `fractary-faber-cloud:init` | `fractary-faber-cloud:cloud-init` |
| `fractary-faber-cloud:director` | `fractary-faber-cloud:cloud-direct` |
| `fractary-faber-cloud:manage` | `fractary-faber-cloud:cloud-manage` |
| `fractary-faber-cloud:architect` | `fractary-faber-cloud:cloud-architect` |
| `fractary-faber-cloud:engineer` | `fractary-faber-cloud:cloud-engineer` |
| `fractary-faber-cloud:adopt` | `fractary-faber-cloud:cloud-adopt` |
| `fractary-faber-cloud:test` | `fractary-faber-cloud:cloud-test` |
| `fractary-faber-cloud:audit` | `fractary-faber-cloud:cloud-audit` |
| `fractary-faber-cloud:teardown` | `fractary-faber-cloud:cloud-teardown` |
| `fractary-faber-cloud:validate` | `fractary-faber-cloud:cloud-validate` |
| `fractary-faber-cloud:debug` | `fractary-faber-cloud:cloud-debug` |
| `fractary-faber-cloud:status` | `fractary-faber-cloud:cloud-status` |
| `fractary-faber-cloud:list` | `fractary-faber-cloud:cloud-list` |

**fractary-faber-cloud (already correct):**
- `fractary-faber-cloud:deploy-plan` ✅
- `fractary-faber-cloud:deploy-apply` ✅

**fractary-faber-article (already correct - no changes):**
- `fractary-faber-article:content-new` ✅
- `fractary-faber-article:content-ideate` ✅
- `fractary-faber-article:content-research` ✅
- `fractary-faber-article:content-draft` ✅
- `fractary-faber-article:content-edit` ✅
- `fractary-faber-article:content-seo` ✅
- `fractary-faber-article:content-image` ✅
- `fractary-faber-article:content-publish` ✅
- `fractary-faber-article:content-status` ✅

**Total Plugin Changes:** 21 renames (8 faber + 13 cloud + 0 article)

## Implementation Plan

### Single Issue Approach

All 4 phases will be implemented in this single issue with one PR.

### Phase 1: SDK Refactoring

**Files to modify:**
- `/sdk/js/src/state/manager.ts`
- `/sdk/js/src/workflow/faber.ts`

**Implementation approach:**
1. Create noun-grouped sub-objects on StateManager
2. Keep FaberWorkflow mostly unchanged (already aligned)
3. Add one rename for `getStatus()` → `status.get()`
4. Create backwards compatibility layer with deprecation warnings
5. Update tests

**Backwards compatibility example:**
```typescript
class StateManager {
  // New noun-first structure
  workflow = {
    create: (workId) => this._createWorkflow(workId),
    save: (state) => this._saveWorkflow(state),
    get: (workflowId) => this._getWorkflow(workflowId),
    // ...
  };

  phase = {
    update: (...args) => this._updatePhase(...args),
    start: (...args) => this._startPhase(...args),
    // ...
  };

  checkpoint = {
    create: (...args) => this._createCheckpoint(...args),
    get: (...args) => this._getCheckpoint(...args),
    // ...
  };

  manifest = {
    create: (...args) => this._createManifest(...args),
    save: (...args) => this._saveManifest(...args),
    // ...
  };

  // Old methods (deprecated)
  /** @deprecated Use state.workflow.create() instead */
  createWorkflow(workId) {
    console.warn('DEPRECATED: createWorkflow() → workflow.create()');
    return this.workflow.create(workId);
  }
}
```

### Phase 2: CLI Refactoring

**Files to modify:**
- `/cli/src/index.ts`
- `/cli/src/commands/workflow/index.ts`

**Implementation approach:**
1. Rename 7 workflow commands to `workflow-{verb}` pattern
2. Create aliases for old command names
3. Add deprecation warnings when old names used

### Phase 3: MCP Server Refactoring

**Files to modify:**
- `/mcp/server/src/tools/events.ts`

**Implementation approach:**
1. Rename `events_consolidate` to `event_consolidate`
2. Keep legacy name as alias with deprecation warning

### Phase 4: Plugin Refactoring

**Files to modify:**
- `/plugins/faber/commands/*.md` (rename 8 files)
- `/plugins/faber/.claude-plugin/plugin.json`
- `/plugins/faber-cloud/commands/*.md` (rename 13 files)
- `/plugins/faber-cloud/.claude-plugin/plugin.json`

**Implementation approach:**
1. Rename command files to noun-verb pattern
2. Update frontmatter `name:` fields
3. Update plugin.json command references

## Migration Strategy

### Version Strategy

**No major version bumps** - use minor versions with deprecation warnings only:
- SDK: v1.x.y → v1.x+1.0 (minor bump)
- CLI: v1.x.y → v1.x+1.0 (minor bump)
- MCP: v1.x.y → v1.x+1.0 (minor bump)
- Plugins: Minor version bumps

### Deprecation Timeline

**Phase 1 (Months 1-3): Soft Deprecation**
- New naming available in all interfaces
- Old naming still works with deprecation warnings
- Documentation updated to show new syntax

**Phase 2 (Months 4-6): Hard Deprecation**
- Deprecation warnings become more prominent
- Old naming marked as "will be removed"

**Phase 3 (Month 7+): Consider Removal**
- Evaluate if safe to remove based on usage
- Old naming may persist longer if heavily used

## Acceptance Criteria

### Functionality
- [ ] All SDK State module methods reorganized to noun-first grouping
- [ ] Workflow module `getStatus()` renamed to `status.get()`
- [ ] All CLI workflow commands renamed to `workflow-{verb}` pattern
- [ ] MCP `events_consolidate` renamed to `event_consolidate`
- [ ] All Plugin commands renamed with noun prefix
- [ ] Backwards compatibility layer working for all renamed items
- [ ] Deprecation warnings displayed when old names used

### Testing
- [ ] All existing tests pass with new naming
- [ ] Compatibility layer tests added
- [ ] Deprecation warning tests added

### Documentation
- [ ] SDK README updated with new method names
- [ ] CLI help text updated
- [ ] Plugin command documentation updated
- [ ] Migration notes added to changelog

### User Experience
- [ ] Old command/method names still work during transition
- [ ] Clear deprecation messages guide users to new names
- [ ] Help text shows new command syntax

## Statistics Summary

| Interface | Renames | Already Correct |
|-----------|---------|-----------------|
| SDK (State) | 25 | 1 |
| SDK (Workflow) | 1 | 3 |
| CLI | 7 | 0 |
| MCP | 1 | 9 |
| Plugin (faber) | 8 | 0 |
| Plugin (cloud) | 13 | 2 |
| Plugin (article) | 0 | 9 |
| **Total** | **55** | **24** |

## Risks and Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Breaking existing integrations | Medium | Backwards compatibility layer, deprecation-only (no major version) |
| User confusion during transition | Low | Clear deprecation warnings with upgrade path |
| Incomplete consistency with core plugins | Low | Document that core plugins are separate concern |

## Dependencies

- No external dependencies
- No blocking dependencies on other issues
- Core plugin alignment is out of scope (separate issues in fractary/core)

## Follow-up Work

After this issue is complete, create separate issues in `fractary/core` for:
- [ ] `@fractary/work` command alignment
- [ ] `@fractary/repo` command alignment
- [ ] `@fractary/logs` command alignment
- [ ] `@fractary/spec` command alignment
- [ ] `@fractary/docs` command alignment
- [ ] `@fractary/file` command alignment
- [ ] `@fractary/codex` command alignment

## Changelog

| Date | Version | Changes |
|------|---------|---------|
| 2025-12-17 | 1.0.0 | Initial specification created from audit |
| 2025-12-17 | 1.1.0 | Refined scope to FABER-only (exclude core plugins), keep domain groups in CLI, use minor version bumps |
