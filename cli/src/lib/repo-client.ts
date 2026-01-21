/**
 * Repo Client
 *
 * Integrates with @fractary/core SDK for repository and work tracking operations.
 * Uses core's auth-aware factories for automatic GitHub App and PAT support.
 */

import { WorkManager, RepoManager, createWorkManager, createRepoManager } from '@fractary/core';
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
 * from the @fractary/core SDK. Authentication (PAT or GitHub App) is handled
 * automatically by core's factories.
 */
export class RepoClient {
  private workManager!: WorkManager;
  private repoManager!: RepoManager;
  private organization: string;
  private project: string;

  /**
   * Create a RepoClient instance (async factory method)
   *
   * Uses @fractary/core's auth-aware factories which automatically handle
   * both PAT and GitHub App authentication based on .fractary/config.yaml.
   *
   * @param config - Optional FABER CLI configuration (for org/project info)
   * @returns Promise resolving to RepoClient instance
   */
  static async create(config?: LoadedFaberConfig): Promise<RepoClient> {
    try {
      // Use core's auth-aware factories - they handle config loading and auth automatically
      const workManager = await createWorkManager();
      const repoManager = await createRepoManager();

      // Get org/project from config or from the managers
      const organization = config?.github?.organization || 'unknown';
      const project = config?.github?.project || 'unknown';

      return new RepoClient(workManager, repoManager, organization, project);
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
