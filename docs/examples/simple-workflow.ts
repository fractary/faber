/**
 * Simple FABER Workflow Example (TypeScript)
 *
 * Demonstrates basic workflow execution for a work item.
 *
 * Usage:
 *   GITHUB_TOKEN=xxx npx tsx docs/examples/simple-workflow.ts 123
 */

import { FaberWorkflow } from '@fractary/faber/workflow';
import type { WorkflowResult } from '@fractary/faber';

async function main() {
  const workId = process.argv[2];

  if (!workId) {
    console.error('Usage: npx tsx simple-workflow.ts <work-id>');
    process.exit(1);
  }

  if (!process.env.GITHUB_TOKEN) {
    console.error('Error: GITHUB_TOKEN environment variable is required');
    process.exit(1);
  }

  console.log(`Running FABER workflow for work item #${workId}...`);

  // Initialize FABER with configuration
  const faber = new FaberWorkflow({
    config: {
      autonomy: 'assisted',
      phases: {
        frame: { enabled: true },
        architect: { enabled: true, refineSpec: true },
        build: { enabled: true },
        evaluate: { enabled: true, maxRetries: 3 },
        release: { enabled: true, requestReviews: true },
      },
    },
  });

  // Add event listener for workflow progress
  faber.addEventListener((event, data) => {
    console.log(`[${event}]`, data);

    // Log phase transitions
    if (event === 'phase:start') {
      console.log(`→ Starting phase: ${data.phase}`);
    } else if (event === 'phase:complete') {
      console.log(`✓ Completed phase: ${data.phase}`);
    } else if (event === 'phase:fail') {
      console.error(`✗ Failed phase: ${data.phase}`, data.error);
    }
  });

  // Set up user input callback for assisted mode
  faber.setUserInputCallback(async (request) => {
    console.log(`\n🤔 ${request.message}`);
    console.log('   (Automatically approving for this example)');
    return true; // Auto-approve for example purposes
  });

  try {
    // Run the workflow
    const result: WorkflowResult = await faber.run({
      workId,
      autonomy: 'assisted',
    });

    // Display results
    console.log('\n' + '='.repeat(50));
    console.log('Workflow completed successfully!');
    console.log('='.repeat(50));
    console.log(`Workflow ID: ${result.workflow_id}`);
    console.log(`Work ID: ${result.work_id}`);
    console.log(`Status: ${result.status}`);
    console.log(`Duration: ${(result.duration_ms / 1000).toFixed(2)}s`);

    console.log('\nPhases:');
    result.phases.forEach((phase) => {
      const duration = phase.duration_ms
        ? ` (${(phase.duration_ms / 1000).toFixed(2)}s)`
        : '';
      console.log(`  - ${phase.phase}: ${phase.status}${duration}`);
    });

    if (result.artifacts && result.artifacts.length > 0) {
      console.log('\nArtifacts:');
      result.artifacts.forEach((artifact) => {
        console.log(`  - ${artifact.type}: ${artifact.path}`);
      });
    }
  } catch (error) {
    console.error('\n' + '='.repeat(50));
    console.error('Workflow failed!');
    console.error('='.repeat(50));

    if (error instanceof Error) {
      console.error('Error:', error.message);
      if (error.stack) {
        console.error('\nStack trace:');
        console.error(error.stack);
      }
    }

    process.exit(1);
  }
}

main().catch((error) => {
  console.error('Unhandled error:', error);
  process.exit(1);
});
