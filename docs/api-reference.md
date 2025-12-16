# API Reference

## WorkManager

```typescript
import { WorkManager } from '@fractary/faber/work';
```

### Constructor

```typescript
new WorkManager(config?: WorkConfig)
```

### Methods

| Method | Parameters | Returns | Description |
|--------|------------|---------|-------------|
| `getPlatform()` | - | `string` | Get current platform name |
| `createIssue(options)` | `IssueCreateOptions` | `Promise<Issue>` | Create a new issue |
| `fetchIssue(issueId)` | `string \| number` | `Promise<Issue>` | Fetch issue by ID |
| `updateIssue(issueId, options)` | `string \| number`, `IssueUpdateOptions` | `Promise<Issue>` | Update issue |
| `closeIssue(issueId)` | `string \| number` | `Promise<Issue>` | Close an issue |
| `reopenIssue(issueId)` | `string \| number` | `Promise<Issue>` | Reopen an issue |
| `searchIssues(query, filters?)` | `string`, `IssueFilters?` | `Promise<Issue[]>` | Search issues |
| `assignIssue(issueId, assignee)` | `string \| number`, `string` | `Promise<Issue>` | Assign issue |
| `unassignIssue(issueId)` | `string \| number` | `Promise<Issue>` | Unassign issue |
| `createComment(issueId, body, context?)` | `string \| number`, `string`, `FaberContext?` | `Promise<Comment>` | Add comment |
| `listComments(issueId, options?)` | `string \| number`, `ListCommentsOptions?` | `Promise<Comment[]>` | List comments |
| `addLabels(issueId, labels)` | `string \| number`, `string[]` | `Promise<Label[]>` | Add labels |
| `removeLabels(issueId, labels)` | `string \| number`, `string[]` | `Promise<void>` | Remove labels |
| `setLabels(issueId, labels)` | `string \| number`, `string[]` | `Promise<Label[]>` | Replace labels |
| `listLabels(issueId?)` | `string \| number?` | `Promise<Label[]>` | List labels |
| `createMilestone(options)` | `MilestoneCreateOptions` | `Promise<Milestone>` | Create milestone |
| `setMilestone(issueId, milestone)` | `string \| number`, `string` | `Promise<Issue>` | Set milestone |
| `removeMilestone(issueId)` | `string \| number` | `Promise<Issue>` | Remove milestone |
| `listMilestones(state?)` | `'open' \| 'closed' \| 'all'?` | `Promise<Milestone[]>` | List milestones |
| `classifyWorkType(issue)` | `Issue` | `Promise<WorkType>` | Classify work type |

---

## RepoManager

```typescript
import { RepoManager } from '@fractary/faber/repo';
```

### Constructor

```typescript
new RepoManager(config?: RepoConfig)
```

### Methods

#### Branch Operations

| Method | Parameters | Returns | Description |
|--------|------------|---------|-------------|
| `createBranch(name, options?)` | `string`, `BranchCreateOptions?` | `Promise<Branch>` | Create branch |
| `deleteBranch(name, options?)` | `string`, `BranchDeleteOptions?` | `Promise<void>` | Delete branch |
| `listBranches(options?)` | `BranchListOptions?` | `Promise<Branch[]>` | List branches |
| `getBranch(name)` | `string` | `Promise<Branch \| null>` | Get branch |
| `generateBranchName(options)` | `BranchNameOptions` | `string` | Generate semantic name |

#### Pull Request Operations

| Method | Parameters | Returns | Description |
|--------|------------|---------|-------------|
| `createPR(options)` | `PRCreateOptions` | `Promise<PullRequest>` | Create PR |
| `getPR(number)` | `number` | `Promise<PullRequest>` | Get PR |
| `updatePR(number, options)` | `number`, `PRUpdateOptions` | `Promise<PullRequest>` | Update PR |
| `listPRs(options?)` | `PRListOptions?` | `Promise<PullRequest[]>` | List PRs |
| `mergePR(number, options?)` | `number`, `PRMergeOptions?` | `Promise<PullRequest>` | Merge PR |
| `addPRComment(number, body)` | `number`, `string` | `Promise<void>` | Comment on PR |
| `requestReview(number, reviewers)` | `number`, `string[]` | `Promise<void>` | Request reviews |
| `approvePR(number, comment?)` | `number`, `string?` | `Promise<void>` | Approve PR |

#### Git Operations

| Method | Parameters | Returns | Description |
|--------|------------|---------|-------------|
| `commit(options)` | `CommitOptions` | `string` | Create commit |
| `push(options?)` | `PushOptions?` | `void` | Push to remote |
| `pull(options?)` | `PullOptions?` | `void` | Pull from remote |
| `fetch(options?)` | `FetchOptions?` | `void` | Fetch from remote |
| `getCurrentBranch()` | - | `string` | Get current branch |
| `getDefaultBranch()` | - | `string` | Get default branch |
| `isClean()` | - | `boolean` | Check working tree |
| `hasUnpushedCommits()` | - | `boolean` | Check for unpushed |

#### Worktree Operations

| Method | Parameters | Returns | Description |
|--------|------------|---------|-------------|
| `createWorktree(options)` | `WorktreeCreateOptions` | `Worktree` | Create worktree |
| `removeWorktree(name, force?)` | `string`, `boolean?` | `void` | Remove worktree |
| `listWorktrees()` | - | `Worktree[]` | List worktrees |
| `cleanupWorktrees(options?)` | `WorktreeCleanupOptions?` | `number` | Cleanup stale |

---

## SpecManager

```typescript
import { SpecManager } from '@fractary/faber/spec';
```

### Constructor

```typescript
new SpecManager(config?: SpecConfig)
```

### Methods

| Method | Parameters | Returns | Description |
|--------|------------|---------|-------------|
| `createSpec(title, options?)` | `string`, `CreateSpecOptions?` | `Specification` | Create spec |
| `getSpec(idOrPath)` | `string` | `Specification \| null` | Get spec |
| `updateSpec(idOrPath, updates)` | `string`, `SpecUpdates` | `Specification` | Update spec |
| `deleteSpec(idOrPath)` | `string` | `boolean` | Delete spec |
| `listSpecs(filters?)` | `SpecFilters?` | `Specification[]` | List specs |
| `searchSpecs(query)` | `string` | `Specification[]` | Search specs |
| `validateSpec(idOrPath)` | `string` | `ValidationResult` | Validate spec |
| `generateRefinementQuestions(idOrPath)` | `string` | `RefinementQuestion[]` | Generate questions |
| `applyRefinements(idOrPath, answers)` | `string`, `Record<string, string>` | `RefinementResult` | Apply refinements |
| `getTemplates()` | - | `SpecTemplate[]` | Get templates |
| `exportSpec(idOrPath, format)` | `string`, `'markdown' \| 'json'` | `string` | Export spec |

---

## LogManager

```typescript
import { LogManager } from '@fractary/faber/logs';
```

### Constructor

```typescript
new LogManager(config?: LogConfig)
```

### Methods

| Method | Parameters | Returns | Description |
|--------|------------|---------|-------------|
| `startCapture(options?)` | `CaptureOptions?` | `void` | Start capturing |
| `stopCapture()` | - | `SessionLog` | Stop and return log |
| `isCapturing()` | - | `boolean` | Check if capturing |
| `addEntry(entry)` | `LogEntry` | `void` | Add log entry |
| `getLog(logId)` | `string` | `SessionLog \| null` | Get log |
| `listLogs(filters?)` | `LogFilters?` | `LogSummary[]` | List logs |
| `deleteLog(logId)` | `string` | `boolean` | Delete log |
| `exportLog(logId, path, format)` | `string`, `string`, `ExportFormat` | `void` | Export log |

---

## StateManager

```typescript
import { StateManager } from '@fractary/faber/state';
```

### Constructor

```typescript
new StateManager(config?: StateConfig)
```

### Methods

#### Workflow Management

| Method | Parameters | Returns | Description |
|--------|------------|---------|-------------|
| `createWorkflow(workId)` | `string` | `WorkflowState` | Create workflow |
| `getWorkflow(workflowId)` | `string` | `WorkflowState \| null` | Get workflow |
| `getActiveWorkflow(workId)` | `string` | `WorkflowState \| null` | Get active by work ID |
| `listWorkflows(filters?)` | `WorkflowFilters?` | `WorkflowState[]` | List workflows |
| `deleteWorkflow(workflowId)` | `string` | `boolean` | Delete workflow |

#### Phase Management

| Method | Parameters | Returns | Description |
|--------|------------|---------|-------------|
| `startPhase(workflowId, phase)` | `string`, `FaberPhase` | `void` | Start phase |
| `completePhase(workflowId, phase, outputs?)` | `string`, `FaberPhase`, `Record<string, unknown>?` | `void` | Complete phase |
| `failPhase(workflowId, phase, error)` | `string`, `FaberPhase`, `string` | `void` | Fail phase |
| `skipPhase(workflowId, phase, reason?)` | `string`, `FaberPhase`, `string?` | `void` | Skip phase |

#### Workflow Control

| Method | Parameters | Returns | Description |
|--------|------------|---------|-------------|
| `pauseWorkflow(workflowId)` | `string` | `void` | Pause workflow |
| `resumeWorkflow(workflowId)` | `string` | `void` | Resume workflow |

#### Checkpoints

| Method | Parameters | Returns | Description |
|--------|------------|---------|-------------|
| `createCheckpoint(workflowId, name)` | `string`, `string` | `Checkpoint` | Create checkpoint |
| `listCheckpoints(workflowId)` | `string` | `Checkpoint[]` | List checkpoints |
| `restoreFromCheckpoint(workflowId, name)` | `string`, `string` | `void` | Restore checkpoint |

#### Manifests

| Method | Parameters | Returns | Description |
|--------|------------|---------|-------------|
| `createManifest(workflowId, workId)` | `string`, `string` | `RunManifest` | Create manifest |
| `getManifest(manifestId)` | `string` | `RunManifest \| null` | Get manifest |
| `addPhaseToManifest(manifestId, phase)` | `string`, `PhaseManifest` | `void` | Add phase |
| `addArtifactToManifest(manifestId, artifact)` | `string`, `ArtifactManifest` | `void` | Add artifact |
| `completeManifest(manifestId, status)` | `string`, `'completed' \| 'failed'` | `void` | Complete manifest |

---

## FaberWorkflow

```typescript
import { FaberWorkflow } from '@fractary/faber/workflow';
```

### Constructor

```typescript
new FaberWorkflow(options?: { config?: Partial<WorkflowConfig> })
```

### Methods

| Method | Parameters | Returns | Description |
|--------|------------|---------|-------------|
| `setUserInputCallback(callback)` | `UserInputCallback` | `void` | Set input handler |
| `addEventListener(listener)` | `EventListener` | `void` | Add event listener |
| `removeEventListener(listener)` | `EventListener` | `void` | Remove listener |
| `run(options)` | `WorkflowOptions` | `Promise<WorkflowResult>` | Run workflow |
| `resume(workflowId)` | `string` | `Promise<WorkflowResult>` | Resume workflow |
| `pause(workflowId)` | `string` | `void` | Pause workflow |
| `getStatus(workflowId)` | `string` | `WorkflowStatus` | Get status |

### Events

| Event | Data | Description |
|-------|------|-------------|
| `workflow:start` | `{ workflowId, workId, autonomy }` | Workflow started |
| `workflow:complete` | `WorkflowResult` | Workflow completed |
| `workflow:fail` | `{ workflowId, error }` | Workflow failed |
| `workflow:pause` | `{ workflowId, phase, message }` | Workflow paused |
| `phase:start` | `{ workflowId, phase }` | Phase started |
| `phase:complete` | `{ workflowId, phase, outputs }` | Phase completed |
| `phase:fail` | `{ workflowId, phase, error }` | Phase failed |
| `phase:skip` | `{ workflowId, phase }` | Phase skipped |
| `artifact:create` | `ArtifactManifest` | Artifact created |

---

## StorageManager

```typescript
import { StorageManager } from '@fractary/faber/storage';
```

### Constructor

```typescript
new StorageManager(config?: StorageConfig)
```

### Methods

| Method | Parameters | Returns | Description |
|--------|------------|---------|-------------|
| `store(path, content)` | `string`, `string` | `Promise<void>` | Store content |
| `retrieve(path)` | `string` | `Promise<string>` | Retrieve content |
| `exists(path)` | `string` | `Promise<boolean>` | Check existence |
| `delete(path)` | `string` | `Promise<boolean>` | Delete content |
| `list(prefix?)` | `string?` | `Promise<string[]>` | List items |
| `hasCodexIntegration()` | - | `boolean` | Check Codex |
| `syncToCodex(path?)` | `string?` | `Promise<void>` | Sync to Codex |

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
```

| Function | Parameters | Returns | Description |
|----------|------------|---------|-------------|
| `findProjectRoot(startPath?)` | `string?` | `string` | Find project root |
| `loadWorkConfig(root?)` | `string?` | `WorkConfig \| null` | Load work config |
| `loadRepoConfig(root?)` | `string?` | `RepoConfig \| null` | Load repo config |
| `loadSpecConfig(root?)` | `string?` | `SpecConfig \| null` | Load spec config |
| `loadLogConfig(root?)` | `string?` | `LogConfig \| null` | Load log config |
| `loadStateConfig(root?)` | `string?` | `StateConfig \| null` | Load state config |

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
