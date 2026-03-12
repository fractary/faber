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
    .description('Run FABER workflow (supports comma-separated work IDs for batch execution)')
    .requiredOption('--work-id <ids>', 'Work item ID(s) to process (comma-separated for batch, e.g., "258,259,260")')
    .option('--autonomy <level>', 'Autonomy level: supervised|assisted|autonomous', 'supervised')
    .option('--phase <phases>', 'Execute only specified phase(s) - comma-separated')
    .option('--force-new', 'Force fresh start, bypass auto-resume')
    .option('--resume-batch', 'Resume a previously interrupted batch')
    .option('--json', 'Output as JSON')
    .action(async (options) => {
      try {
        const workIds = options.workId.split(',').map((id: string) => id.trim()).filter(Boolean);
        const isBatch = workIds.length > 1;

        if (isBatch) {
          // Batch mode: sequential execution
          if (!options.json) {
            console.log(chalk.blue.bold('═══════════════════════════════════════════════'));
            console.log(chalk.blue.bold('  BATCH MODE: Sequential Multi-Workflow Execution'));
            console.log(chalk.blue.bold('═══════════════════════════════════════════════'));
            console.log(chalk.gray(`Work IDs: ${workIds.join(', ')}`));
            console.log(chalk.gray(`Autonomy: ${options.autonomy}`));
            if (options.phase) console.log(chalk.gray(`Phases: ${options.phase}`));
            console.log(chalk.gray(`Total workflows: ${workIds.length}`));
            console.log('');
          }

          const results: Array<{ workId: string; status: string; error?: string }> = [];

          for (let i = 0; i < workIds.length; i++) {
            const workId = workIds[i];

            if (!options.json) {
              console.log(chalk.blue(`\n═══ Workflow ${i + 1}/${workIds.length}: #${workId} ═══`));
            }

            try {
              const workflow = new FaberWorkflow();

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
                workId,
                autonomy: options.autonomy,
                phase: options.phase,
                forceNew: options.forceNew,
              });

              results.push({ workId, status: result.status });

              if (!options.json) {
                console.log(chalk.green(`✓ Workflow ${i + 1}/${workIds.length} completed: #${workId}`));
              }
            } catch (error) {
              const message = error instanceof Error ? error.message : String(error);
              results.push({ workId, status: 'failed', error: message });

              if (!options.json) {
                console.error(chalk.red(`✗ Workflow ${i + 1}/${workIds.length} FAILED: #${workId}`));
                console.error(chalk.red(`  Error: ${message}`));
                console.error(chalk.yellow('\nBatch stopped due to error. Remaining workflows not executed.'));
              }
              break; // Stop batch on error
            }
          }

          // Batch summary
          if (options.json) {
            console.log(JSON.stringify({ status: 'success', data: { batch: true, results } }, null, 2));
          } else {
            const completed = results.filter(r => r.status !== 'failed');
            const failed = results.filter(r => r.status === 'failed');

            console.log(chalk.blue.bold('\n═══════════════════════════════════════════════'));
            console.log(chalk.blue.bold('  BATCH COMPLETE'));
            console.log(chalk.blue.bold('═══════════════════════════════════════════════'));
            console.log(`Total: ${workIds.length} | Completed: ${completed.length} | Failed: ${failed.length}`);
            for (const r of results) {
              if (r.status === 'failed') {
                console.log(chalk.red(`  ✗ #${r.workId} — ${r.error}`));
              } else {
                console.log(chalk.green(`  ✓ #${r.workId} — ${r.status}`));
              }
            }
          }

          if (results.some(r => r.status === 'failed')) {
            process.exit(1);
          }

        } else {
          // Single mode: original behavior
          const workflow = new FaberWorkflow();

          if (!options.json) {
            console.log(chalk.blue(`Starting FABER workflow for work item #${workIds[0]}`));
            console.log(chalk.gray(`Autonomy: ${options.autonomy}`));
          }

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
            workId: workIds[0],
            autonomy: options.autonomy,
            phase: options.phase,
            forceNew: options.forceNew,
          });

          if (options.json) {
            console.log(JSON.stringify({ status: 'success', data: result }, null, 2));
          } else {
            console.log(chalk.green(`\n✓ Workflow ${result.status}`));
            console.log(chalk.gray(`  Workflow ID: ${result.workflow_id}`));
            console.log(chalk.gray(`  Duration: ${result.duration_ms}ms`));
            console.log(chalk.gray(`  Phases: ${result.phases.map((p: any) => p.phase).join(' → ')}`));
          }
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
 * Create the workflow-debug command
 */
export function createWorkflowDebugCommand(): Command {
  return new Command('workflow-debug')
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

/**
 * Create the workflow-batch-plan command
 */
export function createBatchPlanCommand(): Command {
  return new Command('workflow-batch-plan')
    .description('Initialize a batch of workflows for sequential planning and unattended execution')
    .requiredOption('--work-id <ids>', 'Comma-separated work item IDs (e.g., "258,259,260")')
    .option('--name <batch-id>', 'Custom batch name/ID (default: auto-generated timestamp)')
    .option('--autonomous', 'Continue on plan failures without prompting')
    .option('--json', 'Output as JSON')
    .action(async (options) => {
      try {
        await executeBatchPlanCommand(options);
      } catch (error) {
        handleWorkflowError(error, options);
      }
    });
}

/**
 * Create the workflow-batch-run command
 */
export function createBatchRunCommand(): Command {
  return new Command('workflow-batch-run')
    .description('Execute a planned FABER batch sequentially with state tracking')
    .requiredOption('--batch <batch-id>', 'Batch ID to execute (from workflow-batch-plan)')
    .option('--autonomous', 'Auto-skip failed items without prompting (for overnight unattended runs)')
    .option('--resume', 'Skip already-completed items (safe to re-run after interruption)')
    .option('--phase <phases>', 'Execute only specified phase(s) - comma-separated')
    .option('--force-new', 'Force fresh start for each item, bypass auto-resume')
    .option('--json', 'Output as JSON')
    .action(async (options) => {
      try {
        await executeBatchRunCommand(options);
      } catch (error) {
        handleWorkflowError(error, options);
      }
    });
}

// ─── Batch Implementation ───────────────────────────────────────────────────

import fs from 'fs/promises';
import path from 'path';
import { spawnSync } from 'child_process';

interface BatchItem {
  work_id: string;
  status: 'pending' | 'planned' | 'plan_failed' | 'in_progress' | 'completed' | 'failed' | 'skipped';
  plan_id: string | null;
  run_id: string | null;
  started_at: string | null;
  completed_at: string | null;
  skipped: boolean;
  error: string | null;
}

interface BatchState {
  batch_id: string;
  status: 'planning' | 'planned' | 'planning_partial' | 'in_progress' | 'completed' | 'completed_with_failures' | 'paused';
  autonomous: boolean;
  created_at: string;
  updated_at: string;
  items: BatchItem[];
}

function getBatchDir(batchId: string): string {
  return path.join(process.cwd(), '.fractary', 'faber', 'batches', batchId);
}

function generateBatchId(): string {
  const now = new Date();
  const ts = now.toISOString().replace(/:/g, '-').replace(/\.\d{3}Z$/, 'Z');
  return `batch-${ts}`;
}

async function readBatchState(batchId: string): Promise<BatchState> {
  const statePath = path.join(getBatchDir(batchId), 'state.json');
  const content = await fs.readFile(statePath, 'utf-8');
  return JSON.parse(content) as BatchState;
}

async function writeBatchState(batchId: string, state: BatchState): Promise<void> {
  state.updated_at = new Date().toISOString();
  const statePath = path.join(getBatchDir(batchId), 'state.json');
  await fs.writeFile(statePath, JSON.stringify(state, null, 2));
}

async function executeBatchPlanCommand(options: {
  workId: string;
  name?: string;
  autonomous?: boolean;
  json?: boolean;
}): Promise<void> {
  const workIds = options.workId.split(',').map((id: string) => id.trim()).filter(Boolean);

  if (workIds.length === 0) {
    throw new Error('--work-id must contain at least one work item ID');
  }

  const batchId = options.name || generateBatchId();
  const batchDir = getBatchDir(batchId);
  const now = new Date().toISOString();

  if (!options.json) {
    console.log(chalk.blue.bold('═══════════════════════════════════════════════'));
    console.log(chalk.blue.bold('  FABER BATCH PLAN'));
    console.log(chalk.blue.bold('═══════════════════════════════════════════════'));
    console.log(chalk.gray(`Batch ID: ${batchId}`));
    console.log(chalk.gray(`Work IDs: ${workIds.join(', ')}`));
    console.log(chalk.gray(`Items: ${workIds.length}`));
    console.log('');
  }

  // Create batch directory
  await fs.mkdir(batchDir, { recursive: true });

  // Write queue.txt
  const queueLines = [
    '# FABER Batch Queue',
    `# Batch ID: ${batchId}`,
    `# Created: ${now}`,
    '# Format: <work-id> [--workflow custom-workflow] [--phase build,evaluate]',
    '',
    ...workIds,
  ];
  await fs.writeFile(path.join(batchDir, 'queue.txt'), queueLines.join('\n'));

  // Initialize state.json
  const state: BatchState = {
    batch_id: batchId,
    status: 'planning',
    autonomous: options.autonomous ?? false,
    created_at: now,
    updated_at: now,
    items: workIds.map((id) => ({
      work_id: id,
      status: 'pending',
      plan_id: null,
      run_id: null,
      started_at: null,
      completed_at: null,
      skipped: false,
      error: null,
    })),
  };
  await writeBatchState(batchId, state);

  if (!options.json) {
    console.log(chalk.green(`✓ Batch created: ${batchId}`));
    console.log(chalk.gray(`  Directory: ${batchDir}`));
    console.log('');
    console.log(chalk.cyan(`→ Planning ${workIds.length} item(s)...`));
    console.log('');
  }

  // Plan each item
  let planned = 0;
  let failed = 0;

  for (let i = 0; i < workIds.length; i++) {
    const workId = workIds[i];

    if (!options.json) {
      console.log(chalk.blue(`[${i + 1}/${workIds.length}] Planning #${workId}...`));
    }

    try {
      // Invoke the existing workflow-plan CLI command as a subprocess
      const faberBin = process.argv[1];
      const planArgs = [faberBin, 'workflow-plan', '--work-id', workId, '--skip-confirm'];
      if (options.autonomous) {
        planArgs.push('--autonomy', 'autonomous');
      }
      const result = spawnSync(
        process.execPath,
        planArgs,
        { stdio: options.json ? 'pipe' : 'inherit', encoding: 'utf-8' }
      );

      if (result.status !== 0) {
        throw new Error(result.stderr || `workflow-plan exited with code ${result.status}`);
      }

      // Mark as planned
      state.items[i].status = 'planned';
      state.items[i].completed_at = new Date().toISOString();
      await writeBatchState(batchId, state);
      planned++;

      if (!options.json) {
        console.log(chalk.green(`  ✓ Planned: #${workId}`));
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);

      state.items[i].status = 'plan_failed';
      state.items[i].error = message;
      state.items[i].completed_at = new Date().toISOString();
      await writeBatchState(batchId, state);
      failed++;

      if (!options.json) {
        console.error(chalk.red(`  ✗ Plan failed for #${workId}: ${message}`));
      }
    }
  }

  // Final state
  state.status = failed === 0 ? 'planned' : 'planning_partial';
  await writeBatchState(batchId, state);

  if (options.json) {
    console.log(JSON.stringify({
      status: 'success',
      data: { batch_id: batchId, total: workIds.length, planned, failed },
    }, null, 2));
  } else {
    console.log('');
    console.log(chalk.blue.bold('═══════════════════════════════════════════════'));
    console.log(chalk.blue.bold('  BATCH PLANNING COMPLETE'));
    console.log(chalk.blue.bold('═══════════════════════════════════════════════'));
    console.log(`Total: ${workIds.length} | Planned: ${planned} | Failed: ${failed}`);
    console.log('');
    console.log(chalk.cyan('To run this batch (unattended):'));
    console.log(chalk.white(`  fractary-faber workflow-batch-run --batch ${batchId} --autonomous`));
    console.log('');
    console.log(chalk.cyan('Or in Claude Code:'));
    console.log(chalk.white(`  /fractary-faber:workflow-batch-run --batch ${batchId} --autonomous`));
  }
}

async function executeBatchRunCommand(options: {
  batch: string;
  autonomous?: boolean;
  resume?: boolean;
  phase?: string;
  forceNew?: boolean;
  json?: boolean;
}): Promise<void> {
  const batchId = options.batch;
  const batchDir = getBatchDir(batchId);

  // Verify batch exists
  try {
    await fs.access(batchDir);
  } catch {
    throw new Error(
      `Batch '${batchId}' not found.\nExpected: ${batchDir}\n\nCreate a batch first:\n  fractary-faber workflow-batch-plan --work-id <ids> --name ${batchId}`
    );
  }

  // Load state
  let state = await readBatchState(batchId);

  if (state.status === 'completed') {
    if (options.json) {
      console.log(JSON.stringify({ status: 'success', data: { batch_id: batchId, message: 'already completed', state } }, null, 2));
    } else {
      console.log(chalk.green(`✓ Batch '${batchId}' already completed. Nothing to do.`));
      const done = state.items.filter(i => i.status === 'completed').length;
      console.log(chalk.gray(`  Completed: ${done}/${state.items.length}`));
      console.log(chalk.gray('\nTo re-run, edit state.json and reset items to "pending".'));
    }
    return;
  }

  // Filter items to process
  const toProcess = options.resume
    ? state.items.filter(i => i.status !== 'completed' && i.status !== 'skipped')
    : state.items.filter(i => i.status !== 'completed' && i.status !== 'skipped');

  if (!options.json) {
    console.log(chalk.blue.bold('═══════════════════════════════════════════════'));
    console.log(chalk.blue.bold('  FABER BATCH RUN'));
    console.log(chalk.blue.bold('═══════════════════════════════════════════════'));
    console.log(chalk.gray(`Batch ID: ${batchId}`));
    console.log(chalk.gray(`Mode: ${options.autonomous ? 'autonomous (unattended)' : 'interactive'}`));
    if (options.resume) {
      const completed = state.items.filter(i => i.status === 'completed').length;
      console.log(chalk.gray(`Resume: ${completed}/${state.items.length} already completed`));
    }
    if (options.phase) console.log(chalk.gray(`Phase filter: ${options.phase}`));
    if (options.forceNew) console.log(chalk.gray('Force new: yes'));
    console.log(chalk.gray(`Remaining: ${toProcess.length} item(s)`));
    console.log('');
  }

  const results: Array<{ workId: string; status: string; error?: string }> = [];

  for (let i = 0; i < toProcess.length; i++) {
    const item = toProcess[i];
    const workId = item.work_id;
    const globalIndex = state.items.findIndex(s => s.work_id === workId);

    if (!options.json) {
      console.log(chalk.blue(`\n═══ Workflow ${i + 1}/${toProcess.length}: #${workId} ═══`));
    }

    // Mark in progress
    state.items[globalIndex].status = 'in_progress';
    state.items[globalIndex].started_at = new Date().toISOString();
    await writeBatchState(batchId, state);

    try {
      const workflow = new FaberWorkflow();

      workflow.addEventListener((event, data) => {
        if (options.json) return;
        switch (event) {
          case 'phase:start':
            console.log(chalk.cyan(`\n  → Phase: ${String(data.phase || '').toUpperCase()}`));
            break;
          case 'phase:complete':
            console.log(chalk.green(`  ✓ Phase: ${data.phase}`));
            break;
          case 'workflow:fail':
          case 'phase:fail':
            console.error(chalk.red(`  ✗ Error: ${data.error || 'Unknown error'}`));
            break;
        }
      });

      const result = await workflow.run({
        workId,
        autonomy: options.autonomous ? 'autonomous' : 'guarded',
        phase: options.phase,
        forceNew: options.forceNew,
      });

      state.items[globalIndex].status = 'completed';
      state.items[globalIndex].run_id = (result as any).run_id || null;
      state.items[globalIndex].completed_at = new Date().toISOString();
      await writeBatchState(batchId, state);

      results.push({ workId, status: 'completed' });

      if (!options.json) {
        console.log(chalk.green(`✓ Completed: #${workId}`));
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);

      state.items[globalIndex].status = 'failed';
      state.items[globalIndex].skipped = true;
      state.items[globalIndex].error = message;
      state.items[globalIndex].completed_at = new Date().toISOString();
      await writeBatchState(batchId, state);

      results.push({ workId, status: 'failed', error: message });

      if (!options.json) {
        console.error(chalk.red(`✗ Failed: #${workId} — ${message}`));
      }

      if (!options.autonomous) {
        // Non-autonomous: stop on first failure
        if (!options.json) {
          console.error(chalk.yellow('\nBatch stopped. Use --autonomous to auto-skip failures.'));
          console.error(chalk.gray(`Resume with: fractary-faber workflow-batch-run --batch ${batchId} --autonomous --resume`));
        }
        break;
      }

      // Autonomous: continue to next item
      if (!options.json) {
        console.log(chalk.yellow('  → Auto-skipping (autonomous mode). Continuing...'));
      }
    }
  }

  // Final state
  const allCompleted = state.items.every(i => i.status === 'completed');
  const anyFailed = state.items.some(i => i.status === 'failed');
  state.status = allCompleted ? 'completed' : anyFailed ? 'completed_with_failures' : 'paused';
  await writeBatchState(batchId, state);

  if (options.json) {
    const completed = state.items.filter(i => i.status === 'completed').length;
    const failedCount = state.items.filter(i => i.status === 'failed').length;
    console.log(JSON.stringify({
      status: 'success',
      data: { batch_id: batchId, total: state.items.length, completed, failed: failedCount, results },
    }, null, 2));
  } else {
    const completed = state.items.filter(i => i.status === 'completed').length;
    const failedCount = state.items.filter(i => i.status === 'failed').length;

    console.log('');
    console.log(chalk.blue.bold('═══════════════════════════════════════════════'));
    console.log(chalk.blue.bold('  BATCH RUN COMPLETE'));
    console.log(chalk.blue.bold('═══════════════════════════════════════════════'));
    console.log(`Total: ${state.items.length} | Completed: ${completed} | Failed: ${failedCount}`);
    console.log('');

    for (const item of state.items) {
      if (item.status === 'completed') {
        console.log(chalk.green(`  ✓ #${item.work_id} — completed`));
      } else if (item.status === 'failed') {
        console.log(chalk.red(`  ✗ #${item.work_id} — failed: ${item.error}`));
      } else if (item.status === 'skipped') {
        console.log(chalk.yellow(`  ○ #${item.work_id} — skipped`));
      } else {
        console.log(chalk.gray(`  ○ #${item.work_id} — ${item.status}`));
      }
    }

    if (failedCount > 0) {
      console.log('');
      console.log(chalk.cyan('To retry failed items:'));
      console.log(chalk.white(`  fractary-faber workflow-batch-run --batch ${batchId} --autonomous --resume`));
    }
  }

  if (anyFailed && !options.autonomous) {
    process.exit(1);
  }
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
