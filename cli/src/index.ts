#!/usr/bin/env node

/**
 * FABER CLI - Command-line interface for FABER development toolkit
 *
 * Binary: fractary-faber
 * Entry point for the FABER command-line interface
 */

// Load .env file from current working directory before anything else
import dotenv from 'dotenv';
dotenv.config();

import { Command } from 'commander';
import chalk from 'chalk';
import { createRunCommand, createStatusCommand, createResumeCommand, createPauseCommand, createRecoverCommand, createCleanupCommand, createWorkflowCreateCommand, createWorkflowUpdateCommand, createWorkflowInspectCommand, createWorkflowResolveCommand, createWorkflowDebugCommand, createBatchPlanCommand, createBatchRunCommand, createWorkflowExecuteCommand } from './commands/fractary-faber-workflow/index.js';
import { createSessionLoadCommand, createSessionSaveCommand } from './commands/fractary-faber-session.js';
import { createWorkCommand } from './commands/fractary-faber-work/index.js';
import { createRepoCommand } from './commands/fractary-faber-repo/index.js';
import { createLogsCommand } from './commands/fractary-faber-logs/index.js';
import { createChangelogCommand } from './commands/fractary-faber-changelog/index.js';
import { createMigrateCommand } from './commands/fractary-faber-migrate.js';
import { createPlanCommand } from './commands/fractary-faber-plan/index.js';
import { createAuthCommand } from './commands/fractary-faber-auth/index.js';
import { createConfigCommand } from './commands/fractary-faber-config.js';
import { createRunsCommand } from './commands/fractary-faber-runs.js';

// Force unbuffered output to prevent buffering issues in terminals
if (process.stdout.isTTY) {
  (process.stdout as any)._handle?.setBlocking?.(true);
}

const version = '1.5.23';

/**
 * Create and configure the main CLI program
 */
export function createFaberCLI(): Command {
  const program = new Command('fractary-faber');

  program
    .description('FABER development toolkit (workflow, work, repo, logs, auth)')
    .version(version)
    .enablePositionalOptions();

  // Global options
  program.option('--debug', 'Enable debug output');

  // Configuration commands
  program.addCommand(createConfigCommand());       // config init/update/validate/get/set/migrate/path/exists
  program.addCommand(createMigrateCommand());     // migrate (legacy top-level alias)

  // Workflow commands (top-level)
  program.addCommand(createRunsCommand());         // runs dir/plan-path/state-path
  program.addCommand(createPlanCommand());         // workflow-plan
  program.addCommand(createRunCommand());          // workflow-run
  program.addCommand(createStatusCommand());       // run-inspect
  program.addCommand(createResumeCommand());       // workflow-resume
  program.addCommand(createPauseCommand());        // workflow-pause
  program.addCommand(createRecoverCommand());      // workflow-recover
  program.addCommand(createCleanupCommand());      // workflow-cleanup
  program.addCommand(createWorkflowCreateCommand());  // workflow-create
  program.addCommand(createWorkflowUpdateCommand());  // workflow-update
  program.addCommand(createWorkflowInspectCommand()); // workflow-inspect (project-local registry)
  program.addCommand(createWorkflowResolveCommand()); // workflow-resolve (full inheritance + bundled defaults)
  program.addCommand(createWorkflowDebugCommand()); // workflow-debug
  program.addCommand(createBatchPlanCommand());     // workflow-batch-plan
  program.addCommand(createBatchRunCommand());      // workflow-batch-run
  program.addCommand(createWorkflowExecuteCommand()); // workflow-execute (multi-model CLI-native)
  program.addCommand(createSessionLoadCommand());     // session-load
  program.addCommand(createSessionSaveCommand());     // session-save

  // Subcommand trees
  program.addCommand(createAuthCommand());
  program.addCommand(createWorkCommand());
  program.addCommand(createRepoCommand());
  program.addCommand(createLogsCommand());
  program.addCommand(createChangelogCommand());

  // Help command
  program.addCommand(
    new Command('help')
      .description('Show help for all commands')
      .action(() => {
        program.help();
      })
  );

  // Error handling
  program.on('error', (error: Error) => {
    console.error(chalk.red('✖'), error.message);
    process.exit(1);
  });

  return program;
}

// Main execution - ESM compatible entry point detection
const isMainModule = import.meta.url === `file://${process.argv[1]}` ||
                     process.argv[1]?.endsWith('fractary-faber');

if (isMainModule) {
  const program = createFaberCLI();
  program.parse(process.argv);

  // Show help if no command provided
  if (!process.argv.slice(2).length) {
    program.outputHelp();
    process.exit(0);
  }
}
