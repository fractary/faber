/**
 * @fractary/faber - Configuration Initializer
 *
 * Provides utilities for initializing FABER configuration with sensible defaults.
 * Replaces the old initFaberConfig() and writeConfig() functions with a cleaner API.
 */

import * as fs from 'fs';
import * as path from 'path';
import * as yaml from 'js-yaml';
import { FaberConfig } from '../types.js';

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
}
