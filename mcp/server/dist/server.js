#!/usr/bin/env node
/**
 * FABER MCP Server
 *
 * Unified MCP server providing workflow orchestration and event logging for FABER.
 *
 * Tools (10):
 * - Workflow Orchestration (6): run, status, resume, pause, recover, cleanup
 * - Event Gateway (4): emit_event, get_run, list_runs, consolidate_events
 *
 * Resources (3):
 * - faber://runs - List all runs
 * - faber://runs/{run_id} - Get run details
 * - faber://runs/{run_id}/events - Get run events
 */
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { CallToolRequestSchema, ListResourcesRequestSchema, ListToolsRequestSchema, ReadResourceRequestSchema, } from '@modelcontextprotocol/sdk/types.js';
import { createWorkflowTools } from './tools/workflow.js';
import { createEventTools } from './tools/events.js';
import { createChangelogTools } from './tools/changelog.js';
import { LocalFilesBackend } from './backends/local-files.js';
import { listRunResources } from './resources/runs.js';
// Configuration from environment
const BASE_PATH = process.env.FABER_RUNS_PATH || '.fractary/faber/runs';
// Initialize backend for event storage
const backend = new LocalFilesBackend(BASE_PATH);
// Create MCP server
const server = new Server({
    name: 'fractary-faber',
    version: '1.1.5',
}, {
    capabilities: {
        tools: {},
        resources: {},
    },
});
// Register all tools (workflow + events = 10 tools total)
const allTools = [
    ...createWorkflowTools(),
    ...createEventTools(backend),
    ...createChangelogTools(),
];
// List available tools
server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: allTools.map(t => ({
        name: t.name,
        description: t.description,
        inputSchema: t.inputSchema,
    })),
}));
// Handle tool calls
server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;
    const tool = allTools.find(t => t.name === name);
    if (!tool) {
        throw new Error(`Unknown tool: ${name}`);
    }
    try {
        return await tool.handler(args);
    }
    catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return {
            content: [{ type: 'text', text: JSON.stringify({ error: message }, null, 2) }],
            isError: true,
        };
    }
});
// List available resources (faber://runs/*)
server.setRequestHandler(ListResourcesRequestSchema, async () => {
    const resources = await listRunResources(backend);
    return { resources };
});
// Read resource content
server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
    const { uri } = request.params;
    // Parse URI: faber://runs or faber://runs/{run_id} or faber://runs/{run_id}/events
    const match = uri.match(/^faber:\/\/runs(?:\/(.+?))?(?:\/(events))?$/);
    if (!match) {
        throw new Error(`Invalid resource URI: ${uri}`);
    }
    const [, runId, eventsPath] = match;
    if (!runId) {
        // List all runs
        const result = await backend.listRuns({ limit: 100 });
        return {
            contents: [
                {
                    uri,
                    mimeType: 'application/json',
                    text: JSON.stringify(result, null, 2),
                },
            ],
        };
    }
    if (eventsPath === 'events') {
        // Get run events
        const events = await backend.getEvents(runId);
        return {
            contents: [
                {
                    uri,
                    mimeType: 'application/json',
                    text: JSON.stringify(events, null, 2),
                },
            ],
        };
    }
    // Get run details
    const result = await backend.getRun(runId, true);
    return {
        contents: [
            {
                uri,
                mimeType: 'application/json',
                text: JSON.stringify(result, null, 2),
            },
        ],
    };
});
// Start server
async function main() {
    const transport = new StdioServerTransport();
    await server.connect(transport);
    console.error('FABER MCP server started');
}
main().catch((error) => {
    console.error('Server error:', error);
    process.exit(1);
});
//# sourceMappingURL=server.js.map