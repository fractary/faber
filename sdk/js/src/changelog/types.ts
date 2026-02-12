/**
 * @fractary/faber - Changelog Module Types
 *
 * Types for machine-readable changelog entries (NDJSON format).
 */

// ============================================================================
// Changelog Entry
// ============================================================================

/**
 * A single changelog entry representing a meaningful workflow output.
 *
 * Stored as NDJSON (one JSON object per line) in:
 * - Per-run: `.fractary/faber/runs/{run_id}/changelog.ndjson`
 * - Project-level: `.fractary/changelog.ndjson`
 */
export interface ChangelogEntry {
  /** Unique event identifier: evt_{run_slug}_{step_id}_{timestamp} */
  event_id: string;
  /** ISO 8601 timestamp */
  timestamp: string;
  /** Full run identifier (org/project/uuid or plan-id/run-suffix) */
  run_id: string;
  /** Workflow identifier (e.g., "default", "etl") */
  workflow_id: string;
  /** Work item identifier (e.g., issue number) */
  work_id: string;
  /** FABER phase: frame, architect, build, evaluate, release */
  phase: string;
  /** Step identifier within the workflow */
  step_id: string;
  /** Human-readable step name */
  step_name: string;
  /** Step execution status */
  status: 'success' | 'warning' | 'failure' | 'skipped';
  /** Semantic event classification (e.g., CODE_MERGED, DATA_PUBLISHED) */
  event_type: string;
  /** Target branch, environment, or resource */
  target?: string;
  /** Target environment (test, prod) */
  environment?: string;
  /** Human-readable description of what happened */
  message?: string;
  /** Step execution duration in milliseconds */
  duration_ms?: number;
  /** Step-specific metadata (e.g., { pr_number: 42 }) */
  metadata?: Record<string, unknown>;
  /** Project-specific custom data */
  custom?: Record<string, unknown>;
}

// ============================================================================
// Configuration
// ============================================================================

/**
 * Configuration for ChangelogManager.
 */
export interface ChangelogConfig {
  /** Project root directory (default: auto-detected) */
  projectRoot?: string;
  /** Path to runs directory (default: from config) */
  runsPath?: string;
  /** Path to project-level changelog file (default: from config) */
  changelogPath?: string;
}

// ============================================================================
// Emit Options
// ============================================================================

/**
 * Options for emitting a changelog entry.
 */
export interface ChangelogEmitOptions {
  /** Full run identifier */
  run_id: string;
  /** Step identifier */
  step_id: string;
  /** Human-readable step name */
  step_name: string;
  /** FABER phase */
  phase: string;
  /** Step execution status */
  status: 'success' | 'warning' | 'failure' | 'skipped';
  /** Semantic event type (e.g., CODE_MERGED) */
  event_type: string;
  /** Workflow identifier */
  workflow_id: string;
  /** Work item identifier */
  work_id: string;
  /** Target branch/environment/resource */
  target?: string;
  /** Target environment */
  environment?: string;
  /** Human-readable message */
  message?: string;
  /** Duration in milliseconds */
  duration_ms?: number;
  /** Step-specific metadata */
  metadata?: Record<string, unknown>;
  /** Project-specific custom data */
  custom?: Record<string, unknown>;
}

// ============================================================================
// Query Options & Result
// ============================================================================

/**
 * Options for querying the project-level changelog.
 */
export interface ChangelogQueryOptions {
  /** Filter by event type */
  event_type?: string;
  /** Filter by target */
  target?: string;
  /** Filter by phase */
  phase?: string;
  /** Filter by status */
  status?: string;
  /** Filter by work item ID */
  work_id?: string;
  /** Filter entries after this ISO date */
  since?: string;
  /** Filter entries before this ISO date */
  until?: string;
  /** Maximum number of entries to return */
  limit?: number;
}

/**
 * Result of a changelog query.
 */
export interface ChangelogQueryResult {
  /** Matching entries (newest first) */
  entries: ChangelogEntry[];
  /** Total matching entries (before limit) */
  total: number;
}
