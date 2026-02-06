/**
 * @fractary/faber - Configuration Validator
 *
 * Validates the faber: section of .fractary/config.yaml.
 * Only validates FABER-specific configuration — top-level structure
 * (version, anthropic, github) is validated by @fractary/core.
 */

import * as fs from 'fs';
import * as path from 'path';
import * as yaml from 'js-yaml';
import type { FaberPluginConfig, AutonomyLevel } from '../types.js';
import { FABER_DEFAULTS } from '../defaults.js';

/**
 * Severity level for validation findings
 */
export type ValidationSeverity = 'error' | 'warning' | 'info';

/**
 * A single validation finding
 */
export interface ValidationFinding {
  severity: ValidationSeverity;
  field?: string;
  message: string;
  suggestion?: string;
}

/**
 * Result of a validation operation
 */
export interface ValidationResult {
  valid: boolean;
  findings: ValidationFinding[];
}

/**
 * Valid autonomy levels
 */
const VALID_AUTONOMY_LEVELS: AutonomyLevel[] = ['dry-run', 'assisted', 'guarded', 'autonomous'];

/**
 * ConfigValidator — validates the faber: section of unified config.yaml
 *
 * Responsibilities:
 * - Check that required faber fields exist
 * - Validate autonomy level values
 * - Check that referenced directories exist
 * - Detect deprecated fields and suggest migration
 * - Verify workflow manifest presence
 */
export class ConfigValidator {
  /**
   * Validate the faber: section from a loaded unified config object.
   *
   * @param unifiedConfig - The full parsed config.yaml object
   * @param projectRoot - Project root for resolving relative paths
   * @returns ValidationResult with all findings
   */
  static validate(
    unifiedConfig: Record<string, unknown>,
    projectRoot: string,
  ): ValidationResult {
    const findings: ValidationFinding[] = [];

    const faber = unifiedConfig['faber'] as Record<string, unknown> | undefined;

    if (!faber) {
      findings.push({
        severity: 'error',
        field: 'faber',
        message: 'Missing faber section in config.yaml',
        suggestion: 'Run: fractary-faber config init',
      });
      return { valid: false, findings };
    }

    // Check for deprecated fields
    this.checkDeprecatedFields(faber, findings);

    // Validate new-format fields
    this.validateWorkflows(faber, projectRoot, findings);
    this.validateRuns(faber, projectRoot, findings);

    const hasErrors = findings.some((f) => f.severity === 'error');
    return { valid: !hasErrors, findings };
  }

  /**
   * Validate by loading config.yaml from disk.
   *
   * @param projectRoot - Project root directory
   * @returns ValidationResult
   */
  static validateFromDisk(projectRoot: string): ValidationResult {
    const configPath = path.join(projectRoot, '.fractary', 'config.yaml');

    if (!fs.existsSync(configPath)) {
      return {
        valid: false,
        findings: [
          {
            severity: 'error',
            message: `Configuration file not found at: ${configPath}`,
            suggestion: 'Run: fractary-faber config init',
          },
        ],
      };
    }

    let rawConfig: Record<string, unknown>;
    try {
      const content = fs.readFileSync(configPath, 'utf-8');
      rawConfig = (yaml.load(content) as Record<string, unknown>) || {};
    } catch (error) {
      return {
        valid: false,
        findings: [
          {
            severity: 'error',
            message: `Failed to parse config.yaml: ${error instanceof Error ? error.message : String(error)}`,
          },
        ],
      };
    }

    return this.validate(rawConfig, projectRoot);
  }

  /**
   * Validate a FaberPluginConfig object directly (e.g. before writing).
   *
   * @param config - The plugin config to validate
   * @param projectRoot - Project root for resolving relative paths (optional, skips path checks if omitted)
   * @returns ValidationResult
   */
  static validatePluginConfig(
    config: FaberPluginConfig,
    projectRoot?: string,
  ): ValidationResult {
    const findings: ValidationFinding[] = [];

    // Validate autonomy
    if (config.workflows?.autonomy) {
      if (!VALID_AUTONOMY_LEVELS.includes(config.workflows.autonomy)) {
        findings.push({
          severity: 'error',
          field: 'faber.workflows.autonomy',
          message: `Invalid autonomy level: ${config.workflows.autonomy}`,
          suggestion: `Valid values: ${VALID_AUTONOMY_LEVELS.join(', ')}`,
        });
      }
    }

    // Validate paths if projectRoot provided
    if (projectRoot) {
      const workflowsPath = config.workflows?.path || FABER_DEFAULTS.paths.workflows;
      const runsPath = config.runs?.path || FABER_DEFAULTS.paths.runs;

      this.checkDirectoryExists(workflowsPath, 'faber.workflows.path', projectRoot, findings);
      this.checkDirectoryExists(runsPath, 'faber.runs.path', projectRoot, findings);

      // Check workflow manifest
      const workflowsDir = path.isAbsolute(workflowsPath)
        ? workflowsPath
        : path.join(projectRoot, workflowsPath);
      const manifestPath = path.join(workflowsDir, FABER_DEFAULTS.manifestFilename);
      if (fs.existsSync(workflowsDir) && !fs.existsSync(manifestPath)) {
        findings.push({
          severity: 'warning',
          field: 'workflows.yaml',
          message: `Workflow manifest not found: ${manifestPath}`,
          suggestion: 'Run: fractary-faber config init to create it',
        });
      }
    }

    const hasErrors = findings.some((f) => f.severity === 'error');
    return { valid: !hasErrors, findings };
  }

  // ---- Private helpers ----

  private static checkDeprecatedFields(
    faber: Record<string, unknown>,
    findings: ValidationFinding[],
  ): void {
    if (Array.isArray(faber['workflows'])) {
      findings.push({
        severity: 'warning',
        field: 'faber.workflows',
        message: 'Using deprecated workflows array format',
        suggestion: 'Run: fractary-faber config migrate',
      });
    }

    const workflow = faber['workflow'] as Record<string, unknown> | undefined;
    if (workflow?.['config_path']) {
      findings.push({
        severity: 'warning',
        field: 'faber.workflow.config_path',
        message: 'Using deprecated workflow.config_path',
        suggestion: 'Run: fractary-faber config migrate',
      });
    }

    if (faber['repository']) {
      findings.push({
        severity: 'warning',
        field: 'faber.repository',
        message: 'Using deprecated repository section',
        suggestion: 'Run: fractary-faber config migrate',
      });
    }

    if (faber['logging']) {
      findings.push({
        severity: 'warning',
        field: 'faber.logging',
        message: 'Using deprecated logging section',
        suggestion: 'Run: fractary-faber config migrate',
      });
    }

    if (faber['state']) {
      findings.push({
        severity: 'warning',
        field: 'faber.state',
        message: 'Using deprecated state section',
        suggestion: 'Run: fractary-faber config migrate',
      });
    }
  }

  private static validateWorkflows(
    faber: Record<string, unknown>,
    projectRoot: string,
    findings: ValidationFinding[],
  ): void {
    const workflows = faber['workflows'] as Record<string, unknown> | undefined;

    // Skip if it's the deprecated array format (already flagged)
    if (Array.isArray(workflows)) return;

    if (workflows && typeof workflows === 'object') {
      const autonomy = workflows['autonomy'] as string | undefined;
      if (autonomy && !VALID_AUTONOMY_LEVELS.includes(autonomy as AutonomyLevel)) {
        findings.push({
          severity: 'error',
          field: 'faber.workflows.autonomy',
          message: `Invalid autonomy level: ${autonomy}`,
          suggestion: `Valid values: ${VALID_AUTONOMY_LEVELS.join(', ')}`,
        });
      }

      const workflowsPath = (workflows['path'] as string) || FABER_DEFAULTS.paths.workflows;
      this.checkDirectoryExists(workflowsPath, 'faber.workflows.path', projectRoot, findings);

      // Check workflow manifest
      const workflowsDir = path.isAbsolute(workflowsPath)
        ? workflowsPath
        : path.join(projectRoot, workflowsPath);
      const manifestPath = path.join(workflowsDir, FABER_DEFAULTS.manifestFilename);
      if (fs.existsSync(workflowsDir) && !fs.existsSync(manifestPath)) {
        findings.push({
          severity: 'warning',
          field: 'workflows.yaml',
          message: `Workflow manifest not found: ${manifestPath}`,
          suggestion: 'Run: fractary-faber config init to create it',
        });
      }
    }
  }

  private static validateRuns(
    faber: Record<string, unknown>,
    projectRoot: string,
    findings: ValidationFinding[],
  ): void {
    const runs = faber['runs'] as Record<string, unknown> | undefined;
    if (runs && typeof runs === 'object') {
      const runsPath = (runs['path'] as string) || FABER_DEFAULTS.paths.runs;
      this.checkDirectoryExists(runsPath, 'faber.runs.path', projectRoot, findings);
    }
  }

  private static checkDirectoryExists(
    dirPath: string,
    fieldName: string,
    projectRoot: string,
    findings: ValidationFinding[],
  ): void {
    const resolved = path.isAbsolute(dirPath)
      ? dirPath
      : path.join(projectRoot, dirPath);

    if (!fs.existsSync(resolved)) {
      findings.push({
        severity: 'warning',
        field: fieldName,
        message: `Directory does not exist: ${resolved}`,
        suggestion: 'Run: fractary-faber config init to create it',
      });
    }
  }
}
