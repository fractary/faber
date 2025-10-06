/**
 * Tool concept loader
 */

import { z } from 'zod';
import { BaseConceptLoader } from './base';
import { Tool, ConceptType, ToolType } from '../../types';
import * as yaml from 'js-yaml';
import { promises as fs } from 'fs';
import path from 'path';

const ToolMetadataSchema = z.object({
  name: z.string(),
  description: z.string().optional(),
  tool_type: z.nativeEnum(ToolType),
  mcp_server: z.boolean().optional(),
  protocols: z.array(z.string()).optional(),
  command: z.string().optional(),
  args: z.array(z.string()).optional(),
  env: z.record(z.string()).optional()
});

export class ToolLoader extends BaseConceptLoader<Tool> {
  protected async loadConceptContent(conceptPath: string, metadata: any): Promise<Tool> {
    const toolMetadata = ToolMetadataSchema.parse(metadata);

    return {
      name: toolMetadata.name,
      type: ConceptType.TOOL,
      description: toolMetadata.description,
      tool_type: toolMetadata.tool_type,
      mcp_server: toolMetadata.mcp_server || false,
      protocols: toolMetadata.protocols || [],
      command: toolMetadata.command,
      args: toolMetadata.args,
      env: toolMetadata.env
    };
  }

  protected async loadMetadata(conceptPath: string): Promise<any> {
    const metadataPath = path.join(conceptPath, 'tool.yml');
    const content = await fs.readFile(metadataPath, 'utf-8');
    return yaml.load(content);
  }

  protected async validateConcept(tool: Tool): Promise<void> {
    // Validate tool configuration
    if (tool.mcp_server) {
      if (!tool.command) {
        throw new Error('MCP server tools must have a command');
      }
    }

    if (tool.tool_type === ToolType.MCP_SERVER && !tool.mcp_server) {
      throw new Error('Tool type mcp-server must have mcp_server: true');
    }
  }

  getSchema() {
    return ToolMetadataSchema;
  }
}