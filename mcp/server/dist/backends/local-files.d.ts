/**
 * Local Files Backend for FABER Event Gateway
 *
 * Stores events as individual JSON files in the run's events directory.
 * Uses atomic file operations for concurrent access safety.
 */
import { ConsolidateResult, EmitEventResult, FaberEvent, GetRunResult, ListRunsResult } from "../types.js";
export declare class LocalFilesBackend {
    private readonly basePath;
    private readonly resolvedBasePath;
    constructor(basePath: string);
    /**
     * Validate run_id format - accepts multiple formats
     * Format 1 (UUID): {org}/{project}/{uuid} - used by faber-manager/init-run-directory.sh
     * Format 2 (plan-based): {plan-slug}/{run-suffix} - used by workflow-run.md
     * Format 3 (flat plan): {plan-slug} - for direct plan-level operations
     */
    private validateRunId;
    /**
     * Get the directory path for a run with path traversal protection
     */
    private getRunDir;
    /**
     * Get the events directory for a run
     */
    private getEventsDir;
    /**
     * Generate ISO timestamp with milliseconds for consistency
     */
    private getTimestamp;
    /**
     * Sleep helper for retry backoff
     */
    private sleep;
    /**
     * Get next event ID atomically using atomic rename pattern
     *
     * This approach is more reliable than file locking:
     * 1. Read current ID
     * 2. Write new ID to temp file with random suffix
     * 3. Atomically rename temp file to target
     * 4. If rename fails due to race, retry with exponential backoff
     */
    private getNextEventId;
    /**
     * Update state.json atomically - CRITICAL operation
     * Throws on failure to ensure state consistency
     */
    private updateState;
    /**
     * Emit a workflow event
     */
    emitEvent(eventData: Partial<FaberEvent>): Promise<EmitEventResult>;
    /**
     * Get run state and metadata
     */
    getRun(runId: string, includeEvents?: boolean): Promise<GetRunResult>;
    /**
     * Get events for a run with streaming support for large event sets
     * Uses a generator pattern to avoid loading all events into memory
     */
    getEventsStream(runId: string): AsyncGenerator<FaberEvent>;
    /**
     * Get all events for a run (for backward compatibility)
     * For large event sets, prefer getEventsStream
     */
    getEvents(runId: string): Promise<FaberEvent[]>;
    /**
     * List runs with optional filters
     * Uses an index file for performance when available
     */
    listRuns(filters: {
        work_id?: string;
        status?: string;
        org?: string;
        project?: string;
        limit?: number;
    }): Promise<ListRunsResult>;
    /**
     * Consolidate events to JSONL format using streaming
     * Avoids loading all events into memory
     */
    consolidateEvents(runId: string): Promise<ConsolidateResult>;
    /**
     * Update the runs index for faster listing
     * Should be called after run completion
     */
    updateRunsIndex(): Promise<void>;
}
//# sourceMappingURL=local-files.d.ts.map