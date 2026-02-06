/**
 * Workflow commands - FABER workflow execution
 *
 * Provides workflow-run, run-inspect, workflow-resume, workflow-pause commands via FaberWorkflow SDK.
 */

import { Command } from 'commander';
import chalk from 'chalk';
import {
  FaberWorkflow,
  StateManager,
  createWorkflow,
  updateWorkflow,
  inspectWorkflow,
  debugWorkflow,
  listWorkflows,
} from '@fractary/faber';
import { parsePositiveInteger } from '../../utils/validation.js';

/**
 * Create the workflow-run command
 */
export function createRunCommand(): Command {
  return new Command('workflow-run')
    .description('Run FABER workflow')
    .requiredOption('--work-id <id>', 'Work item ID to process')
    .option('--autonomy <level>', 'Autonomy level: supervised|assisted|autonomous', 'supervised')
    .option('--json', 'Output as JSON')
    .action(async (options) => {
      try {
        const workflow = new FaberWorkflow();

        if (!options.json) {
          console.log(chalk.blue(`Starting FABER workflow for work item #${options.workId}`));
          console.log(chalk.gray(`Autonomy: ${options.autonomy}`));
        }

        // Add event listener for progress updates
        workflow.addEventListener((event, data) => {
          if (options.json) return;

          switch (event) {
            case 'phase:start':
              console.log(chalk.cyan(`\n→ Starting phase: ${String(data.phase || '').toUpperCase()}`));
              break;
            case 'phase:complete':
              console.log(chalk.green(`  ✓ Completed phase: ${data.phase}`));
              break;
            case 'workflow:fail':
            case 'phase:fail':
              console.error(chalk.red(`  ✗ Error: ${data.error || 'Unknown error'}`));
              break;
          }
        });

        const result = await workflow.run({
          workId: options.workId,
          autonomy: options.autonomy,
        });

        if (options.json) {
          console.log(JSON.stringify({ status: 'success', data: result }, null, 2));
        } else {
          console.log(chalk.green(`\n✓ Workflow ${result.status}`));
          console.log(chalk.gray(`  Workflow ID: ${result.workflow_id}`));
          console.log(chalk.gray(`  Duration: ${result.duration_ms}ms`));
          console.log(chalk.gray(`  Phases: ${result.phases.map((p: any) => p.phase).join(' → ')}`));
        }
      } catch (error) {
        handleWorkflowError(error, options);
      }
    });
}

/**
 * Create the run-inspect command
 */
export function createStatusCommand(): Command {
  return new Command('run-inspect')
    .description('Show workflow run status')
    .option('--work-id <id>', 'Work item ID to check')
    .option('--workflow-id <id>', 'Workflow ID to check')
    .option('--verbose', 'Show detailed status')
    .option('--json', 'Output as JSON')
    .action(async (options) => {
      try {
        const stateManager = new StateManager();

        if (options.workflowId) {
          // Status for specific workflow by ID
          const workflow = new FaberWorkflow();
          const status = workflow.status.get(options.workflowId);

          if (options.json) {
            console.log(JSON.stringify({ status: 'success', data: status }, null, 2));
          } else {
            console.log(chalk.bold(`Workflow Status: ${options.workflowId}`));
            console.log(`  Current Phase: ${status.currentPhase || 'N/A'}`);
            console.log(`  Progress: ${status.progress}%`);
          }
        } else if (options.workId) {
          // Status for work item's active workflow
          const state = stateManager.workflow.getActive(options.workId);

          if (!state) {
            if (options.json) {
              console.log(JSON.stringify({
                status: 'success',
                data: { active: false, message: 'No active workflow' },
              }, null, 2));
            } else {
              console.log(chalk.yellow(`No active workflow for work item #${options.workId}`));
            }
            return;
          }

          if (options.json) {
            console.log(JSON.stringify({ status: 'success', data: state }, null, 2));
          } else {
            console.log(chalk.bold(`Workflow Status: Work Item #${options.workId}`));
            console.log(`  Workflow ID: ${state.workflow_id}`);
            console.log(`  State: ${getStateColor(state.status)(state.status)}`);
            console.log(`  Current Phase: ${state.current_phase || 'N/A'}`);
            console.log(`  Started: ${state.started_at || 'N/A'}`);

            if (options.verbose && state.phase_states) {
              console.log(chalk.yellow('\nPhase Details:'));
              Object.entries(state.phase_states).forEach(([phase, phaseState]) => {
                const ps = phaseState as { status: string };
                const icon = ps.status === 'completed' ? chalk.green('✓') :
                             ps.status === 'in_progress' ? chalk.cyan('→') :
                             ps.status === 'failed' ? chalk.red('✗') : chalk.gray('○');
                console.log(`  ${icon} ${phase}`);
              });
            }
          }
        } else {
          // List all workflows
          const workflows = stateManager.workflow.list();

          if (options.json) {
            console.log(JSON.stringify({ status: 'success', data: workflows }, null, 2));
          } else {
            if (workflows.length === 0) {
              console.log(chalk.yellow('No workflows found'));
            } else {
              console.log(chalk.bold('Workflows:'));
              workflows.forEach((wf: any) => {
                const stateColor = getStateColor(wf.status);
                console.log(`  ${wf.workflow_id}: work #${wf.work_id} - ${wf.current_phase || 'N/A'} [${stateColor(wf.status)}]`);
              });
            }
          }
        }
      } catch (error) {
        handleWorkflowError(error, options);
      }
    });
}

/**
 * Create the workflow-resume command
 */
export function createResumeCommand(): Command {
  return new Command('workflow-resume')
    .description('Resume a paused workflow')
    .argument('<workflow_id>', 'Workflow ID to resume')
    .option('--json', 'Output as JSON')
    .action(async (workflowId: string, options) => {
      try {
        const workflow = new FaberWorkflow();

        if (!options.json) {
          console.log(chalk.blue(`Resuming workflow: ${workflowId}`));
        }

        const result = await workflow.resume(workflowId);

        if (options.json) {
          console.log(JSON.stringify({ status: 'success', data: result }, null, 2));
        } else {
          console.log(chalk.green(`\n✓ Workflow ${result.status}`));
          console.log(chalk.gray(`  Duration: ${result.duration_ms}ms`));
        }
      } catch (error) {
        handleWorkflowError(error, options);
      }
    });
}

/**
 * Create the workflow-pause command
 */
export function createPauseCommand(): Command {
  return new Command('workflow-pause')
    .description('Pause a running workflow')
    .argument('<workflow_id>', 'Workflow ID to pause')
    .option('--json', 'Output as JSON')
    .action(async (workflowId: string, options) => {
      try {
        const workflow = new FaberWorkflow();

        workflow.pause(workflowId);

        if (options.json) {
          console.log(JSON.stringify({ status: 'success', data: { paused: workflowId } }, null, 2));
        } else {
          console.log(chalk.green(`✓ Paused workflow: ${workflowId}`));
        }
      } catch (error) {
        handleWorkflowError(error, options);
      }
    });
}

/**
 * Create the workflow-recover command
 */
export function createRecoverCommand(): Command {
  return new Command('workflow-recover')
    .description('Recover a workflow from checkpoint')
    .argument('<workflow_id>', 'Workflow ID to recover')
    .option('--checkpoint <id>', 'Specific checkpoint ID to recover from')
    .option('--phase <phase>', 'Recover to specific phase')
    .option('--json', 'Output as JSON')
    .action(async (workflowId: string, options) => {
      try {
        const stateManager = new StateManager();

        const state = stateManager.workflow.recover(workflowId, {
          checkpointId: options.checkpoint,
          fromPhase: options.phase,
        });

        if (options.json) {
          console.log(JSON.stringify({ status: 'success', data: state }, null, 2));
        } else {
          console.log(chalk.green(`✓ Recovered workflow: ${workflowId}`));
          console.log(chalk.gray(`  Current phase: ${state.current_phase}`));
          console.log(chalk.gray(`  Status: ${state.status}`));
        }
      } catch (error) {
        handleWorkflowError(error, options);
      }
    });
}

/**
 * Create the workflow-cleanup command
 */
export function createCleanupCommand(): Command {
  return new Command('workflow-cleanup')
    .description('Clean up old workflow states')
    .option('--max-age <days>', 'Delete workflows older than N days', '30')
    .option('--json', 'Output as JSON')
    .action(async (options) => {
      try {
        const stateManager = new StateManager();

        const result = stateManager.cleanup(parsePositiveInteger(options.maxAge, 'max age (days)'));

        if (options.json) {
          console.log(JSON.stringify({ status: 'success', data: result }, null, 2));
        } else {
          if (result.deleted === 0) {
            console.log(chalk.yellow('No workflows to clean up'));
          } else {
            console.log(chalk.green(`✓ Cleaned up ${result.deleted} workflow(s)`));
          }
          if (result.errors.length > 0) {
            console.log(chalk.yellow(`\nErrors (${result.errors.length}):`));
            result.errors.forEach((err: string) => {
              console.log(chalk.red(`  - ${err}`));
            });
          }
        }
      } catch (error) {
        handleWorkflowError(error, options);
      }
    });
}

/**
 * Create the workflow-create command
 */
export function createWorkflowCreateCommand(): Command {
  return new Command('workflow-create')
    .description('Create a new workflow definition')
    .argument('<name>', 'Workflow name (lowercase, hyphens allowed)')
    .option('--template <id>', 'Copy from existing workflow template')
    .option('--description <text>', 'Workflow description')
    .option('--json', 'Output as JSON')
    .action(async (name: string, options) => {
      try {
        const result = createWorkflow({
          name,
          template: options.template,
          description: options.description,
        });

        if (options.json) {
          console.log(JSON.stringify({
            status: 'success',
            data: {
              entry: result.entry,
              filePath: result.filePath,
              manifestPath: result.manifestPath,
            },
          }, null, 2));
        } else {
          console.log(chalk.green(`✓ Created workflow: ${name}`));
          console.log(chalk.gray(`  File: ${result.filePath}`));
          console.log(chalk.gray(`  Manifest: ${result.manifestPath}`));
          if (options.template) {
            console.log(chalk.gray(`  Template: ${options.template}`));
          }
        }
      } catch (error) {
        handleWorkflowError(error, options);
      }
    });
}

/**
 * Create the workflow-update command
 */
export function createWorkflowUpdateCommand(): Command {
  return new Command('workflow-update')
    .description('Update a workflow definition')
    .argument('<name>', 'Workflow name to update')
    .option('--description <text>', 'New description')
    .option('--json', 'Output as JSON')
    .action(async (name: string, options) => {
      try {
        const entry = updateWorkflow({
          name,
          description: options.description,
        });

        if (options.json) {
          console.log(JSON.stringify({
            status: 'success',
            data: entry,
          }, null, 2));
        } else {
          console.log(chalk.green(`✓ Updated workflow: ${name}`));
          if (options.description) {
            console.log(chalk.gray(`  Description: ${options.description}`));
          }
        }
      } catch (error) {
        handleWorkflowError(error, options);
      }
    });
}

/**
 * Create the workflow-inspect command
 */
export function createWorkflowInspectCommand(): Command {
  return new Command('workflow-inspect')
    .description('Inspect a workflow definition')
    .argument('<name>', 'Workflow name to inspect')
    .option('--json', 'Output as JSON')
    .action(async (name: string, options) => {
      try {
        const result = inspectWorkflow({ workflowId: name });

        if (options.json) {
          console.log(JSON.stringify({
            status: 'success',
            data: result,
          }, null, 2));
        } else {
          console.log(chalk.bold(`Workflow: ${result.entry.id}`));
          if (result.entry.description) {
            console.log(`  Description: ${result.entry.description}`);
          }
          console.log(`  File: ${result.filePath}`);
          console.log(`  File exists: ${result.fileExists ? chalk.green('yes') : chalk.red('no')}`);
          if (result.fileSize !== undefined) {
            console.log(`  File size: ${result.fileSize} bytes`);
          }
          if (result.lastModified) {
            console.log(`  Last modified: ${result.lastModified}`);
          }
          if (result.content) {
            const content = result.content;
            if (content['phases'] && typeof content['phases'] === 'object') {
              const phases = Object.keys(content['phases'] as Record<string, unknown>);
              console.log(`  Phases: ${phases.join(', ')}`);
            }
            if (content['extends']) {
              console.log(`  Extends: ${content['extends']}`);
            }
          }
        }
      } catch (error) {
        handleWorkflowError(error, options);
      }
    });
}

/**
 * Create the workflow-debugger command
 */
export function createWorkflowDebuggerCommand(): Command {
  return new Command('workflow-debugger')
    .description('Debug a workflow run')
    .option('--run-id <id>', 'Run ID to debug')
    .option('--json', 'Output as JSON')
    .action(async (options) => {
      try {
        if (!options.runId) {
          throw new Error('--run-id is required');
        }

        const report = debugWorkflow(options.runId);

        if (options.json) {
          console.log(JSON.stringify({
            status: 'success',
            data: report,
          }, null, 2));
        } else {
          console.log(chalk.bold(`Debug Report: ${report.runId}`));
          console.log(`  Found: ${report.found ? chalk.green('yes') : chalk.red('no')}`);

          if (report.state) {
            const state = report.state as Record<string, unknown>;
            console.log(chalk.cyan('\nState:'));
            console.log(`  Status: ${state['status']}`);
            console.log(`  Phase: ${state['current_phase']}`);
            console.log(`  Updated: ${state['updated_at']}`);
          }

          if (report.events && report.events.length > 0) {
            console.log(chalk.cyan(`\nEvents: ${report.events.length}`));
            const lastEvents = report.events.slice(-5);
            lastEvents.forEach((e: string) => console.log(chalk.gray(`  ${e}`)));
            if (report.events.length > 5) {
              console.log(chalk.gray(`  ... and ${report.events.length - 5} more`));
            }
          }

          if (report.issues.length > 0) {
            console.log(chalk.yellow('\nIssues:'));
            report.issues.forEach((i: string) => console.log(chalk.yellow(`  - ${i}`)));
          } else {
            console.log(chalk.green('\nNo issues detected'));
          }
        }
      } catch (error) {
        handleWorkflowError(error, options);
      }
    });
}

// Helper functions

function getStateColor(state: string): (text: string) => string {
  switch (state) {
    case 'running':
      return chalk.cyan;
    case 'completed':
      return chalk.green;
    case 'failed':
      return chalk.red;
    case 'paused':
      return chalk.yellow;
    case 'idle':
    case 'pending':
      return chalk.gray;
    default:
      return chalk.white;
  }
}

// Error handling

function handleWorkflowError(error: unknown, options: { json?: boolean }): void {
  const message = error instanceof Error ? error.message : String(error);
  if (options.json) {
    console.error(JSON.stringify({
      status: 'error',
      error: { code: 'WORKFLOW_ERROR', message },
    }));
  } else {
    console.error(chalk.red('Error:'), message);
  }
  process.exit(1);
}
