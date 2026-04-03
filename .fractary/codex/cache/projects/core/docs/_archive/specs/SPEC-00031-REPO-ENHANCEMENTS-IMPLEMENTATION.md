# SPEC-00031: Fractary-Repo Enhancements Implementation Plan

**Status**: Approved
**Version**: 1.0
**Date**: 2026-01-06
**Parent Spec**: [SPEC-00030](./SPEC-00030-FRACTARY-REPO-ENHANCEMENTS.md)
**Target Plugin**: fractary-repo
**Target Version**: 2.5.0

## Overview

Implementation plan for SPEC-00030 fractary-repo enhancements. This spec focuses on branch management and worktree enhancements with organization-aware path patterns, while delegating issue management to the existing fractary-work plugin.

## Architecture Decisions

### 1. Issue Management
**Decision**: Use fractary-work plugin for all issue operations (issue-fetch, issue-search, issue-update).

**Rationale**:
- Commands already exist with full CLI/SDK support
- Clean separation of concerns (fractary-work = work tracking, fractary-repo = git/source control)
- No duplication of functionality

### 2. Path Pattern Migration
**Decision**: Default to SPEC-00030 pattern with backward compatibility.

- **New Pattern**: `~/.claude-worktrees/{org}-{project}-{id}`
- **Legacy Pattern**: `../{project}-{id}` (auto-detected, still supported)
- **Migration**: Optional, via `/fractary-repo:worktree-migrate` command

### 3. Organization Extraction
**Implementation**: Parse git remote URLs to extract organization name.

**Supported Formats**:
- SSH: `git@github.com:fractary/core.git` → `fractary`
- HTTPS: `https://github.com/fractary/core.git` → `fractary`
- GitLab: `git@gitlab.com:org/subgroup/project.git` → `org-subgroup`

**Fallback**: Use "local" if no remote or parse fails.

## Implementation Phases

### Phase 1: Core Infrastructure

**Files to Create**:
1. `sdk/js/src/repo/organization.ts` - Organization extraction utilities
2. `sdk/js/src/repo/config.ts` - Configuration management
3. `sdk/js/src/repo/path-generator.ts` - Path generation logic
4. `plugins/repo/commands/fractary-faber-branch-create.md` - Branch creation command
5. `plugins/repo/commands/fractary-faber-worktree-migrate.md` - Migration command

**Key Functions**:

**organization.ts**:
```typescript
export interface GitRemote {
  name: string;
  url: string;
  organization?: string;
  project?: string;
}

export function parseGitRemote(remoteUrl: string): GitRemote | null;
export async function getRemoteInfo(cwd: string): Promise<GitRemote | null>;
```

**Implementation Notes**:
- Use execFileNoThrow for all git commands
- Regex patterns for SSH and HTTPS URL formats
- Fallback to "local" for organization if extraction fails

**config.ts**:
```typescript
export interface WorktreeConfig {
  defaultLocation: string; // "~/.claude-worktrees/"
  pathPattern: string; // "{organization}-{project}-{work-id}"
  legacySupport: boolean; // true
  autoMigrate: boolean; // false
}

export async function loadRepoConfig(cwd: string): Promise<RepoConfig>;
export function getDefaultConfig(): RepoConfig;
```

**Implementation Notes**:
- Load from `.fractary/config.yaml` if exists
- Fallback to defaults if not configured
- Support environment variable expansion (~/)

**path-generator.ts**:
```typescript
export async function generateWorktreePath(
  cwd: string,
  options: PathGenerationOptions
): Promise<string>;

export async function findExistingWorktree(
  cwd: string,
  workId: string
): Promise<string | null>;
```

**Implementation Notes**:
- Check for legacy worktrees at `../{project}-{id}`
- Apply SPEC-00030 pattern for new worktrees
- Respect custom path if provided

### Phase 2: Worktree Enhancements

**Files to Modify**:
1. `plugins/repo/commands/fractary-faber-worktree-create.md` - Add JSON output, SPEC-00030 paths
2. `plugins/repo/commands/fractary-faber-worktree-list.md` - Add organization field
3. `sdk/js/src/repo/manager.ts` - Add organization methods
4. `sdk/js/src/common/types.ts` - Add organization/project to Worktree interface

**Key Changes**:

**worktree-create.md**:
- Add `--format json` flag
- Update path generation to use SPEC-00030 pattern
- Auto-detect legacy worktrees and warn user
- Output organization and project in JSON

**worktree-list.md**:
- Add organization field to JSON output
- Extract organization for each worktree

**manager.ts**:
```typescript
async getOrganization(): Promise<string>;
async getProjectName(): Promise<string>;
async createBranch(options: BranchCreateOptions): Promise<BranchCreateResult>;
```

**types.ts**:
```typescript
export interface Worktree {
  // ... existing fields
  organization?: string;
  project?: string;
  workId?: string;
}
```

### Phase 3: CLI Updates and Documentation

**Files to Create**:
1. `plugins/repo/docs/BRANCH-COMMANDS.md` - Branch command documentation
2. `plugins/repo/docs/WORKTREE-MIGRATION.md` - Migration guide

**Files to Modify**:
1. `cli/src/commands/fractary-faber-repo/worktree.ts` - Add JSON output support
2. `cli/src/commands/fractary-faber-repo/branch.ts` - New branch command registration

## Testing Strategy

### Unit Tests
1. `sdk/js/src/repo/organization.test.ts` - Test SSH/HTTPS parsing
2. `sdk/js/src/repo/path-generator.test.ts` - Test path generation logic
3. `sdk/js/src/repo/config.test.ts` - Test config loading

### Integration Tests
1. Branch create end-to-end (text and JSON output)
2. Worktree migration (dry-run, interactive, auto modes)
3. Legacy worktree detection and compatibility

### Manual Testing Checklist

**Phase 1**:
- [ ] Organization extraction from SSH remote
- [ ] Organization extraction from HTTPS remote
- [ ] Fallback to "local" when no remote
- [ ] Config loading from `.fractary/config.yaml`
- [ ] Branch create (text and JSON output)
- [ ] Migration dry-run, interactive, auto modes

**Phase 2**:
- [ ] Worktree create with SPEC-00030 path
- [ ] Worktree create with legacy path detection
- [ ] Worktree create JSON output includes organization
- [ ] Worktree list JSON output includes organization

**Phase 3**:
- [ ] CLI commands support --format json
- [ ] Documentation is accurate and complete

## Version and Release

**Current**: 2.4.x
**Target**: 2.5.0 (minor version bump)

**Reason**: New features without breaking existing functionality.

### Changelog

```markdown
## [2.5.0] - 2026-01-06

### Added
- New command: `branch-create` for creating git branches with validation
- Organization-aware worktree paths: `~/.claude-worktrees/{org}-{project}-{id}`
- JSON output support for all worktree commands (`--format json`)
- Migration command: `worktree-migrate` for legacy path patterns
- Configuration system for worktree path patterns (`.fractary/config.yaml`)
- Organization extraction utilities for git remotes

### Changed
- Worktree path generation now includes organization name by default
- All worktree commands now support `--format json` flag
- Enhanced worktree-list output with organization and project metadata

### Fixed
- Worktree naming conflicts across different repositories with same name

### Migration Guide
See `plugins/repo/docs/WORKTREE-MIGRATION.md` for migration details.

### Backward Compatibility
Legacy worktree paths (`../{project}-{id}`) continue to work. Migration is optional.
```

## Files Summary

### New Files (7)
1. `sdk/js/src/repo/organization.ts`
2. `sdk/js/src/repo/config.ts`
3. `sdk/js/src/repo/path-generator.ts`
4. `plugins/repo/commands/fractary-faber-branch-create.md`
5. `plugins/repo/commands/fractary-faber-worktree-migrate.md`
6. `plugins/repo/docs/BRANCH-COMMANDS.md`
7. `plugins/repo/docs/WORKTREE-MIGRATION.md`

### Modified Files (6)
1. `plugins/repo/commands/fractary-faber-worktree-create.md`
2. `plugins/repo/commands/fractary-faber-worktree-list.md`
3. `sdk/js/src/repo/manager.ts`
4. `sdk/js/src/common/types.ts`
5. `cli/src/commands/fractary-faber-repo/worktree.ts`
6. `cli/src/commands/fractary-faber-repo/branch.ts`

### Test Files (3)
1. `sdk/js/src/repo/organization.test.ts`
2. `sdk/js/src/repo/path-generator.test.ts`
3. `sdk/js/src/repo/config.test.ts`

## Success Criteria

1. ✅ Branch-create command works in plugin, CLI, and SDK
2. ✅ All worktree commands support JSON output
3. ✅ Organization extraction works for GitHub, GitLab, Bitbucket
4. ✅ New worktrees use SPEC-00030 path pattern
5. ✅ Legacy worktrees continue to work
6. ✅ Migration command successfully moves worktrees
7. ✅ Configuration system allows path customization
8. ✅ All tests pass (unit and integration)
9. ✅ Documentation is complete and accurate
10. ✅ No breaking changes to existing workflows

## Implementation Notes

- Use execFileNoThrow for all git commands (see src/utils/execFileNoThrow.ts)
- Keep commands stateless (no FABER tracking in this phase)
- Issue commands handled by fractary-work plugin (no duplication)
- worktree-remove and worktree-prune already complete (no changes needed)
- Focus on path pattern enhancement and branch management
