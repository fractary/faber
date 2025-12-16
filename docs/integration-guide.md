# CLI Integration Guide

This guide covers how to integrate `@fractary/faber` into a CLI project like `@fractary/cli` or `claude-plugins`.

## Installation

```bash
npm install @fractary/faber
```

## Module Imports

Import specific modules for tree-shaking:

```typescript
// Specific module imports (recommended)
import { WorkManager } from '@fractary/faber/work';
import { RepoManager } from '@fractary/faber/repo';
import { SpecManager } from '@fractary/faber/spec';
import { LogManager } from '@fractary/faber/logs';
import { StateManager } from '@fractary/faber/state';
import { FaberWorkflow } from '@fractary/faber/workflow';
import { StorageManager } from '@fractary/faber/storage';

// Or import everything from root
import {
  WorkManager,
  RepoManager,
  SpecManager,
  LogManager,
  StateManager,
  FaberWorkflow,
  StorageManager,
} from '@fractary/faber';
```

## Type Imports

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
  WorkConfig,
  FaberContext,

  // Repo types
  PullRequest,
  PRCreateOptions,
  PRUpdateOptions,
  PRListOptions,
  PRMergeOptions,
  PRReviewOptions,
  Branch,
  BranchCreateOptions,
  BranchDeleteOptions,
  BranchListOptions,
  Worktree,
  RepoConfig,

  // Spec types
  Specification,
  SpecSection,
  SpecMetadata,
  SpecTemplate,
  SpecTemplateType,
  SpecConfig,
  ValidationResult,
  RefinementQuestion,

  // Workflow types
  WorkflowConfig,
  WorkflowOptions,
  WorkflowResult,
  PhaseResult,
  FaberPhase,
  AutonomyLevel,
  PhaseContext,

  // Log types
  LogConfig,
  SessionLog,
  LogEntry,

  // State types
  StateConfig,
  WorkflowState,
  RunManifest,
  ArtifactManifest,
} from '@fractary/faber';
```

## Configuration

### Auto-Discovery

Managers automatically discover configuration from `.fractary/plugins/{module}/config.json`:

```typescript
// Auto-loads config from project root
const work = new WorkManager();
const repo = new RepoManager();
```

### Manual Configuration

Pass configuration directly:

```typescript
const work = new WorkManager({
  platform: 'github',
  owner: 'my-org',
  repo: 'my-repo',
});

const repo = new RepoManager({
  platform: 'github',
  owner: 'my-org',
  repo: 'my-repo',
  defaultBranch: 'main',
});
```

### Configuration Helpers

```typescript
import {
  loadWorkConfig,
  loadRepoConfig,
  loadSpecConfig,
  loadLogConfig,
  loadStateConfig,
  findProjectRoot,
} from '@fractary/faber';

const root = findProjectRoot();
const workConfig = loadWorkConfig(root);
const repoConfig = loadRepoConfig(root);
```

## Error Handling

### Error Classes

```typescript
import {
  FaberError,           // Base error class
  ConfigurationError,   // Invalid or missing config
  ProviderError,        // Platform-specific errors
  WorkflowError,        // Workflow execution errors
  SpecError,            // Specification errors
  LogError,             // Logging errors
  StateError,           // State management errors
  IssueNotFoundError,   // Issue lookup failures
  PRNotFoundError,      // PR lookup failures
  BranchExistsError,    // Branch already exists
  MergeConflictError,   // PR merge conflicts
} from '@fractary/faber';
```

### Error Handling Pattern

```typescript
import { WorkManager, IssueNotFoundError, ProviderError } from '@fractary/faber';

async function fetchIssue(issueId: string) {
  const work = new WorkManager();

  try {
    return await work.fetchIssue(issueId);
  } catch (error) {
    if (error instanceof IssueNotFoundError) {
      console.error(`Issue ${issueId} not found`);
      return null;
    }
    if (error instanceof ProviderError) {
      console.error(`Provider error: ${error.message}`);
      throw error;
    }
    throw error;
  }
}
```

## Skill/Command Integration

### Wrapping as Skills

```typescript
// skill: issue-fetcher.ts
import { WorkManager } from '@fractary/faber/work';

export async function execute(params: { issueId: string }) {
  const work = new WorkManager();
  const issue = await work.fetchIssue(params.issueId);

  return {
    success: true,
    data: {
      number: issue.number,
      title: issue.title,
      state: issue.state,
      labels: issue.labels.map(l => l.name),
    },
  };
}
```

### Command Integration

```typescript
// commands/work.ts
import { Command } from 'commander';
import { WorkManager } from '@fractary/faber/work';

export function registerWorkCommands(program: Command) {
  const work = program.command('work').description('Work tracking');

  work
    .command('fetch <issue>')
    .description('Fetch issue details')
    .action(async (issue: string) => {
      try {
        const manager = new WorkManager();
        const result = await manager.fetchIssue(issue);
        console.log(JSON.stringify(result, null, 2));
      } catch (error) {
        console.error('Error:', error instanceof Error ? error.message : error);
        process.exit(1);
      }
    });

  work
    .command('create')
    .description('Create a new issue')
    .requiredOption('-t, --title <title>', 'Issue title')
    .option('-b, --body <body>', 'Issue body')
    .option('--type <type>', 'Work type', 'feature')
    .option('-l, --labels <labels>', 'Comma-separated labels')
    .action(async (options) => {
      try {
        const manager = new WorkManager();
        const result = await manager.createIssue({
          title: options.title,
          body: options.body,
          workType: options.type,
          labels: options.labels?.split(','),
        });
        console.log('Created issue:', result.number);
      } catch (error) {
        console.error('Error:', error instanceof Error ? error.message : error);
        process.exit(1);
      }
    });

  work
    .command('classify <issue>')
    .description('Classify issue work type')
    .action(async (issue: string) => {
      try {
        const manager = new WorkManager();
        const issueData = await manager.fetchIssue(issue);
        const workType = await manager.classifyWorkType(issueData);
        console.log('Work type:', workType);
      } catch (error) {
        console.error('Error:', error instanceof Error ? error.message : error);
        process.exit(1);
      }
    });
}
```

## FABER Workflow Integration

### Basic Workflow

```typescript
import { FaberWorkflow } from '@fractary/faber/workflow';

const faber = new FaberWorkflow();

const result = await faber.run({
  workId: '123',
  autonomy: 'assisted',
});

console.log('Workflow completed:', result.status);
console.log('Phases:', result.phases.map(p => `${p.phase}: ${p.status}`));
```

### With Event Handling

```typescript
const faber = new FaberWorkflow();

faber.addEventListener((event, data) => {
  switch (event) {
    case 'workflow:start':
      console.log('Starting workflow:', data.workflowId);
      break;
    case 'phase:start':
      console.log(`Starting phase: ${data.phase}`);
      break;
    case 'phase:complete':
      console.log(`Completed phase: ${data.phase}`);
      break;
    case 'workflow:complete':
      console.log('Workflow completed successfully');
      break;
    case 'workflow:fail':
      console.error('Workflow failed:', data.error);
      break;
  }
});

await faber.run({ workId: '123', autonomy: 'guarded' });
```

### With User Input

```typescript
import { FaberWorkflow } from '@fractary/faber/workflow';
import * as readline from 'readline';

const faber = new FaberWorkflow();

// Set up user input handler
faber.setUserInputCallback(async (request) => {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    rl.question(`${request.message} (yes/no): `, (answer) => {
      rl.close();
      resolve(answer.toLowerCase() === 'yes' || answer.toLowerCase() === 'y');
    });
  });
});

await faber.run({ workId: '123', autonomy: 'assisted' });
```

### Custom Phase Configuration

```typescript
const faber = new FaberWorkflow({
  config: {
    autonomy: 'guarded',
    phases: {
      frame: { enabled: true },
      architect: { enabled: true, refineSpec: true },
      build: { enabled: true },
      evaluate: { enabled: true, maxRetries: 3 },
      release: {
        enabled: true,
        requestReviews: true,
        reviewers: ['@alice', '@bob'],
      },
    },
    hooks: {
      pre_build: 'npm run lint',
      post_build: 'npm test',
      pre_release: 'npm run build',
    },
  },
});
```

## Platform-Specific Behavior

### GitHub (Fully Implemented)

```typescript
const work = new WorkManager({ platform: 'github', owner: 'org', repo: 'repo' });

// All operations work
await work.createIssue({ title: 'Test' });
await work.fetchIssue(123);
await work.createComment(123, 'Comment');
```

### Jira/Linear (Stubs)

```typescript
const work = new WorkManager({ platform: 'jira', project: 'PROJ' });

// Will throw ProviderError
try {
  await work.createIssue({ title: 'Test' });
} catch (error) {
  // ProviderError: Jira createIssue not yet implemented
}
```

## Session Capture

```typescript
import { LogManager } from '@fractary/faber/logs';

const logs = new LogManager();

// Start capture before work begins
logs.startCapture({ issueNumber: 123 });

// ... do work ...

// Stop and get session data
const session = logs.stopCapture();
console.log('Session ID:', session.session_id);
console.log('Duration:', session.duration_ms);
```

## State Persistence

```typescript
import { StateManager } from '@fractary/faber/state';

const state = new StateManager();

// Check for existing workflow
const existing = state.getActiveWorkflow('123');
if (existing) {
  console.log('Resuming workflow:', existing.workflow_id);
  state.resumeWorkflow(existing.workflow_id);
} else {
  console.log('Starting new workflow');
  const workflow = state.createWorkflow('123');
}
```

## Specification Management

```typescript
import { SpecManager, SpecTemplateType } from '@fractary/faber/spec';

const spec = new SpecManager();

// Create from template
const newSpec = spec.createSpec('Add user authentication', {
  template: 'feature' as SpecTemplateType,
  workId: '123',
  context: 'OAuth 2.0 support needed',
});

// Validate
const validation = spec.validateSpec(newSpec.id);
if (validation.status !== 'pass') {
  console.log('Issues:', validation.suggestions);
}

// Generate refinement questions
const questions = spec.generateRefinementQuestions(newSpec.id);
for (const q of questions) {
  console.log(`[${q.priority}] ${q.question}`);
}
```

## Testing

### Mocking Managers

```typescript
import { WorkManager } from '@fractary/faber/work';

// Mock the manager
jest.mock('@fractary/faber/work', () => ({
  WorkManager: jest.fn().mockImplementation(() => ({
    fetchIssue: jest.fn().mockResolvedValue({
      number: 123,
      title: 'Test Issue',
      state: 'open',
    }),
    createComment: jest.fn().mockResolvedValue({
      id: 'comment-1',
      body: 'Test comment',
    }),
  })),
}));

// Test your integration
test('fetches issue', async () => {
  const work = new WorkManager();
  const issue = await work.fetchIssue(123);
  expect(issue.number).toBe(123);
});
```

## Migration from claude-plugins

If migrating existing skills/commands from claude-plugins:

### Before (claude-plugins)

```typescript
// Using gh CLI directly
import { execSync } from 'child_process';

function fetchIssue(number: number) {
  const result = execSync(
    `gh issue view ${number} --json number,title,body,state`,
    { encoding: 'utf-8' }
  );
  return JSON.parse(result);
}
```

### After (@fractary/faber)

```typescript
// Using SDK
import { WorkManager } from '@fractary/faber/work';

async function fetchIssue(number: number) {
  const work = new WorkManager();
  return work.fetchIssue(number);
}
```

Benefits:
- Type safety
- Consistent error handling
- Multi-platform support (when implemented)
- Configuration management
- No direct CLI dependencies in skill code
