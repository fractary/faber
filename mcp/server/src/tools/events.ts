/**
 * Event Gateway Tools for FABER MCP Server
 *
 * Migrated from Event Gateway with renamed tool names.
 */

import { LocalFilesBackend } from '../backends/local-files.js';
import { EventTypes, FaberEvent } from '../types.js';

export interface ToolDefinition {
  name: string;
  description: string;
  inputSchema: {
    type: string;
    properties: Record<string, unknown>;
    required?: string[];
  };
  handler: (params: unknown) => Promise<{
    content: Array<{ type: string; text: string }>;
    isError?: boolean;
  }>;
}

/**
 * Create event gateway tools
 *
 * @param backend LocalFilesBackend instance for run storage
 * @returns Array of tool definitions
 */
export function createEventTools(backend: LocalFilesBackend): ToolDefinition[] {
  return [
    // Tool 1: fractary_faber_event_emit (migrated from emit_event)
    {
      name: 'fractary_faber_event_emit',
      description: 'Emit a workflow event to a FABER run',
      inputSchema: {
        type: 'object',
        properties: {
          run_id: {
            type: 'string',
            description: 'Full run identifier (org/project/uuid)',
          },
          type: {
            type: 'string',
            description: 'Event type',
            enum: EventTypes,
          },
          phase: {
            type: 'string',
            description: 'Current workflow phase',
            enum: ['frame', 'architect', 'build', 'evaluate', 'release'],
          },
          step: {
            type: 'string',
            description: 'Current step within phase',
          },
          status: {
            type: 'string',
            description: 'Event status',
            enum: ['started', 'completed', 'failed', 'skipped', 'pending', 'cancelled'],
          },
          message: {
            type: 'string',
            description: 'Human-readable event description',
          },
          metadata: {
            type: 'object',
            description: 'Event-specific metadata',
          },
          artifacts: {
            type: 'array',
            description: 'Artifacts created or modified',
            items: {
              type: 'object',
              properties: {
                type: { type: 'string' },
                name: { type: 'string' },
                path: { type: 'string' },
                url: { type: 'string' },
              },
              required: ['type', 'name'],
            },
          },
          duration_ms: {
            type: 'number',
            description: 'Duration in milliseconds',
          },
          error: {
            type: 'object',
            description: 'Error information',
            properties: {
              code: { type: 'string' },
              message: { type: 'string' },
              recoverable: { type: 'boolean' },
            },
          },
        },
        required: ['run_id', 'type'],
      },
      handler: async (params) => {
        const result = await backend.emitEvent(params as Partial<FaberEvent>);
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

    // Tool 2: fractary_faber_run_get (migrated from get_run)
    {
      name: 'fractary_faber_run_get',
      description: 'Get run state and metadata',
      inputSchema: {
        type: 'object',
        properties: {
          run_id: {
            type: 'string',
            description: 'Full run identifier',
          },
          include_events: {
            type: 'boolean',
            description: 'Include event count',
            default: false,
          },
        },
        required: ['run_id'],
      },
      handler: async (params) => {
        const { run_id, include_events } = params as {
          run_id: string;
          include_events?: boolean;
        };
        const result = await backend.getRun(run_id, include_events);
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

    // Tool 3: fractary_faber_run_list (migrated from list_runs)
    {
      name: 'fractary_faber_run_list',
      description: 'List runs with optional filters',
      inputSchema: {
        type: 'object',
        properties: {
          work_id: {
            type: 'string',
            description: 'Filter by work item ID',
          },
          status: {
            type: 'string',
            description: 'Filter by status',
            enum: ['pending', 'in_progress', 'completed', 'failed', 'cancelled'],
          },
          org: {
            type: 'string',
            description: 'Filter by organization',
          },
          project: {
            type: 'string',
            description: 'Filter by project',
          },
          limit: {
            type: 'number',
            description: 'Maximum results',
            default: 20,
          },
        },
      },
      handler: async (params) => {
        const result = await backend.listRuns(params as {
          work_id?: string;
          status?: string;
          org?: string;
          project?: string;
          limit?: number;
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

    // Tool 4: fractary_faber_event_consolidate (migrated from consolidate_events)
    {
      name: 'fractary_faber_event_consolidate',
      description: 'Consolidate run events to JSONL format',
      inputSchema: {
        type: 'object',
        properties: {
          run_id: {
            type: 'string',
            description: 'Run to consolidate',
          },
        },
        required: ['run_id'],
      },
      handler: async (params) => {
        const { run_id } = params as { run_id: string };
        const result = await backend.consolidateEvents(run_id);
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
