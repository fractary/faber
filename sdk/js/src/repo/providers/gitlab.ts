/**
 * @fractary/faber - GitLab Repo Provider
 *
 * Repository operations via GitLab API.
 * TODO: Full implementation
 */

import {
  RepoConfig,
  PullRequest,
  PRCreateOptions,
  PRUpdateOptions,
  PRListOptions,
  PRMergeOptions,
  Branch,
  BranchCreateOptions,
  BranchDeleteOptions,
  BranchListOptions,
} from '../../types.js';
import { RepoProvider } from '../types.js';
import { ProviderError } from '../../errors.js';

/**
 * GitLab repository provider
 *
 * Note: This is a stub implementation. Full GitLab support requires:
 * - GitLab API v4 integration
 * - Merge Request operations (GitLab's equivalent of PRs)
 * - Project/group configuration
 */
export class GitLabRepoProvider implements RepoProvider {
  readonly platform = 'gitlab' as const;
  // Stored for future API implementation
  private projectId: string;

  constructor(config: RepoConfig) {
    if (!config.repo) {
      throw new ProviderError(
        'gitlab',
        'init',
        'GitLab repo provider requires repo (project_id) in config'
      );
    }
    this.projectId = config.repo;
  }

  /** Get the project identifier for API calls */
  protected getProjectId(): string {
    return this.projectId;
  }

  private notImplemented(operation: string): never {
    throw new ProviderError(
      'gitlab',
      operation,
      `GitLab ${operation} not yet implemented`
    );
  }

  async createBranch(_name: string, _options?: BranchCreateOptions): Promise<Branch> {
    this.notImplemented('createBranch');
  }

  async deleteBranch(_name: string, _options?: BranchDeleteOptions): Promise<void> {
    this.notImplemented('deleteBranch');
  }

  async listBranches(_options?: BranchListOptions): Promise<Branch[]> {
    this.notImplemented('listBranches');
  }

  async getBranch(_name: string): Promise<Branch | null> {
    this.notImplemented('getBranch');
  }

  async createPR(_options: PRCreateOptions): Promise<PullRequest> {
    this.notImplemented('createPR');
  }

  async getPR(_number: number): Promise<PullRequest> {
    this.notImplemented('getPR');
  }

  async updatePR(_number: number, _options: PRUpdateOptions): Promise<PullRequest> {
    this.notImplemented('updatePR');
  }

  async listPRs(_options?: PRListOptions): Promise<PullRequest[]> {
    this.notImplemented('listPRs');
  }

  async mergePR(_number: number, _options?: PRMergeOptions): Promise<PullRequest> {
    this.notImplemented('mergePR');
  }

  async addPRComment(_number: number, _body: string): Promise<void> {
    this.notImplemented('addPRComment');
  }

  async requestReview(_number: number, _reviewers: string[]): Promise<void> {
    this.notImplemented('requestReview');
  }

  async approvePR(_number: number, _comment?: string): Promise<void> {
    this.notImplemented('approvePR');
  }
}
