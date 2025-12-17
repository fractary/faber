/**
 * Workflow Orchestration Tools for FABER MCP Server
 *
 * Provides workflow control and management via MCP.
 */
export interface ToolDefinition {
    name: string;
    description: string;
    inputSchema: {
        type: string;
        properties: Record<string, unknown>;
        required?: string[];
    };
    handler: (params: unknown) => Promise<{
        content: Array<{
            type: string;
            text: string;
        }>;
        isError?: boolean;
    }>;
}
/**
 * Create workflow orchestration tools
 *
 * @returns Array of tool definitions
 */
export declare function createWorkflowTools(): ToolDefinition[];
//# sourceMappingURL=workflow.d.ts.map