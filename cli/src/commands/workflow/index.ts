/**
 * Workflow commands - FABER workflow management
 *
 * Provides run-inspect, workflow-create, workflow-update, workflow-inspect,
 * workflow-resolve, workflow-debug, workflow-execute, and workflow-batch-plan commands.
 *
 * NOTE: workflow-run, workflow-resume, workflow-pause, and workflow-batch-run
 * have been removed. Workflow execution should go through the
 * fractary-faber-workflow-run skill, not the CLI.
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
  WorkflowResolver,
  ExecutorRegistry,
  WorkflowExecutor,
} from '@fractary/faber';
import { parsePositiveInteger } from '../../utils/validation.js';

/**
 * Create the run-inspect command
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
 * Create the workflow-resolve command.
 *
 * Resolves a workflow with full inheritance chain merging via WorkflowResolver.
 * Unlike workflow-inspect (which only looks in project-local registry),
 * workflow-resolve also searches bundled plugin defaults — making it the
 * CLI equivalent of merge-workflows.sh and the correct tool for agents and
 * skills that need a fully-merged workflow definition.
 *
 * Works identically in Claude Code and pi installs: WorkflowResolver uses
 * __dirname to locate bundled workflows without any environment configuration.
 */
export function createWorkflowResolveCommand(): Command {
  return new Command('workflow-resolve')
    .description('Resolve a workflow with full inheritance chain merging (includes bundled plugin defaults)')
    .argument('<id>', 'Workflow ID to resolve (e.g. "core", "default", "project:my-workflow")')
    .option('--project-root <path>', 'Project root directory (default: cwd)')
    .option('--json', 'Output as JSON')
    .action(async (id: string, options) => {
      try {
        const resolver = new WorkflowResolver({
          projectRoot: options.projectRoot,
        });
        const workflow = await resolver.resolveWorkflow(id);

        if (options.json) {
          console.log(JSON.stringify({ status: 'success', workflow }, null, 2));
        } else {
          console.log(chalk.bold(`Workflow: ${workflow.id}`));
          if (workflow.description) {
            console.log(`  Description: ${workflow.description}`);
          }
          console.log(`  Inheritance chain: ${workflow.inheritance_chain.join(' → ')}`);
          if (workflow.skipped_steps?.length) {
            console.log(`  Skipped steps: ${workflow.skipped_steps.join(', ')}`);
          }
          console.log();
          for (const [phase, def] of Object.entries(workflow.phases)) {
            const steps = def.steps ?? [];
            const enabled = def.enabled !== false;
            console.log(
              chalk.cyan(`  ${phase}`),
              enabled ? '' : chalk.gray('(disabled)'),
              chalk.gray(`${steps.length} steps`)
            );
          }
        }
      } catch (error) {
        if (options.json) {
          const msg = error instanceof Error ? error.message : String(error);
          const paths = (error as { searchedPaths?: string[] }).searchedPaths;
          console.error(JSON.stringify({
            status: 'failure',
            message: msg,
            errors: paths ? [`Searched: ${paths.join(', ')}`] : [msg],
          }));
        } else {
          console.error(chalk.red(`Error: ${error instanceof Error ? error.message : String(error)}`));
        }
        process.exit(1);
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
    .option('--force-new', 'Force new plan generation even if plans already exist')
    .option('--json', 'Output as JSON')
    .action(async (options) => {
      try {
        await executeBatchPlanCommand(options);
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
  force_new: boolean;
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

async function writeBatchState(batchId: string, state: BatchState): Promise<void> {
  state.updated_at = new Date().toISOString();
  const statePath = path.join(getBatchDir(batchId), 'state.json');
  await fs.writeFile(statePath, JSON.stringify(state, null, 2));
}

async function executeBatchPlanCommand(options: {
  workId: string;
  name?: string;
  autonomous?: boolean;
  forceNew?: boolean;
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
    force_new: options.forceNew ?? false,
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
    console.log(chalk.cyan('To run this batch, use the workflow-batch-run skill:'));
    console.log(chalk.white(`  /fractary-faber-workflow-batch-run --batch ${batchId} --autonomous`));
  }
}

/**
 * Create the workflow-execute command (multi-model CLI-native execution)
 */
/**
 * Create the workflow-execute command (multi-model CLI-native execution)
 *
 * Deterministic workflow execution: code controls the step iteration loop,
 * each step is an isolated invocation with fresh context.
 *
 * Routing: `!` prefix → shell command | harness → Agent SDK/API | legacy executor
 */
export function createWorkflowExecuteCommand(): Command {
  return new Command('workflow-execute')
    .description('Execute a workflow using the multi-model executor framework (CLI-native, no Claude Code required)')
    .argument('<plan-path>', 'Path to plan.json file')
    .option('--model <model>', 'Default model override for all steps')
    .option('--harness <harness>', 'Default harness override: claude-code, opencode, codex, api')
    .option('--phase <phases>', 'Execute only specified phase(s) — comma-separated')
    .option('--step <step-id>', 'Execute only a specific step')
    .option('--dry-run', 'Show what would execute without running')
    .option('--json', 'Output as JSON')
    .action(async (planPath: string, options: {
      model?: string;
      harness?: string;
      phase?: string;
      step?: string;
      dryRun?: boolean;
      json?: boolean;
    }) => {
      try {
        const fs = await import('fs/promises');
        const path = await import('path');

        // Load plan
        const resolvedPath = path.resolve(planPath);
        const planContent = await fs.readFile(resolvedPath, 'utf-8');
        const plan = JSON.parse(planContent);

        if (!plan.workflow?.phases) {
          throw new Error('Invalid plan: missing workflow.phases');
        }

        // Create executor registry with defaults
        const registry = ExecutorRegistry.createDefault();

        // Legacy executor support (for backward compatibility)
        const workflowExecutor = plan.workflow.executor || (options.model && !options.harness ? {
          provider: 'claude',
          model: options.model,
        } : undefined);

        // Create workflow executor
        const executor = new WorkflowExecutor(registry);

        // Parse options
        const phasesToRun = options.phase?.split(',').map((p: string) => p.trim()) ?? null;

        // Extract metadata from plan
        const workId = plan.source?.work_id || plan.items?.[0]?.work_id || 'unknown';
        const issue = plan.items?.[0]?.issue;
        const planId = plan.id;
        const branch = plan.items?.[0]?.branch?.name;

        // Determine harness display
        const defaultHarness = options.harness || plan.workflow.defaults?.harness || 'claude-code';
        const defaultModel = options.model || plan.workflow.defaults?.model;

        if (!options.json) {
          console.log(chalk.blue.bold('FABER CLI-Native Workflow Execution'));
          console.log(chalk.gray('═'.repeat(50)));
          console.log(chalk.gray(`Plan: ${resolvedPath}`));
          console.log(chalk.gray(`Work ID: ${workId}`));
          console.log(chalk.gray(`Workflow: ${plan.workflow.id}`));
          console.log(chalk.gray(`Harness: ${defaultHarness}`));
          if (defaultModel) {
            console.log(chalk.gray(`Model: ${defaultModel}`));
          }
          if (options.dryRun) {
            console.log(chalk.yellow.bold('\n⚡ DRY RUN — no steps will be executed'));
          }
          console.log('');
        }

        // Dry run: show step routing and exit
        if (options.dryRun) {
          const phaseNames = ['frame', 'architect', 'build', 'evaluate', 'release'] as const;
          for (const phaseName of phaseNames) {
            const phase = plan.workflow.phases[phaseName];
            if (!phase?.enabled && phase?.enabled !== undefined) continue;
            if (!phase?.steps?.length) continue;
            console.log(chalk.cyan(`\n${phaseName.toUpperCase()}`));
            for (const step of phase.steps) {
              const isCmd = step.prompt?.trim().startsWith('!');
              const harness = step.harness || plan.workflow.phase_defaults?.[phaseName]?.harness || defaultHarness;
              const model = step.model || plan.workflow.phase_defaults?.[phaseName]?.model || defaultModel || '';
              const tag = isCmd
                ? chalk.green('[command]')
                : chalk.magenta(`[${harness}${model ? `:${model}` : ''}]`);
              console.log(chalk.gray(`  ${step.id} ${tag}`));
              if (isCmd) {
                console.log(chalk.gray(`    → ${step.prompt.trim().slice(1)}`));
              }
            }
          }
          return;
        }

        // Execute
        const result = await executor.execute(
          {
            phases: plan.workflow.phases,
            executor: workflowExecutor,
            phase_executors: plan.workflow.phase_executors,
            result_handling: plan.workflow.result_handling,
            prompt: plan.workflow.prompt,
            defaults: plan.workflow.defaults,
            phase_defaults: plan.workflow.phase_defaults,
          },
          {
            workId,
            issue: issue ? { number: issue.number, title: issue.title, body: '' } : undefined,
            workingDirectory: path.dirname(resolvedPath),
            phasesToRun: phasesToRun || undefined,
            stepToRun: options.step || null,
            planId,
            planPath: resolvedPath,
            branch,
            cliHarness: options.harness as any,
            cliModel: options.model,
            onPhaseStart: (phase: string) => {
              if (!options.json) {
                console.log(chalk.cyan(`\n→ Phase: ${phase.toUpperCase()}`));
              }
            },
            onStepStart: (_phase: string, step: any, index: number, total: number) => {
              if (!options.json) {
                const isCmd = step.prompt?.trim().startsWith('!');
                const stepHarness = step.harness || step.executor?.provider;
                const tag = isCmd
                  ? chalk.green('[command]')
                  : stepHarness
                    ? chalk.magenta(`[${stepHarness}${step.model ? `:${step.model}` : ''}]`)
                    : chalk.gray(`[${defaultHarness}]`);
                console.log(chalk.gray(`  [${index + 1}/${total}] ${step.name} ${tag}`));
              }
            },
            onStepComplete: (_phase: string, step: any, stepResult: any) => {
              if (!options.json) {
                const icon = stepResult.status === 'success' ? chalk.green('✓') :
                             stepResult.status === 'warning' ? chalk.yellow('⚠') :
                             chalk.red('✗');
                const providerInfo = stepResult.metadata.provider === 'command'
                  ? chalk.green('cmd')
                  : `${stepResult.metadata.provider}`;
                console.log(`  ${icon} ${step.id} [${providerInfo}] (${stepResult.metadata.duration_ms}ms)`);
                if (stepResult.metadata.tokens_used) {
                  console.log(chalk.gray(`    tokens: ${stepResult.metadata.tokens_used.input}→${stepResult.metadata.tokens_used.output}`));
                }
              }
            },
            onPhaseComplete: (phase: string, status: string) => {
              if (!options.json) {
                const icon = status === 'completed' ? chalk.green('✓') :
                             status === 'skipped' ? chalk.gray('⏭') :
                             chalk.red('✗');
                console.log(`  ${icon} Phase ${phase} ${status}`);
              }
            },
          },
        );

        if (options.json) {
          console.log(JSON.stringify({ status: 'success', data: result }, null, 2));
        } else {
          console.log(chalk.gray('\n' + '═'.repeat(50)));
          const statusIcon = result.status === 'completed' ? chalk.green('✓') : chalk.red('✗');
          console.log(`${statusIcon} Workflow ${result.status} (${result.duration_ms}ms)`);
          console.log(chalk.gray(`  Steps: ${result.steps_completed}/${result.steps_total}`));
        }

        if (result.status === 'failed') {
          process.exit(1);
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
