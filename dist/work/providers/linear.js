"use strict";
/**
 * @fractary/faber - Linear Work Provider
 *
 * Work tracking via Linear GraphQL API.
 * TODO: Full implementation
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.LinearWorkProvider = void 0;
const errors_1 = require("../../errors");
/**
 * Linear Issues provider
 *
 * Note: This is a stub implementation. Full Linear support requires:
 * - Linear GraphQL API integration
 * - Team/workspace configuration
 * - Cycle support (Linear's equivalent of milestones)
 * - Label management
 */
class LinearWorkProvider {
    platform = 'linear';
    // Stored for future API implementation
    teamId;
    constructor(config) {
        if (!config.project) {
            throw new errors_1.ProviderError('linear', 'init', 'Linear work provider requires project (team_id) in config');
        }
        this.teamId = config.project;
    }
    /** Get the team ID for API calls */
    getTeamId() {
        return this.teamId;
    }
    notImplemented(operation) {
        throw new errors_1.ProviderError('linear', operation, `Linear ${operation} not yet implemented`);
    }
    async createIssue(_options) {
        this.notImplemented('createIssue');
    }
    async fetchIssue(_issueId) {
        this.notImplemented('fetchIssue');
    }
    async updateIssue(_issueId, _options) {
        this.notImplemented('updateIssue');
    }
    async closeIssue(_issueId) {
        this.notImplemented('closeIssue');
    }
    async reopenIssue(_issueId) {
        this.notImplemented('reopenIssue');
    }
    async searchIssues(_query, _filters) {
        this.notImplemented('searchIssues');
    }
    async assignIssue(_issueId, _assignee) {
        this.notImplemented('assignIssue');
    }
    async unassignIssue(_issueId) {
        this.notImplemented('unassignIssue');
    }
    async createComment(_issueId, _body, _faberContext) {
        this.notImplemented('createComment');
    }
    async listComments(_issueId, _options) {
        this.notImplemented('listComments');
    }
    async addLabels(_issueId, _labels) {
        this.notImplemented('addLabels');
    }
    async removeLabels(_issueId, _labels) {
        this.notImplemented('removeLabels');
    }
    async setLabels(_issueId, _labels) {
        this.notImplemented('setLabels');
    }
    async listLabels(_issueId) {
        this.notImplemented('listLabels');
    }
    async createMilestone(_options) {
        this.notImplemented('createMilestone');
    }
    async setMilestone(_issueId, _milestone) {
        this.notImplemented('setMilestone');
    }
    async removeMilestone(_issueId) {
        this.notImplemented('removeMilestone');
    }
    async listMilestones(_state) {
        this.notImplemented('listMilestones');
    }
}
exports.LinearWorkProvider = LinearWorkProvider;
//# sourceMappingURL=linear.js.map