/**
 * @fractary/faber - Jira Work Provider
 *
 * Work tracking via Jira REST API.
 * TODO: Full implementation
 */

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
import { ProviderError } from '../../errors.js';

/**
 * Jira Issues provider
 *
 * Note: This is a stub implementation. Full Jira support requires:
 * - Jira REST API v3 integration
 * - JQL query support
 * - ADF (Atlassian Document Format) for rich text
 * - Project/board configuration
 */
export class JiraWorkProvider implements WorkProvider {
  readonly platform = 'jira' as const;
  // Stored for future API implementation
  private baseUrl: string;
  private projectKey: string;

  constructor(config: WorkConfig) {
    if (!config.project) {
      throw new ProviderError(
        'jira',
        'init',
        'Jira work provider requires project in config'
      );
    }
    this.baseUrl = ''; // TODO: Load from config
    this.projectKey = config.project;
  }

  /** Get the API base URL */
  protected getBaseUrl(): string {
    return this.baseUrl;
  }

  /** Get the project key for API calls */
  protected getProjectKey(): string {
    return this.projectKey;
  }

  private notImplemented(operation: string): never {
    throw new ProviderError(
      'jira',
      operation,
      `Jira ${operation} not yet implemented`
    );
  }

  async createIssue(_options: IssueCreateOptions): Promise<Issue> {
    this.notImplemented('createIssue');
  }

  async fetchIssue(_issueId: string | number): Promise<Issue> {
    this.notImplemented('fetchIssue');
  }

  async updateIssue(
    _issueId: string | number,
    _options: IssueUpdateOptions
  ): Promise<Issue> {
    this.notImplemented('updateIssue');
  }

  async closeIssue(_issueId: string | number): Promise<Issue> {
    this.notImplemented('closeIssue');
  }

  async reopenIssue(_issueId: string | number): Promise<Issue> {
    this.notImplemented('reopenIssue');
  }

  async searchIssues(
    _query: string,
    _filters?: IssueFilters
  ): Promise<Issue[]> {
    this.notImplemented('searchIssues');
  }

  async assignIssue(
    _issueId: string | number,
    _assignee: string
  ): Promise<Issue> {
    this.notImplemented('assignIssue');
  }

  async unassignIssue(_issueId: string | number): Promise<Issue> {
    this.notImplemented('unassignIssue');
  }

  async createComment(
    _issueId: string | number,
    _body: string,
    _faberContext?: FaberContext
  ): Promise<Comment> {
    this.notImplemented('createComment');
  }

  async listComments(
    _issueId: string | number,
    _options?: { limit?: number; since?: string }
  ): Promise<Comment[]> {
    this.notImplemented('listComments');
  }

  async addLabels(
    _issueId: string | number,
    _labels: string[]
  ): Promise<Label[]> {
    this.notImplemented('addLabels');
  }

  async removeLabels(
    _issueId: string | number,
    _labels: string[]
  ): Promise<void> {
    this.notImplemented('removeLabels');
  }

  async setLabels(
    _issueId: string | number,
    _labels: string[]
  ): Promise<Label[]> {
    this.notImplemented('setLabels');
  }

  async listLabels(_issueId?: string | number): Promise<Label[]> {
    this.notImplemented('listLabels');
  }

  async createMilestone(
    _options: MilestoneCreateOptions
  ): Promise<Milestone> {
    this.notImplemented('createMilestone');
  }

  async setMilestone(
    _issueId: string | number,
    _milestone: string
  ): Promise<Issue> {
    this.notImplemented('setMilestone');
  }

  async removeMilestone(_issueId: string | number): Promise<Issue> {
    this.notImplemented('removeMilestone');
  }

  async listMilestones(
    _state?: 'open' | 'closed' | 'all'
  ): Promise<Milestone[]> {
    this.notImplemented('listMilestones');
  }
}
