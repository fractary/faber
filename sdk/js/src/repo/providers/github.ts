/**
 * @fractary/faber - GitHub Repo Provider
 *
 * Repository operations via GitHub CLI (gh).
 */

import { execSync } from 'child_process';
import {
  RepoConfig,
  PullRequest,
  PRCreateOptions,
  PRUpdateOptions,
  PRListOptions,
  PRMergeOptions,
  Branch,
  BranchCreateOptions,
  BranchDeleteOptions,
  BranchListOptions,
} from '../../types.js';
import { RepoProvider } from '../types.js';
import { ProviderError } from '../../errors.js';
import { findProjectRoot } from '../../config.js';

/**
 * Execute a gh command and return JSON result
 */
function gh<T>(args: string, cwd?: string): T {
  const execOptions = {
    encoding: 'utf-8' as const,
    cwd: cwd || findProjectRoot(),
    maxBuffer: 10 * 1024 * 1024,
  };

  try {
    const result = execSync(`gh ${args}`, execOptions);
    return JSON.parse(result.toString());
  } catch (error: unknown) {
    const err = error as { stderr?: Buffer | string; message?: string };
    const stderr = err.stderr?.toString() || err.message || 'Unknown error';
    throw new ProviderError('github', 'gh', stderr);
  }
}

/**
 * Execute a gh command without JSON parsing
 */
function ghRaw(args: string, cwd?: string): string {
  const execOptions = {
    encoding: 'utf-8' as const,
    cwd: cwd || findProjectRoot(),
    maxBuffer: 10 * 1024 * 1024,
  };

  try {
    return execSync(`gh ${args}`, execOptions).toString().trim();
  } catch (error: unknown) {
    const err = error as { stderr?: Buffer | string; message?: string };
    const stderr = err.stderr?.toString() || err.message || 'Unknown error';
    throw new ProviderError('github', 'gh', stderr);
  }
}

interface GitHubPR {
  number: number;
  title: string;
  body: string;
  state: string;
  url: string;
  headRefName: string;
  baseRefName: string;
  author: { login: string };
  isDraft: boolean;
  mergeable: string;
  reviewDecision: string;
  createdAt: string;
  updatedAt: string;
  mergedAt: string | null;
  closedAt: string | null;
  additions: number;
  deletions: number;
  changedFiles: number;
  labels: Array<{ name: string }>;
  assignees: Array<{ login: string }>;
  reviewRequests: Array<{ login: string }>;
}

interface GitHubBranch {
  name: string;
  commit: { sha: string };
  protected: boolean;
}

/**
 * Convert GitHub PR to our PullRequest type
 */
function toPullRequest(pr: GitHubPR): PullRequest {
  return {
    number: pr.number,
    title: pr.title,
    body: pr.body || '',
    state: pr.state.toLowerCase() as 'open' | 'closed' | 'merged',
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
export class GitHubRepoProvider implements RepoProvider {
  readonly platform = 'github' as const;
  private cwd: string;
  private owner: string;
  private repo: string;

  constructor(config: RepoConfig) {
    this.cwd = findProjectRoot();
    this.owner = config.owner || '';
    this.repo = config.repo || '';
  }

  // =========================================================================
  // BRANCHES
  // =========================================================================

  async createBranch(name: string, options?: BranchCreateOptions): Promise<Branch> {
    // Branch creation is done via git, not gh
    // This provider focuses on remote operations
    const base = options?.baseBranch || 'main';

    // Create branch locally using git
    const { execSync } = await import('child_process');
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

  async deleteBranch(name: string, options?: BranchDeleteOptions): Promise<void> {
    const location = options?.location || 'both';
    const force = options?.force || false;
    const flag = force ? '-D' : '-d';

    const { execSync } = await import('child_process');

    if (location === 'local' || location === 'both') {
      try {
        execSync(`git branch ${flag} ${name}`, {
          cwd: this.cwd,
          encoding: 'utf-8',
        });
      } catch {
        // Ignore if branch doesn't exist locally
      }
    }

    if (location === 'remote' || location === 'both') {
      try {
        ghRaw(`api repos/${this.owner}/${this.repo}/git/refs/heads/${name} -X DELETE`, this.cwd);
      } catch {
        // Ignore if branch doesn't exist remotely
      }
    }
  }

  async listBranches(options?: BranchListOptions): Promise<Branch[]> {
    const limit = options?.limit || 100;

    const branches = gh<GitHubBranch[]>(
      `api repos/${this.owner}/${this.repo}/branches --paginate -q '.[:${limit}]'`,
      this.cwd
    );

    return branches.map(b => ({
      name: b.name,
      sha: b.commit.sha,
      isDefault: b.name === 'main' || b.name === 'master',
      isProtected: b.protected,
    }));
  }

  async getBranch(name: string): Promise<Branch | null> {
    try {
      const branch = gh<GitHubBranch>(
        `api repos/${this.owner}/${this.repo}/branches/${name}`,
        this.cwd
      );

      return {
        name: branch.name,
        sha: branch.commit.sha,
        isDefault: branch.name === 'main' || branch.name === 'master',
        isProtected: branch.protected,
      };
    } catch {
      return null;
    }
  }

  // =========================================================================
  // PULL REQUESTS
  // =========================================================================

  async createPR(options: PRCreateOptions): Promise<PullRequest> {
    const args: string[] = ['pr', 'create'];

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
      throw new ProviderError('github', 'createPR', 'Failed to get PR number from response');
    }

    const prNumber = parseInt(match[1], 10);
    return this.getPR(prNumber);
  }

  async getPR(number: number): Promise<PullRequest> {
    const fields = [
      'number', 'title', 'body', 'state', 'url', 'headRefName', 'baseRefName',
      'author', 'isDraft', 'mergeable', 'reviewDecision', 'createdAt', 'updatedAt',
      'mergedAt', 'closedAt', 'additions', 'deletions', 'changedFiles',
      'labels', 'assignees', 'reviewRequests',
    ];

    const pr = gh<GitHubPR>(
      `pr view ${number} --json ${fields.join(',')}`,
      this.cwd
    );

    return toPullRequest(pr);
  }

  async updatePR(number: number, options: PRUpdateOptions): Promise<PullRequest> {
    const args: string[] = ['pr', 'edit', number.toString()];

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

  async listPRs(options?: PRListOptions): Promise<PullRequest[]> {
    const args: string[] = ['pr', 'list'];

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

    const prs = gh<GitHubPR[]>(args.join(' '), this.cwd);
    return prs.map(toPullRequest);
  }

  async mergePR(number: number, options?: PRMergeOptions): Promise<PullRequest> {
    const args: string[] = ['pr', 'merge', number.toString()];

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

  async addPRComment(number: number, body: string): Promise<void> {
    ghRaw(`pr comment ${number} --body "${body.replace(/"/g, '\\"')}"`, this.cwd);
  }

  async requestReview(number: number, reviewers: string[]): Promise<void> {
    ghRaw(`pr edit ${number} --add-reviewer ${reviewers.join(',')}`, this.cwd);
  }

  async approvePR(number: number, comment?: string): Promise<void> {
    const args = ['pr', 'review', number.toString(), '--approve'];
    if (comment) {
      args.push('--body', `"${comment.replace(/"/g, '\\"')}"`);
    }
    ghRaw(args.join(' '), this.cwd);
  }
}
