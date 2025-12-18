# API Reference

Comprehensive API documentation for the `@fractary/faber` SDK, providing programmatic access to FABER workflow automation, work tracking, repository management, and more.

## Table of Contents

- [Installation](#installation)
- [Module Imports](#module-imports)
- [WorkManager](#workmanager)
- [RepoManager](#repomanager)
- [SpecManager](#specmanager)
- [LogManager](#logmanager)
- [StateManager](#statemanager)
- [FaberWorkflow](#faberworkflow)
- [StorageManager](#storagemanager)
- [Configuration Helpers](#configuration-helpers)
- [Types](#types)
- [Error Classes](#error-classes)

---

## Installation

```bash
npm install @fractary/faber
```

**TypeScript:**
```typescript
import { WorkManager, RepoManager, FaberWorkflow } from '@fractary/faber';
```

**Python:**
```bash
pip install faber
```

```python
from faber import WorkManager, RepoManager, FaberWorkflow
```

---

## Module Imports

### TypeScript

```typescript
// Import from root (recommended for convenience)
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

### Python

```python
from faber import WorkManager, RepoManager, SpecManager
from faber.workflow import FaberWorkflow
from faber.logs import LogManager
from faber.state import StateManager
from faber.storage import StorageManager
```

---

## WorkManager

Multi-platform work tracking for GitHub Issues, Jira, and Linear.

### Constructor

**TypeScript:**
```typescript
new WorkManager(config?: WorkConfig)
```

**Python:**
```python
WorkManager(config: Optional[WorkConfig] = None)
```

**Parameters:**
- `config` (optional): Work configuration. If omitted, loads from `.fractary/plugins/work/config.json`

**Example:**

**TypeScript:**
```typescript
import { WorkManager } from '@fractary/faber/work';

const work = new WorkManager({
  platform: 'github',
  owner: 'fractary',
  repo: 'faber'
});
```

**Python:**
```python
from faber import WorkManager

work = WorkManager({
    "platform": "github",
    "owner": "fractary",
    "repo": "faber"
})
```

### Methods

#### Issue Operations

##### createIssue

```typescript
createIssue(options: IssueCreateOptions): Promise<Issue>
```

Create a new issue.

**TypeScript:**
```typescript
const issue = await work.createIssue({
  title: 'Add CSV export',
  body: 'Users need to export data as CSV',
  labels: ['enhancement'],
  assignees: ['alice'],
});
```

**Python:**
```python
issue = work.create_issue(
    title="Add CSV export",
    body="Users need to export data as CSV",
    labels=["enhancement"],
    assignees=["alice"]
)
```

##### fetchIssue

```typescript
fetchIssue(issueId: string | number): Promise<Issue>
```

Fetch issue by ID.

**TypeScript:**
```typescript
const issue = await work.fetchIssue(123);
```

**Python:**
```python
issue = work.fetch_issue(123)
```

##### updateIssue

```typescript
updateIssue(issueId: string | number, options: IssueUpdateOptions): Promise<Issue>
```

Update an existing issue.

**TypeScript:**
```typescript
const updated = await work.updateIssue(123, {
  title: 'Updated title',
  state: 'closed'
});
```

**Python:**
```python
updated = work.update_issue(123, title="Updated title", state="closed")
```

##### closeIssue / reopenIssue

```typescript
closeIssue(issueId: string | number): Promise<Issue>
reopenIssue(issueId: string | number): Promise<Issue>
```

**TypeScript:**
```typescript
await work.closeIssue(123);
await work.reopenIssue(123);
```

**Python:**
```python
work.close_issue(123)
work.reopen_issue(123)
```

##### searchIssues

```typescript
searchIssues(query: string, filters?: IssueFilters): Promise<Issue[]>
```

Search for issues.

**TypeScript:**
```typescript
const issues = await work.searchIssues('authentication', {
  state: 'open',
  labels: ['bug'],
});
```

**Python:**
```python
issues = work.search_issues("authentication", state="open", labels=["bug"])
```

##### assignIssue / unassignIssue

```typescript
assignIssue(issueId: string | number, assignee: string): Promise<Issue>
unassignIssue(issueId: string | number): Promise<Issue>
```

**TypeScript:**
```typescript
await work.assignIssue(123, 'alice');
await work.unassignIssue(123);
```

**Python:**
```python
work.assign_issue(123, "alice")
work.unassign_issue(123)
```

#### Comment Operations

##### createComment

```typescript
createComment(
  issueId: string | number,
  body: string,
  faberContext?: FaberContext
): Promise<Comment>
```

Add a comment to an issue.

**TypeScript:**
```typescript
const comment = await work.createComment(123, 'Starting implementation', {
  phase: 'build',
  workflowId: 'WF-abc123'
});
```

**Python:**
```python
comment = work.create_comment(
    123,
    "Starting implementation",
    faber_context={"phase": "build", "workflow_id": "WF-abc123"}
)
```

##### listComments

```typescript
listComments(
  issueId: string | number,
  options?: { limit?: number; since?: string }
): Promise<Comment[]>
```

**TypeScript:**
```typescript
const comments = await work.listComments(123, { limit: 10 });
```

**Python:**
```python
comments = work.list_comments(123, limit=10)
```

#### Label Operations

##### addLabels / removeLabels / setLabels

```typescript
addLabels(issueId: string | number, labels: string[]): Promise<Label[]>
removeLabels(issueId: string | number, labels: string[]): Promise<void>
setLabels(issueId: string | number, labels: string[]): Promise<Label[]>
```

**TypeScript:**
```typescript
await work.addLabels(123, ['bug', 'critical']);
await work.removeLabels(123, ['wontfix']);
await work.setLabels(123, ['bug', 'critical']); // Replace all labels
```

**Python:**
```python
work.add_labels(123, ["bug", "critical"])
work.remove_labels(123, ["wontfix"])
work.set_labels(123, ["bug", "critical"])  # Replace all labels
```

##### listLabels

```typescript
listLabels(issueId?: string | number): Promise<Label[]>
```

List all labels (if no issueId) or labels on a specific issue.

#### Milestone Operations

##### createMilestone

```typescript
createMilestone(options: MilestoneCreateOptions): Promise<Milestone>
```

**TypeScript:**
```typescript
const milestone = await work.createMilestone({
  title: 'v1.0',
  dueOn: '2025-12-31',
  description: 'First major release'
});
```

**Python:**
```python
milestone = work.create_milestone(
    title="v1.0",
    due_on="2025-12-31",
    description="First major release"
)
```

##### setMilestone / removeMilestone

```typescript
setMilestone(issueId: string | number, milestone: string): Promise<Issue>
removeMilestone(issueId: string | number): Promise<Issue>
```

##### listMilestones

```typescript
listMilestones(state?: 'open' | 'closed' | 'all'): Promise<Milestone[]>
```

#### Work Classification

##### classifyWorkType

```typescript
classifyWorkType(issue: Issue): Promise<WorkType>
```

Classify the type of work based on issue content using AI.

**Returns:** `'feature' | 'bug' | 'chore' | 'patch' | 'infrastructure' | 'api'`

**TypeScript:**
```typescript
const issue = await work.fetchIssue(123);
const workType = await work.classifyWorkType(issue);
// Returns: 'feature'
```

**Python:**
```python
issue = work.fetch_issue(123)
work_type = work.classify_work_type(issue)
# Returns: "feature"
```

---

## RepoManager

Git and repository operations supporting GitHub, GitLab, and Bitbucket.

### Constructor

**TypeScript:**
```typescript
new RepoManager(config?: RepoConfig)
```

**Python:**
```python
RepoManager(config: Optional[RepoConfig] = None)
```

**Example:**

**TypeScript:**
```typescript
import { RepoManager } from '@fractary/faber/repo';

const repo = new RepoManager({
  platform: 'github',
  owner: 'fractary',
  repo: 'faber'
});
```

**Python:**
```python
from faber import RepoManager

repo = RepoManager({
    "platform": "github",
    "owner": "fractary",
    "repo": "faber"
})
```

### Branch Methods

#### createBranch

```typescript
createBranch(name: string, options?: BranchCreateOptions): Promise<Branch>
```

**TypeScript:**
```typescript
await repo.createBranch('feature/add-auth', {
  base: 'main',
  fromProtected: true,
});
```

**Python:**
```python
repo.create_branch("feature/add-auth", base="main", from_protected=True)
```

#### deleteBranch

```typescript
deleteBranch(name: string, options?: BranchDeleteOptions): Promise<void>
```

**TypeScript:**
```typescript
await repo.deleteBranch('feature/old-feature', { force: false });
```

**Python:**
```python
repo.delete_branch("feature/old-feature", force=False)
```

#### listBranches

```typescript
listBranches(options?: BranchListOptions): Promise<Branch[]>
```

**TypeScript:**
```typescript
const branches = await repo.listBranches({
  merged: true,
  limit: 50,
});
```

**Python:**
```python
branches = repo.list_branches(merged=True, limit=50)
```

#### generateBranchName

```typescript
generateBranchName(options: BranchNameOptions): string
```

Generate a semantic branch name following conventions.

**TypeScript:**
```typescript
const name = repo.generateBranchName({
  type: 'feature',
  description: 'Add CSV export',
  workId: '123',
});
// Returns: 'feature/123-add-csv-export'
```

**Python:**
```python
name = repo.generate_branch_name(
    type="feature",
    description="Add CSV export",
    work_id="123"
)
# Returns: "feature/123-add-csv-export"
```

### Pull Request Methods

#### createPR

```typescript
createPR(options: PRCreateOptions): Promise<PullRequest>
```

**TypeScript:**
```typescript
const pr = await repo.createPR({
  title: 'Add CSV export feature',
  body: 'Implements CSV export for user data',
  head: 'feature/add-export',
  base: 'main',
  draft: false,
});
```

**Python:**
```python
pr = repo.create_pr(
    title="Add CSV export feature",
    body="Implements CSV export for user data",
    head="feature/add-export",
    base="main",
    draft=False
)
```

#### mergePR

```typescript
mergePR(number: number, options?: PRMergeOptions): Promise<PullRequest>
```

**TypeScript:**
```typescript
await repo.mergePR(45, {
  strategy: 'squash',
  commitTitle: 'feat: Add CSV export',
  deleteBranch: true,
});
```

**Python:**
```python
repo.merge_pr(
    45,
    strategy="squash",
    commit_title="feat: Add CSV export",
    delete_branch=True
)
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

**TypeScript:**
```typescript
const sha = repo.commit({
  message: 'Add export button',
  type: 'feat',
  scope: 'ui',
});
```

**Python:**
```python
sha = repo.commit(message="Add export button", type="feat", scope="ui")
```

#### push

```typescript
push(options?: PushOptions): void
```

**TypeScript:**
```typescript
repo.push({
  branch: 'feature/add-export',
  setUpstream: true,
});
```

**Python:**
```python
repo.push(branch="feature/add-export", set_upstream=True)
```

#### getCurrentBranch / getDefaultBranch

```typescript
getCurrentBranch(): string
getDefaultBranch(): string
```

**TypeScript:**
```typescript
const current = repo.getCurrentBranch(); // 'feature/add-export'
const main = repo.getDefaultBranch(); // 'main'
```

**Python:**
```python
current = repo.get_current_branch()  # "feature/add-export"
main = repo.get_default_branch()  # "main"
```

#### isClean / hasUnpushedCommits

```typescript
isClean(): boolean
hasUnpushedCommits(): boolean
```

Check working tree status and unpushed commits.

### Worktree Methods

#### createWorktree

```typescript
createWorktree(options: WorktreeCreateOptions): Worktree
```

**TypeScript:**
```typescript
const worktree = repo.createWorktree({
  branch: 'feature/parallel-work',
  path: '../worktrees/parallel-work',
});
```

**Python:**
```python
worktree = repo.create_worktree(
    branch="feature/parallel-work",
    path="../worktrees/parallel-work"
)
```

#### removeWorktree

```typescript
removeWorktree(name: string, force?: boolean): void
```

#### listWorktrees

```typescript
listWorktrees(): Worktree[]
```

#### cleanupWorktrees

```typescript
cleanupWorktrees(options?: WorktreeCleanupOptions): number
```

Clean up stale worktrees and return count removed.

---

## SpecManager

Specification management for FABER workflows.

### Constructor

**TypeScript:**
```typescript
new SpecManager(config?: SpecConfig)
```

**Python:**
```python
SpecManager(config: Optional[SpecConfig] = None)
```

### Methods

#### createSpec

```typescript
createSpec(title: string, options?: CreateSpecOptions): Specification
```

**TypeScript:**
```typescript
const spec = specManager.createSpec('Add authentication', {
  template: 'feature',
  workId: '123',
  context: 'Additional context from issue body',
});
```

**Python:**
```python
spec = spec_manager.create_spec(
    "Add authentication",
    template="feature",
    work_id="123",
    context="Additional context from issue body"
)
```

#### validateSpec

```typescript
validateSpec(idOrPath: string): ValidationResult
```

**TypeScript:**
```typescript
const validation = specManager.validateSpec('SPEC-001');
// {
//   status: 'warn',
//   completeness: 0.75,
//   suggestions: ['Add acceptance criteria'],
// }
```

**Python:**
```python
validation = spec_manager.validate_spec("SPEC-001")
# {
#   "status": "warn",
#   "completeness": 0.75,
#   "suggestions": ["Add acceptance criteria"]
# }
```

#### generateRefinementQuestions

```typescript
generateRefinementQuestions(idOrPath: string): RefinementQuestion[]
```

Generate questions to refine a specification.

**TypeScript:**
```typescript
const questions = specManager.generateRefinementQuestions('SPEC-001');
// [
//   { id: 'q1', question: 'What auth method?', priority: 'high' },
//   { id: 'q2', question: 'Token expiry time?', priority: 'medium' },
// ]
```

**Python:**
```python
questions = spec_manager.generate_refinement_questions("SPEC-001")
```

#### applyRefinements

```typescript
applyRefinements(
  idOrPath: string,
  answers: Record<string, string>
): RefinementResult
```

Apply refinement answers to update the specification.

**TypeScript:**
```typescript
const result = specManager.applyRefinements('SPEC-001', {
  q1: 'JWT tokens',
  q2: '24 hours',
});
```

**Python:**
```python
result = spec_manager.apply_refinements("SPEC-001", {
    "q1": "JWT tokens",
    "q2": "24 hours"
})
```

---

## LogManager

Session capture and audit trail management.

### Constructor

**TypeScript:**
```typescript
new LogManager(config?: LogConfig)
```

**Python:**
```python
LogManager(config: Optional[LogConfig] = None)
```

### Methods

#### startCapture

```typescript
startCapture(options?: CaptureOptions): void
```

**TypeScript:**
```typescript
logs.startCapture({
  issueNumber: 123,
  includeSystemLogs: true,
});
```

**Python:**
```python
logs.start_capture(issue_number=123, include_system_logs=True)
```

#### stopCapture

```typescript
stopCapture(): SessionLog
```

Stop capturing and return the session log.

#### exportLog

```typescript
exportLog(logId: string, path: string, format: 'markdown' | 'json'): void
```

**TypeScript:**
```typescript
logs.exportLog('LOG-20250117-001', './logs/session.md', 'markdown');
```

**Python:**
```python
logs.export_log("LOG-20250117-001", "./logs/session.md", "markdown")
```

---

## StateManager

Workflow state persistence and checkpoint management.

### Constructor

**TypeScript:**
```typescript
new StateManager(config?: StateConfig)
```

**Python:**
```python
StateManager(config: Optional[StateConfig] = None)
```

### Workflow Methods

#### createWorkflow

```typescript
createWorkflow(workId: string): WorkflowState
```

Create a new workflow state.

#### getActiveWorkflow

```typescript
getActiveWorkflow(workId: string): WorkflowState | null
```

Get the active workflow for a work item.

### Phase Methods

#### startPhase / completePhase / failPhase

```typescript
startPhase(workflowId: string, phase: FaberPhase): void
completePhase(workflowId: string, phase: FaberPhase, outputs?: Record<string, unknown>): void
failPhase(workflowId: string, phase: FaberPhase, error: string): void
```

**TypeScript:**
```typescript
state.startPhase('WF-abc123', 'build');
// ... do work ...
state.completePhase('WF-abc123', 'build', { artifactsCreated: 5 });
```

**Python:**
```python
state.start_phase("WF-abc123", "build")
# ... do work ...
state.complete_phase("WF-abc123", "build", {"artifacts_created": 5})
```

### Checkpoint Methods

#### createCheckpoint

```typescript
createCheckpoint(workflowId: string, name: string): Checkpoint
```

**TypeScript:**
```typescript
const checkpoint = state.createCheckpoint('WF-abc123', 'before-deploy');
```

**Python:**
```python
checkpoint = state.create_checkpoint("WF-abc123", "before-deploy")
```

#### restoreFromCheckpoint

```typescript
restoreFromCheckpoint(workflowId: string, name: string): void
```

---

## FaberWorkflow

Full FABER workflow orchestration (Frame → Architect → Build → Evaluate → Release).

### Constructor

**TypeScript:**
```typescript
new FaberWorkflow(options?: {
  config?: Partial<WorkflowConfig>
})
```

**Python:**
```python
FaberWorkflow(config: Optional[WorkflowConfig] = None)
```

**Example:**

**TypeScript:**
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

**Python:**
```python
faber = FaberWorkflow(config={
    "autonomy": "assisted",
    "phases": {
        "frame": {"enabled": True},
        "architect": {"enabled": True, "refine_spec": True},
        "build": {"enabled": True},
        "evaluate": {"enabled": True, "max_retries": 3},
        "release": {"enabled": True, "request_reviews": True, "reviewers": ["@team"]}
    },
    "hooks": {
        "pre_build": "npm run lint",
        "post_build": "npm test"
    }
})
```

### Methods

#### run

```typescript
run(options: WorkflowOptions): Promise<WorkflowResult>
```

Execute the FABER workflow.

**TypeScript:**
```typescript
const result = await faber.run({
  workId: '123',
  autonomy: 'assisted',
});
```

**Python:**
```python
result = faber.run(work_id="123", autonomy="assisted")
```

#### addEventListener

```typescript
addEventListener(listener: EventListener): void
```

**TypeScript:**
```typescript
faber.addEventListener((event, data) => {
  console.log(`${event}:`, data);
});
```

**Python:**
```python
def on_event(event, data):
    print(f"{event}: {data}")

faber.add_event_listener(on_event)
```

#### setUserInputCallback

```typescript
setUserInputCallback(callback: UserInputCallback): void
```

Set callback for user confirmation prompts.

**TypeScript:**
```typescript
faber.setUserInputCallback(async (request) => {
  const answer = await promptUser(request.message);
  return answer === 'yes';
});
```

**Python:**
```python
def user_input_callback(request):
    answer = input(request["message"])
    return answer == "yes"

faber.set_user_input_callback(user_input_callback)
```

---

## StorageManager

Artifact storage with optional Codex integration.

### Constructor

**TypeScript:**
```typescript
new StorageManager(config?: StorageConfig)
```

**Python:**
```python
StorageManager(config: Optional[StorageConfig] = None)
```

### Methods

#### store

```typescript
store(path: string, content: string): Promise<void>
```

Store content at the specified path.

#### retrieve

```typescript
retrieve(path: string): Promise<string>
```

Retrieve content from the specified path.

#### syncToCodex

```typescript
syncToCodex(path?: string): Promise<void>
```

Sync artifacts to Codex knowledge base (if configured).

**TypeScript:**
```typescript
await storage.syncToCodex('specs/SPEC-001.md');
```

**Python:**
```python
storage.sync_to_codex("specs/SPEC-001.md")
```

---

## Configuration Helpers

**TypeScript:**
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

**Python:**
```python
from faber.config import (
    load_work_config,
    load_repo_config,
    load_spec_config,
    find_project_root
)

root = find_project_root()
work_config = load_work_config(root)
```

| Function | Parameters | Returns | Description |
|----------|------------|---------|-------------|
| `findProjectRoot(startPath?)` | `string?` | `string` | Find project root by looking for `.fractary/` |
| `loadWorkConfig(root?)` | `string?` | `WorkConfig \| null` | Load work configuration |
| `loadRepoConfig(root?)` | `string?` | `RepoConfig \| null` | Load repo configuration |
| `loadSpecConfig(root?)` | `string?` | `SpecConfig \| null` | Load spec configuration |
| `loadLogConfig(root?)` | `string?` | `LogConfig \| null` | Load log configuration |
| `loadStateConfig(root?)` | `string?` | `StateConfig \| null` | Load state configuration |

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

**TypeScript:**
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

**Python:**
```python
@dataclass
class Issue:
    number: int
    title: str
    body: str
    state: Literal["open", "closed"]
    labels: List[Label]
    assignees: List[str]
    milestone: Optional[Milestone]
    author: str
    created_at: str
    updated_at: str
    url: str
```

### PullRequest

**TypeScript:**
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

**Python:**
```python
@dataclass
class PullRequest:
    number: int
    title: str
    body: str
    state: Literal["open", "closed", "merged"]
    head: str
    base: str
    author: str
    url: str
    is_draft: bool
    mergeable: bool
    review_decision: Optional[Literal["APPROVED", "CHANGES_REQUESTED", "REVIEW_REQUIRED"]]
```

### ValidationResult

**TypeScript:**
```typescript
interface ValidationResult {
  status: 'pass' | 'warn' | 'fail';
  completeness: number;
  suggestions?: string[];
}
```

**Python:**
```python
@dataclass
class ValidationResult:
    status: Literal["pass", "warn", "fail"]
    completeness: float
    suggestions: Optional[List[str]] = None
```

### WorkflowResult

**TypeScript:**
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

**Python:**
```python
@dataclass
class WorkflowResult:
    workflow_id: str
    work_id: str
    status: Literal["completed", "failed", "paused"]
    phases: List[PhaseResult]
    duration_ms: int
    artifacts: List[ArtifactManifest]
```

---

## Error Classes

**TypeScript:**
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

**Python:**
```python
from faber.errors import (
    FaberError,
    ConfigurationError,
    ProviderError,
    WorkflowError,
    SpecError,
    LogError,
    StateError,
    IssueNotFoundError,
    PRNotFoundError,
    BranchExistsError,
    MergeConflictError
)
```

### Error Handling Examples

**TypeScript:**
```typescript
try {
  const issue = await work.fetchIssue(123);
} catch (error) {
  if (error instanceof IssueNotFoundError) {
    console.error('Issue not found:', error.message);
  } else if (error instanceof ProviderError) {
    console.error('API error:', error.message);
  } else {
    throw error;
  }
}
```

**Python:**
```python
try:
    issue = work.fetch_issue(123)
except IssueNotFoundError as e:
    print(f"Issue not found: {e}")
except ProviderError as e:
    print(f"API error: {e}")
```

---

## See Also

- [CLI Integration Guide](./cli-integration.md) - Integration patterns for CLI usage
- [Configuration Guide](./configuration.md) - Complete configuration reference
- [Troubleshooting Guide](./troubleshooting.md) - Common issues and solutions
- [Getting Started](/docs/public/getting-started.md) - Installation and quick start
- [Concepts](/docs/public/concepts.md) - FABER methodology and architecture
