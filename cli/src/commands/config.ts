/**
 * Config command - Manage FABER configuration
 *
 * Provides commands for reading, writing, and migrating FABER configuration.
 * Uses the SDK's ConfigInitializer, ConfigValidator, and ConfigUpdater for
 * all operations to ensure consistency.
 *
 * Subcommands:
 *   config init     - Initialize FABER configuration (used by config-initializer agent)
 *   config update   - Update configuration fields with backup (used by config-updater agent)
 *   config validate - Validate configuration (used by config-validator agent)
 *   config get      - Get configuration values
 *   config set      - Set a single configuration value
 *   config migrate  - Migrate legacy configuration
 *   config path     - Show configuration file path
 *   config exists   - Check if configuration file exists
 */

import { Command } from 'commander';
import * as fs from 'fs';
import * as path from 'path';
import * as yaml from 'js-yaml';
import {
  loadYamlConfig,
  configExists,
  getConfigPath,
  writeYamlConfig,
  findProjectRoot,
} from '../lib/yaml-config.js';
import type { AutonomyLevel } from '../types/config.js';
import { ConfigValidator, ConfigUpdater } from '@fractary/faber';
import type { ValidationFinding, ChangePreview } from '@fractary/faber';

/**
 * Get a nested value from an object using dot notation
 * @param obj The object to search
 * @param path Dot-separated path (e.g., "faber.default_workflow")
 * @returns The value at the path, or undefined if not found
 */
function getNestedValue(obj: Record<string, unknown>, path: string): unknown {
  const parts = path.split('.');
  let current: unknown = obj;

  for (const part of parts) {
    if (current === null || current === undefined) {
      return undefined;
    }
    if (typeof current !== 'object') {
      return undefined;
    }
    current = (current as Record<string, unknown>)[part];
  }

  return current;
}

export function createConfigCommand(): Command {
  const configCmd = new Command('config')
    .description('Manage FABER configuration');

  configCmd
    .command('get')
    .description('Get configuration values')
    .argument('[key]', 'Configuration key path (e.g., faber.default_workflow). Omit for full config.')
    .option('--json', 'Output as JSON (default when no key specified)')
    .option('--raw', 'Output raw value without quotes (for shell scripts)')
    .action(async (key: string | undefined, options) => {
      try {
        // Check if config exists
        if (!configExists()) {
          const configPath = getConfigPath();
          console.error(`Error: Configuration not found at ${configPath}`);
          console.error('Run: fractary-core:init to create configuration');
          process.exit(1);
        }

        // Load configuration using SDK logic
        const config = loadYamlConfig({ warnMissingEnvVars: false });

        if (!config) {
          console.error('Error: Failed to load configuration');
          process.exit(1);
        }

        // If no key specified, output full config
        if (!key) {
          console.log(JSON.stringify(config, null, options.json ? 2 : 0));
          return;
        }

        // Get nested value
        const value = getNestedValue(config as unknown as Record<string, unknown>, key);

        if (value === undefined) {
          if (options.raw) {
            // Output empty string for undefined (useful for shell scripts)
            console.log('');
          } else {
            console.log('null');
          }
          return;
        }

        // Output value
        if (options.raw && typeof value === 'string') {
          // Raw output - no quotes, no JSON
          console.log(value);
        } else if (typeof value === 'object') {
          // Objects are always JSON
          console.log(JSON.stringify(value, null, options.json ? 2 : 0));
        } else if (options.json) {
          // JSON output
          console.log(JSON.stringify(value));
        } else {
          // Default: string values without quotes, others as JSON
          console.log(typeof value === 'string' ? value : JSON.stringify(value));
        }
      } catch (error) {
        console.error(`Error: ${error instanceof Error ? error.message : String(error)}`);
        process.exit(1);
      }
    });

  configCmd
    .command('path')
    .description('Show configuration file path')
    .action(() => {
      console.log(getConfigPath());
    });

  configCmd
    .command('exists')
    .description('Check if configuration file exists (exit 0 if yes, 1 if no)')
    .action(() => {
      process.exit(configExists() ? 0 : 1);
    });

  // =========================================================================
  // Config Init Command
  // =========================================================================

  configCmd
    .command('init')
    .description('Initialize FABER configuration with minimal defaults')
    .option('--workflows-path <path>', 'Directory for workflow files', '.fractary/faber/workflows')
    .option('--default-workflow <id>', 'Default workflow ID', 'default')
    .option('--autonomy <level>', 'Autonomy level (dry-run|assisted|guarded|autonomous)', 'guarded')
    .option('--runs-path <path>', 'Directory for run artifacts', '.fractary/faber/runs')
    .option('--force', 'Overwrite existing configuration')
    .action(async (options) => {
      try {
        const projectRoot = findProjectRoot();
        const configPath = getConfigPath(projectRoot);

        // Check if config already exists
        if (configExists(projectRoot) && !options.force) {
          console.error('Configuration already exists at:', configPath);
          console.error('Use --force to overwrite');
          process.exit(1);
        }

        // Validate autonomy level
        const validAutonomy = ['dry-run', 'assisted', 'guarded', 'autonomous'];
        if (!validAutonomy.includes(options.autonomy)) {
          console.error(`Invalid autonomy level: ${options.autonomy}`);
          console.error(`Valid values: ${validAutonomy.join(', ')}`);
          process.exit(1);
        }

        // Build faber config section
        const faberConfig = {
          workflows: {
            path: options.workflowsPath,
            default: options.defaultWorkflow,
            autonomy: options.autonomy as AutonomyLevel,
          },
          runs: {
            path: options.runsPath,
          },
        };

        // Load existing config or create empty
        let config = loadYamlConfig({ warnMissingEnvVars: false }) || { version: '2.0' };

        // Update faber section (preserves other sections)
        config = { ...config, faber: faberConfig };

        // Write config
        writeYamlConfig(config as import('../types/config.js').UnifiedConfig, projectRoot);

        // Create directories
        const workflowsDir = path.isAbsolute(options.workflowsPath)
          ? options.workflowsPath
          : path.join(projectRoot, options.workflowsPath);
        const runsDir = path.isAbsolute(options.runsPath)
          ? options.runsPath
          : path.join(projectRoot, options.runsPath);

        fs.mkdirSync(workflowsDir, { recursive: true });
        fs.mkdirSync(runsDir, { recursive: true });

        // Create workflow manifest if it doesn't exist
        const manifestPath = path.join(workflowsDir, 'workflows.yaml');
        if (!fs.existsSync(manifestPath)) {
          const manifest = {
            workflows: [
              {
                id: 'default',
                file: 'default.yaml',
                description: 'Default FABER workflow for software development',
              },
            ],
          };

          const manifestContent = `# Workflow Registry - Lists available FABER workflows
# Each workflow is defined in a separate file in this directory

${yaml.dump(manifest, { indent: 2, lineWidth: 100 })}`;

          fs.writeFileSync(manifestPath, manifestContent, 'utf-8');
          console.log('Created workflow manifest:', manifestPath);
        }

        console.log('Configuration initialized:', configPath);
        console.log('');
        console.log('Settings:');
        console.log(`  Workflows path: ${options.workflowsPath}`);
        console.log(`  Default workflow: ${options.defaultWorkflow}`);
        console.log(`  Autonomy: ${options.autonomy}`);
        console.log(`  Runs path: ${options.runsPath}`);
      } catch (error) {
        console.error(`Error: ${error instanceof Error ? error.message : String(error)}`);
        process.exit(1);
      }
    });

  // =========================================================================
  // Config Set Command
  // =========================================================================

  configCmd
    .command('set')
    .description('Set a configuration value')
    .argument('<key>', 'Configuration key path (e.g., faber.workflows.autonomy)')
    .argument('<value>', 'Value to set')
    .action(async (key: string, value: string) => {
      try {
        const projectRoot = findProjectRoot();

        if (!configExists(projectRoot)) {
          console.error('Configuration not found. Run: fractary-faber config init');
          process.exit(1);
        }

        // Load existing config
        const config = loadYamlConfig({ warnMissingEnvVars: false });
        if (!config) {
          console.error('Failed to load configuration');
          process.exit(1);
        }

        // Parse value (handle booleans, numbers, etc.)
        let parsedValue: unknown = value;
        if (value === 'true') parsedValue = true;
        else if (value === 'false') parsedValue = false;
        else if (/^-?\d+$/.test(value)) parsedValue = parseInt(value, 10);
        else if (/^-?\d+\.\d+$/.test(value)) parsedValue = parseFloat(value);

        // Set nested value
        setNestedValue(config as unknown as Record<string, unknown>, key, parsedValue);

        // Write config
        writeYamlConfig(config as import('../types/config.js').UnifiedConfig, projectRoot);

        console.log(`Set ${key} = ${JSON.stringify(parsedValue)}`);
      } catch (error) {
        console.error(`Error: ${error instanceof Error ? error.message : String(error)}`);
        process.exit(1);
      }
    });

  // =========================================================================
  // Config Migrate Command
  // =========================================================================

  configCmd
    .command('migrate')
    .description('Migrate legacy configuration to new simplified format')
    .option('--dry-run', 'Show what would be migrated without making changes')
    .action(async (options) => {
      try {
        const projectRoot = findProjectRoot();
        const configPath = getConfigPath(projectRoot);

        if (!configExists(projectRoot)) {
          console.error('Configuration not found. Nothing to migrate.');
          process.exit(1);
        }

        // Load config
        const configContent = fs.readFileSync(configPath, 'utf-8');
        const config = yaml.load(configContent) as Record<string, unknown>;
        const faber = config?.['faber'] as Record<string, unknown> | undefined;

        if (!faber) {
          console.log('No faber section found. Nothing to migrate.');
          return;
        }

        // Check for legacy fields
        const legacyFields: string[] = [];
        if (Array.isArray(faber['workflows'])) {
          legacyFields.push('workflows (array format)');
        }
        if ((faber['workflow'] as Record<string, unknown> | undefined)?.['config_path']) {
          legacyFields.push('workflow.config_path');
        }
        if (faber['repository']) {
          legacyFields.push('repository');
        }
        if (faber['logging']) {
          legacyFields.push('logging');
        }
        if (faber['state']) {
          legacyFields.push('state');
        }

        if (legacyFields.length === 0) {
          console.log('Configuration is already in the new format. Nothing to migrate.');
          return;
        }

        console.log('Legacy fields detected:');
        legacyFields.forEach((f) => console.log(`  - ${f}`));
        console.log('');

        if (options.dryRun) {
          console.log('Dry run - no changes made.');
          console.log('');
          console.log('Would migrate to:');

          // Show what the migrated config would look like
          const workflow = faber['workflow'] as Record<string, unknown> | undefined;
          const state = faber['state'] as Record<string, unknown> | undefined;

          const newConfig = {
            workflows: {
              path: workflow?.['config_path'] || '.fractary/faber/workflows',
              default: 'default',
              autonomy: workflow?.['autonomy'] || 'guarded',
            },
            runs: {
              path: state?.['runs_dir'] || '.fractary/faber/runs',
            },
          };

          console.log(yaml.dump({ faber: newConfig }, { indent: 2 }));
          return;
        }

        // Create backup
        const backupDir = path.join(projectRoot, '.fractary/backups');
        fs.mkdirSync(backupDir, { recursive: true });
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const backupPath = path.join(backupDir, `config-${timestamp}.yaml`);
        fs.copyFileSync(configPath, backupPath);
        console.log('Created backup:', backupPath);

        // Migrate
        const workflow = faber['workflow'] as Record<string, unknown> | undefined;
        const state = faber['state'] as Record<string, unknown> | undefined;

        const newFaberConfig = {
          workflows: {
            path: (workflow?.['config_path'] as string) || '.fractary/faber/workflows',
            default: 'default',
            autonomy: (workflow?.['autonomy'] as string) || 'guarded',
          },
          runs: {
            path: (state?.['runs_dir'] as string) || '.fractary/faber/runs',
          },
        };

        // Update config
        config['faber'] = newFaberConfig;

        // Write config
        const yamlContent = yaml.dump(config, {
          indent: 2,
          lineWidth: 100,
          noRefs: true,
          sortKeys: false,
        });
        fs.writeFileSync(configPath, yamlContent, 'utf-8');

        console.log('Migration complete:', configPath);
        console.log('');
        console.log('New configuration:');
        console.log(yaml.dump({ faber: newFaberConfig }, { indent: 2 }));
      } catch (error) {
        console.error(`Error: ${error instanceof Error ? error.message : String(error)}`);
        process.exit(1);
      }
    });

  // =========================================================================
  // Config Validate Command (delegates to SDK ConfigValidator)
  // =========================================================================

  configCmd
    .command('validate')
    .description('Validate FABER configuration')
    .option('--json', 'Output validation results as JSON')
    .action(async (options) => {
      try {
        const projectRoot = findProjectRoot();
        const result = ConfigValidator.validateFromDisk(projectRoot);

        if (options.json) {
          console.log(JSON.stringify(result, null, 2));
          process.exit(result.valid ? 0 : 1);
        }

        const errors = result.findings.filter((f: ValidationFinding) => f.severity === 'error');
        const warnings = result.findings.filter((f: ValidationFinding) => f.severity === 'warning');

        if (errors.length === 0 && warnings.length === 0) {
          console.log('Configuration is valid.');
          return;
        }

        if (errors.length > 0) {
          console.error('Errors:');
          errors.forEach((e: ValidationFinding) => {
            console.error(`  - ${e.message}`);
            if (e.suggestion) console.error(`    ${e.suggestion}`);
          });
        }

        if (warnings.length > 0) {
          console.warn('Warnings:');
          warnings.forEach((w: ValidationFinding) => {
            console.warn(`  - ${w.message}`);
            if (w.suggestion) console.warn(`    ${w.suggestion}`);
          });
        }

        if (errors.length > 0) {
          process.exit(1);
        }
      } catch (error) {
        console.error(`Error: ${error instanceof Error ? error.message : String(error)}`);
        process.exit(1);
      }
    });

  // =========================================================================
  // Config Update Command (delegates to SDK ConfigUpdater)
  // =========================================================================

  configCmd
    .command('update')
    .description('Update FABER configuration fields with backup and validation')
    .argument('<changes...>', 'Key=value pairs to update (e.g., faber.workflows.autonomy=autonomous)')
    .option('--dry-run', 'Preview changes without applying')
    .option('--json', 'Output results as JSON')
    .action(async (changeArgs: string[], options) => {
      try {
        const projectRoot = findProjectRoot();

        if (!configExists(projectRoot)) {
          console.error('Configuration not found. Run: fractary-faber config init');
          process.exit(1);
        }

        // Parse key=value pairs into ConfigChange objects
        const changes = changeArgs.map((arg) => {
          const eqIdx = arg.indexOf('=');
          if (eqIdx === -1) {
            console.error(`Invalid change format: ${arg}`);
            console.error('Expected format: key=value (e.g., faber.workflows.autonomy=autonomous)');
            process.exit(1);
          }
          const key = arg.substring(0, eqIdx);
          const rawValue = arg.substring(eqIdx + 1);

          // Strip leading "faber." prefix — ConfigUpdater operates within the faber section
          const faberKey = key.startsWith('faber.') ? key.substring(6) : key;

          // Parse value types
          let value: unknown = rawValue;
          if (rawValue === 'true') value = true;
          else if (rawValue === 'false') value = false;
          else if (/^-?\d+$/.test(rawValue)) value = parseInt(rawValue, 10);
          else if (/^-?\d+\.\d+$/.test(rawValue)) value = parseFloat(rawValue);

          return { key: faberKey, value };
        });

        // Preview mode
        if (options.dryRun) {
          const previews = ConfigUpdater.previewChanges(changes, projectRoot);
          if (options.json) {
            console.log(JSON.stringify({ mode: 'preview', changes: previews }, null, 2));
          } else {
            console.log('Proposed changes:');
            console.log('');
            for (const p of previews) {
              console.log(`  faber.${p.key}:`);
              console.log(`    Current:  ${JSON.stringify(p.currentValue) ?? '(not set)'}`);
              console.log(`    Proposed: ${JSON.stringify(p.proposedValue)}`);
              console.log('');
            }
            console.log('Dry run — no changes applied.');
          }
          return;
        }

        // Apply changes
        const result = ConfigUpdater.applyChanges(changes, projectRoot);

        if (options.json) {
          console.log(JSON.stringify(result, null, 2));
          process.exit(result.success ? 0 : 1);
        }

        if (!result.success) {
          console.error(`Update failed: ${result.error}`);
          if (result.backupPath) {
            console.error(`Backup preserved at: ${result.backupPath}`);
          }
          process.exit(1);
        }

        console.log('Configuration updated successfully.');
        if (result.backupPath) {
          console.log(`Backup: ${result.backupPath}`);
        }
        console.log('');
        for (const change of result.changes) {
          console.log(`  faber.${change.key}: ${JSON.stringify(change.currentValue)} -> ${JSON.stringify(change.proposedValue)}`);
        }
      } catch (error) {
        console.error(`Error: ${error instanceof Error ? error.message : String(error)}`);
        process.exit(1);
      }
    });

  return configCmd;
}

/**
 * Set a nested value in an object using dot notation
 */
function setNestedValue(obj: Record<string, unknown>, path: string, value: unknown): void {
  const parts = path.split('.');
  let current = obj;

  for (let i = 0; i < parts.length - 1; i++) {
    const part = parts[i];
    if (current[part] === undefined || current[part] === null) {
      current[part] = {};
    }
    if (typeof current[part] !== 'object') {
      throw new Error(`Cannot set nested value: ${parts.slice(0, i + 1).join('.')} is not an object`);
    }
    current = current[part] as Record<string, unknown>;
  }

  current[parts[parts.length - 1]] = value;
}
