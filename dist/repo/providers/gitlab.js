"use strict";
/**
 * @fractary/faber - GitLab Repo Provider
 *
 * Repository operations via GitLab API.
 * TODO: Full implementation
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.GitLabRepoProvider = void 0;
const errors_1 = require("../../errors");
/**
 * GitLab repository provider
 *
 * Note: This is a stub implementation. Full GitLab support requires:
 * - GitLab API v4 integration
 * - Merge Request operations (GitLab's equivalent of PRs)
 * - Project/group configuration
 */
class GitLabRepoProvider {
    platform = 'gitlab';
    // Stored for future API implementation
    projectId;
    constructor(config) {
        if (!config.repo) {
            throw new errors_1.ProviderError('gitlab', 'init', 'GitLab repo provider requires repo (project_id) in config');
        }
        this.projectId = config.repo;
    }
    /** Get the project identifier for API calls */
    getProjectId() {
        return this.projectId;
    }
    notImplemented(operation) {
        throw new errors_1.ProviderError('gitlab', operation, `GitLab ${operation} not yet implemented`);
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
exports.GitLabRepoProvider = GitLabRepoProvider;
//# sourceMappingURL=gitlab.js.map