# @fractary/faber

> FABER SDK - Development toolkit for AI-assisted workflows

[![MIT License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![Node.js Version](https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen)](package.json)
[![TypeScript](https://img.shields.io/badge/typescript-5.3.3-blue)](https://www.typescriptlang.org/)

## Overview

Faber is a development toolkit that powers the FABER workflow methodology:
**Frame → Architect → Build → Evaluate → Release**

This SDK provides the core modules for work tracking, repository operations, specifications, logging, state management, and workflow orchestration across multiple platforms.

## Installation

```bash
npm install @fractary/faber
```

## Quick Start

```typescript
import { WorkManager, RepoManager, FaberWorkflow } from '@fractary/faber';

// Work tracking
const work = new WorkManager();
const issue = await work.fetchIssue(123);
await work.createComment(123, 'Starting implementation');

// Repository operations
const repo = new RepoManager();
await repo.createBranch('feature/add-export');
await repo.createPR({ title: 'Add export feature', head: 'feature/add-export' });

// Full FABER workflow
const workflow = new FaberWorkflow();
const result = await workflow.run({ workId: '123', autonomy: 'assisted' });
```

## Modules

### Work Module (`@fractary/faber/work`)

Multi-platform work tracking for GitHub Issues, Jira, and Linear.

```typescript
import { WorkManager } from '@fractary/faber/work';

const work = new WorkManager();

// Issues
const issue = await work.createIssue({ title: 'New feature', body: 'Description' });
const fetched = await work.fetchIssue(123);
await work.closeIssue(123);

// Comments
await work.createComment(123, 'Progress update');
const comments = await work.listComments(123);

// Labels
await work.addLabels(123, ['bug', 'priority:high']);
await work.setLabels(123, ['enhancement']);

// Milestones
await work.setMilestone(123, 'v1.0');

// Classification
const workType = await work.classifyWorkType(issue); // 'feature' | 'bug' | 'chore' | etc.
```

### Repo Module (`@fractary/faber/repo`)

Git and repository operations for GitHub, GitLab, and Bitbucket.

```typescript
import { RepoManager } from '@fractary/faber/repo';

const repo = new RepoManager();

// Branches
await repo.createBranch('feature/new-feature', { base: 'main' });
await repo.deleteBranch('feature/old-feature');
const branches = await repo.listBranches({ merged: true });

// Pull Requests
const pr = await repo.createPR({
  title: 'Add new feature',
  body: 'Description',
  head: 'feature/new-feature',
  base: 'main',
});
await repo.mergePR(pr.number, { strategy: 'squash' });

// Git Operations
repo.commit({ message: 'Add feature', type: 'feat' });
repo.push({ branch: 'feature/new-feature', setUpstream: true });
repo.pull({ rebase: true });

// Branch naming
const name = repo.generateBranchName({
  type: 'feature',
  description: 'Add CSV export',
  workId: '123',
}); // 'feature/123-add-csv-export'
```

### Spec Module (`@fractary/faber/spec`)

Specification management with templates, validation, and refinement.

```typescript
import { SpecManager } from '@fractary/faber/spec';

const spec = new SpecManager();

// Create from template
const newSpec = spec.createSpec('Add user authentication', {
  template: 'feature',
  workId: '123',
});

// List and search
const specs = spec.listSpecs({ status: 'draft' });
const found = spec.searchSpecs('authentication');

// Validation
const validation = spec.validateSpec('SPEC-001');
// { status: 'warn', completeness: 0.75, suggestions: [...] }

// Refinement
const questions = spec.generateRefinementQuestions('SPEC-001');
const result = spec.applyRefinements('SPEC-001', {
  'q1': 'OAuth 2.0 with PKCE',
  'q2': 'JWT tokens with 1-hour expiry',
});
```

### Logs Module (`@fractary/faber/logs`)

Session capture and log management with sensitive data redaction.

```typescript
import { LogManager } from '@fractary/faber/logs';

const logs = new LogManager();

// Session capture
logs.startCapture({ issueNumber: 123 });
// ... work happens ...
const session = logs.stopCapture();

// Log management
const entries = logs.listLogs({ type: 'session' });
const log = logs.getLog('session-2024-01-15.json');

// Export
logs.exportLog('session-123', './exports/session.md', 'markdown');
```

### State Module (`@fractary/faber/state`)

Workflow state persistence with checkpoints and recovery.

```typescript
import { StateManager } from '@fractary/faber/state';

const state = new StateManager();

// Workflows
const workflow = state.createWorkflow('123');
state.startPhase(workflow.workflow_id, 'frame');
state.completePhase(workflow.workflow_id, 'frame', { requirements: [...] });

// Checkpoints
state.createCheckpoint(workflow.workflow_id, 'before-build');
state.restoreFromCheckpoint(workflow.workflow_id, 'before-build');

// Recovery
const active = state.getActiveWorkflow('123');
state.resumeWorkflow(workflow.workflow_id);

// Manifests
const manifest = state.createManifest(workflow.workflow_id, '123');
state.addArtifactToManifest(manifest.manifest_id, { type: 'spec', path: '...' });
```

### Workflow Module (`@fractary/faber/workflow`)

Full FABER workflow orchestration.

```typescript
import { FaberWorkflow } from '@fractary/faber/workflow';

const faber = new FaberWorkflow({
  config: {
    autonomy: 'assisted',
    phases: {
      frame: { enabled: true },
      architect: { enabled: true, refineSpec: true },
      build: { enabled: true },
      evaluate: { enabled: true, maxRetries: 3 },
      release: { enabled: true, requestReviews: true, reviewers: ['@team'] },
    },
  },
});

// Event handling
faber.addEventListener((event, data) => {
  console.log(`${event}:`, data);
});

// User input callback for interactive mode
faber.setUserInputCallback(async (request) => {
  // Prompt user and return response
  return 'yes';
});

// Run workflow
const result = await faber.run({
  workId: '123',
  autonomy: 'assisted', // 'dry-run' | 'assisted' | 'guarded' | 'autonomous'
});

// Check status
const status = faber.getStatus(result.workflow_id);
// { state: {...}, currentPhase: 'build', progress: 60 }

// Resume paused workflow
await faber.resume(result.workflow_id);
```

### Storage Module (`@fractary/faber/storage`)

Artifact storage with optional Codex integration.

```typescript
import { StorageManager } from '@fractary/faber/storage';

const storage = new StorageManager();

// Store artifacts
await storage.store('specs/SPEC-001.md', specContent);
await storage.store('logs/session-123.json', logContent);

// Retrieve
const content = await storage.retrieve('specs/SPEC-001.md');
const exists = await storage.exists('specs/SPEC-001.md');

// List
const artifacts = await storage.list('specs/');

// Delete
await storage.delete('logs/old-session.json');

// Codex integration (if available)
if (storage.hasCodexIntegration()) {
  await storage.syncToCodex('specs/');
}
```

## Configuration

Configuration files are stored at `.fractary/plugins/{module}/config.json`:

```
.fractary/
└── plugins/
    ├── work/
    │   └── config.json
    ├── repo/
    │   └── config.json
    ├── spec/
    │   └── config.json
    ├── logs/
    │   └── config.json
    └── state/
        └── config.json
```

### Work Config

```json
{
  "platform": "github",
  "owner": "your-org",
  "repo": "your-repo"
}
```

### Repo Config

```json
{
  "platform": "github",
  "owner": "your-org",
  "repo": "your-repo",
  "defaultBranch": "main",
  "branchPrefixes": {
    "feature": "feature/",
    "fix": "fix/",
    "chore": "chore/"
  }
}
```

## Autonomy Levels

The SDK supports four autonomy levels:

| Level | Description |
|-------|-------------|
| `dry-run` | Preview changes without executing |
| `assisted` | Pause for user confirmation at each step |
| `guarded` | Confirm destructive operations only |
| `autonomous` | Execute without confirmation |

## CLI Usage

The SDK includes a CLI for direct usage:

```bash
# Work commands
fractary work fetch 123
fractary work create --title "New feature" --type feature
fractary work comment 123 --body "Progress update"
fractary work classify 123

# Repo commands
fractary repo branch create feature/new-feature
fractary repo pr create --title "Add feature" --head feature/new-feature
fractary repo commit --message "Add feature" --type feat

# Spec commands
fractary spec create "Add authentication" --template feature
fractary spec validate SPEC-001
fractary spec refine SPEC-001

# Workflow commands
fractary workflow run 123 --autonomy assisted
fractary workflow status workflow-id
fractary workflow resume workflow-id
```

## Platform Support

### Fully Implemented
- **GitHub** - Issues, PRs, Git operations

### Stub (Interface Only)
- **Jira** - Work tracking
- **Linear** - Work tracking
- **GitLab** - Repository operations
- **Bitbucket** - Repository operations

## Integration Example

For CLI projects consuming this SDK:

```typescript
// cli/src/commands/work.ts
import { WorkManager } from '@fractary/faber/work';
import { Command } from 'commander';

export function registerWorkCommands(program: Command) {
  const work = program.command('work');

  work
    .command('fetch <issue>')
    .action(async (issue) => {
      const manager = new WorkManager();
      const result = await manager.fetchIssue(issue);
      console.log(JSON.stringify(result, null, 2));
    });

  work
    .command('create')
    .requiredOption('-t, --title <title>')
    .option('-b, --body <body>')
    .action(async (options) => {
      const manager = new WorkManager();
      const result = await manager.createIssue(options);
      console.log('Created:', result.number);
    });
}
```

## Type Exports

All types are exported for TypeScript consumers:

```typescript
import type {
  // Work types
  Issue,
  IssueCreateOptions,
  IssueUpdateOptions,
  IssueFilters,
  Comment,
  Label,
  Milestone,
  WorkType,

  // Repo types
  PullRequest,
  PRCreateOptions,
  Branch,
  BranchCreateOptions,

  // Spec types
  Specification,
  SpecTemplate,
  ValidationResult,

  // Workflow types
  WorkflowConfig,
  WorkflowResult,
  PhaseResult,
  FaberPhase,
  AutonomyLevel,

  // Config types
  WorkConfig,
  RepoConfig,
  SpecConfig,
} from '@fractary/faber';
```

## License

MIT - see [LICENSE](LICENSE) file for details.

---

**Part of the Fractary Ecosystem**
