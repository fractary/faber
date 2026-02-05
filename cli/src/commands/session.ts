/**
 * Session commands - Load and save FABER workflow session context
 *
 * Provides session-load and session-save commands via SessionManager SDK.
 */

import { Command } from 'commander';
import chalk from 'chalk';
import { SessionManager } from '@fractary/faber';

/**
 * Create the session-load command
 */
export function createSessionLoadCommand(): Command {
  return new Command('session-load')
    .description('Load active workflow session context')
    .option('--work-id <id>', 'Work item ID to find session for')
    .option('--run-id <id>', 'Specific run ID to load')
    .option('--json', 'Output as JSON')
    .action(async (options) => {
      try {
        const sessionManager = new SessionManager();
        const context = sessionManager.loadSession({
          workId: options.workId,
          runId: options.runId,
        });

        if (options.json) {
          console.log(JSON.stringify({ status: 'success', data: context }, null, 2));
        } else {
          if (!context.active) {
            console.log(chalk.yellow('No active session found'));
            if (options.workId) {
              console.log(chalk.gray(`  No runs found for work item #${options.workId}`));
            }
            if (options.runId) {
              console.log(chalk.gray(`  Run not found: ${options.runId}`));
            }
          } else {
            console.log(chalk.bold('Active Session'));
            if (context.runId) {
              console.log(`  Run ID:  ${context.runId}`);
            }
            if (context.workId) {
              console.log(`  Work ID: ${context.workId}`);
            }
            if (context.state) {
              const state = context.state as Record<string, unknown>;
              console.log(`  Status:  ${state['status'] || 'unknown'}`);
              console.log(`  Phase:   ${state['current_phase'] || 'unknown'}`);
            }
          }
        }
      } catch (error) {
        handleSessionError(error, options);
      }
    });
}

/**
 * Create the session-save command
 */
export function createSessionSaveCommand(): Command {
  return new Command('session-save')
    .description('Save workflow session (set active run)')
    .requiredOption('--run-id <id>', 'Run ID to set as active')
    .option('--work-id <id>', 'Work item ID (for reference)')
    .option('--json', 'Output as JSON')
    .action(async (options) => {
      try {
        const sessionManager = new SessionManager();
        sessionManager.saveSession({
          runId: options.runId,
          workId: options.workId,
        });

        if (options.json) {
          console.log(JSON.stringify({
            status: 'success',
            data: { runId: options.runId, saved: true },
          }, null, 2));
        } else {
          console.log(chalk.green(`✓ Session saved`));
          console.log(chalk.gray(`  Active run: ${options.runId}`));
        }
      } catch (error) {
        handleSessionError(error, options);
      }
    });
}

function handleSessionError(error: unknown, options: { json?: boolean }): void {
  const message = error instanceof Error ? error.message : String(error);
  if (options.json) {
    console.error(JSON.stringify({
      status: 'error',
      error: { code: 'SESSION_ERROR', message },
    }));
  } else {
    console.error(chalk.red('Error:'), message);
  }
  process.exit(1);
}
