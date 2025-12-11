---
title: Core Concepts
description: Understanding Faber's architecture and key concepts
visibility: public
---

# Core Concepts

This guide explains the fundamental concepts of the Faber SDK.

## The FABER Methodology

FABER is a structured workflow for AI-assisted software development:

```
┌─────────────────────────────────────────────────────────────┐
│                    FABER Workflow                            │
├─────────┬───────────┬─────────┬────────────┬───────────────┤
│  Frame  │ Architect │  Build  │  Evaluate  │    Release    │
├─────────┼───────────┼─────────┼────────────┼───────────────┤
│ Gather  │  Create   │ Branch  │  Validate  │  Create PR    │
│ require-│  spec &   │ & impl- │  against   │  & request    │
│ ments   │  refine   │ ement   │  spec      │  review       │
└─────────┴───────────┴─────────┴────────────┴───────────────┘
```

### Phase Details

| Phase | Purpose | Key Activities |
|-------|---------|----------------|
| **Frame** | Understand what needs to be done | Fetch issue, classify work type, gather context |
| **Architect** | Plan the solution | Create/update spec, validate completeness, refine |
| **Build** | Implement the solution | Create branch, write code, make commits |
| **Evaluate** | Verify the solution | Run tests, validate against spec, review |
| **Release** | Deliver the solution | Push changes, create PR, request reviews |

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    FaberWorkflow                             │
│                (Orchestration Layer)                         │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐    │
│  │   Work   │  │   Repo   │  │   Spec   │  │   Logs   │    │
│  │ Manager  │  │ Manager  │  │ Manager  │  │ Manager  │    │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘  └────┬─────┘    │
│       │             │             │             │           │
│  ┌────┴─────┐  ┌────┴─────┐      │             │           │
│  │Providers │  │Providers │      │             │           │
│  │ GitHub   │  │ GitHub   │      │             │           │
│  │ Jira*    │  │ GitLab*  │      │             │           │
│  │ Linear*  │  │Bitbucket*│      │             │           │
│  └──────────┘  └──────────┘      │             │           │
│                                   │             │           │
├─────────────────────────────────────────────────────────────┤
│                    StateManager                              │
│              (Persistence & Recovery)                        │
└─────────────────────────────────────────────────────────────┘
```

## Modules

### WorkManager

Unified interface for work tracking across platforms.

```typescript
import { WorkManager } from '@fractary/faber/work';

const work = new WorkManager();

// Platform-agnostic operations
const issue = await work.fetchIssue(123);
await work.addLabels(123, ['bug', 'priority:high']);
const workType = await work.classifyWorkType(issue);
```

**Supported Platforms:**
- GitHub Issues (fully implemented)
- Jira (stub - interface only)
- Linear (stub - interface only)

### RepoManager

Git and repository operations with platform abstraction.

```typescript
import { RepoManager } from '@fractary/faber/repo';

const repo = new RepoManager();

// Branch operations
await repo.createBranch('feature/add-auth');
const branches = await repo.listBranches({ merged: true });

// PR operations
const pr = await repo.createPR({
  title: 'Add authentication',
  head: 'feature/add-auth',
});

// Git operations
repo.commit({ message: 'Add login form', type: 'feat' });
repo.push({ setUpstream: true });
```

**Capabilities:**
- Branch management (create, delete, list)
- Pull request lifecycle
- Git operations (commit, push, pull)
- Worktree management

### SpecManager

Specification creation, validation, and refinement.

```typescript
import { SpecManager } from '@fractary/faber/spec';

const spec = new SpecManager();

// Create from template
const newSpec = spec.createSpec('Add OAuth support', {
  template: 'feature',
  workId: '123',
});

// Validate
const validation = spec.validateSpec(newSpec.id);

// Refine
const questions = spec.generateRefinementQuestions(newSpec.id);
spec.applyRefinements(newSpec.id, {
  'auth-method': 'OAuth 2.0 with PKCE',
});
```

**Templates:**
- `basic` - Minimal spec structure
- `feature` - New feature implementation
- `bug` - Bug fix with reproduction steps
- `infrastructure` - Infrastructure changes
- `api` - API design and changes

### LogManager

Session capture with sensitive data redaction.

```typescript
import { LogManager } from '@fractary/faber/logs';

const logs = new LogManager();

// Capture a session
logs.startCapture({ issueNumber: 123 });
// ... work happens ...
const session = logs.stopCapture();

// Export for sharing
logs.exportLog(session.session_id, './report.md', 'markdown');
```

**Features:**
- Automatic sensitive data redaction
- Multiple export formats
- Session metadata tracking

### StateManager

Workflow state persistence and recovery.

```typescript
import { StateManager } from '@fractary/faber/state';

const state = new StateManager();

// Create workflow state
const workflow = state.createWorkflow('123');

// Track phases
state.startPhase(workflow.workflow_id, 'frame');
state.completePhase(workflow.workflow_id, 'frame', { workType: 'feature' });

// Checkpoints for recovery
state.createCheckpoint(workflow.workflow_id, 'before-build');
// ... if something fails ...
state.restoreFromCheckpoint(workflow.workflow_id, 'before-build');
```

**Capabilities:**
- Workflow state tracking
- Phase management
- Checkpoint/recovery
- Run manifests

### FaberWorkflow

Orchestrates the complete FABER workflow.

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
      release: { enabled: true, requestReviews: true },
    },
  },
});

const result = await faber.run({ workId: '123' });
```

## Configuration

### File Locations

```
.fractary/
└── plugins/
    ├── work/
    │   └── config.json      # Work tracking config
    ├── repo/
    │   └── config.json      # Repository config
    ├── spec/
    │   └── config.json      # Specification config
    ├── logs/
    │   └── config.json      # Logging config
    └── state/
        └── config.json      # State management config
```

### Work Configuration

```json
{
  "platform": "github",
  "owner": "your-org",
  "repo": "your-repo"
}
```

For Jira:
```json
{
  "platform": "jira",
  "project": "PROJ",
  "baseUrl": "https://your-org.atlassian.net"
}
```

### Repo Configuration

```json
{
  "platform": "github",
  "owner": "your-org",
  "repo": "your-repo",
  "defaultBranch": "main",
  "protectedBranches": ["main", "develop"],
  "branchPrefixes": {
    "feature": "feature/",
    "fix": "fix/",
    "chore": "chore/",
    "hotfix": "hotfix/"
  }
}
```

## Autonomy Levels

Control the balance between automation and human oversight:

### dry-run
No changes made. Shows what would happen.

```typescript
const result = await faber.run({
  workId: '123',
  autonomy: 'dry-run',
});
// result.phases will show { dryRun: true, message: "Would create branch..." }
```

### assisted
Pauses at each significant step for user confirmation.

```typescript
faber.setUserInputCallback(async (request) => {
  console.log(request.message);
  return await askUser('Proceed? (yes/no)') === 'yes';
});
```

### guarded
Automatic for safe operations, confirms for:
- Branch deletion
- Force push
- PR creation
- Closing issues

### autonomous
Runs to completion without user interaction.

## Event System

Subscribe to workflow events:

```typescript
faber.addEventListener((event, data) => {
  switch (event) {
    case 'workflow:start':
      console.log('Starting:', data.workflowId);
      break;
    case 'phase:start':
      console.log('Phase:', data.phase);
      break;
    case 'phase:complete':
      console.log('Completed:', data.phase, data.outputs);
      break;
    case 'artifact:create':
      console.log('Created:', data.type, data.path);
      break;
    case 'workflow:complete':
      console.log('Done:', data.status);
      break;
  }
});
```

**Available Events:**
- `workflow:start` - Workflow begins
- `workflow:complete` - Workflow finishes successfully
- `workflow:fail` - Workflow fails
- `workflow:pause` - Workflow paused for input
- `phase:start` - Phase begins
- `phase:complete` - Phase completes
- `phase:fail` - Phase fails
- `phase:skip` - Phase skipped
- `artifact:create` - Artifact created (spec, branch, PR)

## Error Handling

The SDK provides typed errors:

```typescript
import {
  FaberError,           // Base class
  ConfigurationError,   // Invalid config
  ProviderError,        // Platform API errors
  WorkflowError,        // Workflow execution errors
  SpecError,            // Spec management errors
  IssueNotFoundError,   // Issue not found
  BranchExistsError,    // Branch already exists
  MergeConflictError,   // PR merge failed
} from '@fractary/faber';

try {
  await work.fetchIssue(999999);
} catch (error) {
  if (error instanceof IssueNotFoundError) {
    console.log('Issue does not exist');
  }
}
```

## Work Types

The SDK recognizes these work types:

| Type | Description |
|------|-------------|
| `feature` | New functionality |
| `bug` | Bug fix |
| `chore` | Maintenance task |
| `patch` | Small fix or hotfix |
| `infrastructure` | Infrastructure changes |
| `api` | API changes |

Classification is automatic based on labels and content:

```typescript
const workType = await work.classifyWorkType(issue);
// Returns: 'feature' | 'bug' | 'chore' | etc.
```

## Next Steps

- [Getting Started](./getting-started.md) - Installation and first steps
- [CLI Reference](./cli.md) - Command-line interface
- [API Reference](./api.md) - Full API documentation
