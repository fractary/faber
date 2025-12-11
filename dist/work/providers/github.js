"use strict";
/**
 * @fractary/faber - GitHub Work Provider
 *
 * Work tracking via GitHub Issues using the gh CLI.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.GitHubWorkProvider = void 0;
const child_process_1 = require("child_process");
const errors_1 = require("../../errors");
/**
 * Execute a command and return the output
 */
function exec(command, options) {
    try {
        const result = (0, child_process_1.execSync)(command, {
            encoding: 'utf-8',
            maxBuffer: 10 * 1024 * 1024, // 10MB
            ...options,
        });
        return (typeof result === 'string' ? result : result.toString()).trim();
    }
    catch (error) {
        const err = error;
        const exitCode = err.status || 1;
        const stderr = err.stderr?.toString() || '';
        if (stderr.includes('authentication') || stderr.includes('auth')) {
            throw new errors_1.AuthenticationError('github', 'GitHub authentication failed. Run "gh auth login"');
        }
        throw new errors_1.CommandExecutionError(command, exitCode, stderr);
    }
}
/**
 * Check if gh CLI is available and authenticated
 */
function checkGhCli() {
    try {
        exec('gh auth status');
    }
    catch {
        throw new errors_1.AuthenticationError('github', 'GitHub CLI not authenticated. Run "gh auth login" to authenticate.');
    }
}
/**
 * GitHub Issues provider using gh CLI
 */
class GitHubWorkProvider {
    platform = 'github';
    owner;
    repo;
    constructor(config) {
        if (!config.owner || !config.repo) {
            throw new errors_1.ProviderError('github', 'init', 'GitHub work provider requires owner and repo in config');
        }
        this.owner = config.owner;
        this.repo = config.repo;
        checkGhCli();
    }
    getRepoArg() {
        return `${this.owner}/${this.repo}`;
    }
    // =========================================================================
    // ISSUES
    // =========================================================================
    async createIssue(options) {
        const args = [`--repo ${this.getRepoArg()}`];
        args.push(`--title "${options.title.replace(/"/g, '\\"')}"`);
        if (options.body) {
            args.push(`--body "${options.body.replace(/"/g, '\\"')}"`);
        }
        if (options.labels && options.labels.length > 0) {
            args.push(`--label "${options.labels.join(',')}"`);
        }
        if (options.assignees && options.assignees.length > 0) {
            args.push(`--assignee "${options.assignees.join(',')}"`);
        }
        if (options.milestone) {
            args.push(`--milestone "${options.milestone}"`);
        }
        try {
            const result = exec(`gh issue create ${args.join(' ')} --json number,title,body,state,labels,assignees,milestone,createdAt,updatedAt,url`);
            return this.parseIssue(JSON.parse(result));
        }
        catch (error) {
            if (error instanceof errors_1.CommandExecutionError) {
                throw new errors_1.IssueCreateError(error.stderr);
            }
            throw error;
        }
    }
    async fetchIssue(issueId) {
        try {
            const result = exec(`gh issue view ${issueId} --repo ${this.getRepoArg()} --json number,title,body,state,labels,assignees,milestone,createdAt,updatedAt,closedAt,url`);
            return this.parseIssue(JSON.parse(result));
        }
        catch (error) {
            if (error instanceof errors_1.CommandExecutionError) {
                if (error.stderr.includes('not found') || error.stderr.includes('Could not resolve')) {
                    throw new errors_1.IssueNotFoundError(issueId);
                }
            }
            throw error;
        }
    }
    async updateIssue(issueId, options) {
        const args = [`--repo ${this.getRepoArg()}`];
        if (options.title) {
            args.push(`--title "${options.title.replace(/"/g, '\\"')}"`);
        }
        if (options.body) {
            args.push(`--body "${options.body.replace(/"/g, '\\"')}"`);
        }
        if (args.length > 1) {
            exec(`gh issue edit ${issueId} ${args.join(' ')}`);
        }
        return this.fetchIssue(issueId);
    }
    async closeIssue(issueId) {
        exec(`gh issue close ${issueId} --repo ${this.getRepoArg()}`);
        return this.fetchIssue(issueId);
    }
    async reopenIssue(issueId) {
        exec(`gh issue reopen ${issueId} --repo ${this.getRepoArg()}`);
        return this.fetchIssue(issueId);
    }
    async searchIssues(query, filters) {
        const args = [`--repo ${this.getRepoArg()}`];
        if (filters?.state && filters.state !== 'all') {
            args.push(`--state ${filters.state}`);
        }
        if (filters?.labels && filters.labels.length > 0) {
            args.push(`--label "${filters.labels.join(',')}"`);
        }
        if (filters?.assignee) {
            args.push(`--assignee ${filters.assignee}`);
        }
        if (filters?.milestone) {
            args.push(`--milestone "${filters.milestone}"`);
        }
        args.push(`--search "${query}"`);
        args.push('--json number,title,body,state,labels,assignees,milestone,createdAt,updatedAt,closedAt,url');
        const result = exec(`gh issue list ${args.join(' ')}`);
        const issues = JSON.parse(result || '[]');
        return issues.map(i => this.parseIssue(i));
    }
    async assignIssue(issueId, assignee) {
        exec(`gh issue edit ${issueId} --repo ${this.getRepoArg()} --add-assignee ${assignee}`);
        return this.fetchIssue(issueId);
    }
    async unassignIssue(issueId) {
        // Get current assignees and remove them
        const issue = await this.fetchIssue(issueId);
        if (issue.assignees.length > 0) {
            exec(`gh issue edit ${issueId} --repo ${this.getRepoArg()} --remove-assignee ${issue.assignees.join(',')}`);
        }
        return this.fetchIssue(issueId);
    }
    // =========================================================================
    // COMMENTS
    // =========================================================================
    async createComment(issueId, body, faberContext) {
        // Add FABER context to comment if provided
        let finalBody = body;
        if (faberContext) {
            finalBody = `<!-- faber:${faberContext} -->\n${body}`;
        }
        exec(`gh issue comment ${issueId} --repo ${this.getRepoArg()} --body "${finalBody.replace(/"/g, '\\"')}"`);
        // gh doesn't return JSON for comment creation, so we fetch latest
        const comments = await this.listComments(issueId, { limit: 1 });
        return comments[0];
    }
    async listComments(issueId, options) {
        const result = exec(`gh api repos/${this.getRepoArg()}/issues/${issueId}/comments --jq '.[] | {id: .id, body: .body, author: .user.login, createdAt: .created_at, updatedAt: .updated_at}'`);
        if (!result)
            return [];
        const lines = result.split('\n').filter(l => l.trim());
        let comments = lines.map(line => {
            const c = JSON.parse(line);
            return {
                id: String(c.id),
                body: c.body,
                author: c.author,
                created_at: c.createdAt,
                updated_at: c.updatedAt,
            };
        });
        if (options?.since) {
            const sinceDate = new Date(options.since);
            comments = comments.filter(c => new Date(c.created_at) > sinceDate);
        }
        if (options?.limit) {
            comments = comments.slice(-options.limit);
        }
        return comments;
    }
    // =========================================================================
    // LABELS
    // =========================================================================
    async addLabels(issueId, labels) {
        exec(`gh issue edit ${issueId} --repo ${this.getRepoArg()} --add-label "${labels.join(',')}"`);
        const issue = await this.fetchIssue(issueId);
        return issue.labels;
    }
    async removeLabels(issueId, labels) {
        exec(`gh issue edit ${issueId} --repo ${this.getRepoArg()} --remove-label "${labels.join(',')}"`);
    }
    async setLabels(issueId, labels) {
        // First remove all labels, then add new ones
        const issue = await this.fetchIssue(issueId);
        if (issue.labels.length > 0) {
            await this.removeLabels(issueId, issue.labels.map(l => l.name));
        }
        if (labels.length > 0) {
            return this.addLabels(issueId, labels);
        }
        return [];
    }
    async listLabels(issueId) {
        if (issueId) {
            const issue = await this.fetchIssue(issueId);
            return issue.labels;
        }
        const result = exec(`gh label list --repo ${this.getRepoArg()} --json name,color,description`);
        return JSON.parse(result || '[]');
    }
    // =========================================================================
    // MILESTONES
    // =========================================================================
    async createMilestone(options) {
        const args = [`--title "${options.title}"`];
        if (options.description) {
            args.push(`--description "${options.description.replace(/"/g, '\\"')}"`);
        }
        if (options.due_on) {
            args.push(`--due-date "${options.due_on}"`);
        }
        const result = exec(`gh api repos/${this.getRepoArg()}/milestones -f title="${options.title}" ${options.description ? `-f description="${options.description}"` : ''} ${options.due_on ? `-f due_on="${options.due_on}"` : ''}`);
        const m = JSON.parse(result);
        return {
            id: String(m.number),
            title: m.title,
            description: m.description,
            due_on: m.due_on,
            state: m.state,
        };
    }
    async setMilestone(issueId, milestone) {
        exec(`gh issue edit ${issueId} --repo ${this.getRepoArg()} --milestone "${milestone}"`);
        return this.fetchIssue(issueId);
    }
    async removeMilestone(issueId) {
        exec(`gh issue edit ${issueId} --repo ${this.getRepoArg()} --milestone ""`);
        return this.fetchIssue(issueId);
    }
    async listMilestones(state) {
        const stateArg = state && state !== 'all' ? `?state=${state}` : '';
        const result = exec(`gh api repos/${this.getRepoArg()}/milestones${stateArg}`);
        const milestones = JSON.parse(result || '[]');
        return milestones.map(m => ({
            id: String(m.number),
            title: m.title,
            description: m.description,
            due_on: m.due_on,
            state: m.state,
        }));
    }
    // =========================================================================
    // HELPERS
    // =========================================================================
    parseIssue(raw) {
        const data = raw;
        return {
            id: String(data['number']),
            number: data['number'],
            title: data['title'],
            body: data['body'] || '',
            state: data['state']?.toLowerCase() === 'open' ? 'open' : 'closed',
            labels: (data['labels'] || []).map(l => ({
                name: l.name,
                color: l.color,
                description: l.description,
            })),
            assignees: (data['assignees'] || []).map(a => a.login),
            milestone: data['milestone'] ? {
                id: String(data['milestone']['number']),
                title: data['milestone']['title'],
                description: data['milestone']['description'],
                due_on: data['milestone']['dueOn'],
                state: data['milestone']['state']?.toLowerCase() === 'open' ? 'open' : 'closed',
            } : undefined,
            created_at: data['createdAt'],
            updated_at: data['updatedAt'],
            closed_at: data['closedAt'],
            url: data['url'],
        };
    }
}
exports.GitHubWorkProvider = GitHubWorkProvider;
//# sourceMappingURL=github.js.map