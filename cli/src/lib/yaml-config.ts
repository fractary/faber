/**
 * Unified YAML Configuration Loader for FABER CLI
 *
 * Loads and parses `.fractary/config.yaml` with environment variable substitution.
 * Provides access to shared configuration for FABER and fractary-core plugins.
 */

import * as fs from 'fs';
import * as path from 'path';
import * as yaml from 'js-yaml';

/**
 * Anthropic API configuration (shared)
 */
export interface AnthropicConfig {
  api_key?: string;
  model?: string;
  max_tokens?: number;
}

/**
 * GitHub App configuration
 */
export interface GitHubAppConfig {
  id: string;
  installation_id: string;
  private_key_path?: string;
  private_key_env_var?: string;
  created_via?: 'manifest-flow' | 'manual';
  created_at?: string;
}

/**
 * GitHub authentication configuration (shared)
 */
export interface GitHubConfig {
  token?: string;              // PAT (legacy)
  organization?: string;
  project?: string;
  repo?: string;
  app?: GitHubAppConfig;       // GitHub App (preferred)
}

/**
 * Worktree configuration
 */
export interface WorktreeConfig {
  location?: string;
  inherit_from_claude?: boolean;
}

/**
 * Workflow configuration
 */
export interface WorkflowConfig {
  default?: string;
  config_path?: string;
}

/**
 * Backlog management configuration
 */
export interface BacklogManagementConfig {
  default_limit?: number;
  default_order_by?: 'priority' | 'created' | 'updated' | 'none';
  priority_config?: {
    label_prefix?: string;
  };
}

/**
 * FABER-specific configuration
 */
export interface FaberConfig {
  worktree?: WorktreeConfig;
  workflow?: WorkflowConfig;
  backlog_management?: BacklogManagementConfig;
}

/**
 * Unified configuration structure for FABER and fractary-core plugins
 */
export interface UnifiedConfig {
  version: string;                    // "2.0"
  anthropic?: AnthropicConfig;        // Shared API key
  github?: GitHubConfig;              // Shared GitHub auth
  faber?: FaberConfig;                // FABER-specific settings
  work?: any;                         // Pass-through for work plugin
  repo?: any;                         // Pass-through for repo plugin
  logs?: any;                         // Pass-through for logs plugin
  file?: any;                         // Pass-through for file plugin
  spec?: any;                         // Pass-through for spec plugin
  docs?: any;                         // Pass-through for docs plugin
}

/**
 * Configuration loading options
 */
export interface ConfigLoadOptions {
  /** Project root directory (auto-detected if not provided) */
  projectRoot?: string;
  /** Warn about missing environment variables (default: true) */
  warnMissingEnvVars?: boolean;
  /** Throw error if config file doesn't exist (default: false) */
  throwIfMissing?: boolean;
}

/**
 * Load and parse `.fractary/config.yaml` with environment variable substitution
 *
 * @param options Configuration loading options
 * @returns Parsed configuration object or null if not found
 * @throws Error if config is invalid or throwIfMissing is true and file doesn't exist
 *
 * @example
 * ```typescript
 * const config = loadYamlConfig();
 * if (config?.github) {
 *   console.log('GitHub config:', config.github);
 * }
 * ```
 */
export function loadYamlConfig(options: ConfigLoadOptions = {}): UnifiedConfig | null {
  const {
    projectRoot,
    warnMissingEnvVars = true,
    throwIfMissing = false,
  } = options;

  const root = projectRoot || findProjectRoot();
  const configPath = path.join(root, '.fractary', 'config.yaml');

  if (!fs.existsSync(configPath)) {
    if (throwIfMissing) {
      throw new Error(
        `Configuration file not found at: ${configPath}\n` +
        `Run 'fractary-core:init' or 'fractary-faber migrate' to create it.`
      );
    }
    return null;
  }

  try {
    const content = fs.readFileSync(configPath, 'utf-8');
    const substituted = substituteEnvVars(content, warnMissingEnvVars);
    const parsed = yaml.load(substituted) as UnifiedConfig;

    // Validate basic structure
    if (!parsed || typeof parsed !== 'object') {
      throw new Error('Invalid configuration: must be a YAML object');
    }

    if (!parsed.version) {
      console.warn(`Warning: Configuration missing version field in ${configPath}`);
    }

    return parsed;
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`Failed to load config from ${configPath}: ${error.message}`);
    }
    throw error;
  }
}

/**
 * Write unified configuration to `.fractary/config.yaml`
 *
 * @param config Configuration object to write
 * @param projectRoot Project root directory (auto-detected if not provided)
 *
 * @example
 * ```typescript
 * writeYamlConfig({
 *   version: '2.0',
 *   github: {
 *     organization: 'myorg',
 *     project: 'myrepo'
 *   }
 * });
 * ```
 */
export function writeYamlConfig(
  config: UnifiedConfig,
  projectRoot?: string
): void {
  const root = projectRoot || findProjectRoot();
  const fractaryDir = path.join(root, '.fractary');
  const configPath = path.join(fractaryDir, 'config.yaml');

  // Ensure directory exists
  if (!fs.existsSync(fractaryDir)) {
    fs.mkdirSync(fractaryDir, { recursive: true });
  }

  // Convert to YAML with proper formatting
  const yamlContent = yaml.dump(config, {
    indent: 2,
    lineWidth: 100,
    noRefs: true,
    sortKeys: false,
  });

  fs.writeFileSync(configPath, yamlContent, 'utf-8');
}

/**
 * Substitute ${ENV_VAR} placeholders with actual environment variables
 *
 * Supports:
 * - ${VAR_NAME} - Replace with env var value
 * - ${VAR_NAME:-default} - Replace with env var value or default if not set
 *
 * Security: Default values are limited to 1000 characters to prevent abuse.
 * Variable names must match pattern: [A-Z_][A-Z0-9_]*
 *
 * @param content Content with environment variable placeholders
 * @param warnMissing Whether to warn about missing environment variables
 * @returns Content with substituted values
 *
 * @example
 * ```typescript
 * const content = 'token: ${GITHUB_TOKEN}';
 * const result = substituteEnvVars(content);
 * // result: 'token: ghp_xxxxx'
 * ```
 */
export function substituteEnvVars(content: string, warnMissing = true): string {
  // Input validation
  if (typeof content !== 'string') {
    throw new TypeError('Content must be a string');
  }

  // Maximum length for default values to prevent abuse
  const MAX_DEFAULT_LENGTH = 1000;

  return content.replace(
    /\$\{([A-Z_][A-Z0-9_]*)(:-([^}]+))?\}/g,
    (match, varName, _, defaultValue) => {
      // Validate variable name format
      if (!/^[A-Z_][A-Z0-9_]*$/.test(varName)) {
        console.warn(`Warning: Invalid environment variable name: ${varName}`);
        return match;
      }

      const value = process.env[varName];

      if (value !== undefined) {
        return value;
      }

      if (defaultValue !== undefined) {
        // Validate default value length
        if (defaultValue.length > MAX_DEFAULT_LENGTH) {
          console.warn(
            `Warning: Default value for ${varName} exceeds maximum length (${MAX_DEFAULT_LENGTH} chars). ` +
            `Truncating to prevent abuse.`
          );
          return defaultValue.substring(0, MAX_DEFAULT_LENGTH);
        }

        return defaultValue;
      }

      if (warnMissing) {
        console.warn(
          `Warning: Environment variable ${varName} not set. ` +
          `Using placeholder value.`
        );
      }

      // Keep original placeholder if no value found
      return match;
    }
  );
}

/**
 * Find project root by looking for .fractary directory or .git
 *
 * Walks up the directory tree from startDir until it finds:
 * - A directory containing `.fractary/`
 * - A directory containing `.git/`
 * - The filesystem root
 *
 * Security: Normalizes paths and prevents traversal outside filesystem boundaries.
 * Maximum of 100 directory levels to prevent infinite loops.
 *
 * @param startDir Directory to start searching from (default: current working directory)
 * @returns Project root directory (normalized absolute path)
 */
export function findProjectRoot(startDir: string = process.cwd()): string {
  // Input validation and normalization
  if (typeof startDir !== 'string') {
    throw new TypeError('startDir must be a string');
  }

  // Normalize and resolve to absolute path to prevent path traversal
  let currentDir = path.resolve(path.normalize(startDir));

  // Get filesystem root for comparison
  const fsRoot = path.parse(currentDir).root;

  // Safety limit: maximum 100 directory levels to prevent infinite loops
  const MAX_LEVELS = 100;
  let levels = 0;

  while (currentDir !== fsRoot && levels < MAX_LEVELS) {
    try {
      // Check for .fractary directory
      if (fs.existsSync(path.join(currentDir, '.fractary'))) {
        return currentDir;
      }

      // Check for .git directory
      if (fs.existsSync(path.join(currentDir, '.git'))) {
        return currentDir;
      }

      // Move up one directory
      const parentDir = path.dirname(currentDir);

      // Safety check: ensure we're actually moving up
      if (parentDir === currentDir) {
        // Reached filesystem root
        break;
      }

      currentDir = parentDir;
      levels++;
    } catch (error) {
      // Handle permission errors or invalid paths gracefully
      console.warn(`Warning: Error accessing directory ${currentDir}: ${error}`);
      break;
    }
  }

  if (levels >= MAX_LEVELS) {
    console.warn(`Warning: Exceeded maximum directory depth (${MAX_LEVELS} levels) while searching for project root`);
  }

  // If no marker found, return the normalized starting directory
  return path.resolve(path.normalize(startDir));
}

/**
 * Check if a valid configuration file exists
 *
 * @param projectRoot Project root directory (auto-detected if not provided)
 * @returns true if config exists at .fractary/config.yaml
 */
export function configExists(projectRoot?: string): boolean {
  const root = projectRoot || findProjectRoot();
  const configPath = path.join(root, '.fractary', 'config.yaml');
  return fs.existsSync(configPath);
}

/**
 * Get the configuration file path
 *
 * @param projectRoot Project root directory (auto-detected if not provided)
 * @returns Full path to configuration file
 */
export function getConfigPath(projectRoot?: string): string {
  const root = projectRoot || findProjectRoot();
  return path.join(root, '.fractary', 'config.yaml');
}

/**
 * Check if old settings.json exists (for migration)
 *
 * @param projectRoot Project root directory (auto-detected if not provided)
 * @returns true if old settings.json exists
 */
export function oldSettingsExists(projectRoot?: string): boolean {
  const root = projectRoot || findProjectRoot();
  const settingsPath = path.join(root, '.fractary', 'settings.json');
  return fs.existsSync(settingsPath);
}

/**
 * Get the old settings.json file path
 *
 * @param projectRoot Project root directory (auto-detected if not provided)
 * @returns Full path to old settings.json file
 */
export function getOldSettingsPath(projectRoot?: string): string {
  const root = projectRoot || findProjectRoot();
  return path.join(root, '.fractary', 'settings.json');
}
