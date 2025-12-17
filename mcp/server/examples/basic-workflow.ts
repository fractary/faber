/**
 * Example: Basic FABER Workflow Execution via MCP
 *
 * This example demonstrates running a complete FABER workflow
 * for a work item using the MCP server.
 */

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

async function runBasicWorkflow() {
  // Create MCP client
  const client = new Client(
    {
      name: 'faber-workflow-example',
      version: '1.0.0',
    },
    {
      capabilities: {
        tools: {},
      },
    }
  );

  // Connect to MCP server via stdio
  const transport = new StdioClientTransport({
    command: 'node',
    args: ['../dist/server.js'],
    env: {
      FABER_RUNS_PATH: '.fractary/plugins/faber/runs',
    },
  });

  await client.connect(transport);

  try {
    // 1. Run a workflow for work item #123
    console.log('Starting workflow for work item #123...');
    const runResult = await client.callTool({
      name: 'fractary_faber_workflow_run',
      arguments: {
        work_id: '123',
        autonomy: 'assisted',
        config: {
          phases: {
            build: {
              skip_tests: false,
            },
          },
        },
      },
    });

    console.log('Workflow started:', JSON.parse(runResult.content[0].text));

    // Extract workflow_id from result
    const workflowData = JSON.parse(runResult.content[0].text);
    const workflowId = workflowData.workflow_id;

    // 2. Check workflow status
    console.log('\nChecking workflow status...');
    const statusResult = await client.callTool({
      name: 'fractary_faber_workflow_status',
      arguments: {
        workflow_id: workflowId,
      },
    });

    console.log('Workflow status:', JSON.parse(statusResult.content[0].text));

    // 3. List all runs for this work item
    console.log('\nListing runs for work item #123...');
    const listResult = await client.callTool({
      name: 'fractary_faber_run_list',
      arguments: {
        work_id: '123',
        limit: 10,
      },
    });

    console.log('Runs:', JSON.parse(listResult.content[0].text));
  } catch (error) {
    console.error('Error running workflow:', error);
  } finally {
    await client.close();
  }
}

// Run the example
runBasicWorkflow().catch(console.error);
