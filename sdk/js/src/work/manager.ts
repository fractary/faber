/**
 * @fractary/faber - WorkManager
 *
 * Main entry point for work tracking operations.
 * Supports GitHub Issues, Jira, and Linear.
 */

import {
  WorkConfig,
  Issue,
  IssueCreateOptions,
  IssueUpdateOptions,
  IssueFilters,
  WorkType,
  Comment,
  Label,
  Milestone,
  MilestoneCreateOptions,
  FaberContext,
} from '../types.js';
import { WorkProvider, ListCommentsOptions } from './types.js';
import { loadWorkConfig, findProjectRoot } from '../config.js';
import { ConfigurationError } from '../errors.js';
import { GitHubWorkProvider } from './providers/github.js';
import { JiraWorkProvider } from './providers/jira.js';
import { LinearWorkProvider } from './providers/linear.js';

/**
 * WorkManager - Unified work tracking across platforms
 *
 * @example
 * ```typescript
 * const work = new WorkManager();
 * const issue = await work.fetchIssue(123);
 * await work.createComment(123, 'Implementation complete');
 * ```
 */
export class WorkManager {
  private provider: WorkProvider;
  private config: WorkConfig;

  constructor(config?: WorkConfig) {
    this.config = config || this.loadConfig();
    this.provider = this.createProvider(this.config);
  }

  /**
   * Load work configuration from project
   */
  private loadConfig(): WorkConfig {
    const config = loadWorkConfig(findProjectRoot());
    if (!config) {
      throw new ConfigurationError(
        'Work configuration not found. Run "fractary work init" to set up.'
      );
    }
    return config;
  }

  /**
   * Create the appropriate provider based on config
   */
  private createProvider(config: WorkConfig): WorkProvider {
    switch (config.platform) {
      case 'github':
        return new GitHubWorkProvider(config);
      case 'jira':
        return new JiraWorkProvider(config);
      case 'linear':
        return new LinearWorkProvider(config);
      default:
        throw new ConfigurationError(
          `Unsupported work platform: ${config.platform}`
        );
    }
  }

  /**
   * Get the current platform
   */
  getPlatform(): string {
    return this.provider.platform;
  }

  // =========================================================================
  // ISSUES
  // =========================================================================

  /**
   * Create a new issue
   */
  async createIssue(options: IssueCreateOptions): Promise<Issue> {
    return this.provider.createIssue(options);
  }

  /**
   * Fetch an issue by ID
   */
  async fetchIssue(issueId: string | number): Promise<Issue> {
    return this.provider.fetchIssue(issueId);
  }

  /**
   * Update an existing issue
   */
  async updateIssue(
    issueId: string | number,
    options: IssueUpdateOptions
  ): Promise<Issue> {
    return this.provider.updateIssue(issueId, options);
  }

  /**
   * Close an issue
   */
  async closeIssue(issueId: string | number): Promise<Issue> {
    return this.provider.closeIssue(issueId);
  }

  /**
   * Reopen a closed issue
   */
  async reopenIssue(issueId: string | number): Promise<Issue> {
    return this.provider.reopenIssue(issueId);
  }

  /**
   * Search for issues
   */
  async searchIssues(
    query: string,
    filters?: IssueFilters
  ): Promise<Issue[]> {
    return this.provider.searchIssues(query, filters);
  }

  /**
   * Assign an issue to a user
   */
  async assignIssue(
    issueId: string | number,
    assignee: string
  ): Promise<Issue> {
    return this.provider.assignIssue(issueId, assignee);
  }

  /**
   * Unassign an issue
   */
  async unassignIssue(issueId: string | number): Promise<Issue> {
    return this.provider.unassignIssue(issueId);
  }

  // =========================================================================
  // COMMENTS
  // =========================================================================

  /**
   * Create a comment on an issue
   */
  async createComment(
    issueId: string | number,
    body: string,
    faberContext?: FaberContext
  ): Promise<Comment> {
    return this.provider.createComment(issueId, body, faberContext);
  }

  /**
   * List comments on an issue
   */
  async listComments(
    issueId: string | number,
    options?: ListCommentsOptions
  ): Promise<Comment[]> {
    return this.provider.listComments(issueId, options);
  }

  // =========================================================================
  // LABELS
  // =========================================================================

  /**
   * Add labels to an issue
   */
  async addLabels(
    issueId: string | number,
    labels: string[]
  ): Promise<Label[]> {
    return this.provider.addLabels(issueId, labels);
  }

  /**
   * Remove labels from an issue
   */
  async removeLabels(
    issueId: string | number,
    labels: string[]
  ): Promise<void> {
    return this.provider.removeLabels(issueId, labels);
  }

  /**
   * Set labels on an issue (replaces existing)
   */
  async setLabels(
    issueId: string | number,
    labels: string[]
  ): Promise<Label[]> {
    return this.provider.setLabels(issueId, labels);
  }

  /**
   * List all labels (or labels on an issue)
   */
  async listLabels(issueId?: string | number): Promise<Label[]> {
    return this.provider.listLabels(issueId);
  }

  // =========================================================================
  // MILESTONES
  // =========================================================================

  /**
   * Create a new milestone
   */
  async createMilestone(
    options: MilestoneCreateOptions
  ): Promise<Milestone> {
    return this.provider.createMilestone(options);
  }

  /**
   * Set milestone on an issue
   */
  async setMilestone(
    issueId: string | number,
    milestone: string
  ): Promise<Issue> {
    return this.provider.setMilestone(issueId, milestone);
  }

  /**
   * Remove milestone from an issue
   */
  async removeMilestone(issueId: string | number): Promise<Issue> {
    return this.provider.removeMilestone(issueId);
  }

  /**
   * List all milestones
   */
  async listMilestones(
    state?: 'open' | 'closed' | 'all'
  ): Promise<Milestone[]> {
    return this.provider.listMilestones(state);
  }

  // =========================================================================
  // CLASSIFICATION
  // =========================================================================

  /**
   * Classify the type of work based on issue metadata
   */
  async classifyWorkType(issue: Issue): Promise<WorkType> {
    const labels = issue.labels.map(l => l.name.toLowerCase());
    const title = issue.title.toLowerCase();
    const body = issue.body.toLowerCase();

    // Check labels first
    if (labels.some(l => l.includes('bug') || l.includes('defect'))) {
      return 'bug';
    }
    if (labels.some(l => l.includes('feature') || l.includes('enhancement'))) {
      return 'feature';
    }
    if (labels.some(l => l.includes('chore') || l.includes('maintenance'))) {
      return 'chore';
    }
    if (labels.some(l => l.includes('patch') || l.includes('hotfix'))) {
      return 'patch';
    }
    if (labels.some(l => l.includes('infrastructure') || l.includes('infra'))) {
      return 'infrastructure';
    }
    if (labels.some(l => l.includes('api'))) {
      return 'api';
    }

    // Check title/body keywords
    if (title.includes('bug') || title.includes('fix') || body.includes('regression')) {
      return 'bug';
    }
    if (title.includes('add') || title.includes('implement') || title.includes('feature')) {
      return 'feature';
    }
    if (title.includes('refactor') || title.includes('cleanup') || title.includes('chore')) {
      return 'chore';
    }

    // Default to feature
    return 'feature';
  }
}
