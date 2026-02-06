/**
 * @fractary/faber - Session Manager
 *
 * Manages session context for workflow runs.
 * Loads and saves session data (active run context) for resuming work.
 */

import * as fs from 'fs';
import * as path from 'path';
import { findProjectRoot } from '../config.js';
import { FABER_RUNS_DIR, ACTIVE_RUN_ID_FILE } from '../paths.js';

/**
 * Session context representing the currently active workflow session
 */
export interface SessionContext {
  /** Active run ID */
  runId?: string;
  /** Work item ID */
  workId?: string;
  /** Current workflow state (if run exists) */
  state?: Record<string, unknown>;
  /** Run metadata (if run exists) */
  metadata?: Record<string, unknown>;
  /** Whether a session was found */
  active: boolean;
}

export interface LoadSessionOptions {
  /** Work item ID to find session for */
  workId?: string;
  /** Specific run ID to load */
  runId?: string;
  /** Project root directory */
  projectRoot?: string;
}

export interface SaveSessionOptions {
  /** Work item ID */
  workId?: string;
  /** Run ID to set as active */
  runId: string;
  /** Project root directory */
  projectRoot?: string;
}

/**
 * Session Manager
 *
 * Handles loading and saving session context (which run is active).
 */
export class SessionManager {
  private projectRoot: string;

  constructor(projectRoot?: string) {
    this.projectRoot = projectRoot || findProjectRoot();
  }

  /**
   * Load the current session context.
   *
   * Resolution order:
   * 1. If runId is provided, load that specific run
   * 2. If workId is provided, search for the latest run for that work item
   * 3. Otherwise, load the active run from .active-run-id
   */
  loadSession(options: LoadSessionOptions = {}): SessionContext {
    const root = options.projectRoot || this.projectRoot;

    // Case 1: Specific run ID
    if (options.runId) {
      return this.loadRunSession(options.runId, root);
    }

    // Case 2: Work ID - find latest run
    if (options.workId) {
      return this.loadWorkSession(options.workId, root);
    }

    // Case 3: Active run
    return this.loadActiveSession(root);
  }

  /**
   * Save session context by setting the active run ID.
   */
  saveSession(options: SaveSessionOptions): void {
    const root = options.projectRoot || this.projectRoot;
    const activeRunIdPath = path.join(root, ACTIVE_RUN_ID_FILE);

    // Ensure directory exists
    const dir = path.dirname(activeRunIdPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    fs.writeFileSync(activeRunIdPath, options.runId, 'utf-8');
  }

  /**
   * Load session for a specific run ID
   */
  private loadRunSession(runId: string, root: string): SessionContext {
    const runDir = path.join(root, FABER_RUNS_DIR, runId);

    if (!fs.existsSync(runDir)) {
      return { active: false, runId };
    }

    const context: SessionContext = {
      active: true,
      runId,
    };

    // Load state
    const statePath = path.join(runDir, 'state.json');
    if (fs.existsSync(statePath)) {
      try {
        context.state = JSON.parse(fs.readFileSync(statePath, 'utf-8')) as Record<string, unknown>;
        context.workId = context.state?.['work_id'] as string | undefined;
      } catch {
        // Corrupted state - still return partial context
      }
    }

    // Load metadata
    const metadataPath = path.join(runDir, 'metadata.json');
    if (fs.existsSync(metadataPath)) {
      try {
        context.metadata = JSON.parse(fs.readFileSync(metadataPath, 'utf-8')) as Record<string, unknown>;
        if (!context.workId) {
          context.workId = context.metadata?.['work_id'] as string | undefined;
        }
      } catch {
        // Corrupted metadata
      }
    }

    return context;
  }

  /**
   * Load session for a work item by finding the latest run
   */
  private loadWorkSession(workId: string, root: string): SessionContext {
    const runsDir = path.join(root, FABER_RUNS_DIR);

    if (!fs.existsSync(runsDir)) {
      return { active: false, workId };
    }

    // Search through run directories for matching work ID
    const matchingRunId = this.findLatestRunForWorkId(runsDir, workId);

    if (!matchingRunId) {
      return { active: false, workId };
    }

    return this.loadRunSession(matchingRunId, root);
  }

  /**
   * Find the latest run ID for a given work item
   */
  private findLatestRunForWorkId(runsDir: string, workId: string): string | null {
    const matches: Array<{ runId: string; updatedAt: Date }> = [];
    this.scanRunsDir(runsDir, '', workId, matches);

    if (matches.length === 0) {
      return null;
    }

    // Find the most recent match
    let best = matches[0];
    for (let i = 1; i < matches.length; i++) {
      if (matches[i].updatedAt > best.updatedAt) {
        best = matches[i];
      }
    }
    return best.runId;
  }

  /**
   * Recursively scan runs directory for matching work IDs
   */
  private scanRunsDir(
    dir: string,
    prefix: string,
    workId: string,
    matches: Array<{ runId: string; updatedAt: Date }>
  ): void {
    if (!fs.existsSync(dir)) return;
    const entries = fs.readdirSync(dir, { withFileTypes: true });

    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      if (entry.name.startsWith('.')) continue;

      const subDir = path.join(dir, entry.name);
      const currentPath = prefix ? `${prefix}/${entry.name}` : entry.name;

      const statePath = path.join(subDir, 'state.json');
      if (fs.existsSync(statePath)) {
        try {
          const state = JSON.parse(fs.readFileSync(statePath, 'utf-8')) as Record<string, unknown>;
          const stateWorkId = state['work_id'];
          if (stateWorkId === workId || String(stateWorkId) === String(workId)) {
            const updatedAtValue = (state['updated_at'] ?? state['started_at'] ?? 0) as string | number;
            const updatedAt = new Date(updatedAtValue);
            matches.push({ runId: currentPath, updatedAt });
          }
        } catch {
          // Skip unreadable state files
        }
      } else {
        this.scanRunsDir(subDir, currentPath, workId, matches);
      }
    }
  }

  /**
   * Load the currently active session from .active-run-id
   */
  private loadActiveSession(root: string): SessionContext {
    const activeRunIdPath = path.join(root, ACTIVE_RUN_ID_FILE);

    if (!fs.existsSync(activeRunIdPath)) {
      return { active: false };
    }

    const runId = fs.readFileSync(activeRunIdPath, 'utf-8').trim();
    if (!runId) {
      return { active: false };
    }

    return this.loadRunSession(runId, root);
  }
}
