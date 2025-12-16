"use strict";
/**
 * @fractary/faber - Repo Manager
 *
 * High-level repository operations combining Git CLI and platform APIs.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.RepoManager = void 0;
const git_1 = require("./git");
const github_1 = require("./providers/github");
const gitlab_1 = require("./providers/gitlab");
const bitbucket_1 = require("./providers/bitbucket");
const config_1 = require("../config");
const errors_1 = require("../errors");
/**
 * Create a provider based on platform
 */
function createProvider(config) {
    switch (config.platform) {
        case 'github':
            return new github_1.GitHubRepoProvider(config);
        case 'gitlab':
            return new gitlab_1.GitLabRepoProvider(config);
        case 'bitbucket':
            return new bitbucket_1.BitbucketRepoProvider(config);
        default:
            throw new errors_1.ConfigurationError(`Unknown repo platform: ${config.platform}`);
    }
}
/**
 * Repository Manager
 *
 * Combines local Git operations with remote platform operations.
 */
class RepoManager {
    git;
    provider;
    config;
    constructor(config) {
        this.config = config || (0, config_1.loadRepoConfig)() || { platform: 'github' };
        this.git = new git_1.Git();
        this.provider = createProvider(this.config);
    }
    /**
     * Get the current platform
     */
    get platform() {
        return this.provider.platform;
    }
    // =========================================================================
    // STATUS & INFO
    // =========================================================================
    /**
     * Get repository status
     */
    getStatus() {
        return this.git.getStatus();
    }
    /**
     * Get current branch name
     */
    getCurrentBranch() {
        return this.git.getCurrentBranch();
    }
    /**
     * Check if working directory has uncommitted changes
     */
    isDirty() {
        return this.git.isDirty();
    }
    /**
     * Check if working directory is clean
     */
    isClean() {
        return this.git.isClean();
    }
    /**
     * Get diff
     */
    getDiff(options) {
        return this.git.getDiff(options);
    }
    // =========================================================================
    // BRANCHES
    // =========================================================================
    /**
     * Create a new branch
     */
    async createBranch(name, options) {
        // Check if branch already exists
        if (this.git.branchExists(name)) {
            throw new errors_1.BranchExistsError(name);
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
    async deleteBranch(name, options) {
        // Check if protected
        if (this.git.isProtectedBranch(name) && !options?.force) {
            throw new errors_1.ProtectedBranchError(name, 'delete');
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
    async listBranches(options) {
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
    async getBranch(name) {
        if (!this.git.branchExists(name)) {
            return null;
        }
        const branches = this.git.listBranches();
        return branches.find(b => b.name === name) || null;
    }
    /**
     * Checkout a branch
     */
    checkout(branch) {
        this.git.checkout(branch);
    }
    // =========================================================================
    // COMMITS
    // =========================================================================
    /**
     * Stage files
     */
    stage(patterns) {
        this.git.stage(patterns);
    }
    /**
     * Stage all changes
     */
    stageAll() {
        this.git.stageAll();
    }
    /**
     * Unstage files
     */
    unstage(patterns) {
        this.git.unstage(patterns);
    }
    /**
     * Create a commit
     */
    commit(options) {
        return this.git.commit(options);
    }
    /**
     * Get a commit by ref
     */
    getCommit(ref) {
        return this.git.getCommit(ref);
    }
    /**
     * List commits
     */
    listCommits(options) {
        return this.git.listCommits(options);
    }
    // =========================================================================
    // PUSH/PULL
    // =========================================================================
    /**
     * Push to remote
     */
    push(options) {
        this.git.push(options);
    }
    /**
     * Pull from remote
     */
    pull(options) {
        this.git.pull(options);
    }
    /**
     * Fetch from remote
     */
    fetch(remote) {
        this.git.fetch(remote);
    }
    // =========================================================================
    // PULL REQUESTS
    // =========================================================================
    /**
     * Create a pull request
     */
    async createPR(options) {
        return this.provider.createPR(options);
    }
    /**
     * Get a pull request
     */
    async getPR(number) {
        return this.provider.getPR(number);
    }
    /**
     * Update a pull request
     */
    async updatePR(number, options) {
        return this.provider.updatePR(number, options);
    }
    /**
     * List pull requests
     */
    async listPRs(options) {
        return this.provider.listPRs(options);
    }
    /**
     * Merge a pull request
     */
    async mergePR(number, options) {
        return this.provider.mergePR(number, options);
    }
    /**
     * Add a comment to a pull request
     */
    async addPRComment(number, body) {
        return this.provider.addPRComment(number, body);
    }
    /**
     * Request review on a pull request
     */
    async requestReview(number, reviewers) {
        return this.provider.requestReview(number, reviewers);
    }
    /**
     * Approve a pull request
     */
    async approvePR(number, comment) {
        return this.provider.approvePR(number, comment);
    }
    /**
     * Review a pull request
     */
    async reviewPR(number, options) {
        if (options.approve) {
            await this.provider.approvePR(number, options.comment);
        }
        else if (options.comment) {
            await this.provider.addPRComment(number, options.comment);
        }
    }
    // =========================================================================
    // TAGS
    // =========================================================================
    /**
     * Create a tag
     */
    createTag(name, options) {
        this.git.createTag(name, {
            message: options?.message,
            sha: options?.commit,
        });
    }
    /**
     * Delete a tag
     */
    deleteTag(name) {
        this.git.deleteTag(name);
    }
    /**
     * Push a tag
     */
    pushTag(name, remote) {
        this.git.pushTag(name, remote);
    }
    /**
     * List tags
     */
    listTags(options) {
        return this.git.listTags(options);
    }
    // =========================================================================
    // WORKTREES
    // =========================================================================
    /**
     * Create a worktree
     */
    createWorktree(options) {
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
    listWorktrees() {
        return this.git.listWorktrees();
    }
    /**
     * Remove a worktree
     */
    removeWorktree(path, force) {
        this.git.removeWorktree(path, force);
    }
    /**
     * Prune stale worktrees
     */
    pruneWorktrees() {
        this.git.pruneWorktrees();
    }
    /**
     * Cleanup worktrees
     */
    async cleanupWorktrees(options) {
        const result = {
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
                }
                catch {
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
                    }
                    catch {
                        // Ignore if branch deletion fails
                    }
                }
            }
            catch (error) {
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
    generateBranchName(options) {
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
exports.RepoManager = RepoManager;
//# sourceMappingURL=manager.js.map