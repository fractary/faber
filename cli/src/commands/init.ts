/**
 * Init command - Initialize FABER section in unified config.yaml
 *
 * This command ONLY manages the faber: section of .fractary/config.yaml
 * It assumes shared configuration (github, anthropic) is already set up via fractary-core:init
 */

import { Command } from 'commander';
import chalk from 'chalk';
import * as readline from 'readline/promises';
import os from 'os';
import path from 'path';
import {
  loadYamlConfig,
  writeYamlConfig,
  configExists,
  oldSettingsExists,
  getConfigPath,
  getOldSettingsPath
} from '../lib/yaml-config.js';

export function createInitCommand(): Command {
  return new Command('configure')
    .description('Initialize FABER section in unified config.yaml')
    .option('--force', 'Overwrite existing FABER configuration')
    .option('--json', 'Output as JSON')
    .action(async (options) => {
      try {
        if (!options.json) {
          console.log(chalk.cyan('Initializing FABER configuration...'));
          console.log();
        }

        // Step 1: Check for old settings.json and suggest migration
        if (oldSettingsExists()) {
          const oldPath = getOldSettingsPath();
          if (options.json) {
            console.log(JSON.stringify({
              status: 'error',
              error: {
                message: 'Old settings.json found',
                oldPath,
                migration: 'Run: fractary-faber migrate'
              }
            }));
          } else {
            console.log(chalk.yellow('⚠️  Detected old .fractary/settings.json'));
            console.log(`Found: ${chalk.gray(oldPath)}`);
            console.log();
            console.log('Run this command to migrate to the new format:');
            console.log(chalk.cyan('  fractary-faber migrate'));
            console.log();
          }
          process.exit(1);
        }

        // Step 2: Check if config.yaml exists
        if (!configExists()) {
          if (options.json) {
            console.log(JSON.stringify({
              status: 'error',
              error: {
                message: 'No .fractary/config.yaml found',
                recommendation: 'Run fractary-core:init first'
              }
            }));
          } else {
            console.error(chalk.red('Error: No .fractary/config.yaml found'));
            console.log();
            console.log('FABER requires shared configuration to be set up first.');
            console.log();
            console.log('Please run one of the following:');
            console.log(chalk.cyan('  1. fractary-core:init') + '     - Initialize unified config with GitHub/Anthropic settings');
            console.log(chalk.cyan('  2. fractary-faber migrate') + ' - Migrate from old .fractary/settings.json');
            console.log();
          }
          process.exit(1);
        }

        // Step 3: Load existing config
        const config = loadYamlConfig();
        if (!config) {
          throw new Error('Failed to load .fractary/config.yaml');
        }

        // Step 4: Check if FABER section already exists
        if (config.faber && !options.force) {
          if (options.json) {
            console.log(JSON.stringify({
              status: 'exists',
              path: getConfigPath(),
              message: 'FABER section already configured'
            }));
          } else {
            console.log(chalk.yellow('FABER section already exists in config.yaml'));
            console.log();
            console.log('Use --force to overwrite existing configuration.');
            console.log();
          }
          return;
        }

        // Step 5: Validate shared sections and warn if missing
        const warnings: string[] = [];
        if (!config.github) {
          warnings.push('Missing \'github\' section - FABER needs GitHub authentication');
        }
        if (!config.anthropic) {
          warnings.push('Missing \'anthropic\' section - FABER needs Anthropic API key');
        }

        if (warnings.length > 0 && !options.json) {
          console.log(chalk.yellow('⚠️  Configuration warnings:'));
          warnings.forEach(w => console.log(chalk.yellow(`  - ${w}`)));
          console.log();
          console.log(chalk.bold('Recommendation:') + ' Run ' + chalk.cyan('fractary-core:init') + ' to set up shared configuration');
          console.log();

          // Ask if user wants to continue
          const rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout,
          });

          const answer = await rl.question('Continue with FABER initialization? (y/N) ');
          rl.close();
          console.log();

          if (answer.toLowerCase() !== 'y') {
            console.log('Initialization cancelled.');
            return;
          }
        }

        // Step 6: Initialize FABER section
        config.faber = {
          worktree: {
            location: path.join(os.homedir(), '.claude-worktrees'),
            inherit_from_claude: true
          },
          workflow: {
            config_path: path.join('.fractary', 'faber', 'workflows')
          }
        };

        // Step 7: Write config back
        writeYamlConfig(config);

        if (options.json) {
          console.log(JSON.stringify({
            status: 'success',
            path: getConfigPath()
          }));
        } else {
          console.log(chalk.green('✓ FABER configuration initialized in .fractary/config.yaml'));
          console.log();
          console.log('Next steps:');
          console.log('  1. Set up GitHub App authentication: ' + chalk.cyan('fractary-faber auth setup'));
          console.log('  2. Create workflow configuration files in .fractary/faber/workflows/');
          console.log('  3. Run your first workflow: ' + chalk.cyan('fractary-faber workflow plan <issue-number>'));
          console.log();
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        if (options.json) {
          console.error(JSON.stringify({
            status: 'error',
            error: { message }
          }));
        } else {
          console.error(chalk.red('Error:'), message);
        }
        process.exit(1);
      }
    });
}
