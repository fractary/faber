/**
 * @fractary/faber - GitHub Work Provider
 *
 * Work tracking via GitHub Issues using the gh CLI.
 */
import { WorkConfig, Issue, IssueCreateOptions, IssueUpdateOptions, IssueFilters, Comment, Label, Milestone, MilestoneCreateOptions, FaberContext } from '../../types';
import { WorkProvider } from '../types';
/**
 * GitHub Issues provider using gh CLI
 */
export declare class GitHubWorkProvider implements WorkProvider {
    readonly platform: "github";
    private owner;
    private repo;
    constructor(config: WorkConfig);
    private getRepoArg;
    createIssue(options: IssueCreateOptions): Promise<Issue>;
    fetchIssue(issueId: string | number): Promise<Issue>;
    updateIssue(issueId: string | number, options: IssueUpdateOptions): Promise<Issue>;
    closeIssue(issueId: string | number): Promise<Issue>;
    reopenIssue(issueId: string | number): Promise<Issue>;
    searchIssues(query: string, filters?: IssueFilters): Promise<Issue[]>;
    assignIssue(issueId: string | number, assignee: string): Promise<Issue>;
    unassignIssue(issueId: string | number): Promise<Issue>;
    createComment(issueId: string | number, body: string, faberContext?: FaberContext): Promise<Comment>;
    listComments(issueId: string | number, options?: {
        limit?: number;
        since?: string;
    }): Promise<Comment[]>;
    addLabels(issueId: string | number, labels: string[]): Promise<Label[]>;
    removeLabels(issueId: string | number, labels: string[]): Promise<void>;
    setLabels(issueId: string | number, labels: string[]): Promise<Label[]>;
    listLabels(issueId?: string | number): Promise<Label[]>;
    createMilestone(options: MilestoneCreateOptions): Promise<Milestone>;
    setMilestone(issueId: string | number, milestone: string): Promise<Issue>;
    removeMilestone(issueId: string | number): Promise<Issue>;
    listMilestones(state?: 'open' | 'closed' | 'all'): Promise<Milestone[]>;
    private parseIssue;
}
//# sourceMappingURL=github.d.ts.map