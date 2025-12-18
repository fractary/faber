/**
 * Init command - Initialize a new FABER project
 */

import { Command } from 'commander';
import * as fs from 'fs/promises';
import * as path from 'path';
import chalk from 'chalk';

export function createInitCommand(): Command {
  return new Command('workflow-init')
    .description('Initialize a new FABER project')
    .option('--preset <name>', 'Use a preset configuration', 'default')
    .option('--force', 'Overwrite existing configuration')
    .option('--json', 'Output as JSON')
    .action(async (options) => {
      try {
        const configDir = '.fractary/faber';
        const configPath = path.join(configDir, 'config.json');

        // Check if already initialized
        const exists = await fs.access(configPath).then(() => true).catch(() => false);
        if (exists && !options.force) {
          if (options.json) {
            console.log(JSON.stringify({
              status: 'error',
              error: { code: 'ALREADY_INITIALIZED', message: 'FABER already initialized. Use --force to reinitialize.' },
            }));
          } else {
            console.error(chalk.yellow('FABER already initialized. Use --force to reinitialize.'));
          }
          process.exit(1);
        }

        // Create directory structure
        await fs.mkdir(configDir, { recursive: true });
        await fs.mkdir(path.join(configDir, 'specs'), { recursive: true });
        await fs.mkdir(path.join(configDir, 'logs'), { recursive: true });
        await fs.mkdir(path.join(configDir, 'state'), { recursive: true });

        // Create default configuration
        const config = createDefaultConfig(options.preset);
        await fs.writeFile(configPath, JSON.stringify(config, null, 2));

        // Create .gitignore for sensitive files
        const gitignore = `# FABER state files
state/*.json
logs/session-*.md
*.tmp
`;
        await fs.writeFile(path.join(configDir, '.gitignore'), gitignore);

        if (options.json) {
          console.log(JSON.stringify({
            status: 'success',
            data: { configPath, preset: options.preset },
          }, null, 2));
        } else {
          console.log(chalk.green('✓ FABER initialized successfully'));
          console.log(chalk.gray(`  Config: ${configPath}`));
          console.log(chalk.gray(`  Preset: ${options.preset}`));
          console.log('\nNext steps:');
          console.log('  1. Configure work tracking: Edit .fractary/faber/config.json');
          console.log('  2. Start a workflow: fractary-faber run --work-id <issue-number>');
          console.log('  3. Check status: fractary-faber status');
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        if (options.json) {
          console.error(JSON.stringify({
            status: 'error',
            error: { code: 'INIT_ERROR', message },
          }));
        } else {
          console.error(chalk.red('Error:'), message);
        }
        process.exit(1);
      }
    });
}

/**
 * Create default FABER configuration
 */
function createDefaultConfig(preset: string): object {
  const baseConfig = {
    version: '1.0.0',
    preset,

    // Work tracking configuration
    work: {
      provider: 'github', // or 'jira', 'linear'
    },

    // Repository configuration
    repo: {
      provider: 'github', // or 'gitlab', 'bitbucket'
      defaultBranch: 'main',
      branchPrefix: 'feat/',
      conventionalCommits: true,
    },

    // Specification configuration
    spec: {
      directory: '.fractary/faber/specs',
      templates: {
        feature: 'feature',
        bugfix: 'bugfix',
        refactor: 'refactor',
      },
    },

    // Log configuration
    logs: {
      directory: '.fractary/faber/logs',
      retention: {
        session: 30,
        build: 90,
        deployment: 365,
      },
    },

    // Workflow configuration
    workflow: {
      defaultAutonomy: 'guarded',
      phases: ['frame', 'architect', 'build', 'evaluate', 'release'],
      checkpoints: true,
    },

    // State management
    state: {
      directory: '.fractary/faber/state',
      persistence: 'file', // or 'none' for stateless
    },
  };

  // Apply preset modifications
  switch (preset) {
    case 'minimal':
      return {
        ...baseConfig,
        workflow: {
          ...baseConfig.workflow,
          checkpoints: false,
        },
        logs: {
          ...baseConfig.logs,
          retention: {
            session: 7,
            build: 30,
            deployment: 90,
          },
        },
      };

    case 'enterprise':
      return {
        ...baseConfig,
        workflow: {
          ...baseConfig.workflow,
          defaultAutonomy: 'assist',
        },
        logs: {
          ...baseConfig.logs,
          retention: {
            session: 90,
            build: 365,
            deployment: 730,
          },
        },
      };

    default:
      return baseConfig;
  }
}
