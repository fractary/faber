/**
 * Example: Workflow Recovery and State Management
 *
 * This example demonstrates recovering failed workflows,
 * pausing/resuming workflows, and cleaning up old state.
 */

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

async function demonstrateRecovery() {
  // Create MCP client
  const client = new Client(
    {
      name: 'faber-recovery-example',
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
      FABER_RUNS_PATH: '.fractary/faber/runs',
    },
  });

  await client.connect(transport);

  try {
    // 1. Start a workflow
    console.log('Starting workflow for work item #456...');
    const runResult = await client.callTool({
      name: 'fractary_faber_workflow_run',
      arguments: {
        work_id: '456',
        autonomy: 'guarded',
      },
    });

    const workflowData = JSON.parse(runResult.content[0].text);
    const workflowId = workflowData.workflow_id;

    console.log('Workflow started:', workflowId);

    // 2. Pause the workflow (simulating user intervention)
    console.log('\nPausing workflow...');
    await client.callTool({
      name: 'fractary_faber_workflow_pause',
      arguments: {
        workflow_id: workflowId,
      },
    });

    console.log('Workflow paused');

    // 3. Check status
    console.log('\nChecking paused workflow status...');
    const statusResult = await client.callTool({
      name: 'fractary_faber_workflow_status',
      arguments: {
        workflow_id: workflowId,
      },
    });

    console.log('Status:', JSON.parse(statusResult.content[0].text));

    // 4. Resume the workflow
    console.log('\nResuming workflow...');
    const resumeResult = await client.callTool({
      name: 'fractary_faber_workflow_resume',
      arguments: {
        workflow_id: workflowId,
      },
    });

    console.log('Resume result:', JSON.parse(resumeResult.content[0].text));

    // 5. Simulate a failure and recover from specific phase
    console.log('\nSimulating failure recovery...');
    const failedWorkflowId = 'WF-failed-abc123'; // Example failed workflow

    console.log('Recovering from Build phase...');
    const recoverResult = await client.callTool({
      name: 'fractary_faber_workflow_recover',
      arguments: {
        workflow_id: failedWorkflowId,
        from_phase: 'build',
        skip_phases: ['frame', 'architect'], // Skip completed phases
      },
    });

    console.log('Recovery result:', JSON.parse(recoverResult.content[0].text));

    // 6. Recover from a specific checkpoint
    console.log('\nRecovering from checkpoint...');
    const checkpointRecoverResult = await client.callTool({
      name: 'fractary_faber_workflow_recover',
      arguments: {
        workflow_id: failedWorkflowId,
        checkpoint_id: 'CP-build-step-3',
      },
    });

    console.log(
      'Checkpoint recovery result:',
      JSON.parse(checkpointRecoverResult.content[0].text)
    );

    // 7. Clean up old workflows
    console.log('\nCleaning up workflows older than 30 days...');
    const cleanupResult = await client.callTool({
      name: 'fractary_faber_workflow_cleanup',
      arguments: {
        max_age_days: 30,
      },
    });

    const cleanupData = JSON.parse(cleanupResult.content[0].text);
    console.log(
      `Cleanup complete: ${cleanupData.deleted} workflows deleted`
    );
    if (cleanupData.errors && cleanupData.errors.length > 0) {
      console.warn('Cleanup errors:', cleanupData.errors);
    }

    // 8. List all runs to verify cleanup
    console.log('\nListing remaining active runs...');
    const listResult = await client.callTool({
      name: 'fractary_faber_run_list',
      arguments: {
        limit: 50,
        status: 'running',
      },
    });

    const runs = JSON.parse(listResult.content[0].text);
    console.log(`Found ${runs.runs.length} active runs`);
  } catch (error) {
    console.error('Error in recovery example:', error);
  } finally {
    await client.close();
  }
}

// Run the example
demonstrateRecovery().catch(console.error);
