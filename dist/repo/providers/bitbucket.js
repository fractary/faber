"use strict";
/**
 * @fractary/faber - Bitbucket Repo Provider
 *
 * Repository operations via Bitbucket API.
 * TODO: Full implementation
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.BitbucketRepoProvider = void 0;
const errors_1 = require("../../errors");
/**
 * Bitbucket repository provider
 *
 * Note: This is a stub implementation. Full Bitbucket support requires:
 * - Bitbucket REST API v2 integration
 * - Workspace/project configuration
 * - Pull Request operations
 */
class BitbucketRepoProvider {
    platform = 'bitbucket';
    // Stored for future API implementation
    workspace;
    repoSlug;
    constructor(config) {
        if (!config.owner || !config.repo) {
            throw new errors_1.ProviderError('bitbucket', 'init', 'Bitbucket repo provider requires owner (workspace) and repo in config');
        }
        this.workspace = config.owner;
        this.repoSlug = config.repo;
    }
    /** Get the repo identifier for API calls */
    getRepoPath() {
        return `${this.workspace}/${this.repoSlug}`;
    }
    notImplemented(operation) {
        throw new errors_1.ProviderError('bitbucket', operation, `Bitbucket ${operation} not yet implemented`);
    }
    async createBranch(_name, _options) {
        this.notImplemented('createBranch');
    }
    async deleteBranch(_name, _options) {
        this.notImplemented('deleteBranch');
    }
    async listBranches(_options) {
        this.notImplemented('listBranches');
    }
    async getBranch(_name) {
        this.notImplemented('getBranch');
    }
    async createPR(_options) {
        this.notImplemented('createPR');
    }
    async getPR(_number) {
        this.notImplemented('getPR');
    }
    async updatePR(_number, _options) {
        this.notImplemented('updatePR');
    }
    async listPRs(_options) {
        this.notImplemented('listPRs');
    }
    async mergePR(_number, _options) {
        this.notImplemented('mergePR');
    }
    async addPRComment(_number, _body) {
        this.notImplemented('addPRComment');
    }
    async requestReview(_number, _reviewers) {
        this.notImplemented('requestReview');
    }
    async approvePR(_number, _comment) {
        this.notImplemented('approvePR');
    }
}
exports.BitbucketRepoProvider = BitbucketRepoProvider;
//# sourceMappingURL=bitbucket.js.map