/**
 * @fractary/faber - Linear Work Provider
 *
 * Work tracking via Linear GraphQL API.
 * TODO: Full implementation
 */
import { WorkConfig, Issue, IssueCreateOptions, IssueUpdateOptions, IssueFilters, Comment, Label, Milestone, MilestoneCreateOptions, FaberContext } from '../../types';
import { WorkProvider } from '../types';
/**
 * Linear Issues provider
 *
 * Note: This is a stub implementation. Full Linear support requires:
 * - Linear GraphQL API integration
 * - Team/workspace configuration
 * - Cycle support (Linear's equivalent of milestones)
 * - Label management
 */
export declare class LinearWorkProvider implements WorkProvider {
    readonly platform: "linear";
    private teamId;
    constructor(config: WorkConfig);
    /** Get the team ID for API calls */
    protected getTeamId(): string;
    private notImplemented;
    createIssue(_options: IssueCreateOptions): Promise<Issue>;
    fetchIssue(_issueId: string | number): Promise<Issue>;
    updateIssue(_issueId: string | number, _options: IssueUpdateOptions): Promise<Issue>;
    closeIssue(_issueId: string | number): Promise<Issue>;
    reopenIssue(_issueId: string | number): Promise<Issue>;
    searchIssues(_query: string, _filters?: IssueFilters): Promise<Issue[]>;
    assignIssue(_issueId: string | number, _assignee: string): Promise<Issue>;
    unassignIssue(_issueId: string | number): Promise<Issue>;
    createComment(_issueId: string | number, _body: string, _faberContext?: FaberContext): Promise<Comment>;
    listComments(_issueId: string | number, _options?: {
        limit?: number;
        since?: string;
    }): Promise<Comment[]>;
    addLabels(_issueId: string | number, _labels: string[]): Promise<Label[]>;
    removeLabels(_issueId: string | number, _labels: string[]): Promise<void>;
    setLabels(_issueId: string | number, _labels: string[]): Promise<Label[]>;
    listLabels(_issueId?: string | number): Promise<Label[]>;
    createMilestone(_options: MilestoneCreateOptions): Promise<Milestone>;
    setMilestone(_issueId: string | number, _milestone: string): Promise<Issue>;
    removeMilestone(_issueId: string | number): Promise<Issue>;
    listMilestones(_state?: 'open' | 'closed' | 'all'): Promise<Milestone[]>;
}
//# sourceMappingURL=linear.d.ts.map