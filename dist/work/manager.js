"use strict";
/**
 * @fractary/faber - WorkManager
 *
 * Main entry point for work tracking operations.
 * Supports GitHub Issues, Jira, and Linear.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.WorkManager = void 0;
const config_1 = require("../config");
const errors_1 = require("../errors");
const github_1 = require("./providers/github");
const jira_1 = require("./providers/jira");
const linear_1 = require("./providers/linear");
/**
 * WorkManager - Unified work tracking across platforms
 *
 * @example
 * ```typescript
 * const work = new WorkManager();
 * const issue = await work.fetchIssue(123);
 * await work.createComment(123, 'Implementation complete');
 * ```
 */
class WorkManager {
    provider;
    config;
    constructor(config) {
        this.config = config || this.loadConfig();
        this.provider = this.createProvider(this.config);
    }
    /**
     * Load work configuration from project
     */
    loadConfig() {
        const config = (0, config_1.loadWorkConfig)((0, config_1.findProjectRoot)());
        if (!config) {
            throw new errors_1.ConfigurationError('Work configuration not found. Run "fractary work init" to set up.');
        }
        return config;
    }
    /**
     * Create the appropriate provider based on config
     */
    createProvider(config) {
        switch (config.platform) {
            case 'github':
                return new github_1.GitHubWorkProvider(config);
            case 'jira':
                return new jira_1.JiraWorkProvider(config);
            case 'linear':
                return new linear_1.LinearWorkProvider(config);
            default:
                throw new errors_1.ConfigurationError(`Unsupported work platform: ${config.platform}`);
        }
    }
    /**
     * Get the current platform
     */
    getPlatform() {
        return this.provider.platform;
    }
    // =========================================================================
    // ISSUES
    // =========================================================================
    /**
     * Create a new issue
     */
    async createIssue(options) {
        return this.provider.createIssue(options);
    }
    /**
     * Fetch an issue by ID
     */
    async fetchIssue(issueId) {
        return this.provider.fetchIssue(issueId);
    }
    /**
     * Update an existing issue
     */
    async updateIssue(issueId, options) {
        return this.provider.updateIssue(issueId, options);
    }
    /**
     * Close an issue
     */
    async closeIssue(issueId) {
        return this.provider.closeIssue(issueId);
    }
    /**
     * Reopen a closed issue
     */
    async reopenIssue(issueId) {
        return this.provider.reopenIssue(issueId);
    }
    /**
     * Search for issues
     */
    async searchIssues(query, filters) {
        return this.provider.searchIssues(query, filters);
    }
    /**
     * Assign an issue to a user
     */
    async assignIssue(issueId, assignee) {
        return this.provider.assignIssue(issueId, assignee);
    }
    /**
     * Unassign an issue
     */
    async unassignIssue(issueId) {
        return this.provider.unassignIssue(issueId);
    }
    // =========================================================================
    // COMMENTS
    // =========================================================================
    /**
     * Create a comment on an issue
     */
    async createComment(issueId, body, faberContext) {
        return this.provider.createComment(issueId, body, faberContext);
    }
    /**
     * List comments on an issue
     */
    async listComments(issueId, options) {
        return this.provider.listComments(issueId, options);
    }
    // =========================================================================
    // LABELS
    // =========================================================================
    /**
     * Add labels to an issue
     */
    async addLabels(issueId, labels) {
        return this.provider.addLabels(issueId, labels);
    }
    /**
     * Remove labels from an issue
     */
    async removeLabels(issueId, labels) {
        return this.provider.removeLabels(issueId, labels);
    }
    /**
     * Set labels on an issue (replaces existing)
     */
    async setLabels(issueId, labels) {
        return this.provider.setLabels(issueId, labels);
    }
    /**
     * List all labels (or labels on an issue)
     */
    async listLabels(issueId) {
        return this.provider.listLabels(issueId);
    }
    // =========================================================================
    // MILESTONES
    // =========================================================================
    /**
     * Create a new milestone
     */
    async createMilestone(options) {
        return this.provider.createMilestone(options);
    }
    /**
     * Set milestone on an issue
     */
    async setMilestone(issueId, milestone) {
        return this.provider.setMilestone(issueId, milestone);
    }
    /**
     * Remove milestone from an issue
     */
    async removeMilestone(issueId) {
        return this.provider.removeMilestone(issueId);
    }
    /**
     * List all milestones
     */
    async listMilestones(state) {
        return this.provider.listMilestones(state);
    }
    // =========================================================================
    // CLASSIFICATION
    // =========================================================================
    /**
     * Classify the type of work based on issue metadata
     */
    async classifyWorkType(issue) {
        const labels = issue.labels.map(l => l.name.toLowerCase());
        const title = issue.title.toLowerCase();
        const body = issue.body.toLowerCase();
        // Check labels first
        if (labels.some(l => l.includes('bug') || l.includes('defect'))) {
            return 'bug';
        }
        if (labels.some(l => l.includes('feature') || l.includes('enhancement'))) {
            return 'feature';
        }
        if (labels.some(l => l.includes('chore') || l.includes('maintenance'))) {
            return 'chore';
        }
        if (labels.some(l => l.includes('patch') || l.includes('hotfix'))) {
            return 'patch';
        }
        if (labels.some(l => l.includes('infrastructure') || l.includes('infra'))) {
            return 'infrastructure';
        }
        if (labels.some(l => l.includes('api'))) {
            return 'api';
        }
        // Check title/body keywords
        if (title.includes('bug') || title.includes('fix') || body.includes('regression')) {
            return 'bug';
        }
        if (title.includes('add') || title.includes('implement') || title.includes('feature')) {
            return 'feature';
        }
        if (title.includes('refactor') || title.includes('cleanup') || title.includes('chore')) {
            return 'chore';
        }
        // Default to feature
        return 'feature';
    }
}
exports.WorkManager = WorkManager;
//# sourceMappingURL=manager.js.map