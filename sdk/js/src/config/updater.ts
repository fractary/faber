/**
 * @fractary/faber - Configuration Updater
 *
 * Handles safe updates to the faber: section of .fractary/config.yaml.
 * Provides backup, preview, apply, and rollback capabilities.
 */

import * as fs from 'fs';
import * as path from 'path';
import * as yaml from 'js-yaml';
import { ConfigValidator } from './validator.js';

/**
 * A single field change to apply
 */
export interface ConfigChange {
  /** Dot-notation key path relative to the faber section (e.g. "workflows.autonomy") */
  key: string;
  /** The new value to set */
  value: unknown;
}

/**
 * Preview of a change showing current vs proposed value
 */
export interface ChangePreview {
  key: string;
  currentValue: unknown;
  proposedValue: unknown;
}

/**
 * Result of an update operation
 */
export interface UpdateResult {
  success: boolean;
  backupPath?: string;
  changes: ChangePreview[];
  error?: string;
}

/**
 * ConfigUpdater — safe updates to the faber: section of config.yaml
 *
 * Responsibilities:
 * - Create timestamped backups before any change
 * - Preview changes (current vs proposed)
 * - Apply one or more field changes atomically
 * - Validate after applying
 * - Provide backup path for rollback
 */
export class ConfigUpdater {
  private static readonly UNIFIED_CONFIG_PATH = '.fractary/config.yaml';
  private static readonly BACKUP_DIR = '.fractary/backups';

  /**
   * Preview changes without applying them.
   *
   * @param changes - Array of changes to preview
   * @param projectRoot - Project root directory
   * @returns Array of ChangePreview objects showing current vs proposed values
   */
  static previewChanges(
    changes: ConfigChange[],
    projectRoot: string,
  ): ChangePreview[] {
    const configPath = path.join(projectRoot, this.UNIFIED_CONFIG_PATH);
    const config = this.loadRawConfig(configPath);
    const faber = (config?.['faber'] as Record<string, unknown>) || {};

    return changes.map((change) => ({
      key: change.key,
      currentValue: this.getNestedValue(faber, change.key),
      proposedValue: change.value,
    }));
  }

  /**
   * Apply changes to the faber: section with backup and validation.
   *
   * @param changes - Array of changes to apply
   * @param projectRoot - Project root directory
   * @returns UpdateResult with backup path and applied changes
   */
  static applyChanges(
    changes: ConfigChange[],
    projectRoot: string,
  ): UpdateResult {
    const configPath = path.join(projectRoot, this.UNIFIED_CONFIG_PATH);

    if (!fs.existsSync(configPath)) {
      return {
        success: false,
        changes: [],
        error: `Configuration file not found: ${configPath}`,
      };
    }

    // Create backup
    const backupPath = this.createBackup(projectRoot);

    // Load full config
    const config = this.loadRawConfig(configPath);
    if (!config) {
      return {
        success: false,
        backupPath,
        changes: [],
        error: 'Failed to load configuration',
      };
    }

    // Ensure faber section exists
    if (!config['faber']) {
      config['faber'] = {};
    }
    const faber = config['faber'] as Record<string, unknown>;

    // Build previews and apply
    const previews: ChangePreview[] = [];
    for (const change of changes) {
      previews.push({
        key: change.key,
        currentValue: this.getNestedValue(faber, change.key),
        proposedValue: change.value,
      });
      this.setNestedValue(faber, change.key, change.value);
    }

    // Validate the resulting config before writing
    const validation = ConfigValidator.validate(config, projectRoot);
    const validationErrors = validation.findings.filter((f) => f.severity === 'error');
    if (validationErrors.length > 0) {
      // Restore from backup
      fs.copyFileSync(backupPath, configPath);
      return {
        success: false,
        backupPath,
        changes: previews,
        error: `Validation failed after applying changes: ${validationErrors.map((e) => e.message).join('; ')}`,
      };
    }

    // Write updated config
    const yamlContent = yaml.dump(config, {
      indent: 2,
      lineWidth: 100,
      noRefs: true,
      sortKeys: false,
    });
    fs.writeFileSync(configPath, yamlContent, 'utf-8');

    return {
      success: true,
      backupPath,
      changes: previews,
    };
  }

  /**
   * Create a timestamped backup of config.yaml.
   *
   * @param projectRoot - Project root directory
   * @returns Path to the backup file
   */
  static createBackup(projectRoot: string): string {
    const configPath = path.join(projectRoot, this.UNIFIED_CONFIG_PATH);
    const backupDir = path.join(projectRoot, this.BACKUP_DIR);

    fs.mkdirSync(backupDir, { recursive: true });

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupPath = path.join(backupDir, `config-${timestamp}.yaml`);
    fs.copyFileSync(configPath, backupPath);

    return backupPath;
  }

  /**
   * Restore config.yaml from a backup file.
   *
   * @param backupPath - Path to the backup file
   * @param projectRoot - Project root directory
   * @returns true if restore succeeded
   */
  static restoreFromBackup(backupPath: string, projectRoot: string): boolean {
    const configPath = path.join(projectRoot, this.UNIFIED_CONFIG_PATH);

    if (!fs.existsSync(backupPath)) {
      return false;
    }

    fs.copyFileSync(backupPath, configPath);
    return true;
  }

  /**
   * List available backup files sorted by most recent first.
   *
   * @param projectRoot - Project root directory
   * @returns Array of backup file paths
   */
  static listBackups(projectRoot: string): string[] {
    const backupDir = path.join(projectRoot, this.BACKUP_DIR);

    if (!fs.existsSync(backupDir)) {
      return [];
    }

    return fs
      .readdirSync(backupDir)
      .filter((f) => f.startsWith('config-') && f.endsWith('.yaml'))
      .sort()
      .reverse()
      .map((f) => path.join(backupDir, f));
  }

  // ---- Private helpers ----

  private static loadRawConfig(configPath: string): Record<string, unknown> | null {
    try {
      const content = fs.readFileSync(configPath, 'utf-8');
      return (yaml.load(content) as Record<string, unknown>) || {};
    } catch {
      return null;
    }
  }

  private static getNestedValue(obj: Record<string, unknown>, keyPath: string): unknown {
    const parts = keyPath.split('.');
    let current: unknown = obj;

    for (const part of parts) {
      if (current === null || current === undefined || typeof current !== 'object') {
        return undefined;
      }
      current = (current as Record<string, unknown>)[part];
    }

    return current;
  }

  private static setNestedValue(
    obj: Record<string, unknown>,
    keyPath: string,
    value: unknown,
  ): void {
    const parts = keyPath.split('.');
    let current = obj;

    for (let i = 0; i < parts.length - 1; i++) {
      const part = parts[i];
      if (current[part] === undefined || current[part] === null) {
        current[part] = {};
      }
      if (typeof current[part] !== 'object') {
        current[part] = {};
      }
      current = current[part] as Record<string, unknown>;
    }

    current[parts[parts.length - 1]] = value;
  }
}
