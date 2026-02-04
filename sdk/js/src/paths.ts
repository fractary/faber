/**
 * Centralized path definitions for FABER
 *
 * This module provides the single source of truth for all FABER run-related paths.
 * All run files (plan.json, state.json) are stored in a unified directory structure:
 * .fractary/faber/runs/{run_id}/
 *
 * These paths are committable (not gitignored) to enable:
 * - Workflow state persistence across sessions
 * - Team visibility into workflow progress
 * - Historical tracking of workflow runs
 */

import * as path from 'path';

/**
 * Base directory for all FABER runs (relative to project root)
 */
export const FABER_RUNS_DIR = '.fractary/faber/runs';

/**
 * Get the runs directory path
 * @param projectRoot - Optional project root path (defaults to current working directory)
 * @returns Absolute path to the runs directory
 */
export function getRunsDir(projectRoot?: string): string {
  const root = projectRoot || process.cwd();
  return path.join(root, FABER_RUNS_DIR);
}

/**
 * Get the directory path for a specific run
 * @param runId - The run identifier
 * @param projectRoot - Optional project root path (defaults to current working directory)
 * @returns Absolute path to the run directory
 */
export function getRunDir(runId: string, projectRoot?: string): string {
  const root = projectRoot || process.cwd();
  return path.join(root, FABER_RUNS_DIR, runId);
}

/**
 * Get the plan file path for a specific run
 * @param runId - The run identifier
 * @param projectRoot - Optional project root path (defaults to current working directory)
 * @returns Absolute path to the plan.json file
 */
export function getPlanPath(runId: string, projectRoot?: string): string {
  return path.join(getRunDir(runId, projectRoot), 'plan.json');
}

/**
 * Get the state file path for a specific run
 * @param runId - The run identifier
 * @param projectRoot - Optional project root path (defaults to current working directory)
 * @returns Absolute path to the state.json file
 */
export function getStatePath(runId: string, projectRoot?: string): string {
  return path.join(getRunDir(runId, projectRoot), 'state.json');
}

/**
 * Get relative path constants (for documentation and gitignore)
 */
export const RELATIVE_PATHS = {
  /** Relative path to runs directory from project root */
  RUNS_DIR: FABER_RUNS_DIR,
  /** Template for run directory path */
  RUN_DIR_TEMPLATE: `${FABER_RUNS_DIR}/{run_id}`,
  /** Template for plan file path */
  PLAN_PATH_TEMPLATE: `${FABER_RUNS_DIR}/{run_id}/plan.json`,
  /** Template for state file path */
  STATE_PATH_TEMPLATE: `${FABER_RUNS_DIR}/{run_id}/state.json`,
} as const;
