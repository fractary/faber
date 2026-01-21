/**
 * Repo Client
 *
 * Integrates with @fractary/core SDK for repository and work tracking operations.
 * Supports both PAT and GitHub App authentication.
 */

import { WorkManager, RepoManager } from '@fractary/core';
import { GitHubAppAuth } from '@fractary/faber';
import { sdkIssueToCLIIssue, sdkWorktreeToCLIWorktreeResult } from './sdk-type-adapter.js';
import type { LoadedFaberConfig } from '../types/config.js';
import os from 'os';

interface Issue {
  id: string;
  number: number;
  title: string;
  description: string;
  labels: string[];
  url: string;
  state: string;
}

interface WorktreeResult {
  path: string;
  absolute_path: string;
  branch: string;
  created_at: string;
  organization: string;
  project: string;
  work_id: string;
}

interface IssueUpdateOptions {
  id: string;
  comment?: string;
  addLabel?: string;
  removeLabel?: string;
}

/**
 * Repo Client - integrates with @fractary/core SDK
 *
 * Provides repository and work tracking operations using WorkManager and RepoManager
 * from the @fractary/core SDK.
 */
export class RepoClient {
  private workManager!: WorkManager;
  private repoManager!: RepoManager;
  private organization: string;
  private project: string;

  /**
   * Create a RepoClient instance (async factory method)
   *
   * Supports both PAT and GitHub App authentication.
   * GitHub App takes precedence if configured.
   *
   * @param config - FABER CLI configuration with GitHub settings
   * @returns Promise resolving to RepoClient instance
   */
  static async create(config: LoadedFaberConfig): Promise<RepoClient> {
    const organization = config.github?.organization;
    const project = config.github?.project;

    if (!organization || typeof organization !== 'string' || organization.trim() === '') {
      throw new Error(
        'GitHub organization must be configured in .fractary/config.yaml\n' +
        'Add: github.organization: "your-org"'
      );
    }

    if (!project || typeof project !== 'string' || project.trim() === '') {
      throw new Error(
        'GitHub project must be configured in .fractary/config.yaml\n' +
        'Add: github.project: "your-repo"'
      );
    }

    // Get token - GitHub App takes precedence over PAT
    let token: string;
    const appConfig = config.github?.app;

    if (appConfig?.id && appConfig?.installation_id) {
      // Use GitHub App authentication
      try {
        const auth = new GitHubAppAuth(appConfig);
        token = await auth.getToken();
      } catch (error) {
        if (error instanceof Error) {
          throw new Error(`GitHub App authentication failed: ${error.message}`);
        }
        throw error;
      }
    } else {
      // Fall back to PAT
      const patToken = config.github?.token || process.env.GITHUB_TOKEN;
      if (!patToken || typeof patToken !== 'string' || patToken.trim() === '') {
        throw new Error(
          'GitHub authentication not configured. Either:\n' +
          '  1. Set GITHUB_TOKEN environment variable, or\n' +
          '  2. Configure GitHub App in .fractary/config.yaml:\n' +
          '     github:\n' +
          '       app:\n' +
          '         id: "<app-id>"\n' +
          '         installation_id: "<installation-id>"\n' +
          '         private_key_path: "~/.github/your-app.pem"'
        );
      }
      token = patToken;
    }

    try {
      const workManager = new WorkManager({
        platform: 'github',
        owner: organization.trim(),
        repo: project.trim(),
        token,
      });

      const repoManager = new RepoManager({
        platform: 'github',
        owner: organization.trim(),
        repo: project.trim(),
        token,
      });

      return new RepoClient(workManager, repoManager, organization.trim(), project.trim());
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`Failed to initialize SDK managers: ${error.message}`);
      }
      throw error;
    }
  }

  /**
   * Private constructor - use RepoClient.create() factory method
   */
  private constructor(
    workManager: WorkManager,
    repoManager: RepoManager,
    organization: string,
    project: string
  ) {
    this.workManager = workManager;
    this.repoManager = repoManager;
    this.organization = organization;
    this.project = project;
  }

  /**
   * Fetch specific issues by ID
   *
   * Uses WorkManager from @fractary/core SDK
   */
  async fetchIssues(ids: string[]): Promise<Issue[]> {
    try {
      const issues = await Promise.all(
        ids.map(id => this.workManager.fetchIssue(id))
      );
      return issues.map(sdkIssueToCLIIssue);
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`Failed to fetch issues: ${error.message}`);
      }
      throw error;
    }
  }

  /**
   * Search issues by labels
   *
   * Uses WorkManager from @fractary/core SDK
   */
  async searchIssues(labels: string[]): Promise<Issue[]> {
    try {
      const issues = await this.workManager.searchIssues('', {
        state: 'open',
        labels: labels,
      });
      return issues.map(sdkIssueToCLIIssue);
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`Failed to search issues: ${error.message}`);
      }
      throw error;
    }
  }

  /**
   * Create a git branch
   *
   * Uses RepoManager from @fractary/core SDK
   */
  async createBranch(branchName: string): Promise<void> {
    try {
      await this.repoManager.createBranch(branchName);
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`Failed to create branch: ${error.message}`);
      }
      throw error;
    }
  }

  /**
   * Create a git worktree
   *
   * Uses RepoManager from @fractary/core SDK
   */
  async createWorktree(options: { workId: string; path?: string }): Promise<WorktreeResult> {
    try {
      const branch = `feature/${options.workId}`;
      const path = options.path ||
        `~/.claude-worktrees/${this.organization}-${this.project}-${options.workId}`;

      // Expand ~ to home directory
      const expandedPath = path.startsWith('~')
        ? path.replace('~', os.homedir())
        : path;

      const worktree = this.repoManager.createWorktree({
        path: expandedPath,
        branch,
        workId: options.workId,
      });

      return sdkWorktreeToCLIWorktreeResult(
        worktree,
        this.organization,
        this.project,
        options.workId
      );
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`Failed to create worktree: ${error.message}`);
      }
      throw error;
    }
  }

  /**
   * Update GitHub issue
   *
   * Uses WorkManager from @fractary/core SDK
   */
  async updateIssue(options: IssueUpdateOptions): Promise<void> {
    try {
      const issueId = parseInt(options.id, 10);

      // Create comment if provided
      if (options.comment) {
        await this.workManager.createComment(issueId, options.comment);
      }

      // Add label if provided
      if (options.addLabel) {
        await this.workManager.addLabels(issueId, [options.addLabel]);
      }

      // Remove label if provided
      if (options.removeLabel) {
        await this.workManager.removeLabels(issueId, [options.removeLabel]);
      }
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`Failed to update issue: ${error.message}`);
      }
      throw error;
    }
  }
}
