#!/usr/bin/env node
/**
 * FABER CLI - Command-line interface for FABER development toolkit
 *
 * Binary: fractary-faber
 * Entry point for the FABER command-line interface
 */
import { Command } from 'commander';
import chalk from 'chalk';
import { createRunCommand, createStatusCommand, createResumeCommand, createPauseCommand, createRecoverCommand, createCleanupCommand } from './commands/workflow/index';
import { createWorkCommand } from './commands/work/index';
import { createRepoCommand } from './commands/repo/index';
import { createSpecCommand } from './commands/spec/index';
import { createLogsCommand } from './commands/logs/index';
import { createInitCommand } from './commands/init';
const version = '1.0.0';
/**
 * Create and configure the main CLI program
 */
export function createFaberCLI() {
    const program = new Command('fractary-faber');
    program
        .description('FABER development toolkit (workflow, work, repo, spec, logs)')
        .version(version)
        .enablePositionalOptions();
    // Global options
    program.option('--debug', 'Enable debug output');
    // Workflow commands (top-level)
    program.addCommand(createInitCommand());
    program.addCommand(createRunCommand());
    program.addCommand(createStatusCommand());
    program.addCommand(createResumeCommand());
    program.addCommand(createPauseCommand());
    program.addCommand(createRecoverCommand());
    program.addCommand(createCleanupCommand());
    // Subcommand trees
    program.addCommand(createWorkCommand());
    program.addCommand(createRepoCommand());
    program.addCommand(createSpecCommand());
    program.addCommand(createLogsCommand());
    // Help command
    program.addCommand(new Command('help')
        .description('Show help for all commands')
        .action(() => {
        program.help();
    }));
    // Error handling
    program.on('error', (error) => {
        console.error(chalk.red('✖'), error.message);
        process.exit(1);
    });
    return program;
}
// Main execution
if (require.main === module) {
    const program = createFaberCLI();
    program.parse(process.argv);
    // Show help if no command provided
    if (!process.argv.slice(2).length) {
        program.outputHelp();
        process.exit(0);
    }
}
