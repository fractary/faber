/**
 * Event Gateway Tools for FABER MCP Server
 *
 * Migrated from Event Gateway with renamed tool names.
 */
import { LocalFilesBackend } from '../backends/local-files.js';
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
 * Create event gateway tools
 *
 * @param backend LocalFilesBackend instance for run storage
 * @returns Array of tool definitions
 */
export declare function createEventTools(backend: LocalFilesBackend): ToolDefinition[];
//# sourceMappingURL=events.d.ts.map