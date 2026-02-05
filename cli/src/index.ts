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
import { createRunCommand, createStatusCommand, createResumeCommand, createPauseCommand, createRecoverCommand, createCleanupCommand, createWorkflowCreateCommand, createWorkflowUpdateCommand, createWorkflowInspectCommand, createWorkflowDebuggerCommand } from './commands/workflow/index.js';
import { createSessionLoadCommand, createSessionSaveCommand } from './commands/session.js';
import { createWorkCommand } from './commands/work/index.js';
import { createRepoCommand } from './commands/repo/index.js';
import { createLogsCommand } from './commands/logs/index.js';
import { createInitCommand } from './commands/init.js';
import { createMigrateCommand } from './commands/migrate.js';
import { createPlanCommand } from './commands/plan/index.js';
import { createAuthCommand } from './commands/auth/index.js';
import { createConfigCommand } from './commands/config.js';
import { createRunsCommand } from './commands/runs.js';

// Force unbuffered output to prevent buffering issues in terminals
if (process.stdout.isTTY) {
  (process.stdout as any)._handle?.setBlocking?.(true);
}

const version = '1.5.20';

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

  // Workflow commands (top-level)
  program.addCommand(createInitCommand());        // configure
  program.addCommand(createMigrateCommand());     // migrate
  program.addCommand(createConfigCommand());       // config get/path/exists
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
  program.addCommand(createWorkflowInspectCommand()); // workflow-inspect
  program.addCommand(createWorkflowDebuggerCommand()); // workflow-debugger
  program.addCommand(createSessionLoadCommand());     // session-load
  program.addCommand(createSessionSaveCommand());     // session-save

  // Subcommand trees
  program.addCommand(createAuthCommand());
  program.addCommand(createWorkCommand());
  program.addCommand(createRepoCommand());
  program.addCommand(createLogsCommand());

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
