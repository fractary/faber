/**
 * @fractary/faber - Configuration Initializer
 *
 * Provides utilities for initializing FABER configuration with sensible defaults.
 * Replaces the old initFaberConfig() and writeConfig() functions with a cleaner API.
 */

import * as fs from 'fs';
import * as path from 'path';
import * as yaml from 'js-yaml';
import type { FaberConfig, FaberPluginConfig, AutonomyLevel } from '../types.js';
import { FABER_DEFAULTS } from '../defaults.js';

/**
 * Result of a configuration migration operation
 */
export interface MigrationResult {
  migrated: boolean;
  oldPath?: string;
  newPath?: string;
  error?: string;
}

/**
 * Options for generating plugin configuration
 */
export interface PluginConfigOptions {
  /** Directory containing workflow files and manifest */
  workflowsPath?: string;
  /** Default workflow ID */
  defaultWorkflow?: string;
  /** Autonomy level */
  autonomy?: AutonomyLevel;
  /** Directory for run artifacts */
  runsPath?: string;
}

/**
 * ConfigInitializer class for generating and managing FABER configuration
 */
export class ConfigInitializer {
  /**
   * Default configuration file name (YAML format)
   */
  private static readonly CONFIG_FILENAME = 'config.yaml';

  /**
   * Default configuration path relative to project root
   */
  private static readonly DEFAULT_CONFIG_PATH = '.fractary/faber';

  /**
   * Legacy configuration path for backward compatibility
   */
  private static readonly LEGACY_CONFIG_PATH = '.fractary/plugins/faber';

  /**
   * Generate a complete FaberConfig with sensible defaults
   *
   * @returns Complete FaberConfig object with all sections populated
   */
  static generateDefaultConfig(): FaberConfig {
    return {
      schema_version: '1.0',

      work: {
        platform: 'github',
      },

      repo: {
        platform: 'github',
        owner: '',
        repo: '',
        defaultBranch: 'main',
      },

      artifacts: {
        specs: {
          use_codex: false,
          local_path: '/specs',
        },
        logs: {
          use_codex: false,
          local_path: '.fractary/logs',
        },
        state: {
          use_codex: false,
          local_path: '.fractary/faber',
        },
      },

      workflow: {
        autonomy: 'guarded',
        phases: {
          frame: {
            enabled: true,
          },
          architect: {
            enabled: true,
            refineSpec: true,
          },
          build: {
            enabled: true,
          },
          evaluate: {
            enabled: true,
            maxRetries: 3,
          },
          release: {
            enabled: true,
            requestReviews: false,
            reviewers: [],
          },
        },
      },
    };
  }

  /**
   * Write configuration to a YAML file
   *
   * @param config - FaberConfig object to write
   * @param configPath - Optional custom path (defaults to .fractary/plugins/faber/config.yaml)
   */
  static writeConfig(config: FaberConfig, configPath?: string): void {
    const fullPath = configPath || this.getDefaultConfigPath();

    // Ensure parent directory exists
    const dir = path.dirname(fullPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    // Serialize to YAML
    const yamlContent = yaml.dump(config, {
      indent: 2,
      lineWidth: 120,
      noRefs: true,
      sortKeys: false,
    });

    // Write file
    fs.writeFileSync(fullPath, yamlContent, 'utf-8');
  }

  /**
   * Check if configuration file exists
   *
   * @param configPath - Optional custom path to check
   * @returns true if config exists, false otherwise
   */
  static configExists(configPath?: string): boolean {
    const fullPath = configPath || this.getDefaultConfigPath();

    // Check new location (YAML and JSON)
    if (fs.existsSync(fullPath)) {
      return true;
    }

    const jsonPath = fullPath.replace(/\.yaml$/, '.json');
    if (fs.existsSync(jsonPath)) {
      return true;
    }

    // Check legacy location (only if using default path)
    if (!configPath) {
      const root = process.cwd();
      const legacyYamlPath = path.join(root, this.LEGACY_CONFIG_PATH, this.CONFIG_FILENAME);
      if (fs.existsSync(legacyYamlPath)) {
        return true;
      }
      const legacyJsonPath = legacyYamlPath.replace('.yaml', '.json');
      if (fs.existsSync(legacyJsonPath)) {
        return true;
      }
    }

    return false;
  }

  /**
   * Read configuration from file (supports both YAML and JSON)
   *
   * @param configPath - Optional custom path to read from
   * @returns FaberConfig object or null if file doesn't exist
   */
  static readConfig(configPath?: string): FaberConfig | null {
    const fullPath = configPath || this.getDefaultConfigPath();

    // Try YAML first (preferred format)
    if (fs.existsSync(fullPath)) {
      try {
        const content = fs.readFileSync(fullPath, 'utf-8');
        const config = yaml.load(content) as FaberConfig;
        return config;
      } catch (error) {
        throw new Error(`Failed to parse YAML config at ${fullPath}: ${error}`);
      }
    }

    // Try legacy JSON format
    const jsonPath = fullPath.replace(/\.yaml$/, '.json');
    if (fs.existsSync(jsonPath)) {
      try {
        const content = fs.readFileSync(jsonPath, 'utf-8');
        const config = JSON.parse(content) as FaberConfig;
        return config;
      } catch (error) {
        throw new Error(`Failed to parse JSON config at ${jsonPath}: ${error}`);
      }
    }

    return null;
  }

  /**
   * Get the default configuration file path
   *
   * @param projectRoot - Optional project root directory
   * @returns Full path to default config file
   */
  static getDefaultConfigPath(projectRoot?: string): string {
    const root = projectRoot || process.cwd();
    return path.join(root, this.DEFAULT_CONFIG_PATH, this.CONFIG_FILENAME);
  }

  /**
   * Migrate configuration from legacy location to new location
   *
   * @param projectRoot - Optional project root directory
   * @returns MigrationResult object with migration status and paths
   */
  static migrateConfig(projectRoot?: string): MigrationResult {
    const root = projectRoot || process.cwd();
    const oldConfigDir = path.join(root, this.LEGACY_CONFIG_PATH);
    const newConfigDir = path.join(root, this.DEFAULT_CONFIG_PATH);

    // Find source config (YAML preferred, then JSON)
    const oldYamlPath = path.join(oldConfigDir, this.CONFIG_FILENAME);
    const oldJsonPath = oldYamlPath.replace('.yaml', '.json');
    const newYamlPath = path.join(newConfigDir, this.CONFIG_FILENAME);

    let sourceFile: string | null = null;
    if (fs.existsSync(oldYamlPath)) {
      sourceFile = oldYamlPath;
    } else if (fs.existsSync(oldJsonPath)) {
      sourceFile = oldJsonPath;
    }

    if (!sourceFile) {
      return { migrated: false }; // Nothing to migrate
    }

    // Check if new config already exists
    if (fs.existsSync(newYamlPath)) {
      return {
        migrated: false,
        error: 'Config exists at both old and new locations. Please manually merge and delete old config.',
      };
    }

    try {
      // Read old config
      const config = this.readConfig(sourceFile);
      if (!config) {
        return { migrated: false, error: 'Failed to read old config' };
      }

      // Write to new location (always YAML)
      this.writeConfig(config, newYamlPath);

      // Delete old config files
      if (fs.existsSync(oldYamlPath)) fs.unlinkSync(oldYamlPath);
      if (fs.existsSync(oldJsonPath)) fs.unlinkSync(oldJsonPath);

      // Try to remove old directory if empty
      try {
        fs.rmdirSync(oldConfigDir);
      } catch {
        // Directory not empty, that's fine
      }

      return {
        migrated: true,
        oldPath: sourceFile,
        newPath: newYamlPath,
      };
    } catch (error) {
      return {
        migrated: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Initialize a new FABER project with default configuration
   *
   * @param projectRoot - Optional project root directory
   * @param options - Optional configuration overrides
   * @returns Path to the created configuration file
   */
  static initializeProject(
    projectRoot?: string,
    options?: {
      repoOwner?: string;
      repoName?: string;
      workPlatform?: 'github' | 'jira' | 'linear';
      repoPlatform?: 'github' | 'gitlab' | 'bitbucket';
    }
  ): string {
    // 1. Attempt migration first
    const migrationResult = this.migrateConfig(projectRoot);

    if (migrationResult.migrated) {
      console.log(`✓ Migrated config from ${migrationResult.oldPath}`);
      console.log(`  to ${migrationResult.newPath}`);
      return migrationResult.newPath!;
    }

    if (migrationResult.error) {
      console.warn(`Migration warning: ${migrationResult.error}`);
    }

    // 2. Check if config exists at new location
    const configPath = this.getDefaultConfigPath(projectRoot);
    if (this.configExists(configPath)) {
      console.log(`Config already exists at ${configPath}`);
      return configPath;
    }

    // 3. Generate and write new config (existing logic)
    const config = this.generateDefaultConfig();

    // Apply optional overrides
    if (options) {
      if (options.repoOwner) {
        config.repo.owner = options.repoOwner;
      }
      if (options.repoName) {
        config.repo.repo = options.repoName;
      }
      if (options.workPlatform) {
        config.work.platform = options.workPlatform;
      }
      if (options.repoPlatform) {
        config.repo.platform = options.repoPlatform;
      }
    }

    this.writeConfig(config, configPath);

    return configPath;
  }

  // ==========================================================================
  // Plugin Configuration (Simplified v2)
  // ==========================================================================

  /**
   * Unified config file path
   */
  private static readonly UNIFIED_CONFIG_PATH = '.fractary/config.yaml';

  /**
   * Generate simplified FABER plugin configuration (v2)
   *
   * This generates the minimal config stored in .fractary/config.yaml under 'faber:' section.
   *
   * @param options - Configuration options
   * @returns FaberPluginConfig object
   */
  static generatePluginConfig(options?: PluginConfigOptions): FaberPluginConfig {
    return {
      workflows: {
        path: options?.workflowsPath ?? FABER_DEFAULTS.paths.workflows,
        default: options?.defaultWorkflow ?? FABER_DEFAULTS.workflow.defaultWorkflow,
        autonomy: options?.autonomy ?? FABER_DEFAULTS.workflow.autonomy,
      },
      runs: {
        path: options?.runsPath ?? FABER_DEFAULTS.paths.runs,
      },
    };
  }

  /**
   * Write plugin configuration to unified config file
   *
   * This writes/updates the 'faber:' section in .fractary/config.yaml,
   * preserving other sections in the file.
   *
   * @param config - FaberPluginConfig to write
   * @param projectRoot - Optional project root directory
   */
  static writePluginConfig(config: FaberPluginConfig, projectRoot?: string): void {
    const root = projectRoot || process.cwd();
    const configPath = path.join(root, this.UNIFIED_CONFIG_PATH);
    const configDir = path.dirname(configPath);

    // Ensure directory exists
    if (!fs.existsSync(configDir)) {
      fs.mkdirSync(configDir, { recursive: true });
    }

    // Load existing config or create empty
    let existingConfig: Record<string, unknown> = {};
    if (fs.existsSync(configPath)) {
      try {
        const content = fs.readFileSync(configPath, 'utf-8');
        existingConfig = (yaml.load(content) as Record<string, unknown>) || {};
      } catch {
        // If file is corrupted, start fresh
        existingConfig = {};
      }
    }

    // Update only the faber section (surgical edit)
    existingConfig['faber'] = config;

    // Write back
    const yamlContent = yaml.dump(existingConfig, {
      indent: 2,
      lineWidth: 100,
      noRefs: true,
      sortKeys: false,
    });

    fs.writeFileSync(configPath, yamlContent, 'utf-8');
  }

  /**
   * Read plugin configuration from unified config file
   *
   * @param projectRoot - Optional project root directory
   * @returns FaberPluginConfig or null if not found
   */
  static readPluginConfig(projectRoot?: string): FaberPluginConfig | null {
    const root = projectRoot || process.cwd();
    const configPath = path.join(root, this.UNIFIED_CONFIG_PATH);

    if (!fs.existsSync(configPath)) {
      return null;
    }

    try {
      const content = fs.readFileSync(configPath, 'utf-8');
      const config = yaml.load(content) as Record<string, unknown>;
      const faber = config?.['faber'] as FaberPluginConfig | undefined;
      return faber || null;
    } catch {
      return null;
    }
  }

  /**
   * Migrate legacy config format to new simplified format
   *
   * Reads old format and converts to new FaberPluginConfig format.
   *
   * @param projectRoot - Optional project root directory
   * @returns Migration result
   */
  static migratePluginConfig(projectRoot?: string): MigrationResult {
    const root = projectRoot || process.cwd();
    const configPath = path.join(root, this.UNIFIED_CONFIG_PATH);

    if (!fs.existsSync(configPath)) {
      return { migrated: false, error: 'Config file not found' };
    }

    try {
      const content = fs.readFileSync(configPath, 'utf-8');
      const config = yaml.load(content) as Record<string, unknown>;
      const faber = config?.['faber'] as Record<string, unknown> | undefined;

      if (!faber) {
        return { migrated: false, error: 'No faber section found' };
      }

      // Check if already in new format
      if (faber['workflows'] && typeof faber['workflows'] === 'object' && !Array.isArray(faber['workflows'])) {
        return { migrated: false }; // Already migrated
      }

      // Detect legacy format
      const isLegacy =
        Array.isArray(faber['workflows']) ||
        (faber['workflow'] as Record<string, unknown> | undefined)?.['config_path'] ||
        faber['state'] ||
        faber['logging'];

      if (!isLegacy) {
        return { migrated: false }; // Not legacy format
      }

      // Extract values from legacy format
      const workflow = faber['workflow'] as Record<string, unknown> | undefined;
      const state = faber['state'] as Record<string, unknown> | undefined;

      const newConfig: FaberPluginConfig = {
        workflows: {
          path: (workflow?.['config_path'] as string) || FABER_DEFAULTS.paths.workflows,
          default: FABER_DEFAULTS.workflow.defaultWorkflow,
          autonomy: (workflow?.['autonomy'] as AutonomyLevel) || FABER_DEFAULTS.workflow.autonomy,
        },
        runs: {
          path: (state?.['runs_dir'] as string) || FABER_DEFAULTS.paths.runs,
        },
      };

      // Backup old config
      const backupDir = path.join(root, '.fractary/backups');
      if (!fs.existsSync(backupDir)) {
        fs.mkdirSync(backupDir, { recursive: true });
      }
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const backupPath = path.join(backupDir, `config-${timestamp}.yaml`);
      fs.copyFileSync(configPath, backupPath);

      // Update config with new format
      config['faber'] = newConfig;

      // Write updated config
      const yamlContent = yaml.dump(config, {
        indent: 2,
        lineWidth: 100,
        noRefs: true,
        sortKeys: false,
      });
      fs.writeFileSync(configPath, yamlContent, 'utf-8');

      return {
        migrated: true,
        oldPath: backupPath,
        newPath: configPath,
      };
    } catch (error) {
      return {
        migrated: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Initialize plugin configuration with workflow manifest
   *
   * Creates:
   * - .fractary/config.yaml (faber: section)
   * - .fractary/faber/workflows/workflows.yaml (manifest)
   * - .fractary/faber/workflows/ directory
   * - .fractary/faber/runs/ directory
   *
   * @param projectRoot - Optional project root directory
   * @param options - Configuration options
   * @returns Path to created config file
   */
  static initializePluginConfig(
    projectRoot?: string,
    options?: PluginConfigOptions
  ): string {
    const root = projectRoot || process.cwd();

    // Generate config
    const config = this.generatePluginConfig(options);

    // Resolve paths
    const workflowsPath = config.workflows?.path || FABER_DEFAULTS.paths.workflows;
    const runsPath = config.runs?.path || FABER_DEFAULTS.paths.runs;
    const workflowsDir = path.isAbsolute(workflowsPath)
      ? workflowsPath
      : path.join(root, workflowsPath);
    const runsDir = path.isAbsolute(runsPath)
      ? runsPath
      : path.join(root, runsPath);

    // Create directories
    fs.mkdirSync(workflowsDir, { recursive: true });
    fs.mkdirSync(runsDir, { recursive: true });

    // Write plugin config
    this.writePluginConfig(config, root);

    // Create workflow manifest if it doesn't exist
    const manifestPath = path.join(workflowsDir, FABER_DEFAULTS.manifestFilename);
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
# Schema: https://fractary.dev/schemas/workflow-registry.schema.json

${yaml.dump(manifest, { indent: 2, lineWidth: 100 })}`;

      fs.writeFileSync(manifestPath, manifestContent, 'utf-8');
    }

    return path.join(root, this.UNIFIED_CONFIG_PATH);
  }
}
