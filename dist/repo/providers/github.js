"use strict";
/**
 * @fractary/faber - GitHub Repo Provider
 *
 * Repository operations via GitHub CLI (gh).
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.GitHubRepoProvider = void 0;
const child_process_1 = require("child_process");
const errors_1 = require("../../errors");
const config_1 = require("../../config");
/**
 * Execute a gh command and return JSON result
 */
function gh(args, cwd) {
    const execOptions = {
        encoding: 'utf-8',
        cwd: cwd || (0, config_1.findProjectRoot)(),
        maxBuffer: 10 * 1024 * 1024,
    };
    try {
        const result = (0, child_process_1.execSync)(`gh ${args}`, execOptions);
        return JSON.parse(result.toString());
    }
    catch (error) {
        const err = error;
        const stderr = err.stderr?.toString() || err.message || 'Unknown error';
        throw new errors_1.ProviderError('github', 'gh', stderr);
    }
}
/**
 * Execute a gh command without JSON parsing
 */
function ghRaw(args, cwd) {
    const execOptions = {
        encoding: 'utf-8',
        cwd: cwd || (0, config_1.findProjectRoot)(),
        maxBuffer: 10 * 1024 * 1024,
    };
    try {
        return (0, child_process_1.execSync)(`gh ${args}`, execOptions).toString().trim();
    }
    catch (error) {
        const err = error;
        const stderr = err.stderr?.toString() || err.message || 'Unknown error';
        throw new errors_1.ProviderError('github', 'gh', stderr);
    }
}
/**
 * Convert GitHub PR to our PullRequest type
 */
function toPullRequest(pr) {
    return {
        number: pr.number,
        title: pr.title,
        body: pr.body || '',
        state: pr.state.toLowerCase(),
        url: pr.url,
        head: pr.headRefName,
        base: pr.baseRefName,
        author: pr.author.login,
        isDraft: pr.isDraft,
        mergeable: pr.mergeable === 'MERGEABLE',
        reviewDecision: pr.reviewDecision || undefined,
        createdAt: pr.createdAt,
        updatedAt: pr.updatedAt,
        mergedAt: pr.mergedAt || undefined,
        closedAt: pr.closedAt || undefined,
        additions: pr.additions,
        deletions: pr.deletions,
        changedFiles: pr.changedFiles,
        labels: pr.labels?.map(l => l.name) || [],
        assignees: pr.assignees?.map(a => a.login) || [],
        reviewers: pr.reviewRequests?.map(r => r.login) || [],
    };
}
/**
 * GitHub repository provider
 */
class GitHubRepoProvider {
    platform = 'github';
    cwd;
    owner;
    repo;
    constructor(config) {
        this.cwd = (0, config_1.findProjectRoot)();
        this.owner = config.owner || '';
        this.repo = config.repo || '';
    }
    // =========================================================================
    // BRANCHES
    // =========================================================================
    async createBranch(name, options) {
        // Branch creation is done via git, not gh
        // This provider focuses on remote operations
        const base = options?.baseBranch || 'main';
        // Create branch locally using git
        const { execSync } = await Promise.resolve().then(() => __importStar(require('child_process')));
        execSync(`git checkout -b ${name} ${base}`, {
            cwd: this.cwd,
            encoding: 'utf-8',
        });
        return {
            name,
            sha: '', // Will be populated after first commit
            isDefault: false,
            isProtected: false,
        };
    }
    async deleteBranch(name, options) {
        const location = options?.location || 'both';
        const force = options?.force || false;
        const flag = force ? '-D' : '-d';
        const { execSync } = await Promise.resolve().then(() => __importStar(require('child_process')));
        if (location === 'local' || location === 'both') {
            try {
                execSync(`git branch ${flag} ${name}`, {
                    cwd: this.cwd,
                    encoding: 'utf-8',
                });
            }
            catch {
                // Ignore if branch doesn't exist locally
            }
        }
        if (location === 'remote' || location === 'both') {
            try {
                ghRaw(`api repos/${this.owner}/${this.repo}/git/refs/heads/${name} -X DELETE`, this.cwd);
            }
            catch {
                // Ignore if branch doesn't exist remotely
            }
        }
    }
    async listBranches(options) {
        const limit = options?.limit || 100;
        const branches = gh(`api repos/${this.owner}/${this.repo}/branches --paginate -q '.[:${limit}]'`, this.cwd);
        return branches.map(b => ({
            name: b.name,
            sha: b.commit.sha,
            isDefault: b.name === 'main' || b.name === 'master',
            isProtected: b.protected,
        }));
    }
    async getBranch(name) {
        try {
            const branch = gh(`api repos/${this.owner}/${this.repo}/branches/${name}`, this.cwd);
            return {
                name: branch.name,
                sha: branch.commit.sha,
                isDefault: branch.name === 'main' || branch.name === 'master',
                isProtected: branch.protected,
            };
        }
        catch {
            return null;
        }
    }
    // =========================================================================
    // PULL REQUESTS
    // =========================================================================
    async createPR(options) {
        const args = ['pr', 'create'];
        args.push('--title', `"${options.title.replace(/"/g, '\\"')}"`);
        if (options.body) {
            args.push('--body', `"${options.body.replace(/"/g, '\\"')}"`);
        }
        if (options.base) {
            args.push('--base', options.base);
        }
        if (options.head) {
            args.push('--head', options.head);
        }
        if (options.draft) {
            args.push('--draft');
        }
        if (options.labels && options.labels.length > 0) {
            args.push('--label', options.labels.join(','));
        }
        if (options.assignees && options.assignees.length > 0) {
            args.push('--assignee', options.assignees.join(','));
        }
        if (options.reviewers && options.reviewers.length > 0) {
            args.push('--reviewer', options.reviewers.join(','));
        }
        // Create the PR and get back the URL
        const url = ghRaw(args.join(' '), this.cwd);
        // Extract PR number from URL
        const match = url.match(/\/pull\/(\d+)/);
        if (!match) {
            throw new errors_1.ProviderError('github', 'createPR', 'Failed to get PR number from response');
        }
        const prNumber = parseInt(match[1], 10);
        return this.getPR(prNumber);
    }
    async getPR(number) {
        const fields = [
            'number', 'title', 'body', 'state', 'url', 'headRefName', 'baseRefName',
            'author', 'isDraft', 'mergeable', 'reviewDecision', 'createdAt', 'updatedAt',
            'mergedAt', 'closedAt', 'additions', 'deletions', 'changedFiles',
            'labels', 'assignees', 'reviewRequests',
        ];
        const pr = gh(`pr view ${number} --json ${fields.join(',')}`, this.cwd);
        return toPullRequest(pr);
    }
    async updatePR(number, options) {
        const args = ['pr', 'edit', number.toString()];
        if (options.title) {
            args.push('--title', `"${options.title.replace(/"/g, '\\"')}"`);
        }
        if (options.body) {
            args.push('--body', `"${options.body.replace(/"/g, '\\"')}"`);
        }
        if (options.base) {
            args.push('--base', options.base);
        }
        ghRaw(args.join(' '), this.cwd);
        return this.getPR(number);
    }
    async listPRs(options) {
        const args = ['pr', 'list'];
        if (options?.state) {
            args.push('--state', options.state);
        }
        if (options?.base) {
            args.push('--base', options.base);
        }
        if (options?.head) {
            args.push('--head', options.head);
        }
        if (options?.author) {
            args.push('--author', options.author);
        }
        if (options?.limit) {
            args.push('--limit', options.limit.toString());
        }
        const fields = [
            'number', 'title', 'body', 'state', 'url', 'headRefName', 'baseRefName',
            'author', 'isDraft', 'mergeable', 'reviewDecision', 'createdAt', 'updatedAt',
            'mergedAt', 'closedAt', 'additions', 'deletions', 'changedFiles',
            'labels', 'assignees', 'reviewRequests',
        ];
        args.push('--json', fields.join(','));
        const prs = gh(args.join(' '), this.cwd);
        return prs.map(toPullRequest);
    }
    async mergePR(number, options) {
        const args = ['pr', 'merge', number.toString()];
        const strategy = options?.strategy || 'squash';
        args.push(`--${strategy}`);
        if (options?.deleteBranch) {
            args.push('--delete-branch');
        }
        if (options?.commitTitle) {
            args.push('--subject', `"${options.commitTitle.replace(/"/g, '\\"')}"`);
        }
        if (options?.commitBody) {
            args.push('--body', `"${options.commitBody.replace(/"/g, '\\"')}"`);
        }
        ghRaw(args.join(' '), this.cwd);
        return this.getPR(number);
    }
    async addPRComment(number, body) {
        ghRaw(`pr comment ${number} --body "${body.replace(/"/g, '\\"')}"`, this.cwd);
    }
    async requestReview(number, reviewers) {
        ghRaw(`pr edit ${number} --add-reviewer ${reviewers.join(',')}`, this.cwd);
    }
    async approvePR(number, comment) {
        const args = ['pr', 'review', number.toString(), '--approve'];
        if (comment) {
            args.push('--body', `"${comment.replace(/"/g, '\\"')}"`);
        }
        ghRaw(args.join(' '), this.cwd);
    }
}
exports.GitHubRepoProvider = GitHubRepoProvider;
//# sourceMappingURL=github.js.map