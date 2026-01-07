/**
 * @fractary/faber - Work Module Types
 *
 * Re-exports from main types + work-specific interfaces.
 */

// Re-export common types
export {
  WorkConfig,
  WorkPlatform,
  Issue,
  IssueCreateOptions,
  IssueUpdateOptions,
  IssueFilters,
  WorkType,
  Label,
  Milestone,
  MilestoneCreateOptions,
  Comment,
  CommentCreateOptions,
  FaberContext,
} from '../types.js';

/**
 * Interface for work tracking providers
 */
export interface WorkProvider {
  readonly platform: 'github' | 'jira' | 'linear';

  // Issues
  createIssue(options: import('../types.js').IssueCreateOptions): Promise<import('../types.js').Issue>;
  fetchIssue(issueId: string | number): Promise<import('../types.js').Issue>;
  updateIssue(
    issueId: string | number,
    options: import('../types.js').IssueUpdateOptions
  ): Promise<import('../types.js').Issue>;
  closeIssue(issueId: string | number): Promise<import('../types.js').Issue>;
  reopenIssue(issueId: string | number): Promise<import('../types.js').Issue>;
  searchIssues(
    query: string,
    filters?: import('../types.js').IssueFilters
  ): Promise<import('../types.js').Issue[]>;
  assignIssue(
    issueId: string | number,
    assignee: string
  ): Promise<import('../types.js').Issue>;
  unassignIssue(issueId: string | number): Promise<import('../types.js').Issue>;

  // Comments
  createComment(
    issueId: string | number,
    body: string,
    faberContext?: import('../types.js').FaberContext
  ): Promise<import('../types.js').Comment>;
  listComments(
    issueId: string | number,
    options?: { limit?: number; since?: string }
  ): Promise<import('../types.js').Comment[]>;

  // Labels
  addLabels(issueId: string | number, labels: string[]): Promise<import('../types.js').Label[]>;
  removeLabels(issueId: string | number, labels: string[]): Promise<void>;
  setLabels(issueId: string | number, labels: string[]): Promise<import('../types.js').Label[]>;
  listLabels(issueId?: string | number): Promise<import('../types.js').Label[]>;

  // Milestones
  createMilestone(
    options: import('../types.js').MilestoneCreateOptions
  ): Promise<import('../types.js').Milestone>;
  setMilestone(issueId: string | number, milestone: string): Promise<import('../types.js').Issue>;
  removeMilestone(issueId: string | number): Promise<import('../types.js').Issue>;
  listMilestones(state?: 'open' | 'closed' | 'all'): Promise<import('../types.js').Milestone[]>;
}

/**
 * List options for comments
 */
export interface ListCommentsOptions {
  limit?: number;
  since?: string;
}
