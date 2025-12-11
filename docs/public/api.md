---
title: API Reference
description: Complete programmatic API documentation for the Faber SDK
visibility: public
---

# API Reference

Comprehensive API documentation for the `@fractary/faber` SDK.

## Installation

```bash
npm install @fractary/faber
```

## Module Imports

```typescript
// Import from root
import { WorkManager, RepoManager, FaberWorkflow } from '@fractary/faber';

// Or import from specific modules (tree-shakable)
import { WorkManager } from '@fractary/faber/work';
import { RepoManager } from '@fractary/faber/repo';
import { SpecManager } from '@fractary/faber/spec';
import { LogManager } from '@fractary/faber/logs';
import { StateManager } from '@fractary/faber/state';
import { FaberWorkflow } from '@fractary/faber/workflow';
import { StorageManager } from '@fractary/faber/storage';
```

---

## WorkManager

Multi-platform work tracking.

### Constructor

```typescript
new WorkManager(config?: WorkConfig)
```

**Parameters:**
- `config` (optional): Work configuration. If omitted, loads from `.fractary/plugins/work/config.json`

### Methods

#### createIssue

```typescript
createIssue(options: IssueCreateOptions): Promise<Issue>
```

Create a new issue.

```typescript
const issue = await work.createIssue({
  title: 'Add CSV export',
  body: 'Users need to export data as CSV',
  labels: ['enhancement'],
  assignees: ['alice'],
});
```

#### fetchIssue

```typescript
fetchIssue(issueId: string | number): Promise<Issue>
```

Fetch issue by ID.

#### updateIssue

```typescript
updateIssue(issueId: string | number, options: IssueUpdateOptions): Promise<Issue>
```

Update an existing issue.

#### closeIssue / reopenIssue

```typescript
closeIssue(issueId: string | number): Promise<Issue>
reopenIssue(issueId: string | number): Promise<Issue>
```

#### searchIssues

```typescript
searchIssues(query: string, filters?: IssueFilters): Promise<Issue[]>
```

Search for issues.

```typescript
const issues = await work.searchIssues('authentication', {
  state: 'open',
  labels: ['bug'],
});
```

#### assignIssue / unassignIssue

```typescript
assignIssue(issueId: string | number, assignee: string): Promise<Issue>
unassignIssue(issueId: string | number): Promise<Issue>
```

#### createComment

```typescript
createComment(
  issueId: string | number,
  body: string,
  faberContext?: FaberContext
): Promise<Comment>
```

Add a comment to an issue.

#### listComments

```typescript
listComments(
  issueId: string | number,
  options?: { limit?: number; since?: string }
): Promise<Comment[]>
```

#### addLabels / removeLabels / setLabels

```typescript
addLabels(issueId: string | number, labels: string[]): Promise<Label[]>
removeLabels(issueId: string | number, labels: string[]): Promise<void>
setLabels(issueId: string | number, labels: string[]): Promise<Label[]>
```

#### classifyWorkType

```typescript
classifyWorkType(issue: Issue): Promise<WorkType>
```

Classify the type of work based on issue content.

```typescript
const workType = await work.classifyWorkType(issue);
// Returns: 'feature' | 'bug' | 'chore' | 'patch' | 'infrastructure' | 'api'
```

---

## RepoManager

Git and repository operations.

### Constructor

```typescript
new RepoManager(config?: RepoConfig)
```

### Branch Methods

#### createBranch

```typescript
createBranch(name: string, options?: BranchCreateOptions): Promise<Branch>
```

```typescript
await repo.createBranch('feature/add-auth', {
  base: 'main',
  fromProtected: true,
});
```

#### deleteBranch

```typescript
deleteBranch(name: string, options?: BranchDeleteOptions): Promise<void>
```

#### listBranches

```typescript
listBranches(options?: BranchListOptions): Promise<Branch[]>
```

```typescript
const branches = await repo.listBranches({
  merged: true,
  limit: 50,
});
```

#### getBranch

```typescript
getBranch(name: string): Promise<Branch | null>
```

#### generateBranchName

```typescript
generateBranchName(options: BranchNameOptions): string
```

Generate a semantic branch name.

```typescript
const name = repo.generateBranchName({
  type: 'feature',
  description: 'Add CSV export',
  workId: '123',
});
// Returns: 'feature/123-add-csv-export'
```

### Pull Request Methods

#### createPR

```typescript
createPR(options: PRCreateOptions): Promise<PullRequest>
```

```typescript
const pr = await repo.createPR({
  title: 'Add CSV export feature',
  body: 'Implements CSV export for user data',
  head: 'feature/add-export',
  base: 'main',
  draft: false,
});
```

#### getPR

```typescript
getPR(number: number): Promise<PullRequest>
```

#### updatePR

```typescript
updatePR(number: number, options: PRUpdateOptions): Promise<PullRequest>
```

#### listPRs

```typescript
listPRs(options?: PRListOptions): Promise<PullRequest[]>
```

#### mergePR

```typescript
mergePR(number: number, options?: PRMergeOptions): Promise<PullRequest>
```

```typescript
await repo.mergePR(45, {
  strategy: 'squash',
  commitTitle: 'feat: Add CSV export',
  deleteBranch: true,
});
```

#### addPRComment

```typescript
addPRComment(number: number, body: string): Promise<void>
```

#### requestReview

```typescript
requestReview(number: number, reviewers: string[]): Promise<void>
```

#### approvePR

```typescript
approvePR(number: number, comment?: string): Promise<void>
```

### Git Methods

#### commit

```typescript
commit(options: CommitOptions): string
```

Create a commit and return the SHA.

```typescript
const sha = repo.commit({
  message: 'Add export button',
  type: 'feat',
  scope: 'ui',
});
```

#### push

```typescript
push(options?: PushOptions): void
```

```typescript
repo.push({
  branch: 'feature/add-export',
  setUpstream: true,
});
```

#### pull

```typescript
pull(options?: PullOptions): void
```

#### getCurrentBranch / getDefaultBranch

```typescript
getCurrentBranch(): string
getDefaultBranch(): string
```

#### isClean / hasUnpushedCommits

```typescript
isClean(): boolean
hasUnpushedCommits(): boolean
```

---

## SpecManager

Specification management.

### Constructor

```typescript
new SpecManager(config?: SpecConfig)
```

### Methods

#### createSpec

```typescript
createSpec(title: string, options?: CreateSpecOptions): Specification
```

```typescript
const spec = spec.createSpec('Add authentication', {
  template: 'feature',
  workId: '123',
  context: 'Additional context from issue body',
});
```

#### getSpec

```typescript
getSpec(idOrPath: string): Specification | null
```

#### updateSpec

```typescript
updateSpec(idOrPath: string, updates: SpecUpdates): Specification
```

#### deleteSpec

```typescript
deleteSpec(idOrPath: string): boolean
```

#### listSpecs

```typescript
listSpecs(filters?: SpecFilters): Specification[]
```

```typescript
const specs = spec.listSpecs({
  status: 'draft',
  workId: '123',
});
```

#### searchSpecs

```typescript
searchSpecs(query: string): Specification[]
```

#### validateSpec

```typescript
validateSpec(idOrPath: string): ValidationResult
```

```typescript
const validation = spec.validateSpec('SPEC-001');
// {
//   status: 'warn',
//   completeness: 0.75,
//   suggestions: ['Add acceptance criteria'],
// }
```

#### generateRefinementQuestions

```typescript
generateRefinementQuestions(idOrPath: string): RefinementQuestion[]
```

```typescript
const questions = spec.generateRefinementQuestions('SPEC-001');
// [
//   { id: 'q1', question: 'What auth method?', priority: 'high' },
//   { id: 'q2', question: 'Token expiry time?', priority: 'medium' },
// ]
```

#### applyRefinements

```typescript
applyRefinements(
  idOrPath: string,
  answers: Record<string, string>
): RefinementResult
```

#### getTemplates

```typescript
getTemplates(): SpecTemplate[]
```

---

## LogManager

Session capture and log management.

### Constructor

```typescript
new LogManager(config?: LogConfig)
```

### Methods

#### startCapture

```typescript
startCapture(options?: CaptureOptions): void
```

```typescript
logs.startCapture({
  issueNumber: 123,
});
```

#### stopCapture

```typescript
stopCapture(): SessionLog
```

#### isCapturing

```typescript
isCapturing(): boolean
```

#### getLog

```typescript
getLog(logId: string): SessionLog | null
```

#### listLogs

```typescript
listLogs(filters?: LogFilters): LogSummary[]
```

#### deleteLog

```typescript
deleteLog(logId: string): boolean
```

#### exportLog

```typescript
exportLog(logId: string, path: string, format: 'markdown' | 'json'): void
```

---

## StateManager

Workflow state persistence.

### Constructor

```typescript
new StateManager(config?: StateConfig)
```

### Workflow Methods

#### createWorkflow

```typescript
createWorkflow(workId: string): WorkflowState
```

#### getWorkflow

```typescript
getWorkflow(workflowId: string): WorkflowState | null
```

#### getActiveWorkflow

```typescript
getActiveWorkflow(workId: string): WorkflowState | null
```

#### listWorkflows

```typescript
listWorkflows(filters?: WorkflowFilters): WorkflowState[]
```

### Phase Methods

#### startPhase / completePhase / failPhase / skipPhase

```typescript
startPhase(workflowId: string, phase: FaberPhase): void
completePhase(workflowId: string, phase: FaberPhase, outputs?: Record<string, unknown>): void
failPhase(workflowId: string, phase: FaberPhase, error: string): void
skipPhase(workflowId: string, phase: FaberPhase, reason?: string): void
```

### Checkpoint Methods

#### createCheckpoint

```typescript
createCheckpoint(workflowId: string, name: string): Checkpoint
```

#### restoreFromCheckpoint

```typescript
restoreFromCheckpoint(workflowId: string, name: string): void
```

---

## FaberWorkflow

FABER workflow orchestration.

### Constructor

```typescript
new FaberWorkflow(options?: {
  config?: Partial<WorkflowConfig>
})
```

```typescript
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
    hooks: {
      pre_build: 'npm run lint',
      post_build: 'npm test',
    },
  },
});
```

### Methods

#### setUserInputCallback

```typescript
setUserInputCallback(callback: UserInputCallback): void
```

Set callback for user confirmation prompts.

```typescript
faber.setUserInputCallback(async (request) => {
  const answer = await promptUser(request.message);
  return answer === 'yes';
});
```

#### addEventListener / removeEventListener

```typescript
addEventListener(listener: EventListener): void
removeEventListener(listener: EventListener): void
```

```typescript
faber.addEventListener((event, data) => {
  console.log(`${event}:`, data);
});
```

#### run

```typescript
run(options: WorkflowOptions): Promise<WorkflowResult>
```

Execute the FABER workflow.

```typescript
const result = await faber.run({
  workId: '123',
  autonomy: 'assisted',
});
```

#### resume

```typescript
resume(workflowId: string): Promise<WorkflowResult>
```

Resume a paused workflow.

#### pause

```typescript
pause(workflowId: string): void
```

#### getStatus

```typescript
getStatus(workflowId: string): {
  state: Record<string, unknown> | null;
  currentPhase: string;
  progress: number;
}
```

---

## Types

### WorkType

```typescript
type WorkType = 'feature' | 'bug' | 'chore' | 'patch' | 'infrastructure' | 'api';
```

### FaberPhase

```typescript
type FaberPhase = 'frame' | 'architect' | 'build' | 'evaluate' | 'release';
```

### AutonomyLevel

```typescript
type AutonomyLevel = 'dry-run' | 'assisted' | 'guarded' | 'autonomous';
```

### WorkflowEvent

```typescript
type WorkflowEvent =
  | 'workflow:start'
  | 'workflow:complete'
  | 'workflow:fail'
  | 'workflow:pause'
  | 'phase:start'
  | 'phase:complete'
  | 'phase:fail'
  | 'phase:skip'
  | 'artifact:create';
```

### Issue

```typescript
interface Issue {
  number: number;
  title: string;
  body: string;
  state: 'open' | 'closed';
  labels: Label[];
  assignees: string[];
  milestone?: Milestone;
  author: string;
  created_at: string;
  updated_at: string;
  url: string;
}
```

### PullRequest

```typescript
interface PullRequest {
  number: number;
  title: string;
  body: string;
  state: 'open' | 'closed' | 'merged';
  head: string;
  base: string;
  author: string;
  url: string;
  isDraft: boolean;
  mergeable: boolean;
  reviewDecision?: 'APPROVED' | 'CHANGES_REQUESTED' | 'REVIEW_REQUIRED';
}
```

### ValidationResult

```typescript
interface ValidationResult {
  status: 'pass' | 'warn' | 'fail';
  completeness: number;
  suggestions?: string[];
}
```

### WorkflowResult

```typescript
interface WorkflowResult {
  workflow_id: string;
  work_id: string;
  status: 'completed' | 'failed' | 'paused';
  phases: PhaseResult[];
  duration_ms: number;
  artifacts: ArtifactManifest[];
}
```

---

## Errors

```typescript
import {
  FaberError,           // Base error class
  ConfigurationError,   // Invalid or missing configuration
  ProviderError,        // Platform API errors
  WorkflowError,        // Workflow execution errors
  SpecError,            // Specification errors
  LogError,             // Logging errors
  StateError,           // State management errors
  IssueNotFoundError,   // Issue not found
  PRNotFoundError,      // PR not found
  BranchExistsError,    // Branch already exists
  MergeConflictError,   // PR merge conflict
} from '@fractary/faber';
```

---

## Configuration Helpers

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
```

---

## See Also

- [Getting Started](./getting-started.md) - Installation guide
- [Concepts](./concepts.md) - Architecture overview
- [CLI Reference](./cli.md) - Command-line interface
