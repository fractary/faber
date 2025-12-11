#!/usr/bin/env node
/**
 * @fractary/faber - CLI
 *
 * Command-line interface for FABER SDK.
 */

import { Command } from 'commander';
import { workCommand } from './commands/work';
import { repoCommand } from './commands/repo';
import { specCommand } from './commands/spec';
import { logsCommand } from './commands/logs';
import { workflowCommand } from './commands/workflow';

const program = new Command();

program
  .name('fractary')
  .description('FABER SDK - Development toolkit for AI-assisted workflows')
  .version('1.0.0');

// Register commands
program.addCommand(workCommand);
program.addCommand(repoCommand);
program.addCommand(specCommand);
program.addCommand(logsCommand);
program.addCommand(workflowCommand);

program.parse();
