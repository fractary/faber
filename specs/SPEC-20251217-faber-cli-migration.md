# SPEC-20251217: Faber CLI Migration

| Field | Value |
|-------|-------|
| **Status** | Refined |
| **Created** | 2025-12-17 |
| **Author** | Claude (with human direction) |
| **Related** | SPEC-00026-distributed-plugin-architecture |
| **Source** | Conversation context |
| **Template** | infrastructure |

## 1. Executive Summary

Migrate ALL faber-related CLI commands from the centralized `fractary/cli` repository to the `fractary/faber` repository, following SPEC-00026's distributed plugin architecture. This creates a new separate CLI package `@fractary/faber-cli` with binary `fractary-faber`.

### 1.1 Scope

This specification covers:
- Migration of 90+ CLI commands from fractary/cli to fractary/faber
- Creation of new `/cli/` package at repository root level
- Proper package naming per SPEC-00026 (`@fractary/faber-cli`)
- Binary naming convention (`fractary-faber`)
- Deprecation of existing SDK-bundled CLI

### 1.2 Design Goals

1. **SPEC-00026 Compliance** - Align with distributed plugin architecture
2. **Separation of Concerns** - CLI as separate package from SDK
3. **Universal Naming** - `fractary-faber` binary following `fractary-{domain}` convention
4. **Complete Migration** - All 90+ commands migrated with full functionality
5. **Clean Deprecation** - Existing CLI removed from SDK package

## 2. Background & Motivation

### 2.1 Current State

**Source: fractary/cli**
- Location: `/mnt/c/GitHub/fractary/cli/src/tools/faber/`
- Contains 90+ faber-related CLI commands
- Framework: Commander.js with factory functions
- SDK Integration: Via getters (`getWorkflow()`, `getWorkManager()`, etc.)

**Destination: fractary/faber**
- Current CLI location: `sdk/js/src/cli/` (bundled with SDK)
- Package: `@fractary/faber` with binary `fractary`
- This violates SPEC-00026 architecture

### 2.2 Problems with Current Architecture

1. **CLI bundled with SDK** - Users installing SDK get CLI dependencies unnecessarily
2. **Wrong binary name** - `fractary` instead of `fractary-faber`
3. **Wrong location** - CLI in `sdk/js/src/cli/` instead of root `/cli/`
4. **Centralized CLI** - Commands in fractary/cli instead of domain repository

### 2.3 Target Architecture (per SPEC-00026)

```
fractary/faber/
├── package.json           (workspaces: ["sdk/js", "cli"])
├── cli/                   (@fractary/faber-cli, binary: "fractary-faber")
│   ├── src/
│   │   ├── index.ts      (main entry with shebang)
│   │   └── commands/     (migrated from fractary/cli)
│   │       ├── workflow/
│   │       ├── work/
│   │       ├── repo/
│   │       ├── spec/
│   │       └── logs/
│   └── package.json
└── sdk/js/                (@fractary/faber - NO cli/ subdirectory)
```

## 3. Commands to Migrate

### 3.1 Workflow Commands (7)

| Command | Description |
|---------|-------------|
| `run` | Run FABER workflow |
| `status` | Show workflow status |
| `resume` | Resume a paused workflow |
| `pause` | Pause a running workflow |
| `recover` | Recover workflow from checkpoint |
| `cleanup` | Clean up old workflow states |
| `init` | Initialize FABER configuration |

### 3.2 Work Commands (23)

**Issue Operations:**
- `issue create`, `issue fetch`, `issue update`, `issue close`, `issue reopen`
- `issue assign`, `issue classify`, `issue search`

**Comment Operations:**
- `comment create`, `comment list`

**Label Operations:**
- `label add`, `label remove`, `label list`

**Milestone Operations:**
- `milestone create`, `milestone list`, `milestone set`

**Initialization:**
- `init`

### 3.3 Repo Commands (30+)

**Branch Operations:**
- `branch create`, `branch delete`, `branch list`

**Commit Operations:**
- `commit`

**Pull Request Operations:**
- `pr create`, `pr list`, `pr merge`, `pr review`

**Tag Operations:**
- `tag create`, `tag push`, `tag list`

**Worktree Operations:**
- `worktree create`, `worktree list`, `worktree remove`, `worktree cleanup`

**Repository Operations:**
- `push`, `pull`, `status`

### 3.4 Spec Commands (8)

- `create`, `get`, `list`, `update`, `validate`, `refine`, `delete`, `templates`

### 3.5 Logs Commands (8)

- `capture`, `stop`, `write`, `read`, `search`, `list`, `archive`, `delete`

## 4. Implementation Plan

### 4.0 Phase 0: Verify SDK Exports (Pre-requisite)

**Before starting migration, verify SDK exports:**

Check that `@fractary/faber` exposes required managers:
- [ ] `WorkManager` from `@fractary/faber/work`
- [ ] `RepoManager` from `@fractary/faber/repo`
- [ ] `SpecManager` from `@fractary/faber/spec`
- [ ] `LogsManager` from `@fractary/faber/logs`
- [ ] `FaberWorkflow` from `@fractary/faber/workflow`
- [ ] `StateManager` from `@fractary/faber/state`

**If exports are missing:**
1. Add missing exports to SDK package
2. Ensure managers are properly exported in `sdk/js/src/index.ts`
3. Verify subpath exports work in `package.json` exports field

### 4.1 Phase 1: Create CLI Package Structure

**Create Directory Structure:**
```
/cli/
├── src/
│   ├── index.ts
│   ├── commands/
│   │   ├── workflow/index.ts
│   │   ├── work/index.ts
│   │   ├── repo/index.ts
│   │   ├── spec/index.ts
│   │   └── logs/index.ts
│   └── utils/
│       ├── errors.ts
│       └── output.ts
├── package.json
├── tsconfig.json
└── README.md
```

**Files to Create:**
1. `/cli/package.json` - Define `@fractary/faber-cli`
2. `/cli/tsconfig.json` - TypeScript configuration
3. `/cli/src/index.ts` - Main CLI entry point

### 4.2 Phase 2: Migrate Command Files

**Source Files:**
```
/mnt/c/GitHub/fractary/cli/src/tools/faber/
├── index.ts                    → /cli/src/index.ts (adapt)
├── commands/
│   ├── workflow/index.ts       → /cli/src/commands/workflow/index.ts
│   ├── work/index.ts           → /cli/src/commands/work/index.ts
│   ├── repo/index.ts           → /cli/src/commands/repo/index.ts
│   ├── spec/index.ts           → /cli/src/commands/spec/index.ts
│   └── logs/index.ts           → /cli/src/commands/logs/index.ts
```

**Key Adaptations Required:**
1. Change SDK imports from getters to direct imports:
   ```typescript
   // Before (fractary/cli)
   import { getWorkflow, getWorkManager } from '../../../../sdk';

   // After (fractary/faber/cli)
   import { FaberWorkflow, WorkManager } from '@fractary/faber';
   ```

2. Update command registration for new structure
3. Update help text to reference `fractary-faber` binary

### 4.3 Phase 3: Update Package Configuration

**Root package.json:**
```json
{
  "workspaces": [
    "sdk/js",
    "cli"
  ],
  "scripts": {
    "build:cli": "npm run build -w cli",
    "test:cli": "npm run test -w cli"
  }
}
```

**CLI package.json:**
```json
{
  "name": "@fractary/faber-cli",
  "version": "1.0.0",
  "bin": {
    "fractary-faber": "dist/index.js"
  },
  "dependencies": {
    "@fractary/faber": "^1.2.0",
    "commander": "^12.0.0",
    "chalk": "^5.0.0"
  }
}
```

### 4.4 Phase 4: Remove Existing SDK CLI

**Actions:**
1. **Delete existing CLI entirely:** Remove `sdk/js/src/cli/` directory completely
   - Includes: work.ts, repo.ts, spec.ts, logs.ts, workflow.ts, index.ts
   - Rationale: fractary/cli commands are the source of truth
2. Remove `bin` field from `sdk/js/package.json`
3. Update SDK version to 2.0.0 (major version for breaking change)
4. Add deprecation notice to SDK README pointing to `@fractary/faber-cli`

**Out of Scope:**
- Cleanup of faber commands in fractary/cli (handled separately)

### 4.5 Phase 5: Testing

**Verification Steps:**
1. `fractary-faber --help` works
2. `fractary-faber --version` shows correct version
3. Key commands work (e.g., `fractary-faber work issue fetch 1`)
4. `--json` flag works on all commands
5. Error handling works correctly

### 4.6 Phase 6: Documentation

**Files to Create/Update:**
1. `/cli/README.md` - CLI usage and installation
2. Root `/README.md` - Point to new CLI package

### 4.7 Phase 7: Final Cleanup

**Actions:**
1. Verify all 90+ commands migrated
2. Test build process (`npm run build:cli`)
3. Update CHANGELOG

## 5. Command Mapping

All commands change from `fractary faber/work/repo/spec/logs` to `fractary-faber`:

| Old Command | New Command |
|-------------|-------------|
| `fractary faber run --work-id 123` | `fractary-faber run --work-id 123` |
| `fractary work issue fetch 45` | `fractary-faber work issue fetch 45` |
| `fractary repo branch create feat/new` | `fractary-faber repo branch create feat/new` |
| `fractary spec create "My Spec"` | `fractary-faber spec create "My Spec"` |
| `fractary logs capture 123` | `fractary-faber logs capture 123` |

## 6. Dependencies

### 6.1 CLI Package Dependencies

**Runtime:**
- `@fractary/faber`: ^1.2.0 (SDK)
- `commander`: ^12.0.0 (CLI framework)
- `chalk`: ^5.0.0 (Console colors)

**Dev:**
- `typescript`: ^5.x
- `@types/node`: ^20.x

### 6.2 SDK Exports Required

The CLI will import from `@fractary/faber`:
- `WorkManager` from `@fractary/faber/work`
- `RepoManager` from `@fractary/faber/repo`
- `SpecManager` from `@fractary/faber/spec`
- `LogsManager` from `@fractary/faber/logs`
- `FaberWorkflow` from `@fractary/faber/workflow`
- `StateManager` from `@fractary/faber/state`

## 7. Success Criteria

- [ ] New `/cli/` directory created at root level
- [ ] Package name is `@fractary/faber-cli`
- [ ] Binary name is `fractary-faber`
- [ ] All 90+ commands migrated and functional
- [ ] `--json` output support for all commands
- [ ] Existing SDK CLI removed
- [ ] SDK version bumped to 2.0.0
- [ ] Root package.json updated with CLI workspace
- [ ] Documentation updated

## 8. Risks and Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Breaking changes for existing users | High | Clear deprecation notice, migration guide |
| SDK API changes needed | Medium | Review SDK exports before migration |
| Command behavior differences | Medium | Test each command against fractary/cli |
| Build process complexity | Low | Clear build scripts, CI/CD updates |

## 9. Future Considerations

1. **NPM Publishing** - Publish `@fractary/faber-cli` to npm
2. **Auto-update** - Notify users of new CLI version
3. **Completion Scripts** - Add bash/zsh completion support
4. **Plugin System** - Allow CLI extensions

## 10. References

- [SPEC-00026: Distributed Plugin Architecture](./SPEC-00026-distributed-plugin-architecture.md)
- [Source: fractary/cli faber commands](/mnt/c/GitHub/fractary/cli/src/tools/faber/)
- [Plan file](/home/jmcwilliam/.claude/plans/rosy-stargazing-hare.md)

---

## Changelog

### 2025-12-17 - Refinement Round 1

**Questions Resolved:**

1. **SDK Exports Verification**: Verify exports exist first before migration
   - Added Phase 0 pre-requisite to check all required SDK exports

2. **Existing CLI Handling**: Delete entirely
   - Clarified that `sdk/js/src/cli/` should be completely removed (not archived)
   - fractary/cli commands are the source of truth

3. **Cleanup Scope**: Out of scope
   - Clarified that removing faber commands from fractary/cli is handled separately
   - Added explicit "Out of Scope" note
