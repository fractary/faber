/**
 * Migrate command - Convert .fractary/settings.json to .fractary/config.yaml
 *
 * Migrates old FABER configuration to the unified config format.
 * After migration, settings.json is backed up and all FABER commands use config.yaml.
 */

import { Command } from 'commander';
import chalk from 'chalk';
import fs from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';
import * as yaml from 'js-yaml';
import {
  loadYamlConfig,
  writeYamlConfig,
  findProjectRoot,
  configExists,
  oldSettingsExists,
  getOldSettingsPath,
  getConfigPath
} from '../lib/yaml-config.js';
import type { UnifiedConfig, FaberConfig } from '../types/config.js';

interface OldSettings {
  anthropic?: {
    api_key?: string;
    model?: string;
    max_tokens?: number;
  };
  github?: {
    token?: string;
    organization?: string;
    project?: string;
    repo?: string;
    app?: {
      id: string;
      installation_id: string;
      private_key_path?: string;
      private_key_env_var?: string;
      created_via?: 'manifest-flow' | 'manual';
      created_at?: string;
    };
  };
  worktree?: {
    location?: string;
    inherit_from_claude?: boolean;
  };
  workflow?: {
    default?: string;
    config_path?: string;
  };
  backlog_management?: {
    default_limit?: number;
    default_order_by?: string;
    priority_config?: {
      label_prefix?: string;
    };
  };
}

export function createMigrateCommand(): Command {
  return new Command('migrate')
    .description('Migrate from .fractary/settings.json to .fractary/config.yaml')
    .option('--dry-run', 'Show what would be migrated without making changes')
    .option('--no-backup', 'Do not create backup of old settings.json')
    .option('--json', 'Output as JSON')
    .action(async (options) => {
      try {
        const projectRoot = findProjectRoot();
        const settingsPath = getOldSettingsPath(projectRoot);
        const configPath = getConfigPath(projectRoot);

        // Step 1: Check if settings.json exists
        if (!oldSettingsExists(projectRoot)) {
          if (options.json) {
            console.log(JSON.stringify({
              status: 'error',
              error: {
                message: 'No .fractary/settings.json found to migrate',
                recommendation: 'If starting fresh, run: fractary-core:init'
              }
            }));
          } else {
            console.error(chalk.red('Error: No .fractary/settings.json found to migrate'));
            console.log();
            console.log('If you\'re starting fresh, run:');
            console.log(chalk.cyan('  fractary-core:init'));
            console.log();
          }
          process.exit(1);
        }

        // Step 2: Load old settings
        let oldSettings: OldSettings;
        try {
          const content = await fs.readFile(settingsPath, 'utf-8');
          oldSettings = JSON.parse(content);
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          if (options.json) {
            console.log(JSON.stringify({
              status: 'error',
              error: { message: `Failed to parse settings.json: ${message}` }
            }));
          } else {
            console.error(chalk.red(`Error: Failed to parse settings.json: ${message}`));
          }
          process.exit(1);
        }

        // Step 3: Load existing config.yaml (if exists)
        let config: UnifiedConfig;
        const configExistsAlready = configExists(projectRoot);

        if (configExistsAlready) {
          config = loadYamlConfig({ projectRoot }) || { version: '2.0' };
          if (!options.json) {
            console.log(chalk.yellow('Note: Existing config.yaml found - will merge settings'));
          }
        } else {
          config = { version: '2.0' };
        }

        // Step 4: Build migrated config
        // Map old structure to new unified structure
        if (oldSettings.anthropic) {
          config.anthropic = {
            ...config.anthropic,
            ...oldSettings.anthropic
          };

          // Convert hardcoded API key to env var reference if present
          if (config.anthropic?.api_key && !config.anthropic.api_key.startsWith('${')) {
            if (!options.json) {
              console.log(chalk.yellow('⚠️  Found hardcoded Anthropic API key'));
              console.log('   Recommendation: Set ANTHROPIC_API_KEY environment variable');
              console.log('   and use ${ANTHROPIC_API_KEY} in config.yaml');
              console.log();
            }
          }
        }

        if (oldSettings.github) {
          config.github = {
            ...config.github,
            ...oldSettings.github
          };

          // Warn about hardcoded tokens
          if (config.github?.token && !config.github.token.startsWith('${')) {
            if (!options.json) {
              console.log(chalk.yellow('⚠️  Found hardcoded GitHub token'));
              console.log('   Recommendation: Set GITHUB_TOKEN environment variable');
              console.log('   and use ${GITHUB_TOKEN} in config.yaml');
              console.log();
            }
          }
        }

        // Move FABER-specific settings to faber section
        if (oldSettings.worktree || oldSettings.workflow || oldSettings.backlog_management) {
          // Validate and convert backlog_management.default_order_by
          let backlogManagement: FaberConfig['backlog_management'];
          if (oldSettings.backlog_management) {
            const validOrderBy = ['priority', 'created', 'updated', 'none'] as const;
            const orderBy = oldSettings.backlog_management.default_order_by;
            backlogManagement = {
              ...oldSettings.backlog_management,
              default_order_by: orderBy && validOrderBy.includes(orderBy as typeof validOrderBy[number])
                ? orderBy as typeof validOrderBy[number]
                : undefined
            };
          }

          config.faber = {
            ...config.faber,
            ...(oldSettings.worktree && { worktree: oldSettings.worktree }),
            ...(oldSettings.workflow && { workflow: oldSettings.workflow }),
            ...(backlogManagement && { backlog_management: backlogManagement })
          };
        }

        // Step 5: Handle dry-run
        if (options.dryRun) {
          const yamlContent = yaml.dump(config, {
            indent: 2,
            lineWidth: 100,
            noRefs: true,
            sortKeys: false,
          });

          if (options.json) {
            console.log(JSON.stringify({
              status: 'dry-run',
              wouldWrite: configPath,
              wouldBackup: options.backup !== false ? `${settingsPath}.backup` : null,
              config: config
            }, null, 2));
          } else {
            console.log(chalk.cyan('Dry run - would write to config.yaml:'));
            console.log();
            console.log(yamlContent);
            console.log();
            if (options.backup !== false) {
              console.log(chalk.gray(`Would backup: ${settingsPath} → ${settingsPath}.backup`));
            }
          }
          return;
        }

        // Step 6: Write new config
        writeYamlConfig(config, projectRoot);

        // Step 7: Backup old settings
        if (options.backup !== false) {
          const backupPath = `${settingsPath}.backup`;
          await fs.rename(settingsPath, backupPath);

          if (options.json) {
            console.log(JSON.stringify({
              status: 'success',
              configPath,
              backupPath,
              message: 'Successfully migrated to config.yaml'
            }));
          } else {
            console.log(chalk.green('✓ Successfully migrated to .fractary/config.yaml'));
            console.log(chalk.green(`✓ Backup created at ${path.relative(projectRoot, backupPath)}`));
          }
        } else {
          // Delete old settings without backup
          await fs.unlink(settingsPath);

          if (options.json) {
            console.log(JSON.stringify({
              status: 'success',
              configPath,
              message: 'Successfully migrated to config.yaml (no backup)'
            }));
          } else {
            console.log(chalk.green('✓ Successfully migrated to .fractary/config.yaml'));
            console.log(chalk.yellow('⚠️  Old settings.json deleted (no backup)'));
          }
        }

        if (!options.json) {
          console.log();
          console.log('Next steps:');
          console.log('  1. Review .fractary/config.yaml');
          console.log('  2. Replace any hardcoded secrets with environment variable references');
          console.log('     Example: api_key: ${ANTHROPIC_API_KEY}');
          console.log('  3. Consider running ' + chalk.cyan('fractary-core:init') + ' to set up other plugins');
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
