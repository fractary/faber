/**
 * @fractary/faber - Git CLI Wrapper
 *
 * Low-level Git operations using the git CLI.
 */
import { GitStatus, Commit, CommitOptions, Branch, Tag, Worktree } from '../types';
/**
 * Git CLI wrapper class
 */
export declare class Git {
    private cwd;
    constructor(cwd?: string);
    /**
     * Execute a raw git command
     */
    exec(args: string): string;
    /**
     * Get repository status
     */
    getStatus(): GitStatus;
    /**
     * Get current branch name
     */
    getCurrentBranch(): string;
    /**
     * Get tracking info (ahead/behind)
     */
    private getTrackingInfo;
    /**
     * Get staged files
     */
    private getStagedFiles;
    /**
     * Get modified files
     */
    private getModifiedFiles;
    /**
     * Get untracked files
     */
    private getUntrackedFiles;
    /**
     * Get files with conflicts
     */
    private getConflictFiles;
    /**
     * Check if working directory has uncommitted changes
     */
    isDirty(): boolean;
    /**
     * Check if working directory is clean
     */
    isClean(): boolean;
    /**
     * Create a new branch
     */
    createBranch(name: string, baseBranch?: string): void;
    /**
     * Switch to a branch
     */
    checkout(branch: string): void;
    /**
     * Delete a branch
     */
    deleteBranch(name: string, force?: boolean): void;
    /**
     * Delete a remote branch
     */
    deleteRemoteBranch(name: string, remote?: string): void;
    /**
     * List local branches
     */
    listBranches(): Branch[];
    /**
     * Get default branch name
     */
    getDefaultBranch(): string;
    /**
     * Check if branch is protected (simple heuristic)
     */
    isProtectedBranch(name: string): boolean;
    /**
     * Check if branch exists
     */
    branchExists(name: string): boolean;
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
    listCommits(options?: {
        branch?: string;
        limit?: number;
        since?: string;
    }): Commit[];
    /**
     * Get diff
     */
    getDiff(options?: {
        staged?: boolean;
        base?: string;
        head?: string;
    }): string;
    /**
     * Push to remote
     */
    push(options?: {
        branch?: string;
        remote?: string;
        setUpstream?: boolean;
        force?: boolean;
        forceWithLease?: boolean;
    }): void;
    /**
     * Pull from remote
     */
    pull(options?: {
        branch?: string;
        remote?: string;
        rebase?: boolean;
    }): void;
    /**
     * Fetch from remote
     */
    fetch(remote?: string): void;
    /**
     * Create a tag
     */
    createTag(name: string, options?: {
        message?: string;
        sha?: string;
    }): void;
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
    listTags(options?: {
        pattern?: string;
        limit?: number;
    }): Tag[];
    /**
     * Create a worktree
     */
    createWorktree(path: string, branch: string, baseBranch?: string): void;
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
}
//# sourceMappingURL=git.d.ts.map