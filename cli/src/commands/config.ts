/**
 * Config command - Read FABER configuration from unified config.yaml
 *
 * This command provides access to configuration values for scripts and tools.
 * It uses the SDK's config loading logic, ensuring consistency across all tools.
 */

import { Command } from 'commander';
import {
  loadYamlConfig,
  configExists,
  getConfigPath,
} from '../lib/yaml-config.js';

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

  return configCmd;
}
