/**
 * Runs command - Query FABER run paths
 *
 * This command provides access to run directory and file paths for scripts and tools.
 * It uses the SDK's centralized path definitions, ensuring consistency across all tools.
 *
 * All run files are stored in: .fractary/faber/runs/{run_id}/
 * - plan.json: The execution plan
 * - state.json: The workflow state
 *
 * Active workflow tracking: .fractary/faber/runs/.active-run-id
 * - Contains the run ID of the currently active workflow in this worktree
 */

import { Command } from 'commander';
import * as fs from 'fs';
import {
  FABER_RUNS_DIR,
  ACTIVE_RUN_ID_FILE,
  getRunsDir,
  getRunDir,
  getPlanPath,
  getStatePath,
  getActiveRunIdPath,
  RELATIVE_PATHS,
} from '@fractary/faber';

export function createRunsCommand(): Command {
  const runsCmd = new Command('runs')
    .description('Query FABER run paths');

  runsCmd
    .command('dir')
    .description('Show runs directory path or specific run directory')
    .argument('[run_id]', 'Run ID (optional - omit for base runs directory)')
    .option('--relative', 'Output relative path instead of absolute')
    .option('--json', 'Output as JSON')
    .action((runId: string | undefined, options) => {
      try {
        if (runId) {
          // Specific run directory
          const absPath = getRunDir(runId);
          const relPath = `${FABER_RUNS_DIR}/${runId}`;

          if (options.json) {
            console.log(JSON.stringify({
              run_id: runId,
              absolute: absPath,
              relative: relPath,
            }, null, 2));
          } else {
            console.log(options.relative ? relPath : absPath);
          }
        } else {
          // Base runs directory
          const absPath = getRunsDir();

          if (options.json) {
            console.log(JSON.stringify({
              absolute: absPath,
              relative: FABER_RUNS_DIR,
            }, null, 2));
          } else {
            console.log(options.relative ? FABER_RUNS_DIR : absPath);
          }
        }
      } catch (error) {
        console.error(`Error: ${error instanceof Error ? error.message : String(error)}`);
        process.exit(1);
      }
    });

  runsCmd
    .command('plan-path')
    .description('Show plan file path for a run')
    .argument('<run_id>', 'Run ID')
    .option('--relative', 'Output relative path instead of absolute')
    .option('--json', 'Output as JSON')
    .action((runId: string, options) => {
      try {
        const absPath = getPlanPath(runId);
        const relPath = `${FABER_RUNS_DIR}/${runId}/plan.json`;

        if (options.json) {
          console.log(JSON.stringify({
            run_id: runId,
            absolute: absPath,
            relative: relPath,
          }, null, 2));
        } else {
          console.log(options.relative ? relPath : absPath);
        }
      } catch (error) {
        console.error(`Error: ${error instanceof Error ? error.message : String(error)}`);
        process.exit(1);
      }
    });

  runsCmd
    .command('state-path')
    .description('Show state file path for a run')
    .argument('<run_id>', 'Run ID')
    .option('--relative', 'Output relative path instead of absolute')
    .option('--json', 'Output as JSON')
    .action((runId: string, options) => {
      try {
        const absPath = getStatePath(runId);
        const relPath = `${FABER_RUNS_DIR}/${runId}/state.json`;

        if (options.json) {
          console.log(JSON.stringify({
            run_id: runId,
            absolute: absPath,
            relative: relPath,
          }, null, 2));
        } else {
          console.log(options.relative ? relPath : absPath);
        }
      } catch (error) {
        console.error(`Error: ${error instanceof Error ? error.message : String(error)}`);
        process.exit(1);
      }
    });

  runsCmd
    .command('active-run-id-path')
    .description('Show active run ID file path')
    .option('--relative', 'Output relative path instead of absolute')
    .option('--json', 'Output as JSON')
    .action((options) => {
      try {
        const absPath = getActiveRunIdPath();

        if (options.json) {
          console.log(JSON.stringify({
            absolute: absPath,
            relative: ACTIVE_RUN_ID_FILE,
          }, null, 2));
        } else {
          console.log(options.relative ? ACTIVE_RUN_ID_FILE : absPath);
        }
      } catch (error) {
        console.error(`Error: ${error instanceof Error ? error.message : String(error)}`);
        process.exit(1);
      }
    });

  runsCmd
    .command('paths')
    .description('Show all path templates')
    .option('--json', 'Output as JSON')
    .action((options) => {
      if (options.json) {
        console.log(JSON.stringify(RELATIVE_PATHS, null, 2));
      } else {
        console.log('FABER Run Path Templates:');
        console.log(`  Runs Directory:     ${RELATIVE_PATHS.RUNS_DIR}`);
        console.log(`  Run Directory:      ${RELATIVE_PATHS.RUN_DIR_TEMPLATE}`);
        console.log(`  Plan File:          ${RELATIVE_PATHS.PLAN_PATH_TEMPLATE}`);
        console.log(`  State File:         ${RELATIVE_PATHS.STATE_PATH_TEMPLATE}`);
        console.log(`  Active Run ID File: ${RELATIVE_PATHS.ACTIVE_RUN_ID_FILE}`);
      }
    });

  runsCmd
    .command('verify-complete')
    .description('Verify that all phases and steps in a run are completed or skipped')
    .argument('<run_id>', 'Run ID to verify')
    .option('--json', 'Output as JSON')
    .action((runId: string, options) => {
      try {
        const statePath = getStatePath(runId);
        if (!fs.existsSync(statePath)) {
          console.error(`Error: State file not found: ${statePath}`);
          process.exit(2);
        }

        const state = JSON.parse(fs.readFileSync(statePath, 'utf-8'));
        const pending: string[] = [];

        // Check each phase and its steps
        if (state.phases && typeof state.phases === 'object') {
          for (const [phaseName, phase] of Object.entries(state.phases) as [string, any][]) {
            if (phase.enabled === false) continue;

            if (phase.steps && typeof phase.steps === 'object') {
              for (const [stepId, step] of Object.entries(phase.steps) as [string, any][]) {
                const status = step.status || 'pending';
                if (status !== 'completed' && status !== 'success' && status !== 'skipped') {
                  pending.push(`${phaseName}:${stepId} (${status})`);
                }
              }
            } else {
              // Phase without steps — check phase-level status
              const phaseStatus = phase.status || 'pending';
              if (phaseStatus !== 'completed' && phaseStatus !== 'success' && phaseStatus !== 'skipped') {
                pending.push(`${phaseName} (${phaseStatus})`);
              }
            }
          }
        }

        const pass = pending.length === 0;

        if (options.json) {
          console.log(JSON.stringify({ pass, pending }, null, 2));
        } else if (pass) {
          console.log('✓ All phases and steps are completed');
        } else {
          console.log(`✗ ${pending.length} item(s) still pending:`);
          for (const item of pending) {
            console.log(`  - ${item}`);
          }
        }

        process.exit(pass ? 0 : 1);
      } catch (error) {
        console.error(`Error: ${error instanceof Error ? error.message : String(error)}`);
        process.exit(2);
      }
    });

  return runsCmd;
}
