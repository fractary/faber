/**
 * @fractary/faber - GitHub Repo Provider
 *
 * Repository operations via GitHub CLI (gh).
 */
import { RepoConfig, PullRequest, PRCreateOptions, PRUpdateOptions, PRListOptions, PRMergeOptions, Branch, BranchCreateOptions, BranchDeleteOptions, BranchListOptions } from '../../types';
import { RepoProvider } from '../types';
/**
 * GitHub repository provider
 */
export declare class GitHubRepoProvider implements RepoProvider {
    readonly platform: "github";
    private cwd;
    private owner;
    private repo;
    constructor(config: RepoConfig);
    createBranch(name: string, options?: BranchCreateOptions): Promise<Branch>;
    deleteBranch(name: string, options?: BranchDeleteOptions): Promise<void>;
    listBranches(options?: BranchListOptions): Promise<Branch[]>;
    getBranch(name: string): Promise<Branch | null>;
    createPR(options: PRCreateOptions): Promise<PullRequest>;
    getPR(number: number): Promise<PullRequest>;
    updatePR(number: number, options: PRUpdateOptions): Promise<PullRequest>;
    listPRs(options?: PRListOptions): Promise<PullRequest[]>;
    mergePR(number: number, options?: PRMergeOptions): Promise<PullRequest>;
    addPRComment(number: number, body: string): Promise<void>;
    requestReview(number: number, reviewers: string[]): Promise<void>;
    approvePR(number: number, comment?: string): Promise<void>;
}
//# sourceMappingURL=github.d.ts.map