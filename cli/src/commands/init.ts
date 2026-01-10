/**
 * Init command - Initialize a new FABER project
 *
 * This command is a lightweight wrapper that delegates all logic to the SDK's ConfigInitializer.
 * In the future, this will invoke the faber-initializer agent.
 */

import { Command } from 'commander';
import chalk from 'chalk';
import { ConfigInitializer } from '@fractary/faber';

export function createInitCommand(): Command {
  return new Command('init')
    .description('Initialize FABER project configuration')
    .option('--force', 'Overwrite existing configuration')
    .option('--json', 'Output as JSON')
    .action(async (options) => {
      try {
        // TODO: Invoke faber-initializer agent here
        // For now, use SDK directly for centralized logic

        if (!options.json) {
          console.log(chalk.cyan('Initializing FABER project...'));
        }

        // 1. Attempt migration first
        const migrationResult = ConfigInitializer.migrateConfig();

        if (migrationResult.migrated) {
          if (options.json) {
            console.log(JSON.stringify({
              status: 'migrated',
              path: migrationResult.newPath
            }));
          } else {
            console.log(chalk.green(`✓ Migrated config from ${migrationResult.oldPath}`));
            console.log(chalk.gray(`  to ${migrationResult.newPath}`));
          }
          return;
        }

        if (migrationResult.error && !options.json) {
          console.warn(chalk.yellow(`⚠ ${migrationResult.error}`));
        }

        // 2. Check if config exists
        if (ConfigInitializer.configExists() && !options.force) {
          if (options.json) {
            console.log(JSON.stringify({
              status: 'exists',
              path: ConfigInitializer.getDefaultConfigPath()
            }));
          } else {
            console.log(chalk.yellow('Config already exists. Use --force to overwrite.'));
          }
          return;
        }

        // 3. Initialize project using SDK
        const configPath = ConfigInitializer.initializeProject();

        if (options.json) {
          console.log(JSON.stringify({
            status: 'success',
            path: configPath
          }));
        } else {
          console.log(chalk.green('✓ FABER initialized successfully'));
          console.log(chalk.gray(`  Config: ${configPath}`));
          console.log('\nNext steps:');
          console.log('  1. Review config: .fractary/faber/config.yaml');
          console.log('  2. Set up authentication: fractary-faber auth setup');
          console.log('  3. Create your first workflow: fractary-faber workflow plan <issue-number>');
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
