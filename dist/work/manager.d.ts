/**
 * @fractary/faber - WorkManager
 *
 * Main entry point for work tracking operations.
 * Supports GitHub Issues, Jira, and Linear.
 */
import { WorkConfig, Issue, IssueCreateOptions, IssueUpdateOptions, IssueFilters, WorkType, Comment, Label, Milestone, MilestoneCreateOptions, FaberContext } from '../types';
import { ListCommentsOptions } from './types';
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
export declare class WorkManager {
    private provider;
    private config;
    constructor(config?: WorkConfig);
    /**
     * Load work configuration from project
     */
    private loadConfig;
    /**
     * Create the appropriate provider based on config
     */
    private createProvider;
    /**
     * Get the current platform
     */
    getPlatform(): string;
    /**
     * Create a new issue
     */
    createIssue(options: IssueCreateOptions): Promise<Issue>;
    /**
     * Fetch an issue by ID
     */
    fetchIssue(issueId: string | number): Promise<Issue>;
    /**
     * Update an existing issue
     */
    updateIssue(issueId: string | number, options: IssueUpdateOptions): Promise<Issue>;
    /**
     * Close an issue
     */
    closeIssue(issueId: string | number): Promise<Issue>;
    /**
     * Reopen a closed issue
     */
    reopenIssue(issueId: string | number): Promise<Issue>;
    /**
     * Search for issues
     */
    searchIssues(query: string, filters?: IssueFilters): Promise<Issue[]>;
    /**
     * Assign an issue to a user
     */
    assignIssue(issueId: string | number, assignee: string): Promise<Issue>;
    /**
     * Unassign an issue
     */
    unassignIssue(issueId: string | number): Promise<Issue>;
    /**
     * Create a comment on an issue
     */
    createComment(issueId: string | number, body: string, faberContext?: FaberContext): Promise<Comment>;
    /**
     * List comments on an issue
     */
    listComments(issueId: string | number, options?: ListCommentsOptions): Promise<Comment[]>;
    /**
     * Add labels to an issue
     */
    addLabels(issueId: string | number, labels: string[]): Promise<Label[]>;
    /**
     * Remove labels from an issue
     */
    removeLabels(issueId: string | number, labels: string[]): Promise<void>;
    /**
     * Set labels on an issue (replaces existing)
     */
    setLabels(issueId: string | number, labels: string[]): Promise<Label[]>;
    /**
     * List all labels (or labels on an issue)
     */
    listLabels(issueId?: string | number): Promise<Label[]>;
    /**
     * Create a new milestone
     */
    createMilestone(options: MilestoneCreateOptions): Promise<Milestone>;
    /**
     * Set milestone on an issue
     */
    setMilestone(issueId: string | number, milestone: string): Promise<Issue>;
    /**
     * Remove milestone from an issue
     */
    removeMilestone(issueId: string | number): Promise<Issue>;
    /**
     * List all milestones
     */
    listMilestones(state?: 'open' | 'closed' | 'all'): Promise<Milestone[]>;
    /**
     * Classify the type of work based on issue metadata
     */
    classifyWorkType(issue: Issue): Promise<WorkType>;
}
//# sourceMappingURL=manager.d.ts.map