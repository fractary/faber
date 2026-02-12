/**
 * @fractary/faber - Changelog Manager
 *
 * Machine-readable changelog for FABER workflow outputs.
 * Stores entries as NDJSON (one JSON object per line).
 *
 * File locations:
 * - Per-run:     `.fractary/faber/runs/{run_id}/changelog.ndjson`
 * - Project:     `.fractary/changelog.ndjson`
 */

import * as fs from 'fs';
import * as path from 'path';
import {
  ChangelogConfig,
  ChangelogEntry,
  ChangelogEmitOptions,
  ChangelogQueryOptions,
  ChangelogQueryResult,
} from './types.js';
import { findProjectRoot, getRunsPath } from '../config.js';
import { FaberError } from '../errors.js';

// ============================================================================
// Errors
// ============================================================================

export class ChangelogError extends FaberError {
  constructor(operation: string, message: string, details?: Record<string, unknown>) {
    super(`Changelog ${operation}: ${message}`, 'CHANGELOG_ERROR', details);
    this.name = 'ChangelogError';
  }
}

// ============================================================================
// Helpers
// ============================================================================

/**
 * Generate a unique event ID.
 * Format: evt_{run_slug}_{step_id}_{timestamp}
 */
function generateEventId(runId: string, stepId: string): string {
  const runSlug = runId.replace(/[^a-zA-Z0-9]/g, '-').slice(-20);
  const ts = Date.now().toString(36);
  return `evt_${runSlug}_${stepId}_${ts}`;
}

/**
 * Parse a single NDJSON line into a ChangelogEntry.
 * Returns null for empty or invalid lines.
 */
function parseLine(line: string): ChangelogEntry | null {
  const trimmed = line.trim();
  if (!trimmed) return null;
  try {
    return JSON.parse(trimmed) as ChangelogEntry;
  } catch {
    return null;
  }
}

/**
 * Read all entries from an NDJSON file.
 */
function readNdjson(filePath: string): ChangelogEntry[] {
  if (!fs.existsSync(filePath)) return [];
  const content = fs.readFileSync(filePath, 'utf-8');
  const entries: ChangelogEntry[] = [];
  for (const line of content.split('\n')) {
    const entry = parseLine(line);
    if (entry) entries.push(entry);
  }
  return entries;
}

// ============================================================================
// ChangelogManager
// ============================================================================

/**
 * Changelog Manager
 *
 * Handles emission, aggregation, and querying of changelog entries.
 */
export class ChangelogManager {
  private projectRoot: string;
  private runsPath: string;

  constructor(config?: ChangelogConfig) {
    this.projectRoot = config?.projectRoot || findProjectRoot();
    this.runsPath = config?.runsPath || getRunsPath(this.projectRoot);
  }

  // =========================================================================
  // Path Resolution
  // =========================================================================

  /** Get path to per-run changelog file */
  private getRunChangelogPath(runId: string): string {
    return path.join(this.runsPath, runId, 'changelog.ndjson');
  }

  /** Get path to project-level changelog file */
  private getProjectChangelogPath(): string {
    return path.join(this.projectRoot, '.fractary', 'changelog.ndjson');
  }

  // =========================================================================
  // Emit
  // =========================================================================

  /**
   * Emit a changelog entry for a completed step.
   * Appends one NDJSON line to the per-run changelog file.
   */
  emit(options: ChangelogEmitOptions): ChangelogEntry {
    const entry: ChangelogEntry = {
      event_id: generateEventId(options.run_id, options.step_id),
      timestamp: new Date().toISOString(),
      run_id: options.run_id,
      workflow_id: options.workflow_id,
      work_id: options.work_id,
      phase: options.phase,
      step_id: options.step_id,
      step_name: options.step_name,
      status: options.status,
      event_type: options.event_type,
    };

    // Optional fields - only include if provided
    if (options.target !== undefined) entry.target = options.target;
    if (options.environment !== undefined) entry.environment = options.environment;
    if (options.message !== undefined) entry.message = options.message;
    if (options.duration_ms !== undefined) entry.duration_ms = options.duration_ms;
    if (options.metadata !== undefined) entry.metadata = options.metadata;
    if (options.custom !== undefined) entry.custom = options.custom;

    const filePath = this.getRunChangelogPath(options.run_id);
    const dir = path.dirname(filePath);

    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    // Append single NDJSON line
    fs.appendFileSync(filePath, JSON.stringify(entry) + '\n', 'utf-8');

    return entry;
  }

  // =========================================================================
  // Aggregate
  // =========================================================================

  /**
   * Aggregate per-run changelog entries to the project-level file.
   * Reads the per-run file and appends all lines to the project changelog.
   */
  aggregate(runId: string): { entries_aggregated: number } {
    const runPath = this.getRunChangelogPath(runId);
    const entries = readNdjson(runPath);

    if (entries.length === 0) {
      return { entries_aggregated: 0 };
    }

    const projectPath = this.getProjectChangelogPath();
    const projectDir = path.dirname(projectPath);

    if (!fs.existsSync(projectDir)) {
      fs.mkdirSync(projectDir, { recursive: true });
    }

    // Append all entries as NDJSON lines
    const lines = entries.map(e => JSON.stringify(e)).join('\n') + '\n';
    fs.appendFileSync(projectPath, lines, 'utf-8');

    return { entries_aggregated: entries.length };
  }

  // =========================================================================
  // Query
  // =========================================================================

  /**
   * Query the project-level changelog with optional filters.
   */
  query(options?: ChangelogQueryOptions): ChangelogQueryResult {
    const projectPath = this.getProjectChangelogPath();
    let entries = readNdjson(projectPath);

    // Apply filters
    if (options?.event_type) {
      entries = entries.filter(e => e.event_type === options.event_type);
    }
    if (options?.target) {
      entries = entries.filter(e => e.target === options.target);
    }
    if (options?.phase) {
      entries = entries.filter(e => e.phase === options.phase);
    }
    if (options?.status) {
      entries = entries.filter(e => e.status === options.status);
    }
    if (options?.work_id) {
      entries = entries.filter(e => e.work_id === options.work_id);
    }
    if (options?.since) {
      const sinceDate = new Date(options.since);
      entries = entries.filter(e => new Date(e.timestamp) >= sinceDate);
    }
    if (options?.until) {
      const untilDate = new Date(options.until);
      entries = entries.filter(e => new Date(e.timestamp) <= untilDate);
    }

    const total = entries.length;

    // Sort newest first
    entries.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    // Apply limit
    if (options?.limit && options.limit > 0) {
      entries = entries.slice(0, options.limit);
    }

    return { entries, total };
  }

  // =========================================================================
  // Read Run
  // =========================================================================

  /**
   * Read all changelog entries from a specific run.
   */
  readRun(runId: string): ChangelogEntry[] {
    const runPath = this.getRunChangelogPath(runId);
    return readNdjson(runPath);
  }
}
