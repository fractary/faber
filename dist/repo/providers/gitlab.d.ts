/**
 * @fractary/faber - GitLab Repo Provider
 *
 * Repository operations via GitLab API.
 * TODO: Full implementation
 */
import { RepoConfig, PullRequest, PRCreateOptions, PRUpdateOptions, PRListOptions, PRMergeOptions, Branch, BranchCreateOptions, BranchDeleteOptions, BranchListOptions } from '../../types';
import { RepoProvider } from '../types';
/**
 * GitLab repository provider
 *
 * Note: This is a stub implementation. Full GitLab support requires:
 * - GitLab API v4 integration
 * - Merge Request operations (GitLab's equivalent of PRs)
 * - Project/group configuration
 */
export declare class GitLabRepoProvider implements RepoProvider {
    readonly platform: "gitlab";
    private projectId;
    constructor(config: RepoConfig);
    /** Get the project identifier for API calls */
    protected getProjectId(): string;
    private notImplemented;
    createBranch(_name: string, _options?: BranchCreateOptions): Promise<Branch>;
    deleteBranch(_name: string, _options?: BranchDeleteOptions): Promise<void>;
    listBranches(_options?: BranchListOptions): Promise<Branch[]>;
    getBranch(_name: string): Promise<Branch | null>;
    createPR(_options: PRCreateOptions): Promise<PullRequest>;
    getPR(_number: number): Promise<PullRequest>;
    updatePR(_number: number, _options: PRUpdateOptions): Promise<PullRequest>;
    listPRs(_options?: PRListOptions): Promise<PullRequest[]>;
    mergePR(_number: number, _options?: PRMergeOptions): Promise<PullRequest>;
    addPRComment(_number: number, _body: string): Promise<void>;
    requestReview(_number: number, _reviewers: string[]): Promise<void>;
    approvePR(_number: number, _comment?: string): Promise<void>;
}
//# sourceMappingURL=gitlab.d.ts.map