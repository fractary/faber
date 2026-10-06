/**
 * Centralized path definitions for FABER
 *
 * This module provides the single source of truth for all FABER run-related paths.
 * All run files are stored in a unified directory structure:
 * .fractary/faber/runs/{run_id}/
 *
 * Plan-scoped runs (created by `workflow-execute` and the workflow-run skill)
 * share their plan's directory, one state file per run:
 * .fractary/faber/runs/{plan_id}/plan.json
 * .fractary/faber/runs/{plan_id}/state-{run_suffix}.json
 * Their run IDs have the form `{plan_id}-run-{run_suffix}`.
 *
 * These paths are committable (not gitignored) to enable:
 * - Workflow state persistence across sessions
 * - Team visibility into workflow progress
 * - Historical tracking of workflow runs
 */

import * as path from 'path';
import { findProjectRoot } from './config.js';

/**
 * Base directory for all FABER runs (relative to project root)
 */
export const FABER_RUNS_DIR = '.fractary/faber/runs';

/**
 * Path to the active run ID file (relative to project root)
 * This file tracks which workflow run is currently active in the worktree
 */
export const ACTIVE_RUN_ID_FILE = '.fractary/faber/runs/.active-run-id';

/**
 * Separator between the plan ID and the run suffix in a plan-scoped run ID
 */
export const RUN_ID_MARKER = '-run-';

/**
 * Run suffix format: UTC timestamp `YYYY-MM-DDTHH-MM-SSZ`, optionally followed
 * by `-N` when two runs of the same plan start in the same second
 */
const RUN_SUFFIX_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}Z(?:-\d+)?$/;

/**
 * Split a plan-scoped run ID (`{plan_id}-run-{run_suffix}`) into its parts.
 * @param runId - The run identifier
 * @returns The plan ID and run suffix, or null if the ID is not plan-scoped
 */
export function parseRunId(runId: string): { planId: string; suffix: string } | null {
  const idx = runId.lastIndexOf(RUN_ID_MARKER);
  if (idx <= 0) return null;
  const suffix = runId.substring(idx + RUN_ID_MARKER.length);
  if (!RUN_SUFFIX_PATTERN.test(suffix)) return null;
  return { planId: runId.substring(0, idx), suffix };
}

/**
 * Get the runs directory path
 * @param projectRoot - Optional project root path (defaults to current working directory)
 * @returns Absolute path to the runs directory
 */
export function getRunsDir(projectRoot?: string): string {
  const root = projectRoot || findProjectRoot();
  return path.join(root, FABER_RUNS_DIR);
}

/**
 * Get the directory path for a specific run
 * @param runId - The run identifier (a plan-scoped run ID resolves to its plan's directory)
 * @param projectRoot - Optional project root path (defaults to current working directory)
 * @returns Absolute path to the run directory
 */
export function getRunDir(runId: string, projectRoot?: string): string {
  const root = projectRoot || findProjectRoot();
  const parsed = parseRunId(runId);
  return path.join(root, FABER_RUNS_DIR, parsed ? parsed.planId : runId);
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
 * @returns Absolute path to the run's state file: `state-{run_suffix}.json` for a
 *   plan-scoped run ID, otherwise `state.json`
 */
export function getStatePath(runId: string, projectRoot?: string): string {
  const parsed = parseRunId(runId);
  const fileName = parsed ? `state-${parsed.suffix}.json` : 'state.json';
  return path.join(getRunDir(runId, projectRoot), fileName);
}

/**
 * Get the active run ID file path
 * @param projectRoot - Optional project root path (defaults to current working directory)
 * @returns Absolute path to the .active-run-id file
 */
export function getActiveRunIdPath(projectRoot?: string): string {
  const root = projectRoot || findProjectRoot();
  return path.join(root, ACTIVE_RUN_ID_FILE);
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
  /** Template for a plan-scoped run's state file path (run ID `{plan_id}-run-{run_suffix}`) */
  RUN_STATE_PATH_TEMPLATE: `${FABER_RUNS_DIR}/{plan_id}/state-{run_suffix}.json`,
  /** Path to active run ID file */
  ACTIVE_RUN_ID_FILE: ACTIVE_RUN_ID_FILE,
} as const;
