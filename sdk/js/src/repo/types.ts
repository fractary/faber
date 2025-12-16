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
} from '../types';

/**
 * Interface for repository providers
 */
export interface RepoProvider {
  readonly platform: 'github' | 'gitlab' | 'bitbucket';

  // Branches
  createBranch(name: string, options?: import('../types').BranchCreateOptions): Promise<import('../types').Branch>;
  deleteBranch(name: string, options?: import('../types').BranchDeleteOptions): Promise<void>;
  listBranches(options?: import('../types').BranchListOptions): Promise<import('../types').Branch[]>;
  getBranch(name: string): Promise<import('../types').Branch | null>;

  // Pull Requests
  createPR(options: import('../types').PRCreateOptions): Promise<import('../types').PullRequest>;
  getPR(number: number): Promise<import('../types').PullRequest>;
  updatePR(number: number, options: import('../types').PRUpdateOptions): Promise<import('../types').PullRequest>;
  listPRs(options?: import('../types').PRListOptions): Promise<import('../types').PullRequest[]>;
  mergePR(number: number, options?: import('../types').PRMergeOptions): Promise<import('../types').PullRequest>;
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
