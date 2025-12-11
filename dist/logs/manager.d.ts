/**
 * @fractary/faber - Log Manager
 *
 * Session and operational logging for FABER workflows.
 */
import { LogConfig, LogEntry, LogStatus, LogWriteOptions, LogListOptions, LogSearchOptions, LogSearchResult, CaptureStartOptions, CaptureResult, CaptureSession, LogAppendOptions, ArchiveResult } from './types';
/**
 * Log Manager
 *
 * Handles session logging, build logs, and operational logs.
 */
export declare class LogManager {
    private config;
    private logsDir;
    private activeSession;
    constructor(config?: LogConfig);
    /**
     * Ensure logs directory exists
     */
    private ensureLogsDir;
    /**
     * Get log directory for a type
     */
    private getTypeDir;
    /**
     * Write a new log entry
     */
    writeLog(options: LogWriteOptions): LogEntry;
    /**
     * Read a log entry by path or ID
     */
    readLog(idOrPath: string): LogEntry | null;
    /**
     * Find a log by ID
     */
    private findLogById;
    /**
     * Recursively search directory for log ID
     */
    private searchDirForId;
    /**
     * Append to an existing log
     */
    appendToLog(idOrPath: string, options: LogAppendOptions): LogEntry;
    /**
     * Update log status
     */
    updateLogStatus(idOrPath: string, status: LogStatus): LogEntry;
    /**
     * List logs
     */
    listLogs(options?: LogListOptions): LogEntry[];
    /**
     * Recursively collect logs from directory
     */
    private collectLogsFromDir;
    /**
     * Search logs
     */
    searchLogs(options: LogSearchOptions): LogSearchResult[];
    /**
     * Delete a log
     */
    deleteLog(idOrPath: string): boolean;
    /**
     * Start session capture
     */
    startCapture(options: CaptureStartOptions): CaptureResult;
    /**
     * Stop session capture
     */
    stopCapture(): CaptureResult | null;
    /**
     * Get active capture session
     */
    getActiveCapture(): CaptureSession | null;
    /**
     * Log a message to the active capture session
     */
    logMessage(role: 'user' | 'assistant' | 'system', content: string): void;
    /**
     * Archive old logs
     */
    archiveLogs(options?: {
        maxAgeDays?: number;
        compress?: boolean;
    }): ArchiveResult;
    /**
     * Calculate duration from start time to now
     */
    private calculateDuration;
    /**
     * Get logs directory path
     */
    getLogsDir(): string;
}
//# sourceMappingURL=manager.d.ts.map