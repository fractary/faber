/**
 * @fractary/faber - Logs Module Types
 *
 * Re-exports from main types + logs-specific interfaces.
 */

// Re-export common types
export {
  LogConfig,
  LogType,
  LogEntry,
  LogMetadata,
  LogStatus,
  LogWriteOptions,
  LogListOptions,
  LogSearchOptions,
  LogSearchResult,
  SessionState,
  CaptureStartOptions,
  CaptureResult,
} from '../types';

/**
 * Session capture state stored in state module
 */
export interface CaptureSession {
  sessionId: string;
  logPath: string;
  issueNumber: number;
  startTime: string;
  status: 'active' | 'stopped';
  redactSensitive: boolean;
  model?: string;
  messageCount: number;
}

/**
 * Log append options
 */
export interface LogAppendOptions {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Log rotation options
 */
export interface LogRotationOptions {
  maxSize?: number; // bytes
  maxAge?: number; // days
  compress?: boolean;
}

/**
 * Archive result
 */
export interface ArchiveResult {
  archived: string[];
  deleted: string[];
  errors: string[];
}
