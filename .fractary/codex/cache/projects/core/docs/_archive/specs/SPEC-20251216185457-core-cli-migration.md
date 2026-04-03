---
spec_id: spec-20251216185457-core-cli-migration
issue_number: N/A
issue_url: N/A
title: Core Plugin CLI Migration
type: feature
status: draft
created: 2025-12-16
updated: 2025-12-16
author: Claude
validated: false
---

# Feature Specification: Core Plugin CLI Migration

**Issue**: N/A (Standalone specification)
**Type**: Feature
**Status**: Draft
**Created**: 2025-12-16

## Summary

Migrate core plugin CLI commands from the standalone `fractary/cli` project into `fractary/core/cli/`, creating a new CLI tool (`fractary-core`) focused specifically on core plugin operations (work, repo, spec, logs, file, docs). This migration consolidates the CLI within the core project, removes dependency on `@fractary/faber`, and supports both command-line execution and programmatic SDK access.

**Note**: This specification focuses on CLI migration only. MCP server creation (`@fractary/core-mcp-server`) will be addressed in a separate specification as outlined in SPEC-00026 Section 3.11.

## Related Specifications

- **SPEC-00026: Distributed Plugin Architecture** - Defines the broader architecture this CLI fits into, including:
  - Multi-language SDK support (JavaScript + Python)
  - MCP server architecture per SDK
  - Universal naming convention with `fractary-` prefix
  - Plugin colocation patterns

## User Stories

### Developer CLI Access
**As a** developer
**I want** to run `fractary-core work issue fetch 123` from the command line
**So that** I can interact with work items without switching tools or importing SDKs

**Acceptance Criteria**:
- [ ] `fractary-core` command is globally installable via npm
- [ ] All work, repo, spec, and logs commands from fractary/cli are available
- [ ] JSON output mode (`--json`) is supported for all commands
- [ ] Help text is accessible via `--help` on all commands

### Programmatic SDK Access
**As a** tool developer
**I want** to import CLI command factories programmatically
**So that** I can embed core CLI functionality in custom tools

**Acceptance Criteria**:
- [ ] Command factories are exportable from the package
- [ ] SDK manager factories are available for direct use
- [ ] TypeScript types are exported for type safety

### File and Docs CLI Commands
**As a** developer
**I want** CLI commands for file storage and documentation management
**So that** I can interact with all core plugins from the command line

**Acceptance Criteria**:
- [ ] `fractary-core file upload/download/list/delete` commands exist
- [ ] `fractary-core docs create/get/list/update` commands exist
- [ ] Commands integrate with existing SDK modules

## Functional Requirements

- **FR1**: Migrate all `faber work` commands to `fractary-core work`
- **FR2**: Migrate all `faber repo` commands to `fractary-core repo`
- **FR3**: Migrate all `faber spec` commands to `fractary-core spec`
- **FR4**: Migrate all `faber logs` commands to `fractary-core logs`
- **FR5**: Create new `fractary-core file` commands based on FileManager SDK
- **FR6**: Create new `fractary-core docs` commands based on DocsManager SDK
- **FR7**: Support both CLI binary execution and programmatic import
- **FR8**: Maintain JSON and text output modes for all commands
- **FR9**: Use Commander.js for CLI framework consistency
- **FR10**: Integrate with existing `@fractary/core` SDK modules

## Non-Functional Requirements

- **NFR1**: CLI startup time < 100ms for `--help` commands (lazy loading) (Performance)
- **NFR2**: TypeScript strict mode compliance (Code Quality)
- **NFR3**: 80%+ test coverage for CLI commands (Test Coverage)
- **NFR4**: Node.js 18+ compatibility (Compatibility)
- **NFR5**: Zero high-severity security vulnerabilities (Security)

## Technical Design

### Architecture Changes

The CLI will be added as a new package within the `fractary/core` monorepo:

```
fractary/core/
├── cli/                    # NEW: CLI package
│   ├── src/
│   │   ├── index.ts       # CLI entry point (binary)
│   │   ├── lib.ts         # Library exports
│   │   ├── commands/      # Command implementations
│   │   ├── utils/         # Shared utilities
│   │   └── sdk/           # SDK factory layer
│   ├── package.json
│   └── tsconfig.json
├── sdk/js/                 # Existing SDK (dependency)
└── plugins/                # Existing plugins (reference)
```

The CLI will depend on `@fractary/core` (the existing SDK) rather than `@fractary/faber`.

### Data Model

No database changes. Configuration files migrate from `.fractary/faber/` to `.fractary/core/`:

```
.fractary/
├── faber/           # OLD (deprecated)
│   └── config.json
└── core/            # NEW
    └── config.json
```

### API Design

CLI commands follow the pattern: `fractary-core <plugin> <subcommand> [options]`

**Work Commands**:
- `GET fractary-core work issue fetch <number>`: Fetch issue details
- `POST fractary-core work issue create --title <title>`: Create new issue
- `PUT fractary-core work issue update <number>`: Update issue
- `PUT fractary-core work issue close <number>`: Close issue
- `PUT fractary-core work issue reopen <number>`: Reopen issue
- `PUT fractary-core work issue assign <number> <user>`: Assign issue
- `GET fractary-core work issue classify <number>`: Classify work type
- `GET fractary-core work issue search`: Search issues
- `POST fractary-core work comment create <issue>`: Create comment
- `GET fractary-core work comment list <issue>`: List comments
- `POST fractary-core work label add <issue>`: Add labels
- `DELETE fractary-core work label remove <issue>`: Remove labels
- `GET fractary-core work label list`: List all labels
- `POST fractary-core work milestone create`: Create milestone
- `GET fractary-core work milestone list`: List milestones
- `PUT fractary-core work milestone set <issue>`: Set milestone on issue

**Repo Commands**:
- `POST fractary-core repo branch create <name>`: Create branch
- `DELETE fractary-core repo branch delete <name>`: Delete branch
- `GET fractary-core repo branch list`: List branches
- `POST fractary-core repo commit --message <msg>`: Create commit
- `POST fractary-core repo push`: Push to remote
- `GET fractary-core repo pull`: Pull from remote
- `GET fractary-core repo status`: Show status
- `POST fractary-core repo pr create`: Create pull request
- `GET fractary-core repo pr list`: List pull requests
- `PUT fractary-core repo pr merge <number>`: Merge PR
- `POST fractary-core repo pr review <number>`: Review PR
- `POST fractary-core repo tag create <name>`: Create tag
- `POST fractary-core repo tag push <name>`: Push tag
- `GET fractary-core repo tag list`: List tags
- `POST fractary-core repo worktree create <branch>`: Create worktree
- `GET fractary-core repo worktree list`: List worktrees
- `DELETE fractary-core repo worktree remove <path>`: Remove worktree
- `DELETE fractary-core repo worktree cleanup`: Clean up worktrees

**Spec Commands**:
- `POST fractary-core spec create <title>`: Create specification
- `GET fractary-core spec get <id>`: Retrieve specification
- `GET fractary-core spec list`: List specifications
- `PUT fractary-core spec update <id>`: Update specification
- `POST fractary-core spec validate <id>`: Validate specification
- `POST fractary-core spec refine <id>`: Generate refinement questions
- `DELETE fractary-core spec delete <id>`: Delete specification
- `GET fractary-core spec templates`: List available templates

**Logs Commands**:
- `POST fractary-core logs capture <issue>`: Start log capture
- `POST fractary-core logs stop`: Stop capture
- `POST fractary-core logs write`: Write log entry
- `GET fractary-core logs read <id>`: Read log entry
- `GET fractary-core logs search`: Search logs
- `GET fractary-core logs list`: List logs
- `POST fractary-core logs archive`: Archive old logs
- `DELETE fractary-core logs delete <id>`: Delete log

**File Commands** (NEW):
- `POST fractary-core file upload <path>`: Upload file to storage
- `GET fractary-core file download <path>`: Download file from storage
- `GET fractary-core file list [prefix]`: List files
- `DELETE fractary-core file delete <path>`: Delete file

**Docs Commands** (NEW):
- `POST fractary-core docs create <title>`: Create documentation
- `GET fractary-core docs get <id>`: Retrieve documentation
- `GET fractary-core docs list`: List documentation
- `PUT fractary-core docs update <id>`: Update documentation

### UI/UX Changes

N/A - This is a CLI tool with no GUI. Output follows existing patterns:
- Text mode: Human-readable colored output (chalk)
- JSON mode (`--json`): Machine-readable structured output

## Implementation Plan

### Phase 1: Foundation Setup
**Status**: Not Started

**Objective**: Create CLI directory structure and core configuration files

**Tasks**:
- [ ] Create `/mnt/c/GitHub/fractary/core/cli/` directory structure
- [ ] Create `package.json` with binary entry point and dependencies
- [ ] Create `tsconfig.json` extending SDK configuration
- [ ] Update root `package.json` to add CLI to workspaces
- [ ] Create `src/utils/errors.ts` with error handling utilities
- [ ] Create `src/utils/output.ts` with output formatting utilities
- [ ] Create `src/utils/config.ts` with configuration loading and migration utilities
- [ ] Create `src/sdk/factory.ts` with SDK manager factories
- [ ] Create `src/commands/fractary-faber-init.ts` with top-level `fractary-core init` command

**Estimated Scope**: Small-Medium

### Phase 2: Migrate Work Commands
**Status**: Not Started

**Objective**: Migrate all work-related CLI commands

**Tasks**:
- [ ] Create `src/commands/fractary-faber-work/index.ts` with main command tree
- [ ] Create `src/commands/fractary-faber-work/issue.ts` with issue subcommands
- [ ] Create `src/commands/fractary-faber-work/comment.ts` with comment subcommands
- [ ] Create `src/commands/fractary-faber-work/label.ts` with label subcommands
- [ ] Create `src/commands/fractary-faber-work/milestone.ts` with milestone subcommands
- [ ] Create `src/commands/fractary-faber-work/init.ts` with initialization command
- [ ] Update SDK imports from `@fractary/faber` to `@fractary/core`
- [ ] Update config paths from `.fractary/faber/` to `.fractary/core/`
- [ ] Add unit tests for work commands

**Estimated Scope**: Medium

### Phase 3: Migrate Repo Commands
**Status**: Not Started

**Objective**: Migrate all repository-related CLI commands

**Tasks**:
- [ ] Create `src/commands/fractary-faber-repo/index.ts` with main command tree
- [ ] Create `src/commands/fractary-faber-repo/branch.ts` with branch subcommands
- [ ] Create `src/commands/fractary-faber-repo/commit.ts` with commit command
- [ ] Create `src/commands/fractary-faber-repo/pr.ts` with PR subcommands
- [ ] Create `src/commands/fractary-faber-repo/tag.ts` with tag subcommands
- [ ] Create `src/commands/fractary-faber-repo/worktree.ts` with worktree subcommands
- [ ] Create `src/commands/fractary-faber-repo/status.ts` with status/push/pull commands
- [ ] Update SDK imports and factory calls
- [ ] Add unit tests for repo commands

**Estimated Scope**: Medium

### Phase 4: Migrate Spec and Logs Commands
**Status**: Not Started

**Objective**: Migrate specification and logging CLI commands

**Tasks**:
- [ ] Create `src/commands/fractary-faber-spec/index.ts` with all spec commands
- [ ] Create `src/commands/fractary-faber-logs/index.ts` with all logs commands
- [ ] Update SDK imports and factory calls
- [ ] Add unit tests for spec and logs commands

**Estimated Scope**: Small-Medium

### Phase 5: Create New Commands
**Status**: Not Started

**Objective**: Create new CLI commands for file and docs plugins

**Tasks**:
- [ ] Review FileManager SDK API at `/sdk/js/src/file/manager.ts`
- [ ] Create `src/commands/fractary-faber-file/index.ts` with file commands
- [ ] Review DocsManager SDK API at `/sdk/js/src/docs/manager.ts`
- [ ] Create `src/commands/fractary-faber-docs/index.ts` with docs commands
- [ ] Skip status plugin CLI commands (status is UI-only for Claude Code status line)
- [ ] Add unit tests for new commands

**Estimated Scope**: Small-Medium

### Phase 6: Entry Points and Integration
**Status**: Not Started

**Objective**: Create main entry points and integrate all commands

**Tasks**:
- [ ] Create `src/index.ts` with CLI entry point (binary)
- [ ] Create `src/lib.ts` with library exports for programmatic use
- [ ] Register all command trees with main program
- [ ] Add custom help text and error handling
- [ ] Add integration tests for full CLI execution
- [ ] Build and verify npm package works correctly

**Estimated Scope**: Medium

### Phase 7: Documentation and Testing
**Status**: Not Started

**Objective**: Complete documentation and comprehensive testing

**Tasks**:
- [ ] Create `/mnt/c/GitHub/fractary/core/cli/README.md` with usage examples
- [ ] Update root README with CLI section
- [ ] Achieve 80%+ test coverage
- [ ] Manual testing of all commands
- [ ] Verify JSON output mode for all commands
- [ ] Test error handling edge cases

**Estimated Scope**: Small-Medium

## Files to Create/Modify

### New Files
- `/mnt/c/GitHub/fractary/core/cli/package.json`: CLI package configuration with binary entry and dependencies
- `/mnt/c/GitHub/fractary/core/cli/tsconfig.json`: TypeScript configuration extending SDK config
- `/mnt/c/GitHub/fractary/core/cli/src/index.ts`: Main CLI entry point with Commander.js setup
- `/mnt/c/GitHub/fractary/core/cli/src/lib.ts`: Library exports for programmatic access
- `/mnt/c/GitHub/fractary/core/cli/src/sdk/factory.ts`: SDK manager factory functions with lazy loading
- `/mnt/c/GitHub/fractary/core/cli/src/utils/errors.ts`: Error handling utilities and SDKNotAvailableError
- `/mnt/c/GitHub/fractary/core/cli/src/utils/output.ts`: Output formatting for JSON and text modes
- `/mnt/c/GitHub/fractary/core/cli/src/utils/config.ts`: Configuration loading and migration utilities
- `/mnt/c/GitHub/fractary/core/cli/src/commands/fractary-faber-init.ts`: Top-level `fractary-core init` command for initializing all core plugins
- `/mnt/c/GitHub/fractary/core/cli/src/commands/fractary-faber-work/index.ts`: Work command tree
- `/mnt/c/GitHub/fractary/core/cli/src/commands/fractary-faber-work/issue.ts`: Issue subcommands
- `/mnt/c/GitHub/fractary/core/cli/src/commands/fractary-faber-work/comment.ts`: Comment subcommands
- `/mnt/c/GitHub/fractary/core/cli/src/commands/fractary-faber-work/label.ts`: Label subcommands
- `/mnt/c/GitHub/fractary/core/cli/src/commands/fractary-faber-work/milestone.ts`: Milestone subcommands
- `/mnt/c/GitHub/fractary/core/cli/src/commands/fractary-faber-work/init.ts`: Work initialization command
- `/mnt/c/GitHub/fractary/core/cli/src/commands/fractary-faber-repo/index.ts`: Repo command tree
- `/mnt/c/GitHub/fractary/core/cli/src/commands/fractary-faber-repo/branch.ts`: Branch subcommands
- `/mnt/c/GitHub/fractary/core/cli/src/commands/fractary-faber-repo/commit.ts`: Commit command
- `/mnt/c/GitHub/fractary/core/cli/src/commands/fractary-faber-repo/pr.ts`: PR subcommands
- `/mnt/c/GitHub/fractary/core/cli/src/commands/fractary-faber-repo/tag.ts`: Tag subcommands
- `/mnt/c/GitHub/fractary/core/cli/src/commands/fractary-faber-repo/worktree.ts`: Worktree subcommands
- `/mnt/c/GitHub/fractary/core/cli/src/commands/fractary-faber-repo/status.ts`: Status, push, pull commands
- `/mnt/c/GitHub/fractary/core/cli/src/commands/fractary-faber-spec/index.ts`: Spec commands
- `/mnt/c/GitHub/fractary/core/cli/src/commands/fractary-faber-logs/index.ts`: Logs commands
- `/mnt/c/GitHub/fractary/core/cli/src/commands/fractary-faber-file/index.ts`: File commands (NEW)
- `/mnt/c/GitHub/fractary/core/cli/src/commands/fractary-faber-docs/index.ts`: Docs commands (NEW)
- `/mnt/c/GitHub/fractary/core/cli/README.md`: CLI documentation

### Modified Files
- `/mnt/c/GitHub/fractary/core/package.json`: Add cli to workspaces array
- `/mnt/c/GitHub/fractary/core/README.md`: Add CLI section and documentation link

## Testing Strategy

### Unit Tests

Mock SDK managers and test:
- Command option parsing for all commands
- Input validation and error handling
- Output formatting (JSON vs text modes)
- Factory pattern with lazy loading

Test files:
- `__tests__/commands/fractary-faber-work.test.ts`
- `__tests__/commands/fractary-faber-repo.test.ts`
- `__tests__/commands/fractary-faber-spec.test.ts`
- `__tests__/commands/fractary-faber-logs.test.ts`
- `__tests__/commands/fractary-faber-file.test.ts`
- `__tests__/commands/fractary-faber-docs.test.ts`
- `__tests__/utils/errors.test.ts`
- `__tests__/utils/output.test.ts`

### Integration Tests

Test full CLI execution with real SDK:
- Command chains work correctly
- Configuration loading and initialization
- End-to-end flows for common operations

Test file: `__tests__/integration/cli.test.ts`

### E2E Tests

Manual verification:
- All commands accessible via `fractary-core --help`
- Commands execute correctly against real services (GitHub, etc.)
- Output formats correct for both JSON and text modes

### Performance Tests

Verify:
- `fractary-core --help` responds in < 100ms (no SDK loading)
- Command execution time comparable to current fractary/cli

## Dependencies

- `@fractary/core` (workspace dependency) - Existing SDK for work, repo, spec, logs, file, docs
- `commander` ^11.1.0 - CLI framework
- `chalk` ^5.3.0 - Colored terminal output
- `inquirer` ^13.1.0 - Interactive prompts
- `cli-table3` ^0.6.5 - Table formatting for list commands
- `typescript` ^5.3.3 (dev) - TypeScript compiler
- `jest` ^29.7.0 (dev) - Testing framework
- `ts-jest` ^29.1.1 (dev) - Jest TypeScript preset
- `@types/node` ^20.x (dev) - Node.js type definitions
- `eslint` ^8.56.0 (dev) - Linting
- `@typescript-eslint/*` ^6.19.0 (dev) - TypeScript ESLint plugins

## Risks and Mitigations

- **Risk**: SDK API incompatibilities between @fractary/faber and @fractary/core
  - **Likelihood**: Medium
  - **Impact**: High
  - **Mitigation**: Conduct thorough API comparison before migration; create adapter layer if needed; document differences

- **Risk**: Configuration file migration issues
  - **Likelihood**: High
  - **Impact**: Medium
  - **Mitigation**: Support both `.fractary/faber/` and `.fractary/core/` paths during transition; auto-migrate on first `init` command

- **Risk**: Missing SDK features in @fractary/core
  - **Likelihood**: Low
  - **Impact**: High
  - **Mitigation**: Audit SDK capabilities before migration; implement missing features in SDK first if needed

- **Risk**: Breaking changes for existing users
  - **Likelihood**: Medium
  - **Impact**: High
  - **Mitigation**: Clear documentation; gradual deprecation timeline; migration guide; possible alias commands

## Documentation Updates

- `/mnt/c/GitHub/fractary/core/cli/README.md`: Full CLI documentation with usage examples, command reference, and programmatic access guide
- `/mnt/c/GitHub/fractary/core/README.md`: Add CLI section linking to cli/README.md
- Migration guide document for users transitioning from `fractary/cli`

## Rollout Plan

1. **Development Phase**: Implement all phases in feature branch
2. **Alpha Release**: Publish `@fractary/core-cli@0.1.0-alpha.1` for internal testing
3. **Beta Release**: Publish `@fractary/core-cli@0.1.0-beta.1` for external testing
4. **GA Release**: Publish `@fractary/core-cli@0.1.0` after validation
5. **Deprecation**: Add deprecation notice to `@fractary/cli` package pointing to new CLI

## Success Metrics

- All commands from `fractary/cli` available in `fractary-core`: 100% parity
- Test coverage: >= 80%
- CLI startup time for --help: < 100ms
- Zero high-severity security vulnerabilities
- Documentation completeness: All commands documented with examples

## Implementation Notes

### Key Code Patterns

**SDK Factory Pattern** (from fractary/cli):
```typescript
// src/sdk/factory.ts
import type { WorkManager } from '@fractary/core/work';

const instances: { work?: WorkManager } = {};

export async function getWorkManager(): Promise<WorkManager> {
  if (!instances.work) {
    const { WorkManager } = await import('@fractary/core/work');
    instances.work = new WorkManager();
  }
  return instances.work;
}
```

**Command Creation Pattern** (from fractary/cli):
```typescript
// src/commands/fractary-faber-work/issue.ts
import { Command } from 'commander';
import chalk from 'chalk';
import { getWorkManager } from '../../sdk/factory';

export function createIssueFetchCommand(): Command {
  return new Command('fetch')
    .description('Fetch a work item by ID')
    .argument('<number>', 'Issue number')
    .option('--json', 'Output as JSON')
    .action(async (number: string, options) => {
      try {
        const workManager = await getWorkManager();
        const issue = await workManager.fetchIssue(parseInt(number, 10));

        if (options.json) {
          console.log(JSON.stringify({ status: 'success', data: issue }, null, 2));
        } else {
          console.log(chalk.bold(`#${issue.number}: ${issue.title}`));
          console.log(chalk.gray(`State: ${issue.state}`));
        }
      } catch (error) {
        handleError(error, options);
      }
    });
}
```

### SDK Error Messages to Update

The SDK contains hardcoded references to old command names that need updating:
- `/mnt/c/GitHub/fractary/core/sdk/js/src/work/manager.ts` line 55:
  - Change `'Run "fractary work init"'` to `'Run "fractary-core work init"'`

### Source Files Reference

**Files to migrate from**:
- `/mnt/c/GitHub/fractary/cli/src/cli.ts` - Entry point pattern
- `/mnt/c/GitHub/fractary/cli/src/tools/faber/commands/fractary-faber-work/index.ts` - Work commands
- `/mnt/c/GitHub/fractary/cli/src/tools/faber/commands/fractary-faber-repo/index.ts` - Repo commands
- `/mnt/c/GitHub/fractary/cli/src/tools/faber/commands/fractary-faber-spec/index.ts` - Spec commands
- `/mnt/c/GitHub/fractary/cli/src/tools/faber/commands/fractary-faber-logs/index.ts` - Logs commands
- `/mnt/c/GitHub/fractary/cli/src/sdk/factory.ts` - SDK factory pattern

**SDK files to integrate with**:
- `/mnt/c/GitHub/fractary/core/sdk/js/src/work/manager.ts` - WorkManager
- `/mnt/c/GitHub/fractary/core/sdk/js/src/repo/manager.ts` - RepoManager
- `/mnt/c/GitHub/fractary/core/sdk/js/src/spec/manager.ts` - SpecManager
- `/mnt/c/GitHub/fractary/core/sdk/js/src/logs/manager.ts` - LogManager
- `/mnt/c/GitHub/fractary/core/sdk/js/src/file/manager.ts` - FileManager
- `/mnt/c/GitHub/fractary/core/sdk/js/src/docs/manager.ts` - DocsManager

## Changelog

### Refinement 2025-12-16

**Context**: Spec reviewed against SPEC-00026 (Distributed Plugin Architecture) for alignment and completeness.

**Changes Applied**:

1. **Added Related Specifications section** - Cross-reference to SPEC-00026 for architectural context
2. **Clarified MCP server scope** - Added note that MCP server (`@fractary/core-mcp-server`) is out of scope for this spec and will be addressed separately per SPEC-00026 Section 3.11
3. **Confirmed configuration path** - Standardized on `.fractary/core/config.json` (simpler, SDK-centric approach)
4. **Added top-level init command** - New `fractary-core init` command to initialize all core plugins at once, improving UX for initial setup
5. **Explicitly skipped status plugin CLI** - Clarified that status plugin is UI-only (Claude Code status line) and will not have CLI commands
6. **Updated file list** - Added `src/commands/fractary-faber-init.ts` to new files list

**Questions Answered**:
- Q1: MCP Server Scope → Keep CLI-only, separate MCP spec later
- Q2: Config Path → `.fractary/core/config.json`
- Q3: Init Command → Yes, add `fractary-core init`
- Q4: Status Plugin CLI → Skip CLI commands (UI-only)
- Q5: Cross-Reference → Yes, add Related Specifications section

**Impact**: Improves alignment with broader architecture, clarifies scope boundaries, and enhances initial setup UX.
