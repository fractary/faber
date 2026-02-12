/**
 * @fractary/faber - Default Configuration Values
 *
 * Hardcoded defaults for FABER configuration.
 * These values are used when not specified in the project config.
 */

import type { AutonomyLevel } from './types.js';

/**
 * Default paths for FABER artifacts and state
 */
export const FABER_PATHS = {
  /** Directory containing workflow manifest and definition files */
  workflows: '.fractary/faber/workflows',
  /** Directory for workflow run artifacts (logs, state, manifests) */
  runs: '.fractary/faber/runs',
  /** Project-level changelog file */
  changelog: '.fractary/changelog.ndjson',
} as const;

/**
 * Default logging configuration
 * These are hardcoded and no longer configurable via config file
 */
export const FABER_LOGGING = {
  /** Always use the logs plugin for workflow logging */
  useLogsPlugin: true,
  /** Log type for workflow executions */
  logType: 'workflow' as const,
  /** Default log level */
  logLevel: 'info' as const,
} as const;

/**
 * Default workflow settings
 */
export const FABER_WORKFLOW = {
  /** Default workflow ID when not specified */
  defaultWorkflow: 'default',
  /** Default autonomy level */
  autonomy: 'guarded' as AutonomyLevel,
} as const;

/**
 * Workflow manifest filename
 */
export const WORKFLOW_MANIFEST_FILENAME = 'workflows.yaml';

/**
 * Combined FABER defaults for easy access
 */
export const FABER_DEFAULTS = {
  logging: FABER_LOGGING,
  workflow: FABER_WORKFLOW,
  paths: FABER_PATHS,
  manifestFilename: WORKFLOW_MANIFEST_FILENAME,
} as const;
