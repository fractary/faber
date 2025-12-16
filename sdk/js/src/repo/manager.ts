/**
 * @fractary/faber - Repo Manager
 *
 * High-level repository operations combining Git CLI and platform APIs.
 */

import {
  RepoConfig,
  Branch,
  BranchCreateOptions,
  BranchDeleteOptions,
  BranchListOptions,
  Commit,
  CommitOptions,
  CommitListOptions,
  GitStatus,
  PullRequest,
  PRCreateOptions,
  PRUpdateOptions,
  PRListOptions,
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
import { RepoProvider, WorktreeCleanupResult, DiffOptions } from './types';
import { Git } from './git';
import { GitHubRepoProvider } from './providers/github';
import { GitLabRepoProvider } from './providers/gitlab';
import { BitbucketRepoProvider } from './providers/bitbucket';
import { loadRepoConfig } from '../config';
import { ConfigurationError, BranchExistsError, ProtectedBranchError } from '../errors';

/**
 * Create a provider based on platform
 */
function createProvider(config: RepoConfig): RepoProvider {
  switch (config.platform) {
    case 'github':
      return new GitHubRepoProvider(config);
    case 'gitlab':
      return new GitLabRepoProvider(config);
    case 'bitbucket':
      return new BitbucketRepoProvider(config);
    default:
      throw new ConfigurationError(`Unknown repo platform: ${config.platform}`);
  }
}

/**
 * Repository Manager
 *
 * Combines local Git operations with remote platform operations.
 */
export class RepoManager {
  private git: Git;
  private provider: RepoProvider;
  private config: RepoConfig;

  constructor(config?: RepoConfig) {
    this.config = config || loadRepoConfig() || { platform: 'github' };
    this.git = new Git();
    this.provider = createProvider(this.config);
  }

  /**
   * Get the current platform
   */
  get platform(): string {
    return this.provider.platform;
  }

  // =========================================================================
  // STATUS & INFO
  // =========================================================================

  /**
   * Get repository status
   */
  getStatus(): GitStatus {
    return this.git.getStatus();
  }

  /**
   * Get current branch name
   */
  getCurrentBranch(): string {
    return this.git.getCurrentBranch();
  }

  /**
   * Check if working directory has uncommitted changes
   */
  isDirty(): boolean {
    return this.git.isDirty();
  }

  /**
   * Check if working directory is clean
   */
  isClean(): boolean {
    return this.git.isClean();
  }

  /**
   * Get diff
   */
  getDiff(options?: DiffOptions): string {
    return this.git.getDiff(options);
  }

  // =========================================================================
  // BRANCHES
  // =========================================================================

  /**
   * Create a new branch
   */
  async createBranch(name: string, options?: BranchCreateOptions): Promise<Branch> {
    // Check if branch already exists
    if (this.git.branchExists(name)) {
      throw new BranchExistsError(name);
    }

    // Check if trying to create from protected branch without explicit flag
    const baseBranch = options?.baseBranch || this.git.getCurrentBranch();
    if (this.git.isProtectedBranch(baseBranch) && options?.fromProtected !== true) {
      // This is fine - we allow creating branches FROM protected branches
    }

    // Create branch locally
    this.git.createBranch(name, options?.baseBranch);

    // Return branch info
    return {
      name,
      sha: this.git.exec('rev-parse HEAD'),
      isDefault: false,
      isProtected: false,
    };
  }

  /**
   * Delete a branch
   */
  async deleteBranch(name: string, options?: BranchDeleteOptions): Promise<void> {
    // Check if protected
    if (this.git.isProtectedBranch(name) && !options?.force) {
      throw new ProtectedBranchError(name, 'delete');
    }

    const location = options?.location || 'local';

    if (location === 'local' || location === 'both') {
      this.git.deleteBranch(name, options?.force);
    }

    if (location === 'remote' || location === 'both') {
      await this.provider.deleteBranch(name, options);
    }
  }

  /**
   * List branches
   */
  async listBranches(options?: BranchListOptions): Promise<Branch[]> {
    // Get local branches from git
    const localBranches = this.git.listBranches();

    // Apply filters
    let branches = localBranches;

    if (options?.pattern) {
      const regex = new RegExp(options.pattern);
      branches = branches.filter(b => regex.test(b.name));
    }

    if (options?.merged) {
      // Get merged branches
      const merged = this.git.exec('branch --merged').split('\n').map(b => b.trim().replace(/^\* /, ''));
      branches = branches.filter(b => merged.includes(b.name));
    }

    if (options?.limit) {
      branches = branches.slice(0, options.limit);
    }

    return branches;
  }

  /**
   * Get a specific branch
   */
  async getBranch(name: string): Promise<Branch | null> {
    if (!this.git.branchExists(name)) {
      return null;
    }

    const branches = this.git.listBranches();
    return branches.find(b => b.name === name) || null;
  }

  /**
   * Checkout a branch
   */
  checkout(branch: string): void {
    this.git.checkout(branch);
  }

  // =========================================================================
  // COMMITS
  // =========================================================================

  /**
   * Stage files
   */
  stage(patterns: string[]): void {
    this.git.stage(patterns);
  }

  /**
   * Stage all changes
   */
  stageAll(): void {
    this.git.stageAll();
  }

  /**
   * Unstage files
   */
  unstage(patterns: string[]): void {
    this.git.unstage(patterns);
  }

  /**
   * Create a commit
   */
  commit(options: CommitOptions): Commit {
    return this.git.commit(options);
  }

  /**
   * Get a commit by ref
   */
  getCommit(ref: string): Commit {
    return this.git.getCommit(ref);
  }

  /**
   * List commits
   */
  listCommits(options?: CommitListOptions): Commit[] {
    return this.git.listCommits(options);
  }

  // =========================================================================
  // PUSH/PULL
  // =========================================================================

  /**
   * Push to remote
   */
  push(options?: PushOptions): void {
    this.git.push(options);
  }

  /**
   * Pull from remote
   */
  pull(options?: PullOptions): void {
    this.git.pull(options);
  }

  /**
   * Fetch from remote
   */
  fetch(remote?: string): void {
    this.git.fetch(remote);
  }

  // =========================================================================
  // PULL REQUESTS
  // =========================================================================

  /**
   * Create a pull request
   */
  async createPR(options: PRCreateOptions): Promise<PullRequest> {
    return this.provider.createPR(options);
  }

  /**
   * Get a pull request
   */
  async getPR(number: number): Promise<PullRequest> {
    return this.provider.getPR(number);
  }

  /**
   * Update a pull request
   */
  async updatePR(number: number, options: PRUpdateOptions): Promise<PullRequest> {
    return this.provider.updatePR(number, options);
  }

  /**
   * List pull requests
   */
  async listPRs(options?: PRListOptions): Promise<PullRequest[]> {
    return this.provider.listPRs(options);
  }

  /**
   * Merge a pull request
   */
  async mergePR(number: number, options?: PRMergeOptions): Promise<PullRequest> {
    return this.provider.mergePR(number, options);
  }

  /**
   * Add a comment to a pull request
   */
  async addPRComment(number: number, body: string): Promise<void> {
    return this.provider.addPRComment(number, body);
  }

  /**
   * Request review on a pull request
   */
  async requestReview(number: number, reviewers: string[]): Promise<void> {
    return this.provider.requestReview(number, reviewers);
  }

  /**
   * Approve a pull request
   */
  async approvePR(number: number, comment?: string): Promise<void> {
    return this.provider.approvePR(number, comment);
  }

  /**
   * Review a pull request
   */
  async reviewPR(number: number, options: PRReviewOptions): Promise<void> {
    if (options.approve) {
      await this.provider.approvePR(number, options.comment);
    } else if (options.comment) {
      await this.provider.addPRComment(number, options.comment);
    }
  }

  // =========================================================================
  // TAGS
  // =========================================================================

  /**
   * Create a tag
   */
  createTag(name: string, options?: TagCreateOptions): void {
    this.git.createTag(name, {
      message: options?.message,
      sha: options?.commit,
    });
  }

  /**
   * Delete a tag
   */
  deleteTag(name: string): void {
    this.git.deleteTag(name);
  }

  /**
   * Push a tag
   */
  pushTag(name: string, remote?: string): void {
    this.git.pushTag(name, remote);
  }

  /**
   * List tags
   */
  listTags(options?: TagListOptions): Tag[] {
    return this.git.listTags(options);
  }

  // =========================================================================
  // WORKTREES
  // =========================================================================

  /**
   * Create a worktree
   */
  createWorktree(options: WorktreeCreateOptions): Worktree {
    const { path, branch, baseBranch } = options;
    this.git.createWorktree(path, branch, baseBranch);

    return {
      path,
      branch,
      sha: this.git.exec(`rev-parse ${branch}`),
    };
  }

  /**
   * List worktrees
   */
  listWorktrees(): Worktree[] {
    return this.git.listWorktrees();
  }

  /**
   * Remove a worktree
   */
  removeWorktree(path: string, force?: boolean): void {
    this.git.removeWorktree(path, force);
  }

  /**
   * Prune stale worktrees
   */
  pruneWorktrees(): void {
    this.git.pruneWorktrees();
  }

  /**
   * Cleanup worktrees
   */
  async cleanupWorktrees(options?: WorktreeCleanupOptions): Promise<WorktreeCleanupResult> {
    const result: WorktreeCleanupResult = {
      removed: [],
      skipped: [],
      errors: [],
    };

    const worktrees = this.listWorktrees();

    for (const worktree of worktrees) {
      // Skip main worktree
      if (worktree.isMain) {
        result.skipped.push({ path: worktree.path, reason: 'Main worktree' });
        continue;
      }

      // Check if branch is merged (if option specified)
      if (options?.merged && worktree.branch) {
        try {
          const merged = this.git.exec('branch --merged').split('\n')
            .map(b => b.trim().replace(/^\* /, ''));

          if (!merged.includes(worktree.branch)) {
            result.skipped.push({
              path: worktree.path,
              reason: `Branch ${worktree.branch} is not merged`,
            });
            continue;
          }
        } catch {
          // Continue with cleanup if we can't check merge status
        }
      }

      // Remove worktree
      try {
        this.removeWorktree(worktree.path, options?.force);
        result.removed.push(worktree.path);

        // Also delete the branch if requested and it exists
        if (options?.deleteBranch && worktree.branch) {
          try {
            this.git.deleteBranch(worktree.branch, options.force);
          } catch {
            // Ignore if branch deletion fails
          }
        }
      } catch (error) {
        result.errors.push({
          path: worktree.path,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    // Prune stale worktree entries
    this.pruneWorktrees();

    return result;
  }

  // =========================================================================
  // BRANCH NAMING
  // =========================================================================

  /**
   * Generate a semantic branch name
   */
  generateBranchName(options: {
    type: 'feature' | 'fix' | 'chore' | 'docs' | 'refactor';
    description: string;
    workId?: string;
  }): string {
    const prefixes = this.config.branchPrefixes || {
      feature: 'feature',
      fix: 'fix',
      chore: 'chore',
      docs: 'docs',
      refactor: 'refactor',
    };

    const prefix = prefixes[options.type] || options.type;
    const slug = options.description
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 50);

    if (options.workId) {
      return `${prefix}/${options.workId}-${slug}`;
    }

    return `${prefix}/${slug}`;
  }
}
