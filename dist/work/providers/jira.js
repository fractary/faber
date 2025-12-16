"use strict";
/**
 * @fractary/faber - Jira Work Provider
 *
 * Work tracking via Jira REST API.
 * TODO: Full implementation
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.JiraWorkProvider = void 0;
const errors_1 = require("../../errors");
/**
 * Jira Issues provider
 *
 * Note: This is a stub implementation. Full Jira support requires:
 * - Jira REST API v3 integration
 * - JQL query support
 * - ADF (Atlassian Document Format) for rich text
 * - Project/board configuration
 */
class JiraWorkProvider {
    platform = 'jira';
    // Stored for future API implementation
    baseUrl;
    projectKey;
    constructor(config) {
        if (!config.project) {
            throw new errors_1.ProviderError('jira', 'init', 'Jira work provider requires project in config');
        }
        this.baseUrl = ''; // TODO: Load from config
        this.projectKey = config.project;
    }
    /** Get the API base URL */
    getBaseUrl() {
        return this.baseUrl;
    }
    /** Get the project key for API calls */
    getProjectKey() {
        return this.projectKey;
    }
    notImplemented(operation) {
        throw new errors_1.ProviderError('jira', operation, `Jira ${operation} not yet implemented`);
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
exports.JiraWorkProvider = JiraWorkProvider;
//# sourceMappingURL=jira.js.map