/**
 * @fractary/faber - GitHub Work Provider
 *
 * Work tracking via GitHub Issues using the gh CLI.
 */

import { execSync, ExecSyncOptions } from 'child_process';
import {
  WorkConfig,
  Issue,
  IssueCreateOptions,
  IssueUpdateOptions,
  IssueFilters,
  Comment,
  Label,
  Milestone,
  MilestoneCreateOptions,
  FaberContext,
} from '../../types.js';
import { WorkProvider } from '../types.js';
import {
  IssueNotFoundError,
  IssueCreateError,
  AuthenticationError,
  CommandExecutionError,
  ProviderError,
} from '../../errors.js';

/**
 * Execute a command and return the output
 */
function exec(command: string, options?: ExecSyncOptions): string {
  try {
    const result = execSync(command, {
      encoding: 'utf-8',
      maxBuffer: 10 * 1024 * 1024, // 10MB
      ...options,
    });
    return (typeof result === 'string' ? result : result.toString()).trim();
  } catch (error: unknown) {
    const err = error as { status?: number; stderr?: Buffer | string };
    const exitCode = err.status || 1;
    const stderr = err.stderr?.toString() || '';

    if (stderr.includes('authentication') || stderr.includes('auth')) {
      throw new AuthenticationError('github', 'GitHub authentication failed. Run "gh auth login"');
    }

    throw new CommandExecutionError(command, exitCode, stderr);
  }
}

/**
 * Execute a command with env overrides for gh CLI authentication
 */
function execWithEnv(command: string, env?: Record<string, string>, options?: ExecSyncOptions): string {
  const opts: ExecSyncOptions = { ...options };
  if (env) {
    opts.env = { ...process.env, ...env };
  }
  return exec(command, opts);
}


/**
 * Check if gh CLI is available and authenticated.
 * When a GH_TOKEN is provided via env overrides, skip the auth status check
 * entirely — the token is the auth, and `gh auth status` may fail if other
 * hosts (e.g. SSH aliases like github-fractary) have expired tokens.
 */
function checkGhCli(host?: string, env?: Record<string, string>): void {
  if (env?.GH_TOKEN) {
    return; // Token provided — no need for a preflight auth check
  }
  try {
    const hostnameArg = host ? ` --hostname ${host}` : '';
    exec(`gh auth status${hostnameArg}`);
  } catch {
    throw new AuthenticationError(
      'github',
      'GitHub CLI not authenticated. Run "gh auth login" to authenticate.'
    );
  }
}

/**
 * GitHub Issues provider using gh CLI
 */
export class GitHubWorkProvider implements WorkProvider {
  readonly platform = 'github' as const;
  private owner: string;
  private repo: string;
  private ghEnv: Record<string, string> | undefined;

  constructor(config: WorkConfig) {
    if (!config.owner || !config.repo) {
      throw new ProviderError(
        'github',
        'init',
        'GitHub work provider requires owner and repo in config'
      );
    }
    this.owner = config.owner;
    this.repo = config.repo;

    // Inject GH_TOKEN so gh CLI uses the configured token instead of its
    // own auth store (which may have expired or fail with SSH host aliases).
    const token = config.token || process.env.GITHUB_TOKEN;
    if (token) {
      this.ghEnv = { GH_TOKEN: token };
    }

    checkGhCli(config.host, this.ghEnv);
  }

  private getRepoArg(): string {
    return `${this.owner}/${this.repo}`;
  }

  /** Execute a gh command with configured token injected into the environment. */
  private gh(command: string, options?: ExecSyncOptions): string {
    return execWithEnv(command, this.ghEnv, options);
  }

  /** Execute a gh command with stdin input and configured token injected. */
  private ghWithStdin(command: string, stdin: string): string {
    const opts: ExecSyncOptions = {
      encoding: 'utf-8',
      maxBuffer: 10 * 1024 * 1024,
      input: stdin,
      ...(this.ghEnv ? { env: { ...process.env, ...this.ghEnv } } : {}),
    };
    try {
      const result = execSync(command, opts);
      return (typeof result === 'string' ? result : result.toString()).trim();
    } catch (error: unknown) {
      const err = error as { status?: number; stderr?: Buffer | string };
      const exitCode = err.status || 1;
      const stderr = err.stderr?.toString() || '';
      if (stderr.includes('authentication') || stderr.includes('auth')) {
        throw new AuthenticationError('github', 'GitHub authentication failed. Run "gh auth login"');
      }
      throw new CommandExecutionError(command, exitCode, stderr);
    }
  }

  // =========================================================================
  // ISSUES
  // =========================================================================

  async createIssue(options: IssueCreateOptions): Promise<Issue> {
    const args = [`--repo ${this.getRepoArg()}`];
    args.push(`--title "${options.title.replace(/"/g, '\\"')}"`);

    // Use stdin for body to avoid shell injection
    const useBodyStdin = !!options.body;
    if (useBodyStdin) {
      args.push('--body-file -');
    }
    if (options.labels && options.labels.length > 0) {
      args.push(`--label "${options.labels.join(',')}"`);
    }
    if (options.assignees && options.assignees.length > 0) {
      args.push(`--assignee "${options.assignees.join(',')}"`);
    }
    if (options.milestone) {
      args.push(`--milestone "${options.milestone}"`);
    }

    try {
      const cmd = `gh issue create ${args.join(' ')} --json number,title,body,state,labels,assignees,milestone,createdAt,updatedAt,url`;
      const result = useBodyStdin
        ? this.ghWithStdin(cmd, options.body!)
        : this.gh(cmd);
      return this.parseIssue(JSON.parse(result));
    } catch (error) {
      if (error instanceof CommandExecutionError) {
        throw new IssueCreateError(error.stderr);
      }
      throw error;
    }
  }

  async fetchIssue(issueId: string | number): Promise<Issue> {
    try {
      const result = this.gh(
        `gh issue view ${issueId} --repo ${this.getRepoArg()} --json number,title,body,state,labels,assignees,milestone,createdAt,updatedAt,closedAt,url`
      );
      return this.parseIssue(JSON.parse(result));
    } catch (error) {
      if (error instanceof CommandExecutionError) {
        if (error.stderr.includes('not found') || error.stderr.includes('Could not resolve')) {
          throw new IssueNotFoundError(issueId);
        }
      }
      throw error;
    }
  }

  async updateIssue(
    issueId: string | number,
    options: IssueUpdateOptions
  ): Promise<Issue> {
    const args = [`--repo ${this.getRepoArg()}`];

    if (options.title) {
      args.push(`--title "${options.title.replace(/"/g, '\\"')}"`);
    }

    // Use stdin for body to avoid shell injection
    const useBodyStdin = !!options.body;
    if (useBodyStdin) {
      args.push('--body-file -');
    }

    if (args.length > 1) {
      const cmd = `gh issue edit ${issueId} ${args.join(' ')}`;
      if (useBodyStdin) {
        this.ghWithStdin(cmd, options.body!);
      } else {
        this.gh(cmd);
      }
    }

    return this.fetchIssue(issueId);
  }

  async closeIssue(issueId: string | number): Promise<Issue> {
    this.gh(`gh issue close ${issueId} --repo ${this.getRepoArg()}`);
    return this.fetchIssue(issueId);
  }

  async reopenIssue(issueId: string | number): Promise<Issue> {
    this.gh(`gh issue reopen ${issueId} --repo ${this.getRepoArg()}`);
    return this.fetchIssue(issueId);
  }

  async searchIssues(
    query: string,
    filters?: IssueFilters
  ): Promise<Issue[]> {
    const args = [`--repo ${this.getRepoArg()}`];

    if (filters?.state && filters.state !== 'all') {
      args.push(`--state ${filters.state}`);
    }
    if (filters?.labels && filters.labels.length > 0) {
      args.push(`--label "${filters.labels.join(',')}"`);
    }
    if (filters?.assignee) {
      args.push(`--assignee ${filters.assignee}`);
    }
    if (filters?.milestone) {
      args.push(`--milestone "${filters.milestone}"`);
    }

    args.push(`--search "${query}"`);
    args.push('--json number,title,body,state,labels,assignees,milestone,createdAt,updatedAt,closedAt,url');

    const result = this.gh(`gh issue list ${args.join(' ')}`);
    const issues = JSON.parse(result || '[]') as unknown[];
    return issues.map(i => this.parseIssue(i));
  }

  async assignIssue(
    issueId: string | number,
    assignee: string
  ): Promise<Issue> {
    this.gh(`gh issue edit ${issueId} --repo ${this.getRepoArg()} --add-assignee ${assignee}`);
    return this.fetchIssue(issueId);
  }

  async unassignIssue(issueId: string | number): Promise<Issue> {
    // Get current assignees and remove them
    const issue = await this.fetchIssue(issueId);
    if (issue.assignees.length > 0) {
      this.gh(`gh issue edit ${issueId} --repo ${this.getRepoArg()} --remove-assignee ${issue.assignees.join(',')}`);
    }
    return this.fetchIssue(issueId);
  }

  // =========================================================================
  // COMMENTS
  // =========================================================================

  async createComment(
    issueId: string | number,
    body: string,
    faberContext?: FaberContext
  ): Promise<Comment> {
    // Add FABER context to comment if provided
    let finalBody = body;
    if (faberContext) {
      finalBody = `<!-- faber:${faberContext} -->\n${body}`;
    }

    // Use stdin to pass body safely (avoids shell injection with backticks, newlines, etc.)
    this.ghWithStdin(
      `gh issue comment ${issueId} --repo ${this.getRepoArg()} --body-file -`,
      finalBody
    );

    // gh doesn't return JSON for comment creation, so we fetch latest
    const comments = await this.listComments(issueId, { limit: 1 });
    return comments[0];
  }

  async listComments(
    issueId: string | number,
    options?: { limit?: number; since?: string }
  ): Promise<Comment[]> {
    const result = this.gh(
      `gh api repos/${this.getRepoArg()}/issues/${issueId}/comments --jq '.[] | {id: .id, body: .body, author: .user.login, createdAt: .created_at, updatedAt: .updated_at}'`
    );

    if (!result) return [];

    const lines = result.split('\n').filter(l => l.trim());
    let comments = lines.map(line => {
      const c = JSON.parse(line);
      return {
        id: String(c.id),
        body: c.body,
        author: c.author,
        created_at: c.createdAt,
        updated_at: c.updatedAt,
      };
    });

    if (options?.since) {
      const sinceDate = new Date(options.since);
      comments = comments.filter(c => new Date(c.created_at) > sinceDate);
    }

    if (options?.limit) {
      comments = comments.slice(-options.limit);
    }

    return comments;
  }

  // =========================================================================
  // LABELS
  // =========================================================================

  async addLabels(
    issueId: string | number,
    labels: string[]
  ): Promise<Label[]> {
    this.gh(`gh issue edit ${issueId} --repo ${this.getRepoArg()} --add-label "${labels.join(',')}"`);
    const issue = await this.fetchIssue(issueId);
    return issue.labels;
  }

  async removeLabels(
    issueId: string | number,
    labels: string[]
  ): Promise<void> {
    this.gh(`gh issue edit ${issueId} --repo ${this.getRepoArg()} --remove-label "${labels.join(',')}"`);
  }

  async setLabels(
    issueId: string | number,
    labels: string[]
  ): Promise<Label[]> {
    // First remove all labels, then add new ones
    const issue = await this.fetchIssue(issueId);
    if (issue.labels.length > 0) {
      await this.removeLabels(issueId, issue.labels.map(l => l.name));
    }
    if (labels.length > 0) {
      return this.addLabels(issueId, labels);
    }
    return [];
  }

  async listLabels(issueId?: string | number): Promise<Label[]> {
    if (issueId) {
      const issue = await this.fetchIssue(issueId);
      return issue.labels;
    }

    const result = this.gh(
      `gh label list --repo ${this.getRepoArg()} --json name,color,description`
    );
    return JSON.parse(result || '[]') as Label[];
  }

  // =========================================================================
  // MILESTONES
  // =========================================================================

  async createMilestone(options: MilestoneCreateOptions): Promise<Milestone> {
    const args = [`--title "${options.title}"`];
    if (options.description) {
      args.push(`--description "${options.description.replace(/"/g, '\\"')}"`);
    }
    if (options.due_on) {
      args.push(`--due-date "${options.due_on}"`);
    }

    const result = this.gh(
      `gh api repos/${this.getRepoArg()}/milestones -f title="${options.title}" ${options.description ? `-f description="${options.description}"` : ''} ${options.due_on ? `-f due_on="${options.due_on}"` : ''}`
    );

    const m = JSON.parse(result);
    return {
      id: String(m.number),
      title: m.title,
      description: m.description,
      due_on: m.due_on,
      state: m.state,
    };
  }

  async setMilestone(
    issueId: string | number,
    milestone: string
  ): Promise<Issue> {
    this.gh(`gh issue edit ${issueId} --repo ${this.getRepoArg()} --milestone "${milestone}"`);
    return this.fetchIssue(issueId);
  }

  async removeMilestone(issueId: string | number): Promise<Issue> {
    this.gh(`gh issue edit ${issueId} --repo ${this.getRepoArg()} --milestone ""`);
    return this.fetchIssue(issueId);
  }

  async listMilestones(state?: 'open' | 'closed' | 'all'): Promise<Milestone[]> {
    const stateArg = state && state !== 'all' ? `?state=${state}` : '';
    const result = this.gh(
      `gh api repos/${this.getRepoArg()}/milestones${stateArg}`
    );

    const milestones = JSON.parse(result || '[]') as Array<{
      number: number;
      title: string;
      description?: string;
      due_on?: string;
      state: string;
    }>;

    return milestones.map(m => ({
      id: String(m.number),
      title: m.title,
      description: m.description,
      due_on: m.due_on,
      state: m.state as 'open' | 'closed',
    }));
  }

  // =========================================================================
  // HELPERS
  // =========================================================================

  private parseIssue(raw: unknown): Issue {
    const data = raw as Record<string, unknown>;
    return {
      id: String(data['number']),
      number: data['number'] as number,
      title: data['title'] as string,
      body: (data['body'] as string) || '',
      state: (data['state'] as string)?.toLowerCase() === 'open' ? 'open' : 'closed',
      labels: ((data['labels'] as Array<{ name: string; color?: string; description?: string }>) || []).map(l => ({
        name: l.name,
        color: l.color,
        description: l.description,
      })),
      assignees: ((data['assignees'] as Array<{ login: string }>) || []).map(a => a.login),
      milestone: data['milestone'] ? {
        id: String((data['milestone'] as Record<string, unknown>)['number']),
        title: (data['milestone'] as Record<string, unknown>)['title'] as string,
        description: (data['milestone'] as Record<string, unknown>)['description'] as string | undefined,
        due_on: (data['milestone'] as Record<string, unknown>)['dueOn'] as string | undefined,
        state: ((data['milestone'] as Record<string, unknown>)['state'] as string)?.toLowerCase() === 'open' ? 'open' : 'closed',
      } : undefined,
      created_at: data['createdAt'] as string,
      updated_at: data['updatedAt'] as string,
      closed_at: data['closedAt'] as string | undefined,
      url: data['url'] as string,
    };
  }
}
