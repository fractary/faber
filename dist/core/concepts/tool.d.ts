/**
 * Tool concept loader
 */
import { z } from 'zod';
import { BaseConceptLoader } from './base';
import { Tool, ToolType } from '../../types';
export declare class ToolLoader extends BaseConceptLoader<Tool> {
    protected loadConceptContent(conceptPath: string, metadata: any): Promise<Tool>;
    protected loadMetadata(conceptPath: string): Promise<any>;
    protected validateConcept(tool: Tool): Promise<void>;
    getSchema(): z.ZodObject<{
        name: z.ZodString;
        description: z.ZodOptional<z.ZodString>;
        tool_type: z.ZodNativeEnum<typeof ToolType>;
        mcp_server: z.ZodOptional<z.ZodBoolean>;
        protocols: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
        command: z.ZodOptional<z.ZodString>;
        args: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
        env: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodString>>;
    }, "strip", z.ZodTypeAny, {
        name?: string;
        description?: string;
        tool_type?: ToolType;
        mcp_server?: boolean;
        protocols?: string[];
        command?: string;
        args?: string[];
        env?: Record<string, string>;
    }, {
        name?: string;
        description?: string;
        tool_type?: ToolType;
        mcp_server?: boolean;
        protocols?: string[];
        command?: string;
        args?: string[];
        env?: Record<string, string>;
    }>;
}
//# sourceMappingURL=tool.d.ts.map