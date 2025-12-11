/**
 * @fractary/faber - Work Module Types
 *
 * Re-exports from main types + work-specific interfaces.
 */
export { WorkConfig, WorkPlatform, Issue, IssueCreateOptions, IssueUpdateOptions, IssueFilters, WorkType, Label, Milestone, MilestoneCreateOptions, Comment, CommentCreateOptions, FaberContext, } from '../types';
/**
 * Interface for work tracking providers
 */
export interface WorkProvider {
    readonly platform: 'github' | 'jira' | 'linear';
    createIssue(options: import('../types').IssueCreateOptions): Promise<import('../types').Issue>;
    fetchIssue(issueId: string | number): Promise<import('../types').Issue>;
    updateIssue(issueId: string | number, options: import('../types').IssueUpdateOptions): Promise<import('../types').Issue>;
    closeIssue(issueId: string | number): Promise<import('../types').Issue>;
    reopenIssue(issueId: string | number): Promise<import('../types').Issue>;
    searchIssues(query: string, filters?: import('../types').IssueFilters): Promise<import('../types').Issue[]>;
    assignIssue(issueId: string | number, assignee: string): Promise<import('../types').Issue>;
    unassignIssue(issueId: string | number): Promise<import('../types').Issue>;
    createComment(issueId: string | number, body: string, faberContext?: import('../types').FaberContext): Promise<import('../types').Comment>;
    listComments(issueId: string | number, options?: {
        limit?: number;
        since?: string;
    }): Promise<import('../types').Comment[]>;
    addLabels(issueId: string | number, labels: string[]): Promise<import('../types').Label[]>;
    removeLabels(issueId: string | number, labels: string[]): Promise<void>;
    setLabels(issueId: string | number, labels: string[]): Promise<import('../types').Label[]>;
    listLabels(issueId?: string | number): Promise<import('../types').Label[]>;
    createMilestone(options: import('../types').MilestoneCreateOptions): Promise<import('../types').Milestone>;
    setMilestone(issueId: string | number, milestone: string): Promise<import('../types').Issue>;
    removeMilestone(issueId: string | number): Promise<import('../types').Issue>;
    listMilestones(state?: 'open' | 'closed' | 'all'): Promise<import('../types').Milestone[]>;
}
/**
 * List options for comments
 */
export interface ListCommentsOptions {
    limit?: number;
    since?: string;
}
//# sourceMappingURL=types.d.ts.map