# Implementation Plan: Align Command Naming Across Interfaces

**Issue**: #20 - Align command naming across SDK, CLI, MCP, and Plugin interfaces
**Spec**: `specs/WORK-00020-align-command-naming-across-interfaces.md`
**Branch**: `feat/20-align-command-naming-across-sdk-cli-mcp-and-plugin`
**Approach**: Single PR implementing all 4 phases with backwards compatibility

---

## Executive Summary

This plan implements consistent noun-first, verb-second naming across all FABER interfaces:
- **SDK**: 26 method reorganizations (25 StateManager + 1 FaberWorkflow)
- **CLI**: 7 command renames
- **MCP**: 1 tool rename
- **Plugins**: 21 command renames (8 faber + 13 cloud)

All changes maintain backwards compatibility through aliases and deprecation warnings. No major version bumps required.

---

## Phase 1: SDK Refactoring

### 1.1 StateManager Reorganization

**File**: `/sdk/js/src/state/manager.ts`

**Current Structure**: Flat methods like `createWorkflow()`, `saveWorkflow()`, `updatePhase()`

**Target Structure**: Noun-first grouping:
```typescript
class StateManager {
  workflow = { create, save, get, getActive, list, delete, pause, resume, recover }
  phase = { update, start, complete, fail, skip }
  checkpoint = { create, get, list, getLatest }
  manifest = { create, save, get, addPhase, addArtifact, complete }
  cleanup() // stays as-is
}
```

**Implementation Steps**:

1. **Rename current public methods to private** (prefix with `_`):
   - `createWorkflow` → `_createWorkflow`
   - `saveWorkflow` → `_saveWorkflow`
   - ... (all 25 methods)

2. **Create noun-grouped sub-objects**:
   ```typescript
   // Workflow operations (9 methods)
   public readonly workflow = {
     create: (workId: string) => this._createWorkflow(workId),
     save: (state: WorkflowState) => this._saveWorkflow(state),
     get: (workflowId: string) => this._getWorkflow(workflowId),
     getActive: (workId: string) => this._getActiveWorkflow(workId),
     list: (options?: StateQueryOptions) => this._listWorkflows(options),
     delete: (workflowId: string) => this._deleteWorkflow(workflowId),
     pause: (workflowId: string) => this._pauseWorkflow(workflowId),
     resume: (workflowId: string) => this._resumeWorkflow(workflowId),
     recover: (workflowId: string) => this._recoverWorkflow(workflowId),
   };

   // Phase operations (5 methods)
   public readonly phase = {
     update: (workflowId: string, phase: FaberPhase, updates: Partial<PhaseState>, options?: { skipHistory?: boolean }) =>
       this._updatePhase(workflowId, phase, updates, options),
     start: (workflowId: string, phase: FaberPhase) => this._startPhase(workflowId, phase),
     complete: (workflowId: string, phase: FaberPhase, outputs?: Record<string, unknown>) =>
       this._completePhase(workflowId, phase, outputs),
     fail: (workflowId: string, phase: FaberPhase, error: string) => this._failPhase(workflowId, phase, error),
     skip: (workflowId: string, phase: FaberPhase, reason?: string) => this._skipPhase(workflowId, phase, reason),
   };

   // Checkpoint operations (4 methods)
   public readonly checkpoint = {
     create: (workflowId: string, phase: FaberPhase, step: string, data: Record<string, unknown>) =>
       this._createCheckpoint(workflowId, phase, step, data),
     get: (checkpointId: string) => this._getCheckpoint(checkpointId),
     list: (workflowId: string) => this._listCheckpoints(workflowId),
     getLatest: (workflowId: string) => this._getLatestCheckpoint(workflowId),
   };

   // Manifest operations (6 methods)
   public readonly manifest = {
     create: (workflowId: string, workId: string) => this._createManifest(workflowId, workId),
     save: (manifest: RunManifest) => this._saveManifest(manifest),
     get: (manifestId: string) => this._getManifest(manifestId),
     addPhase: (manifestId: string, phase: FaberPhase) => this._addPhaseToManifest(manifestId, phase),
     addArtifact: (manifestId: string, artifact: ArtifactManifest) => this._addArtifactToManifest(manifestId, artifact),
     complete: (manifestId: string) => this._completeManifest(manifestId),
   };
   ```

3. **Add deprecated public methods** (backwards compatibility):
   ```typescript
   /** @deprecated Use state.workflow.create() instead. Will be removed in v2.0 */
   public createWorkflow(workId: string): WorkflowState {
     console.warn('DEPRECATED: StateManager.createWorkflow() is deprecated. Use state.workflow.create() instead.');
     return this.workflow.create(workId);
   }

   /** @deprecated Use state.workflow.save() instead. Will be removed in v2.0 */
   public saveWorkflow(state: WorkflowState): void {
     console.warn('DEPRECATED: StateManager.saveWorkflow() is deprecated. Use state.workflow.save() instead.');
     return this.workflow.save(state);
   }

   // ... repeat for all 25 methods
   ```

4. **Update internal FaberWorkflow usage** (in `/sdk/js/src/workflow/faber.ts`):
   - Line 160-163: `this.state.createWorkflow()` → `this.state.workflow.create()`
   - Line 170: `this.state.createManifest()` → `this.state.manifest.create()`
   - Line 204, 224: Phase methods → `this.state.phase.start()`, etc.
   - Line 238-239: `this.state.completePhase()` → `this.state.phase.complete()`
   - Line 242: `this.state.failPhase()` → `this.state.phase.fail()`
   - Search for ALL uses and update

5. **Export type updates** (if needed):
   - Ensure `StateManager` type exports include the new sub-object signatures
   - Update JSDoc comments to reference new methods

**Files to Modify**:
- `/sdk/js/src/state/manager.ts` - Main refactoring (lines 67-587)
- `/sdk/js/src/workflow/faber.ts` - Update all StateManager calls
- `/sdk/js/src/state/index.ts` - Verify exports
- `/sdk/js/src/index.ts` - Verify main exports

**Testing**:
- Update existing StateManager tests to use new grouping
- Add backwards compatibility tests (verify old methods still work)
- Add deprecation warning tests (verify console.warn is called)
- Ensure all FaberWorkflow tests still pass

---

### 1.2 FaberWorkflow Refactoring

**File**: `/sdk/js/src/workflow/faber.ts`

**Current**: `workflow.getStatus(workflowId)` (line 813-833)

**Target**: `workflow.status.get(workflowId)`

**Implementation Steps**:

1. **Create status sub-object**:
   ```typescript
   public readonly status = {
     get: (workflowId: string) => {
       const state = this.state.workflow.get(workflowId);
       if (!state) {
         return { state: null, currentPhase: 'unknown', progress: 0 };
       }
       // ... existing logic from getStatus()
     }
   };
   ```

2. **Add deprecated method**:
   ```typescript
   /** @deprecated Use workflow.status.get() instead. Will be removed in v2.0 */
   public getStatus(workflowId: string) {
     console.warn('DEPRECATED: FaberWorkflow.getStatus() is deprecated. Use workflow.status.get() instead.');
     return this.status.get(workflowId);
   }
   ```

**Files to Modify**:
- `/sdk/js/src/workflow/faber.ts` - Lines 813-833

**Testing**:
- Update tests to use `workflow.status.get()`
- Add backwards compatibility test for `getStatus()`

---

## Phase 2: CLI Refactoring

### 2.1 Command Renaming

**Files**: `/cli/src/index.ts` and `/cli/src/commands/workflow/*.ts`

**Renames Required** (7 commands):
| Old Command | New Command | File |
|-------------|-------------|------|
| `init` | `workflow-init` | `commands/workflow/init.ts` |
| `run` | `workflow-run` | `commands/workflow/run.ts` |
| `status` | `workflow-status` | `commands/workflow/status.ts` |
| `pause` | `workflow-pause` | `commands/workflow/pause.ts` |
| `resume` | `workflow-resume` | `commands/workflow/resume.ts` |
| `recover` | `workflow-recover` | `commands/workflow/recover.ts` |
| `cleanup` | `workflow-cleanup` | `commands/workflow/cleanup.ts` |

**Implementation Steps**:

1. **Update command factory functions** (in each command file):
   ```typescript
   // Example: /cli/src/commands/workflow/run.ts
   export function createRunCommand(): Command {
     const command = new Command('workflow-run')  // Changed from 'run'
       .description('Run a FABER workflow')
       .option('--work-id <id>', 'Work item ID')
       .option('--autonomy <level>', 'Autonomy level')
       .option('--json', 'Output in JSON format')
       .action(async (options) => {
         // ... existing implementation
       });
     return command;
   }
   ```

2. **Create alias commands with deprecation** (in `/cli/src/index.ts`):
   ```typescript
   import chalk from 'chalk';

   // New commands
   program.addCommand(createInitCommand());  // now creates 'workflow-init'
   program.addCommand(createRunCommand());    // now creates 'workflow-run'
   // ... etc

   // Deprecated aliases
   program
     .command('init')
     .description('(DEPRECATED: Use workflow-init)')
     .action(() => {
       console.warn(chalk.yellow('\n⚠️  DEPRECATED: "init" → use "workflow-init"\n'));
       program.parse(['node', 'faber', 'workflow-init', ...process.argv.slice(3)]);
     });

   program
     .command('run')
     .description('(DEPRECATED: Use workflow-run)')
     .action(() => {
       console.warn(chalk.yellow('\n⚠️  DEPRECATED: "run" → use "workflow-run"\n'));
       program.parse(['node', 'faber', 'workflow-run', ...process.argv.slice(3)]);
     });

   // ... repeat for all 7 commands
   ```

3. **Update help text and README**:
   - Update `/cli/README.md` with new command names
   - Update command descriptions to emphasize new names

**Files to Modify**:
- `/cli/src/commands/workflow/init.ts` - Change command name
- `/cli/src/commands/workflow/run.ts` - Change command name
- `/cli/src/commands/workflow/status.ts` - Change command name
- `/cli/src/commands/workflow/pause.ts` - Change command name
- `/cli/src/commands/workflow/resume.ts` - Change command name
- `/cli/src/commands/workflow/recover.ts` - Change command name
- `/cli/src/commands/workflow/cleanup.ts` - Change command name
- `/cli/src/index.ts` - Add deprecated aliases
- `/cli/README.md` - Update documentation

**Testing**:
- Test new command names work: `faber workflow-run --work-id 123`
- Test old command names show deprecation: `faber run --work-id 123`
- Verify help text shows new commands

---

## Phase 3: MCP Server Refactoring

### 3.1 Event Tool Rename

**File**: `/mcp/server/src/tools/events.ts`

**Current**: `fractary_faber_events_consolidate` (line 201)

**Target**: `fractary_faber_event_consolidate`

**Implementation Steps**:

1. **Create new tool with correct name**:
   ```typescript
   // In createEventTools() function, line 201:
   {
     name: 'fractary_faber_event_consolidate',  // Changed from 'events_consolidate'
     description: 'Consolidate run events to JSONL format',
     inputSchema: {
       type: 'object',
       properties: {
         run_id: {
           type: 'string',
           description: 'Run ID to consolidate events for',
         },
       },
       required: ['run_id'],
     },
     handler: async (params) => {
       const { run_id } = params as { run_id: string };
       const result = await backend.consolidateEvents(run_id);
       return {
         content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
       };
     },
   }
   ```

2. **Add deprecated alias** (optional, for backwards compatibility):
   ```typescript
   // Add after the new tool definition
   {
     name: 'fractary_faber_events_consolidate',  // Old name
     description: '(DEPRECATED: Use fractary_faber_event_consolidate) Consolidate run events to JSONL format',
     inputSchema: {
       type: 'object',
       properties: {
         run_id: {
           type: 'string',
           description: 'Run ID to consolidate events for',
         },
       },
       required: ['run_id'],
     },
     handler: async (params) => {
       console.warn('DEPRECATED: fractary_faber_events_consolidate → use fractary_faber_event_consolidate');
       const { run_id } = params as { run_id: string };
       const result = await backend.consolidateEvents(run_id);
       return {
         content: [
           {
             type: 'text',
             text: '⚠️  DEPRECATED: This tool will be removed. Use fractary_faber_event_consolidate instead.\n\n' +
                   JSON.stringify(result, null, 2)
           }
         ],
       };
     },
   }
   ```

**Files to Modify**:
- `/mcp/server/src/tools/events.ts` - Line 201 and add alias

**Testing**:
- Test new tool name works
- Test old tool name shows deprecation (if alias added)
- Verify MCP server tool listing includes new name

---

## Phase 4: Plugin Refactoring

### 4.1 fractary-faber Plugin (8 renames)

**Base Path**: `/plugins/faber/`

**Renames Required**:
| Old File | New File | Old Name | New Name |
|----------|----------|----------|----------|
| `init.md` | `workflow-init.md` | `fractary-faber:init` | `fractary-faber:workflow-init` |
| `run.md` | `workflow-run.md` | `fractary-faber:run` | `fractary-faber:workflow-run` |
| `plan.md` | `workflow-plan.md` | `fractary-faber:plan` | `fractary-faber:workflow-plan` |
| `execute.md` | `workflow-execute.md` | `fractary-faber:execute` | `fractary-faber:workflow-execute` |
| `execute-deterministic.md` | `workflow-execute-deterministic.md` | `fractary-faber:execute-deterministic` | `fractary-faber:workflow-execute-deterministic` |
| `archive.md` | `workflow-archive.md` | `fractary-faber:archive` | `fractary-faber:workflow-archive` |
| `review.md` | `workflow-review.md` | `fractary-faber:review` | `fractary-faber:workflow-review` |
| `build.md` | `workflow-build.md` | `fractary-faber:build` | `fractary-faber:workflow-build` |

**Implementation Steps**:

1. **Rename command files**:
   ```bash
   cd /plugins/faber/commands
   mv init.md workflow-init.md
   mv run.md workflow-run.md
   mv plan.md workflow-plan.md
   mv execute.md workflow-execute.md
   mv execute-deterministic.md workflow-execute-deterministic.md
   mv archive.md workflow-archive.md
   mv review.md workflow-review.md
   mv build.md workflow-build.md
   ```

2. **Update frontmatter in each file**:
   ```yaml
   ---
   name: fractary-faber:workflow-init  # Changed from fractary-faber:init
   description: Initialize a new FABER workflow
   ---
   ```

3. **Fix missing name fields** (audit.md, debugger.md, status.md):
   - Add proper `name:` field to frontmatter
   - Decide if these need workflow- prefix or different naming

4. **Update plugin.json** (if needed):
   - Verify commands directory reference is still correct
   - No changes needed if commands are auto-discovered

**Files to Modify**:
- `/plugins/faber/commands/init.md` → `workflow-init.md`
- `/plugins/faber/commands/run.md` → `workflow-run.md`
- `/plugins/faber/commands/plan.md` → `workflow-plan.md`
- `/plugins/faber/commands/execute.md` → `workflow-execute.md`
- `/plugins/faber/commands/execute-deterministic.md` → `workflow-execute-deterministic.md`
- `/plugins/faber/commands/archive.md` → `workflow-archive.md`
- `/plugins/faber/commands/review.md` → `workflow-review.md`
- `/plugins/faber/commands/build.md` → `workflow-build.md`

---

### 4.2 fractary-faber-cloud Plugin (13 renames)

**Base Path**: `/plugins/faber-cloud/`

**Renames Required**:
| Old File | New File | Old Name | New Name |
|----------|----------|----------|----------|
| `init.md` | `cloud-init.md` | `fractary-faber-cloud:init` | `fractary-faber-cloud:cloud-init` |
| `director.md` | `cloud-direct.md` | `fractary-faber-cloud:director` | `fractary-faber-cloud:cloud-direct` |
| `manage.md` | `cloud-manage.md` | `fractary-faber-cloud:manage` | `fractary-faber-cloud:cloud-manage` |
| `architect.md` | `cloud-architect.md` | `fractary-faber-cloud:architect` | `fractary-faber-cloud:cloud-architect` |
| `engineer.md` | `cloud-engineer.md` | `fractary-faber-cloud:engineer` | `fractary-faber-cloud:cloud-engineer` |
| `adopt.md` | `cloud-adopt.md` | `fractary-faber-cloud:adopt` | `fractary-faber-cloud:cloud-adopt` |
| `test.md` | `cloud-test.md` | `fractary-faber-cloud:test` | `fractary-faber-cloud:cloud-test` |
| `audit.md` | `cloud-audit.md` | `fractary-faber-cloud:audit` | `fractary-faber-cloud:cloud-audit` |
| `teardown.md` | `cloud-teardown.md` | `fractary-faber-cloud:teardown` | `fractary-faber-cloud:cloud-teardown` |
| `validate.md` | `cloud-validate.md` | `fractary-faber-cloud:validate` | `fractary-faber-cloud:cloud-validate` |
| `debug.md` | `cloud-debug.md` | `fractary-faber-cloud:debug` | `fractary-faber-cloud:cloud-debug` |
| `status.md` | `cloud-status.md` | `fractary-faber-cloud:status` | `fractary-faber-cloud:cloud-status` |
| `list.md` | `cloud-list.md` | `fractary-faber-cloud:list` | `fractary-faber-cloud:cloud-list` |

**Already Correct** (no changes):
- `deploy-plan.md` → `fractary-faber-cloud:deploy-plan` ✅
- `deploy-apply.md` → `fractary-faber-cloud:deploy-apply` ✅

**Implementation Steps**:

1. **Rename command files**:
   ```bash
   cd /plugins/faber-cloud/commands
   mv init.md cloud-init.md
   mv director.md cloud-direct.md
   mv manage.md cloud-manage.md
   mv architect.md cloud-architect.md
   mv engineer.md cloud-engineer.md
   mv adopt.md cloud-adopt.md
   mv test.md cloud-test.md
   mv audit.md cloud-audit.md
   mv teardown.md cloud-teardown.md
   mv validate.md cloud-validate.md
   mv debug.md cloud-debug.md
   mv status.md cloud-status.md
   mv list.md cloud-list.md
   ```

2. **Update frontmatter in each file**:
   ```yaml
   ---
   name: fractary-faber-cloud:cloud-init  # Changed from fractary-faber-cloud:init
   description: Initialize cloud infrastructure
   ---
   ```

**Files to Modify**: 13 command files in `/plugins/faber-cloud/commands/`

---

### 4.3 fractary-faber-article Plugin (0 changes)

**Status**: Already correctly named with `content-` prefix ✅

**Files**: No changes needed
- All 9 commands already follow noun-verb pattern: `content-new`, `content-ideate`, etc.

---

## Testing Strategy

### Unit Tests

1. **SDK Tests**:
   - Update all existing StateManager tests to use new grouping
   - Add new test suite: `manager.backwards-compatibility.test.ts`
   - Add deprecation warning tests
   - Update FaberWorkflow tests for status.get()

2. **CLI Tests**:
   - Test new command names work correctly
   - Test old command names trigger deprecation warnings
   - Test help output shows new commands

3. **MCP Tests**:
   - Test new tool name is registered
   - Test tool invocation works correctly
   - Test old tool name shows deprecation (if alias added)

### Integration Tests

1. **End-to-End Workflow**:
   - Run complete workflow using new SDK methods
   - Run CLI commands using new names
   - Verify MCP tools work with new names

2. **Backwards Compatibility**:
   - Run workflows using old SDK method names
   - Run CLI with old command names
   - Verify deprecation warnings appear

### Manual Testing

1. **SDK**: Import and test both old and new method patterns
2. **CLI**: Test commands from terminal with both old and new names
3. **MCP**: Test tool invocation from MCP client
4. **Plugins**: Test command invocation in Claude Code

---

## Version Bumps

All packages get minor version bumps (no major versions):

- `@fractary/faber` (SDK): `1.x.y` → `1.x+1.0`
- `@fractary/faber-cli`: `1.x.y` → `1.x+1.0`
- `@fractary/faber-mcp`: `1.x.y` → `1.x+1.0`
- Plugin `fractary-faber`: `3.1.0` → `3.2.0`
- Plugin `fractary-faber-cloud`: `2.2.1` → `2.3.0`
- Plugin `fractary-faber-article`: No change (already correct)

---

## Documentation Updates

### SDK Documentation
- Update `/sdk/js/README.md` with new method groupings
- Add migration guide section
- Update all code examples

### CLI Documentation
- Update `/cli/README.md` with new command names
- Add deprecation notices for old commands
- Update all examples

### MCP Documentation
- Update `/mcp/server/README.md` with new tool name
- Document the renamed tool

### Plugin Documentation
- Update plugin README files if they exist
- Update command descriptions in .md files

### Changelog
- Add comprehensive changelog entries for all packages
- Document migration path for users

---

## Migration Timeline

### Phase 1 (Months 1-3): Soft Deprecation
- New naming available in all interfaces
- Old naming works with deprecation warnings
- Documentation shows new syntax

### Phase 2 (Months 4-6): Hard Deprecation
- Deprecation warnings become more prominent
- Old naming marked as "will be removed in v2.0"

### Phase 3 (Month 7+): Consider Removal
- Evaluate usage metrics
- Plan for v2.0 with breaking changes (optional)

---

## Implementation Order

1. **SDK First** (Foundation):
   - StateManager refactoring
   - FaberWorkflow refactoring
   - Update all internal usage
   - Update tests
   - Commit: `feat(sdk): reorganize state management to noun-first grouping`

2. **CLI Second** (User-facing):
   - Rename commands
   - Add aliases
   - Update documentation
   - Commit: `feat(cli): rename workflow commands to workflow-{verb} pattern`

3. **MCP Third** (Integration):
   - Rename event tool
   - Add alias
   - Update docs
   - Commit: `feat(mcp): rename events_consolidate to event_consolidate`

4. **Plugins Fourth** (Extensions):
   - Rename faber commands
   - Rename cloud commands
   - Update frontmatter
   - Commit: `feat(plugins): rename commands to noun-verb pattern`

5. **Documentation & Polish**:
   - Update all READMEs
   - Add migration guides
   - Update examples
   - Commit: `docs: update for command alignment changes`

---

## Risk Mitigation

| Risk | Mitigation |
|------|------------|
| Breaking existing integrations | Backwards compatibility layer with deprecation warnings |
| TypeScript type errors | Careful typing of new sub-objects and deprecated methods |
| Test failures | Update tests incrementally, verify at each step |
| User confusion | Clear deprecation messages, comprehensive documentation |
| Plugin discovery issues | Verify command file renaming doesn't break auto-discovery |

---

## Success Criteria

- [ ] All 55 renames completed successfully
- [ ] All existing tests pass
- [ ] New backwards compatibility tests added and passing
- [ ] Deprecation warnings work correctly
- [ ] All documentation updated
- [ ] No breaking changes (old APIs still work)
- [ ] CI/CD pipeline passes
- [ ] Manual testing confirms both old and new APIs work

---

## Estimated Effort

- **SDK Refactoring**: 4-6 hours (complex restructuring)
- **CLI Refactoring**: 2-3 hours (straightforward renames)
- **MCP Refactoring**: 1 hour (single rename)
- **Plugin Refactoring**: 2-3 hours (file renames and frontmatter)
- **Testing**: 3-4 hours (update existing, add new)
- **Documentation**: 2-3 hours (READMEs, examples, migration guide)

**Total**: ~15-20 hours of focused development

---

## Next Steps

1. Review and approve this plan
2. Begin implementation with Phase 1 (SDK)
3. Test each phase before moving to next
4. Create PR with all changes
5. Update issue #20 with completion
