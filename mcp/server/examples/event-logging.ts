/**
 * Example: Event Logging with FABER MCP Server
 *
 * This example demonstrates logging workflow events and
 * querying run data using the MCP server.
 */

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

async function logWorkflowEvents() {
  // Create MCP client
  const client = new Client(
    {
      name: 'faber-event-logging-example',
      version: '1.0.0',
    },
    {
      capabilities: {
        tools: {},
        resources: {},
      },
    }
  );

  // Connect to MCP server via stdio
  const transport = new StdioClientTransport({
    command: 'node',
    args: ['../dist/server.js'],
    env: {
      FABER_RUNS_PATH: '.fractary/faber/runs',
    },
  });

  await client.connect(transport);

  try {
    const runId = 'fractary/faber/550e8400-e29b-41d4-a716-446655440000';

    // 1. Emit workflow started event
    console.log('Emitting workflow_started event...');
    await client.callTool({
      name: 'fractary_faber_event_emit',
      arguments: {
        run_id: runId,
        type: 'workflow_started',
        status: 'started',
        message: 'Beginning FABER workflow execution',
        metadata: {
          work_id: '123',
          autonomy: 'assisted',
        },
      },
    });

    // 2. Emit phase started event
    console.log('Emitting phase_started event...');
    await client.callTool({
      name: 'fractary_faber_event_emit',
      arguments: {
        run_id: runId,
        type: 'phase_started',
        phase: 'frame',
        status: 'started',
        message: 'Starting Frame phase',
      },
    });

    // 3. Emit agent event with artifact
    console.log('Emitting agent_completed event with artifact...');
    await client.callTool({
      name: 'fractary_faber_event_emit',
      arguments: {
        run_id: runId,
        type: 'agent_completed',
        phase: 'frame',
        step: 'analyze_requirements',
        status: 'completed',
        message: 'Requirements analysis complete',
        agent_id: 'claude-sonnet-4.5',
        artifacts: [
          {
            type: 'specification',
            path: 'specs/SPEC-00123-feature.md',
          },
        ],
        metadata: {
          tokens_used: 2500,
          duration_ms: 8432,
        },
      },
    });

    // 4. Emit error event
    console.log('Emitting error event...');
    await client.callTool({
      name: 'fractary_faber_event_emit',
      arguments: {
        run_id: runId,
        type: 'error',
        phase: 'build',
        step: 'run_tests',
        status: 'failed',
        message: 'Unit tests failed',
        error: {
          code: 'TEST_FAILURE',
          message: '3 tests failed in UserService.test.ts',
          stack: 'Error: Expected 5 to equal 4...',
        },
      },
    });

    // 5. Get run details with events
    console.log('\nRetrieving run details...');
    const runResult = await client.callTool({
      name: 'fractary_faber_run_get',
      arguments: {
        run_id: runId,
        include_events: true,
      },
    });

    console.log('Run details:', JSON.parse(runResult.content[0].text));

    // 6. Read events via MCP resource
    console.log('\nReading events via MCP resource...');
    const resourceResult = await client.readResource({
      uri: `faber://runs/${runId}/events`,
    });

    console.log('Events from resource:', resourceResult.contents[0].text);

    // 7. Consolidate events to JSONL
    console.log('\nConsolidating events to JSONL...');
    const consolidateResult = await client.callTool({
      name: 'fractary_faber_events_consolidate',
      arguments: {
        run_id: runId,
      },
    });

    console.log(
      'Consolidation result:',
      JSON.parse(consolidateResult.content[0].text)
    );
  } catch (error) {
    console.error('Error logging events:', error);
  } finally {
    await client.close();
  }
}

// Run the example
logWorkflowEvents().catch(console.error);
