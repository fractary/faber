/**
 * @fractary/faber - Core Type Definitions
 *
 * This file contains all shared TypeScript interfaces used across the SDK.
 */

// ============================================================================
// Common Types
// ============================================================================

/** Result type for operations that can fail */
export type Result<T, E = Error> =
  | { success: true; value: T }
  | { success: false; error: E };

/** Async result */
export type AsyncResult<T, E = Error> = Promise<Result<T, E>>;

/** Optional value wrapper */
export type Maybe<T> = T | null | undefined;

/** Pagination options for list operations */
export interface PaginationOptions {
  limit?: number;
  offset?: number;
  cursor?: string;
}

/** Paginated response */
export interface PaginatedResult<T> {
  items: T[];
  total: number;
  hasMore: boolean;
  nextCursor?: string;
}

// ============================================================================
// Work Module Types
// ============================================================================

export type WorkPlatform = 'github' | 'jira' | 'linear';

export interface WorkConfig {
  platform: WorkPlatform;
  owner?: string;
  repo?: string;
  project?: string;
  token?: string;
}

export interface Issue {
  id: string;
  number: number;
  title: string;
  body: string;
  state: 'open' | 'closed';
  labels: Label[];
  assignees: string[];
  milestone?: Milestone;
  created_at: string;
  updated_at: string;
  closed_at?: string;
  url: string;
}

export interface IssueCreateOptions {
  title: string;
  body?: string;
  workType?: WorkType;
  labels?: string[];
  assignees?: string[];
  milestone?: string;
}

export interface IssueUpdateOptions {
  title?: string;
  body?: string;
  state?: 'open' | 'closed';
}

export interface IssueFilters {
  state?: 'open' | 'closed' | 'all';
  labels?: string[];
  assignee?: string;
  milestone?: string;
  since?: string;
}

export type WorkType = 'feature' | 'bug' | 'chore' | 'patch' | 'infrastructure' | 'api';

export interface Label {
  name: string;
  color?: string;
  description?: string;
}

export interface Milestone {
  id: string;
  title: string;
  description?: string;
  due_on?: string;
  state: 'open' | 'closed';
}

export interface MilestoneCreateOptions {
  title: string;
  description?: string;
  due_on?: string;
}

export interface Comment {
  id: string;
  body: string;
  author: string;
  created_at: string;
  updated_at: string;
}

export interface CommentCreateOptions {
  body: string;
  faber_context?: FaberContext;
}

export type FaberContext = 'frame' | 'architect' | 'build' | 'evaluate' | 'release' | 'ops';

// ============================================================================
// Repo Module Types
// ============================================================================

export type RepoPlatform = 'github' | 'gitlab' | 'bitbucket';

export interface RepoConfig {
  platform: RepoPlatform;
  owner?: string;
  repo?: string;
  defaultBranch?: string;
  token?: string;
  branchPrefix?: BranchPrefixConfig;
  branchPrefixes?: BranchPrefixConfig;
}

export interface BranchPrefixConfig {
  feature: string;
  fix?: string;
  bugfix?: string;
  hotfix?: string;
  chore: string;
  docs?: string;
  refactor?: string;
}

export interface Branch {
  name: string;
  sha: string;
  isDefault: boolean;
  isProtected: boolean;
  upstream?: string;
  lastCommit?: Commit;
}

export interface BranchCreateOptions {
  baseBranch?: string;
  checkout?: boolean;
  worktree?: boolean;
  workId?: string;
  prefix?: string;
  fromProtected?: boolean;
}

export interface BranchDeleteOptions {
  location?: 'local' | 'remote' | 'both';
  force?: boolean;
  cleanupWorktree?: boolean;
}

export interface BranchListOptions {
  merged?: boolean;
  stale?: boolean;
  staleDays?: number;
  pattern?: string;
  limit?: number;
}

export interface Commit {
  sha: string;
  message: string;
  author: string;
  authorEmail?: string;
  date: string;
  parents: string[];
}

export type CommitType = 'feat' | 'fix' | 'chore' | 'docs' | 'style' | 'refactor' | 'perf' | 'test';

export interface CommitOptions {
  message: string;
  type?: CommitType;
  scope?: string;
  body?: string;
  breaking?: boolean;
  workId?: string;
  coAuthors?: string[];
  allowEmpty?: boolean;
}

export interface CommitListOptions {
  branch?: string;
  since?: string;
  until?: string;
  author?: string;
  limit?: number;
}

export interface GitStatus {
  branch: string;
  ahead: number;
  behind: number;
  staged: string[];
  modified: string[];
  untracked: string[];
  conflicts: string[];
}

export interface PullRequest {
  number: number;
  title: string;
  body: string;
  state: 'open' | 'closed' | 'merged';
  head: string;
  base: string;
  author: string;
  reviewers: string[];
  labels: string[];
  assignees?: string[];
  mergeable?: boolean;
  isDraft?: boolean;
  reviewDecision?: string;
  url: string;
  createdAt: string;
  updatedAt: string;
  mergedAt?: string;
  closedAt?: string;
  additions?: number;
  deletions?: number;
  changedFiles?: number;
}

export interface PRCreateOptions {
  title: string;
  body?: string;
  head?: string;
  base?: string;
  workId?: string;
  draft?: boolean;
  labels?: string[];
  reviewers?: string[];
  assignees?: string[];
}

export interface PRUpdateOptions {
  title?: string;
  body?: string;
  base?: string;
  state?: 'open' | 'closed';
  labels?: string[];
}

export interface PRListOptions {
  state?: 'open' | 'closed' | 'merged' | 'all';
  author?: string;
  base?: string;
  head?: string;
  limit?: number;
}

export type PRMergeStrategy = 'merge' | 'squash' | 'rebase';

export interface PRMergeOptions {
  strategy?: PRMergeStrategy;
  deleteBranch?: boolean;
  cleanupWorktree?: boolean;
  commitMessage?: string;
  commitTitle?: string;
  commitBody?: string;
}

export interface PRReviewOptions {
  action: 'approve' | 'request_changes' | 'comment';
  approve?: boolean;
  comment?: string;
}

export interface Tag {
  name: string;
  sha: string;
  message?: string;
  tagger?: string;
  date: string;
}

export interface TagCreateOptions {
  name: string;
  message?: string;
  sha?: string;
  commit?: string;
  sign?: boolean;
  force?: boolean;
}

export interface TagListOptions {
  pattern?: string;
  latest?: number;
}

export interface Worktree {
  path: string;
  branch?: string;
  sha?: string;
  isMain?: boolean;
  workId?: string;
}

export interface WorktreeCreateOptions {
  path: string;
  branch: string;
  baseBranch?: string;
  workId?: string;
}

export interface WorktreeCleanupOptions {
  merged?: boolean;
  stale?: boolean;
  staleDays?: number;
  dryRun?: boolean;
  force?: boolean;
  deleteBranch?: boolean;
}

export interface PushOptions {
  branch?: string;
  remote?: string;
  setUpstream?: boolean;
  force?: boolean;
  forceWithLease?: boolean;
}

export interface PullOptions {
  branch?: string;
  remote?: string;
  rebase?: boolean;
  strategy?: 'merge' | 'rebase' | 'ff-only';
}

// ============================================================================
// Spec Module Types
// ============================================================================

export interface SpecConfig {
  localPath?: string;
  templates?: {
    default: SpecTemplateType;
    customDir?: string;
  };
}

export type SpecTemplateType = 'basic' | 'feature' | 'bug' | 'infrastructure' | 'api';

export interface Specification {
  id: string;
  path: string;
  title: string;
  workId?: string;
  workType: WorkType;
  template: SpecTemplateType;
  content: string;
  metadata: SpecMetadata;
  phases?: SpecPhase[];
}

export interface SpecMetadata {
  created_at: string;
  updated_at: string;
  validation_status?: 'not_validated' | 'partial' | 'complete' | 'failed';
  source: 'conversation' | 'issue' | 'conversation+issue';
}

export interface SpecPhase {
  id: string;
  title: string;
  status: 'not_started' | 'in_progress' | 'complete';
  objective?: string;
  tasks: SpecTask[];
  notes?: string[];
}

export interface SpecTask {
  text: string;
  completed: boolean;
}

export interface SpecCreateOptions {
  workId?: string;
  template?: SpecTemplateType;
  context?: string;
  conversationContext?: string;
  force?: boolean;
}

export interface SpecListOptions {
  workId?: string;
  status?: string;
  template?: SpecTemplateType;
}

export interface SpecValidateResult {
  status: 'pass' | 'partial' | 'fail';
  score: number;
  checks: {
    requirements: { completed: number; total: number; status: 'pass' | 'warn' | 'fail' };
    acceptanceCriteria: { met: number; total: number; status: 'pass' | 'warn' | 'fail' };
    filesModified: { status: 'pass' | 'fail' };
    testsAdded: { added: number; expected: number; status: 'pass' | 'warn' | 'fail' };
    docsUpdated: { status: 'pass' | 'fail' };
  };
  suggestions?: string[];
}

export interface SpecRefineResult {
  questionsAsked: number;
  questionsAnswered: number;
  improvementsApplied: number;
  additionalRoundsRecommended: boolean;
}

export interface RefinementQuestion {
  id: string;
  question: string;
  category: string;
  priority: 'high' | 'medium' | 'low';
}

// ============================================================================
// Logs Module Types
// ============================================================================

export interface LogConfig {
  localPath?: string;
  sessionLogging?: {
    enabled: boolean;
    format: 'markdown' | 'json';
    redactSensitive: boolean;
  };
}

export type LogType =
  | 'session'
  | 'build'
  | 'deployment'
  | 'test'
  | 'debug'
  | 'audit'
  | 'operational'
  | 'workflow';

export interface LogEntry {
  id: string;
  type: LogType;
  path: string;
  title: string;
  content: string;
  metadata: LogMetadata;
  size_bytes: number;
}

export interface LogMetadata {
  date: string;
  status: LogStatus;
  issue_number?: number;
  repository?: string;
  branch?: string;
}

export type LogStatus =
  | 'active'
  | 'completed'
  | 'stopped'
  | 'success'
  | 'failure'
  | 'error';

export interface LogWriteOptions {
  type: LogType;
  title: string;
  content: string;
  issueNumber?: number;
  metadata?: Partial<LogMetadata>;
}

export interface LogListOptions {
  type?: LogType;
  status?: LogStatus;
  issueNumber?: number;
  since?: string;
  until?: string;
  limit?: number;
}

export interface LogSearchOptions {
  query: string;
  type?: LogType;
  issueNumber?: number;
  since?: string;
  until?: string;
  regex?: boolean;
}

export interface LogSearchResult {
  log: LogEntry;
  snippets: string[];
  lineNumbers: number[];
}

export interface SessionState {
  session_id: string;
  log_path: string;
  issue_number: number;
  start_time: string;
  status: 'active' | 'stopped';
}

export interface CaptureStartOptions {
  issueNumber: number;
  redactSensitive?: boolean;
  model?: string;
}

export interface CaptureResult {
  sessionId: string;
  logPath: string;
  issueNumber: number;
  status: 'active' | 'stopped';
}

// ============================================================================
// State Module Types
// ============================================================================

export interface StateConfig {
  localPath?: string;
}

export type FaberPhase = 'frame' | 'architect' | 'build' | 'evaluate' | 'release';

export interface WorkflowState {
  workflow_id: string;
  work_id: string;
  current_phase: FaberPhase;
  phase_states: Record<FaberPhase, PhaseState>;
  started_at: string;
  updated_at: string;
  status: 'running' | 'paused' | 'completed' | 'failed';
}

export interface PhaseState {
  status: 'pending' | 'in_progress' | 'completed' | 'failed' | 'skipped';
  started_at?: string;
  completed_at?: string;
  attempts: number;
  error?: string;
  outputs?: Record<string, unknown>;
}

export interface RunManifest {
  manifest_id: string;
  workflow_id: string;
  work_id: string;
  created_at: string;
  completed_at?: string;
  status: 'running' | 'completed' | 'failed';
  phases: PhaseManifest[];
  artifacts: ArtifactManifest[];
}

export interface PhaseManifest {
  phase: FaberPhase;
  status: string;
  duration_ms: number;
  steps: StepManifest[];
}

export interface StepManifest {
  name: string;
  skill?: string;
  status: 'success' | 'failure' | 'skipped';
  duration_ms: number;
  outputs?: Record<string, unknown>;
}

export interface ArtifactManifest {
  type: 'spec' | 'log' | 'commit' | 'pr' | 'branch';
  path: string;
  created_at: string;
}

// ============================================================================
// Workflow Module Types
// ============================================================================

export type AutonomyLevel = 'dry-run' | 'assisted' | 'guarded' | 'autonomous';

/**
 * Forge configuration for workflow
 */
export interface ForgeWorkflowConfig {
  /** Enable Forge agent resolution (default: true in v2.0) */
  enabled: boolean;
  /** Prefer project-local agents over global (default: true) */
  prefer_local: boolean;
}

/**
 * Phase configuration with optional agent override
 */
export interface PhaseConfig {
  enabled: boolean;
  /** Override default agent for this phase (e.g., "my-custom-frame-agent@1.0.0") */
  agent?: string;
}

export interface WorkflowConfig {
  autonomy: AutonomyLevel;
  phases: {
    frame: PhaseConfig & { enabled: boolean };
    architect: PhaseConfig & { enabled: boolean; refineSpec: boolean };
    build: PhaseConfig & { enabled: boolean };
    evaluate: PhaseConfig & { enabled: boolean; maxRetries: number };
    release: PhaseConfig & { enabled: boolean; requestReviews: boolean; reviewers: string[] };
  };
  hooks?: WorkflowHooks;
  /** Forge integration configuration */
  forge?: ForgeWorkflowConfig;
}

export interface WorkflowHooks {
  pre_frame?: string;
  post_frame?: string;
  pre_architect?: string;
  post_architect?: string;
  pre_build?: string;
  post_build?: string;
  pre_evaluate?: string;
  post_evaluate?: string;
  pre_release?: string;
  post_release?: string;
}

export interface WorkflowOptions {
  workId: string | number;
  autonomy?: AutonomyLevel;
  config?: Partial<WorkflowConfig>;
}

export interface WorkflowResult {
  workflow_id: string;
  work_id: string;
  status: 'completed' | 'failed' | 'paused';
  phases: PhaseResult[];
  duration_ms: number;
  artifacts: ArtifactManifest[];
}

export interface PhaseResult {
  phase: FaberPhase;
  status: 'completed' | 'failed' | 'skipped' | 'retry';
  duration_ms: number;
  outputs?: Record<string, unknown>;
  error?: string;
}

export type WorkflowStatus = 'idle' | 'running' | 'paused' | 'completed' | 'failed';

// ============================================================================
// Storage Module Types
// ============================================================================

export interface StorageConfig {
  basePath: string;
}

export interface Storage {
  write(id: string, content: string): Promise<string>;
  read(id: string): Promise<string | null>;
  exists(id: string): Promise<boolean>;
  list(prefix?: string): Promise<string[]>;
  delete(id: string): Promise<void>;
}

// ============================================================================
// Configuration Types
// ============================================================================

export interface FaberConfig {
  schema_version: string;
  work: WorkConfig;
  repo: RepoConfig;
  artifacts: {
    specs: { use_codex: boolean; local_path: string };
    logs: { use_codex: boolean; local_path: string };
    state: { use_codex: boolean; local_path: string };
  };
  workflow: WorkflowConfig;
  llm?: {
    defaultModel: string;
    modelOverrides?: Record<FaberPhase, string>;
  };
}
