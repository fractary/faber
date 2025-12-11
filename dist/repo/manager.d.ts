/**
 * @fractary/faber - Repo Manager
 *
 * High-level repository operations combining Git CLI and platform APIs.
 */
import { RepoConfig, Branch, BranchCreateOptions, BranchDeleteOptions, BranchListOptions, Commit, CommitOptions, CommitListOptions, GitStatus, PullRequest, PRCreateOptions, PRUpdateOptions, PRListOptions, PRMergeOptions, PRReviewOptions, Tag, TagCreateOptions, TagListOptions, Worktree, WorktreeCreateOptions, WorktreeCleanupOptions, PushOptions, PullOptions } from '../types';
import { WorktreeCleanupResult, DiffOptions } from './types';
/**
 * Repository Manager
 *
 * Combines local Git operations with remote platform operations.
 */
export declare class RepoManager {
    private git;
    private provider;
    private config;
    constructor(config?: RepoConfig);
    /**
     * Get the current platform
     */
    get platform(): string;
    /**
     * Get repository status
     */
    getStatus(): GitStatus;
    /**
     * Get current branch name
     */
    getCurrentBranch(): string;
    /**
     * Check if working directory has uncommitted changes
     */
    isDirty(): boolean;
    /**
     * Check if working directory is clean
     */
    isClean(): boolean;
    /**
     * Get diff
     */
    getDiff(options?: DiffOptions): string;
    /**
     * Create a new branch
     */
    createBranch(name: string, options?: BranchCreateOptions): Promise<Branch>;
    /**
     * Delete a branch
     */
    deleteBranch(name: string, options?: BranchDeleteOptions): Promise<void>;
    /**
     * List branches
     */
    listBranches(options?: BranchListOptions): Promise<Branch[]>;
    /**
     * Get a specific branch
     */
    getBranch(name: string): Promise<Branch | null>;
    /**
     * Checkout a branch
     */
    checkout(branch: string): void;
    /**
     * Stage files
     */
    stage(patterns: string[]): void;
    /**
     * Stage all changes
     */
    stageAll(): void;
    /**
     * Unstage files
     */
    unstage(patterns: string[]): void;
    /**
     * Create a commit
     */
    commit(options: CommitOptions): Commit;
    /**
     * Get a commit by ref
     */
    getCommit(ref: string): Commit;
    /**
     * List commits
     */
    listCommits(options?: CommitListOptions): Commit[];
    /**
     * Push to remote
     */
    push(options?: PushOptions): void;
    /**
     * Pull from remote
     */
    pull(options?: PullOptions): void;
    /**
     * Fetch from remote
     */
    fetch(remote?: string): void;
    /**
     * Create a pull request
     */
    createPR(options: PRCreateOptions): Promise<PullRequest>;
    /**
     * Get a pull request
     */
    getPR(number: number): Promise<PullRequest>;
    /**
     * Update a pull request
     */
    updatePR(number: number, options: PRUpdateOptions): Promise<PullRequest>;
    /**
     * List pull requests
     */
    listPRs(options?: PRListOptions): Promise<PullRequest[]>;
    /**
     * Merge a pull request
     */
    mergePR(number: number, options?: PRMergeOptions): Promise<PullRequest>;
    /**
     * Add a comment to a pull request
     */
    addPRComment(number: number, body: string): Promise<void>;
    /**
     * Request review on a pull request
     */
    requestReview(number: number, reviewers: string[]): Promise<void>;
    /**
     * Approve a pull request
     */
    approvePR(number: number, comment?: string): Promise<void>;
    /**
     * Review a pull request
     */
    reviewPR(number: number, options: PRReviewOptions): Promise<void>;
    /**
     * Create a tag
     */
    createTag(name: string, options?: TagCreateOptions): void;
    /**
     * Delete a tag
     */
    deleteTag(name: string): void;
    /**
     * Push a tag
     */
    pushTag(name: string, remote?: string): void;
    /**
     * List tags
     */
    listTags(options?: TagListOptions): Tag[];
    /**
     * Create a worktree
     */
    createWorktree(options: WorktreeCreateOptions): Worktree;
    /**
     * List worktrees
     */
    listWorktrees(): Worktree[];
    /**
     * Remove a worktree
     */
    removeWorktree(path: string, force?: boolean): void;
    /**
     * Prune stale worktrees
     */
    pruneWorktrees(): void;
    /**
     * Cleanup worktrees
     */
    cleanupWorktrees(options?: WorktreeCleanupOptions): Promise<WorktreeCleanupResult>;
    /**
     * Generate a semantic branch name
     */
    generateBranchName(options: {
        type: 'feature' | 'fix' | 'chore' | 'docs' | 'refactor';
        description: string;
        workId?: string;
    }): string;
}
//# sourceMappingURL=manager.d.ts.map