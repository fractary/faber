# SPEC-00031: FABER CLI Integration with @fractary/core SDK

**Status**: Approved
**Version**: 1.0
**Date**: 2026-01-06
**Related**: SPEC-00029, SPEC-00030

## Overview

This specification defines the integration of FABER CLI with the @fractary/core SDK to replace stub implementations in `repo-client.ts` with fully functional SDK-based operations using `WorkManager` and `RepoManager`.

## Background

As of PR #37, the FABER CLI planning architecture was implemented with stub methods in `cli/src/lib/repo-client.ts` that throw "not yet implemented" errors. SPEC-00030 originally specified that these would call `fractary-repo` CLI commands, but the fractary-core SDK now provides these capabilities directly through:
- `WorkManager` - Issue tracking operations (fetch, search, update, comment, labels)
- `RepoManager` - Repository operations (branches, worktrees, commits, PRs)

This spec supersedes the CLI-calling approach in favor of direct SDK integration.

## Architecture

### Current State
```
FABER CLI (plan command)
    ↓
RepoClient (stub)
    ↓
[throws "not implemented"]
```

### Target State
```
FABER CLI (plan command)
    ↓
RepoClient
    ├→ WorkManager (@fractary/core)
    │    ├→ fetchIssue()
    │    ├→ searchIssues()
    │    ├→ createComment()
    │    └→ addLabels/removeLabels()
    └→ RepoManager (@fractary/core)
         ├→ createBranch()
         ├→ createWorktree()
         └→ listWorktrees()
```

## Dependencies

### Add to cli/package.json
```json
{
  "dependencies": {
    "@fractary/faber": "*",
    "@fractary/core": "^0.2.0",
    "chalk": "^5.0.0",
    "commander": "^12.0.0"
  }
}
```

## Implementation Components

### 1. Configuration Adapter

**File**: `cli/src/lib/sdk-config-adapter.ts` (NEW)

**Purpose**: Convert FABER CLI configuration to SDK configuration format

**Functions**:

```typescript
import type { FaberConfig } from '../types/config.js';

// Convert to WorkConfig for WorkManager
export function createWorkConfig(faberConfig: FaberConfig): WorkConfig {
  const token = faberConfig.github?.token;
  const owner = faberConfig.github?.organization;
  const repo = faberConfig.github?.project;

  if (!token) {
    throw new Error('GitHub token not found. Set GITHUB_TOKEN environment variable.');
  }
  if (!owner || !repo) {
    throw new Error('GitHub organization and project must be configured.');
  }

  return {
    platform: 'github',
    owner,
    repo,
    token,
  };
}

// Convert to RepoConfig for RepoManager
export function createRepoConfig(faberConfig: FaberConfig): RepoConfig {
  const token = faberConfig.github?.token;
  const owner = faberConfig.github?.organization;
  const repo = faberConfig.github?.project;

  if (!token) {
    throw new Error('GitHub token not found. Set GITHUB_TOKEN environment variable.');
  }

  return {
    platform: 'github',
    owner,
    repo,
    token,
  };
}
```

### 2. Type Adapter

**File**: `cli/src/lib/sdk-type-adapter.ts` (NEW)

**Purpose**: Convert between SDK types and CLI types

**Type Mappings**:

#### SDK Issue → CLI Issue

| SDK Field | CLI Field | Transformation |
|-----------|-----------|----------------|
| `id` | `id` | Direct |
| `number` | `number` | Direct |
| `title` | `title` | Direct |
| `body` | `description` | Rename |
| `state` | `state` | Direct |
| `labels: Label[]` | `labels: string[]` | Extract `.name` from each |
| `url` | `url` | Direct |

#### SDK Worktree → CLI WorktreeResult

| SDK Field | CLI Field | Transformation |
|-----------|-----------|----------------|
| `path` | `path`, `absolute_path` | Duplicate (SDK path is absolute) |
| `branch` | `branch` | Direct |
| `workId` | `work_id` | Rename |
| (parameter) | `organization` | From function parameter |
| (parameter) | `project` | From function parameter |
| (generated) | `created_at` | Current ISO timestamp |

**Functions**:

```typescript
import type { Issue as SDKIssue, Worktree as SDKWorktree } from '@fractary/core';

export function sdkIssueToCLIIssue(sdkIssue: SDKIssue): CLIIssue {
  return {
    id: sdkIssue.id,
    number: sdkIssue.number,
    title: sdkIssue.title,
    description: sdkIssue.body,
    labels: sdkIssue.labels.map(l => l.name),
    url: sdkIssue.url,
    state: sdkIssue.state,
  };
}

export function sdkWorktreeToCLIWorktreeResult(
  sdkWorktree: SDKWorktree,
  organization: string,
  project: string,
  workId: string
): WorktreeResult {
  return {
    path: sdkWorktree.path,
    absolute_path: sdkWorktree.path,
    branch: sdkWorktree.branch || '',
    created_at: new Date().toISOString(),
    organization,
    project,
    work_id: workId,
  };
}
```

### 3. RepoClient Refactoring

**File**: `cli/src/lib/repo-client.ts`

**Changes**:

#### 3.1 Imports
```typescript
import { WorkManager, RepoManager } from '@fractary/core';
import { createWorkConfig, createRepoConfig } from './sdk-config-adapter.js';
import { sdkIssueToCLIIssue, sdkWorktreeToCLIWorktreeResult } from './sdk-type-adapter.js';
import os from 'os';
```

#### 3.2 Class Fields
```typescript
export class RepoClient {
  private config: any;
  private workManager: WorkManager;
  private repoManager: RepoManager;
  private organization: string;
  private project: string;
}
```

#### 3.3 Constructor
```typescript
constructor(config: any) {
  this.config = config;

  // Validate GitHub token
  const token = config.github?.token;
  if (!token) {
    throw new Error('GitHub token not found. Set GITHUB_TOKEN environment variable.');
  }

  // Extract organization and project
  this.organization = config.github?.organization || 'unknown';
  this.project = config.github?.project || 'unknown';

  // Create SDK configurations
  const workConfig = createWorkConfig(config);
  const repoConfig = createRepoConfig(config);

  // Initialize SDK managers
  try {
    this.workManager = new WorkManager(workConfig);
    this.repoManager = new RepoManager(repoConfig);
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`Failed to initialize SDK managers: ${error.message}`);
    }
    throw error;
  }
}
```

#### 3.4 Method Implementations

**fetchIssues()**:
```typescript
async fetchIssues(ids: string[]): Promise<Issue[]> {
  try {
    const issues = await Promise.all(
      ids.map(id => this.workManager.fetchIssue(id))
    );
    return issues.map(sdkIssueToCLIIssue);
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`Failed to fetch issues: ${error.message}`);
    }
    throw error;
  }
}
```

**searchIssues()**:
```typescript
async searchIssues(labels: string[]): Promise<Issue[]> {
  try {
    const issues = await this.workManager.searchIssues('', {
      state: 'open',
      labels: labels,
    });
    return issues.map(sdkIssueToCLIIssue);
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`Failed to search issues: ${error.message}`);
    }
    throw error;
  }
}
```

**createBranch()**:
```typescript
async createBranch(branchName: string): Promise<void> {
  try {
    await this.repoManager.createBranch(branchName);
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`Failed to create branch: ${error.message}`);
    }
    throw error;
  }
}
```

**createWorktree()**:
```typescript
async createWorktree(options: { workId: string; path?: string }): Promise<WorktreeResult> {
  try {
    const branch = `feature/${options.workId}`;
    const path = options.path ||
      `~/.claude-worktrees/${this.organization}-${this.project}-${options.workId}`;

    // Expand ~ to home directory
    const expandedPath = path.startsWith('~')
      ? path.replace('~', os.homedir())
      : path;

    const worktree = this.repoManager.createWorktree({
      path: expandedPath,
      branch,
      workId: options.workId,
    });

    return sdkWorktreeToCLIWorktreeResult(
      worktree,
      this.organization,
      this.project,
      options.workId
    );
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`Failed to create worktree: ${error.message}`);
    }
    throw error;
  }
}
```

**updateIssue()**:
```typescript
async updateIssue(options: IssueUpdateOptions): Promise<void> {
  try {
    const issueId = parseInt(options.id, 10);

    if (options.comment) {
      await this.workManager.createComment(issueId, options.comment);
    }

    if (options.addLabel) {
      await this.workManager.addLabels(issueId, [options.addLabel]);
    }

    if (options.removeLabel) {
      await this.workManager.removeLabels(issueId, [options.removeLabel]);
    }
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`Failed to update issue: ${error.message}`);
    }
    throw error;
  }
}
```

#### 3.5 Remove Obsolete Code
- Delete `callRepoCommand()` method (no longer needed)

## Configuration Requirements

The SDK requires these fields from FaberConfig:
- `github.token` - GitHub API token (required, from GITHUB_TOKEN env var or config)
- `github.organization` - GitHub org/owner (required, from config)
- `github.project` - GitHub repo name (required, from config)

These should already be available from environment variables or `.fractary/settings.json`.

## Error Handling

### Strategy
1. **Constructor**: Throw clear errors if configuration is missing
2. **SDK Methods**: Wrap all SDK calls in try-catch blocks
3. **Error Messages**: Prefix with operation context (e.g., "Failed to fetch issues: ...")
4. **Authentication**: Provide helpful guidance if authentication fails

### Example Error Messages
- Missing token: "GitHub token not found. Set GITHUB_TOKEN environment variable."
- Missing config: "GitHub organization and project must be configured."
- SDK failure: "Failed to fetch issues: Issue #999 not found"
- Auth failure: "GitHub authentication failed. Run 'gh auth login' to authenticate."

## Testing

### Manual Test Checklist
After implementation, manually verify:

1. ✅ `fetchIssues()` with valid issue IDs
2. ✅ `fetchIssues()` with invalid issue IDs (should error gracefully)
3. ✅ `searchIssues()` with label filters
4. ✅ `searchIssues()` with no matches (should return empty array)
5. ✅ `createBranch()` with new branch name
6. ✅ `createBranch()` with existing branch (should error)
7. ✅ `createWorktree()` with default path
8. ✅ `createWorktree()` with custom path
9. ✅ `updateIssue()` with comment
10. ✅ `updateIssue()` with label addition
11. ✅ Full `plan` command workflow end-to-end

### Unit Tests (Future Work)
- Mock WorkManager and RepoManager
- Test type conversion functions
- Test error handling paths
- Test configuration validation

## Success Criteria

- [ ] @fractary/core dependency added to package.json
- [ ] Configuration adapter created and working
- [ ] Type adapter created and working
- [ ] All 5 RepoClient methods implemented with SDK
- [ ] Error handling provides clear feedback
- [ ] Manual testing passes all scenarios
- [ ] No regression in plan command functionality
- [ ] Documentation updated

## Migration Notes

### Breaking Changes
None - this replaces stub implementations with functional code.

### Backward Compatibility
- All existing CLI command signatures remain unchanged
- Type interfaces remain the same
- Only internal implementation changes

### Configuration Migration
- No changes needed to existing `.fractary/settings.json` files
- GitHub token can still come from `GITHUB_TOKEN` environment variable

## Performance Considerations

1. **Manager Initialization**: Managers are lightweight, negligible overhead
2. **Network Calls**: SDK uses GitHub CLI (`gh`) under the hood
3. **Type Conversions**: Minimal overhead, pure data transformation
4. **Concurrency**: Promise.all() used for parallel issue fetching

## Security Considerations

1. **Token Handling**: SDK handles tokens securely via GitHub CLI
2. **Input Validation**: SDK performs its own validation
3. **Path Traversal**: SDK validates worktree paths internally
4. **Command Injection**: SDK uses safe command execution

## Future Enhancements

1. Add unit tests with mocked SDK managers
2. Add integration tests with real GitHub repository
3. Support for additional platforms (GitLab, Bitbucket)
4. Caching layer for frequently accessed issues
5. Batch operations optimization

## References

- **SPEC-00029**: FABER CLI Planning Architecture
- **SPEC-00030**: fractary-repo Plugin Enhancements
- **@fractary/core SDK**: `/mnt/c/GitHub/fractary/core/sdk/js/`
- **WorkManager API**: `/mnt/c/GitHub/fractary/core/sdk/js/src/work/manager.ts`
- **RepoManager API**: `/mnt/c/GitHub/fractary/core/sdk/js/src/repo/manager.ts`
