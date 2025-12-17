/**
 * MCP Resource Handlers for FABER Runs
 *
 * Provides access to run data via faber:// URIs.
 */

import { LocalFilesBackend } from '../backends/local-files.js';

export interface Resource {
  uri: string;
  name: string;
  description: string;
  mimeType: string;
}

export interface ResourceContent {
  uri: string;
  mimeType: string;
  text: string;
}

export interface ReadResourceResult {
  contents: ResourceContent[];
}

/**
 * List all run resources
 *
 * @param backend LocalFilesBackend instance
 * @returns Array of resource definitions
 */
export async function listRunResources(backend: LocalFilesBackend): Promise<Resource[]> {
  const runs = await backend.listRuns({ limit: 100 });
  const resources: Resource[] = [
    {
      uri: 'faber://runs',
      name: 'All FABER Runs',
      description: 'List of all workflow runs',
      mimeType: 'application/json',
    },
  ];

  // Add each run as a resource
  for (const run of runs.runs) {
    resources.push({
      uri: `faber://runs/${run.run_id}`,
      name: `Run ${run.run_id.split('/').pop()}`,
      description: `Work #${run.work_id} - ${run.status}`,
      mimeType: 'application/json',
    });
    resources.push({
      uri: `faber://runs/${run.run_id}/events`,
      name: `Events for ${run.run_id.split('/').pop()}`,
      description: `Event log for run`,
      mimeType: 'application/json',
    });
  }

  return resources;
}

/**
 * Read resource content
 *
 * @param uri Resource URI (faber://runs/...)
 * @param backend LocalFilesBackend instance
 * @returns Resource contents
 */
export async function readRunResource(
  uri: string,
  backend: LocalFilesBackend
): Promise<ReadResourceResult> {
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
}
