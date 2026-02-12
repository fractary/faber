/**
 * Changelog Tools for FABER MCP Server
 *
 * Provides MCP tool for querying the project-level changelog.
 * Imports ChangelogManager from SDK directly.
 */
import { ChangelogManager } from '@fractary/faber';
/**
 * Create changelog tools
 *
 * @returns Array of tool definitions
 */
export function createChangelogTools() {
    return [
        {
            name: 'fractary_faber_changelog_query',
            description: 'Query the project-level changelog for workflow outputs. Returns machine-readable entries describing meaningful artifacts produced by FABER workflows (e.g., code merges, codex syncs, deployments).',
            inputSchema: {
                type: 'object',
                properties: {
                    event_type: {
                        type: 'string',
                        description: 'Filter by event type (e.g., CODE_MERGED, CODEX_SYNCED, DATA_PUBLISHED)',
                    },
                    target: {
                        type: 'string',
                        description: 'Filter by target branch/resource',
                    },
                    phase: {
                        type: 'string',
                        description: 'Filter by FABER phase',
                        enum: ['frame', 'architect', 'build', 'evaluate', 'release'],
                    },
                    status: {
                        type: 'string',
                        description: 'Filter by status',
                        enum: ['success', 'warning', 'failure', 'skipped'],
                    },
                    work_id: {
                        type: 'string',
                        description: 'Filter by work item ID',
                    },
                    since: {
                        type: 'string',
                        description: 'Filter entries after this ISO 8601 date',
                    },
                    until: {
                        type: 'string',
                        description: 'Filter entries before this ISO 8601 date',
                    },
                    limit: {
                        type: 'number',
                        description: 'Maximum entries to return (default: 50)',
                        default: 50,
                    },
                },
            },
            handler: async (params) => {
                const options = params;
                const manager = new ChangelogManager();
                const result = manager.query({
                    event_type: options.event_type,
                    target: options.target,
                    phase: options.phase,
                    status: options.status,
                    work_id: options.work_id,
                    since: options.since,
                    until: options.until,
                    limit: options.limit || 50,
                });
                return {
                    content: [
                        {
                            type: 'text',
                            text: JSON.stringify(result, null, 2),
                        },
                    ],
                };
            },
        },
    ];
}
//# sourceMappingURL=changelog.js.map