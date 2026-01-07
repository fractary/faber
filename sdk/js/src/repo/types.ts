/**
 * @fractary/faber - Repo Module Types
 *
 * Re-exports from main types + repo-specific interfaces.
 */

// Re-export common types
export {
  RepoConfig,
  RepoPlatform,
  BranchPrefixConfig,
  Branch,
  BranchCreateOptions,
  BranchDeleteOptions,
  BranchListOptions,
  Commit,
  CommitType,
  CommitOptions,
  CommitListOptions,
  GitStatus,
  PullRequest,
  PRCreateOptions,
  PRUpdateOptions,
  PRListOptions,
  PRMergeStrategy,
  PRMergeOptions,
  PRReviewOptions,
  Tag,
  TagCreateOptions,
  TagListOptions,
  Worktree,
  WorktreeCreateOptions,
  WorktreeCleanupOptions,
  PushOptions,
  PullOptions,
} from '../types.js';

/**
 * Interface for repository providers
 */
export interface RepoProvider {
  readonly platform: 'github' | 'gitlab' | 'bitbucket';

  // Branches
  createBranch(name: string, options?: import('../types.js').BranchCreateOptions): Promise<import('../types.js').Branch>;
  deleteBranch(name: string, options?: import('../types.js').BranchDeleteOptions): Promise<void>;
  listBranches(options?: import('../types.js').BranchListOptions): Promise<import('../types.js').Branch[]>;
  getBranch(name: string): Promise<import('../types.js').Branch | null>;

  // Pull Requests
  createPR(options: import('../types.js').PRCreateOptions): Promise<import('../types.js').PullRequest>;
  getPR(number: number): Promise<import('../types.js').PullRequest>;
  updatePR(number: number, options: import('../types.js').PRUpdateOptions): Promise<import('../types.js').PullRequest>;
  listPRs(options?: import('../types.js').PRListOptions): Promise<import('../types.js').PullRequest[]>;
  mergePR(number: number, options?: import('../types.js').PRMergeOptions): Promise<import('../types.js').PullRequest>;
  addPRComment(number: number, body: string): Promise<void>;
  requestReview(number: number, reviewers: string[]): Promise<void>;
  approvePR(number: number, comment?: string): Promise<void>;
}

/**
 * Worktree cleanup result
 */
export interface WorktreeCleanupResult {
  removed: string[];
  skipped: Array<{ path: string; reason: string }>;
  errors: Array<{ path: string; error: string }>;
}

/**
 * Diff options
 */
export interface DiffOptions {
  staged?: boolean;
  base?: string;
  head?: string;
}
