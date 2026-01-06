/**
 * Repo Client
 *
 * Integrates with @fractary/core SDK for repository and work tracking operations
 */

import { WorkManager, RepoManager } from '@fractary/core';
import { createWorkConfig, createRepoConfig } from './sdk-config-adapter.js';
import { sdkIssueToCLIIssue, sdkWorktreeToCLIWorktreeResult } from './sdk-type-adapter.js';
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
 * from the @fractary/core SDK. Replaces the previous CLI-based approach.
 */
export class RepoClient {
  private config: any;
  private workManager: WorkManager;
  private repoManager: RepoManager;
  private organization: string;
  private project: string;

  constructor(config: any) {
    this.config = config;

    // Validate GitHub token
    const token = config.github?.token;
    if (!token) {
      throw new Error('GitHub token not found. Set GITHUB_TOKEN environment variable.');
    }

    // Extract organization and project
    this.organization = config.github?.organization || 'unknown';
    this.project = config.github?.project || 'unknown';

    // Create SDK configurations
    const workConfig = createWorkConfig(config);
    const repoConfig = createRepoConfig(config);

    // Initialize SDK managers
    try {
      this.workManager = new WorkManager(workConfig);
      this.repoManager = new RepoManager(repoConfig);
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`Failed to initialize SDK managers: ${error.message}`);
      }
      throw error;
    }
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
