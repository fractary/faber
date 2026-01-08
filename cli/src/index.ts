#!/usr/bin/env node

/**
 * FABER CLI - Command-line interface for FABER development toolkit
 *
 * Binary: fractary-faber
 * Entry point for the FABER command-line interface
 */

import { Command } from 'commander';
import chalk from 'chalk';
import { createRunCommand, createStatusCommand, createResumeCommand, createPauseCommand, createRecoverCommand, createCleanupCommand } from './commands/workflow/index.js';
import { createWorkCommand } from './commands/work/index.js';
import { createRepoCommand } from './commands/repo/index.js';
import { createSpecCommand } from './commands/spec/index.js';
import { createLogsCommand } from './commands/logs/index.js';
import { createInitCommand } from './commands/init.js';
import { createPlanCommand } from './commands/plan/index.js';
import { createAuthCommand } from './commands/auth/index.js';

const version = '1.3.2';

/**
 * Create and configure the main CLI program
 */
export function createFaberCLI(): Command {
  const program = new Command('fractary-faber');

  program
    .description('FABER development toolkit (workflow, work, repo, spec, logs, auth)')
    .version(version)
    .enablePositionalOptions();

  // Global options
  program.option('--debug', 'Enable debug output');

  // Workflow commands (top-level) - NEW NAMES
  program.addCommand(createInitCommand());        // workflow-init
  program.addCommand(createPlanCommand());         // plan - NEW
  program.addCommand(createRunCommand());          // workflow-run
  program.addCommand(createStatusCommand());       // workflow-status
  program.addCommand(createResumeCommand());       // workflow-resume
  program.addCommand(createPauseCommand());        // workflow-pause
  program.addCommand(createRecoverCommand());      // workflow-recover
  program.addCommand(createCleanupCommand());      // workflow-cleanup

  // DEPRECATED: Old command names (backwards compatibility)
  const showDeprecationWarning = (oldName: string, newName: string) => {
    console.warn(chalk.yellow(`\n⚠️  DEPRECATED: "${oldName}" → use "${newName}"\n`));
  };

  program
    .command('init')
    .description('(DEPRECATED: Use workflow-init)')
    .option('--preset <name>', 'Use a preset configuration', 'default')
    .option('--force', 'Overwrite existing configuration')
    .option('--json', 'Output as JSON')
    .action((options) => {
      showDeprecationWarning('init', 'workflow-init');
      const initCmd = createInitCommand();
      initCmd.parse(['', '', ...Object.entries(options).flatMap(([k, v]) =>
        typeof v === 'boolean' && v ? [`--${k}`] : typeof v === 'string' ? [`--${k}`, v] : []
      )], { from: 'user' });
    });

  program
    .command('run')
    .description('(DEPRECATED: Use workflow-run)')
    .requiredOption('--work-id <id>', 'Work item ID to process')
    .option('--autonomy <level>', 'Autonomy level', 'supervised')
    .option('--json', 'Output as JSON')
    .action((options) => {
      showDeprecationWarning('run', 'workflow-run');
      const runCmd = createRunCommand();
      runCmd.parse(['', '', '--work-id', options.workId,
        ...(options.autonomy ? ['--autonomy', options.autonomy] : []),
        ...(options.json ? ['--json'] : [])
      ], { from: 'user' });
    });

  program
    .command('status')
    .description('(DEPRECATED: Use workflow-status)')
    .option('--work-id <id>', 'Work item ID to check')
    .option('--workflow-id <id>', 'Workflow ID to check')
    .option('--verbose', 'Show detailed status')
    .option('--json', 'Output as JSON')
    .action((options) => {
      showDeprecationWarning('status', 'workflow-status');
      const statusCmd = createStatusCommand();
      statusCmd.parse(['', '', ...Object.entries(options).flatMap(([k, v]) =>
        typeof v === 'boolean' && v ? [`--${k}`] : typeof v === 'string' ? [`--${k}`, v] : []
      )], { from: 'user' });
    });

  program
    .command('resume <workflow_id>')
    .description('(DEPRECATED: Use workflow-resume)')
    .option('--json', 'Output as JSON')
    .action((workflowId, options) => {
      showDeprecationWarning('resume', 'workflow-resume');
      const resumeCmd = createResumeCommand();
      resumeCmd.parse(['', '', workflowId, ...(options.json ? ['--json'] : [])], { from: 'user' });
    });

  program
    .command('pause <workflow_id>')
    .description('(DEPRECATED: Use workflow-pause)')
    .option('--json', 'Output as JSON')
    .action((workflowId, options) => {
      showDeprecationWarning('pause', 'workflow-pause');
      const pauseCmd = createPauseCommand();
      pauseCmd.parse(['', '', workflowId, ...(options.json ? ['--json'] : [])], { from: 'user' });
    });

  program
    .command('recover <workflow_id>')
    .description('(DEPRECATED: Use workflow-recover)')
    .option('--checkpoint <id>', 'Specific checkpoint ID')
    .option('--phase <phase>', 'Recover to specific phase')
    .option('--json', 'Output as JSON')
    .action((workflowId, options) => {
      showDeprecationWarning('recover', 'workflow-recover');
      const recoverCmd = createRecoverCommand();
      recoverCmd.parse(['', '', workflowId, ...Object.entries(options).flatMap(([k, v]) =>
        typeof v === 'boolean' && v ? [`--${k}`] : typeof v === 'string' ? [`--${k}`, v] : []
      )], { from: 'user' });
    });

  program
    .command('cleanup')
    .description('(DEPRECATED: Use workflow-cleanup)')
    .option('--max-age <days>', 'Delete workflows older than N days', '30')
    .option('--json', 'Output as JSON')
    .action((options) => {
      showDeprecationWarning('cleanup', 'workflow-cleanup');
      const cleanupCmd = createCleanupCommand();
      cleanupCmd.parse(['', '', ...Object.entries(options).flatMap(([k, v]) =>
        typeof v === 'boolean' && v ? [`--${k}`] : typeof v === 'string' ? [`--${k}`, v] : []
      )], { from: 'user' });
    });

  // Subcommand trees
  program.addCommand(createAuthCommand());
  program.addCommand(createWorkCommand());
  program.addCommand(createRepoCommand());
  program.addCommand(createSpecCommand());
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
