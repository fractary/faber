/**
 * @fractary/faber - Bitbucket Repo Provider
 *
 * Repository operations via Bitbucket API.
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
 * Bitbucket repository provider
 *
 * Note: This is a stub implementation. Full Bitbucket support requires:
 * - Bitbucket REST API v2 integration
 * - Workspace/project configuration
 * - Pull Request operations
 */
export class BitbucketRepoProvider implements RepoProvider {
  readonly platform = 'bitbucket' as const;
  // Stored for future API implementation
  private workspace: string;
  private repoSlug: string;

  constructor(config: RepoConfig) {
    if (!config.owner || !config.repo) {
      throw new ProviderError(
        'bitbucket',
        'init',
        'Bitbucket repo provider requires owner (workspace) and repo in config'
      );
    }
    this.workspace = config.owner;
    this.repoSlug = config.repo;
  }

  /** Get the repo identifier for API calls */
  protected getRepoPath(): string {
    return `${this.workspace}/${this.repoSlug}`;
  }

  private notImplemented(operation: string): never {
    throw new ProviderError(
      'bitbucket',
      operation,
      `Bitbucket ${operation} not yet implemented`
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
