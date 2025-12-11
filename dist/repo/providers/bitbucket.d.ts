/**
 * @fractary/faber - Bitbucket Repo Provider
 *
 * Repository operations via Bitbucket API.
 * TODO: Full implementation
 */
import { RepoConfig, PullRequest, PRCreateOptions, PRUpdateOptions, PRListOptions, PRMergeOptions, Branch, BranchCreateOptions, BranchDeleteOptions, BranchListOptions } from '../../types';
import { RepoProvider } from '../types';
/**
 * Bitbucket repository provider
 *
 * Note: This is a stub implementation. Full Bitbucket support requires:
 * - Bitbucket REST API v2 integration
 * - Workspace/project configuration
 * - Pull Request operations
 */
export declare class BitbucketRepoProvider implements RepoProvider {
    readonly platform: "bitbucket";
    private workspace;
    private repoSlug;
    constructor(config: RepoConfig);
    /** Get the repo identifier for API calls */
    protected getRepoPath(): string;
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
//# sourceMappingURL=bitbucket.d.ts.map