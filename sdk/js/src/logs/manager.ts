/**
 * @fractary/faber - Log Manager
 *
 * Session and operational logging for FABER workflows.
 */

import * as fs from 'fs';
import * as path from 'path';
import {
  LogConfig,
  LogEntry,
  LogType,
  LogStatus,
  LogWriteOptions,
  LogListOptions,
  LogSearchOptions,
  LogSearchResult,
  CaptureStartOptions,
  CaptureResult,
  CaptureSession,
  LogAppendOptions,
  ArchiveResult,
} from './types';
import { loadLogConfig, findProjectRoot } from '../config';
import { LogError } from '../errors';

/**
 * Generate a unique log ID
 */
function generateLogId(): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 6);
  return `LOG-${timestamp}-${random}`.toUpperCase();
}

/**
 * Generate a session ID
 */
function generateSessionId(): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 8);
  return `SESSION-${timestamp}-${random}`.toUpperCase();
}

/**
 * Get date string for directory structure
 */
function getDatePath(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}/${month}/${day}`;
}

/**
 * Parse log frontmatter
 */
function parseLogFrontmatter(content: string): Record<string, string> {
  const match = content.match(/^---\n([\s\S]*?)\n---/);
  if (!match) return {};

  const frontmatter: Record<string, string> = {};
  for (const line of match[1].split('\n')) {
    const lineMatch = line.match(/^(\w+):\s*(.*)$/);
    if (lineMatch) {
      const [, key, value] = lineMatch;
      frontmatter[key] = value.replace(/^["']|["']$/g, '');
    }
  }
  return frontmatter;
}

/**
 * Redact sensitive patterns from content
 */
function redactSensitive(content: string): string {
  const patterns = [
    // API keys and tokens
    { pattern: /([A-Za-z0-9_-]{20,})/g, replace: '[REDACTED_TOKEN]' },
    // Passwords in URLs
    { pattern: /:([^:@\s]{8,})@/g, replace: ':[REDACTED]@' },
    // Bearer tokens
    { pattern: /(Bearer\s+)[A-Za-z0-9._-]+/gi, replace: '$1[REDACTED]' },
    // AWS keys
    { pattern: /(AKIA|ABIA|ACCA|ASIA)[A-Z0-9]{16}/g, replace: '[REDACTED_AWS_KEY]' },
    // GitHub tokens
    { pattern: /ghp_[A-Za-z0-9]{36}/g, replace: '[REDACTED_GH_TOKEN]' },
    { pattern: /gho_[A-Za-z0-9]{36}/g, replace: '[REDACTED_GH_TOKEN]' },
    { pattern: /github_pat_[A-Za-z0-9_]{22,}/g, replace: '[REDACTED_GH_TOKEN]' },
  ];

  let redacted = content;
  for (const { pattern, replace } of patterns) {
    redacted = redacted.replace(pattern, replace);
  }
  return redacted;
}

/**
 * Log Manager
 *
 * Handles session logging, build logs, and operational logs.
 */
export class LogManager {
  private config: LogConfig;
  private logsDir: string;
  private activeSession: CaptureSession | null = null;

  constructor(config?: LogConfig) {
    this.config = config || loadLogConfig();
    const projectRoot = findProjectRoot();
    this.logsDir = this.config.localPath || path.join(projectRoot, 'logs');
  }

  /**
   * Ensure logs directory exists
   */
  private ensureLogsDir(subDir?: string): string {
    const dir = subDir ? path.join(this.logsDir, subDir) : this.logsDir;
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    return dir;
  }

  /**
   * Get log directory for a type
   */
  private getTypeDir(type: LogType): string {
    return path.join(this.logsDir, type);
  }

  // =========================================================================
  // Log CRUD Operations
  // =========================================================================

  /**
   * Write a new log entry
   */
  writeLog(options: LogWriteOptions): LogEntry {
    this.ensureLogsDir(options.type);
    const dateDir = this.ensureLogsDir(path.join(options.type, getDatePath()));

    const id = generateLogId();
    const timestamp = new Date().toISOString();
    const slug = options.title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 40);
    const filename = `${id}-${slug}.md`;
    const filePath = path.join(dateDir, filename);

    // Build content
    const lines: string[] = [];
    lines.push('---');
    lines.push(`id: ${id}`);
    lines.push(`type: ${options.type}`);
    lines.push(`title: "${options.title}"`);
    lines.push(`date: ${timestamp}`);
    lines.push(`status: active`);
    if (options.issueNumber) {
      lines.push(`issue_number: ${options.issueNumber}`);
    }
    if (options.metadata?.repository) {
      lines.push(`repository: "${options.metadata.repository}"`);
    }
    if (options.metadata?.branch) {
      lines.push(`branch: "${options.metadata.branch}"`);
    }
    lines.push('---');
    lines.push('');
    lines.push(`# ${options.title}`);
    lines.push('');
    lines.push(options.content);

    const content = lines.join('\n');
    fs.writeFileSync(filePath, content, 'utf-8');

    return {
      id,
      type: options.type,
      path: filePath,
      title: options.title,
      content: options.content,
      metadata: {
        date: timestamp,
        status: 'active',
        issue_number: options.issueNumber,
        repository: options.metadata?.repository,
        branch: options.metadata?.branch,
      },
      size_bytes: Buffer.byteLength(content, 'utf-8'),
    };
  }

  /**
   * Read a log entry by path or ID
   */
  readLog(idOrPath: string): LogEntry | null {
    let filePath = idOrPath;

    // If it's an ID, search for the file
    if (!path.isAbsolute(idOrPath) && !idOrPath.endsWith('.md')) {
      const found = this.findLogById(idOrPath);
      if (!found) return null;
      filePath = found;
    }

    if (!fs.existsSync(filePath)) {
      return null;
    }

    const content = fs.readFileSync(filePath, 'utf-8');
    const frontmatter = parseLogFrontmatter(content);

    // Extract body (after frontmatter)
    const bodyMatch = content.match(/^---\n[\s\S]*?\n---\n([\s\S]*)$/);
    const body = bodyMatch ? bodyMatch[1] : content;

    return {
      id: frontmatter.id || path.basename(filePath, '.md'),
      type: (frontmatter.type as LogType) || 'operational',
      path: filePath,
      title: frontmatter.title || 'Untitled',
      content: body,
      metadata: {
        date: frontmatter.date || '',
        status: (frontmatter.status as LogStatus) || 'active',
        issue_number: frontmatter.issue_number ? parseInt(frontmatter.issue_number, 10) : undefined,
        repository: frontmatter.repository,
        branch: frontmatter.branch,
      },
      size_bytes: Buffer.byteLength(content, 'utf-8'),
    };
  }

  /**
   * Find a log by ID
   */
  private findLogById(id: string): string | null {
    // Search through all type directories
    const types: LogType[] = ['session', 'build', 'deployment', 'test', 'debug', 'audit', 'operational', 'workflow'];

    for (const type of types) {
      const typeDir = this.getTypeDir(type);
      if (!fs.existsSync(typeDir)) continue;

      const found = this.searchDirForId(typeDir, id);
      if (found) return found;
    }

    return null;
  }

  /**
   * Recursively search directory for log ID
   */
  private searchDirForId(dir: string, id: string): string | null {
    const entries = fs.readdirSync(dir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);

      if (entry.isDirectory()) {
        const found = this.searchDirForId(fullPath, id);
        if (found) return found;
      } else if (entry.name.startsWith(id) && entry.name.endsWith('.md')) {
        return fullPath;
      }
    }

    return null;
  }

  /**
   * Append to an existing log
   */
  appendToLog(idOrPath: string, options: LogAppendOptions): LogEntry {
    const log = this.readLog(idOrPath);
    if (!log) {
      throw new LogError('append', `Log not found: ${idOrPath}`);
    }

    const timestamp = options.timestamp || new Date().toISOString();
    let content = options.content;

    // Redact if needed
    if (this.config.sessionLogging?.redactSensitive) {
      content = redactSensitive(content);
    }

    // Build append content
    const lines: string[] = [];
    lines.push('');
    lines.push(`### [${timestamp}] ${options.role.toUpperCase()}`);
    lines.push('');
    lines.push(content);

    // Append to file
    fs.appendFileSync(log.path, lines.join('\n'), 'utf-8');

    // Return updated log
    return this.readLog(log.path)!;
  }

  /**
   * Update log status
   */
  updateLogStatus(idOrPath: string, status: LogStatus): LogEntry {
    const log = this.readLog(idOrPath);
    if (!log) {
      throw new LogError('updateStatus', `Log not found: ${idOrPath}`);
    }

    // Read full content and update frontmatter
    let content = fs.readFileSync(log.path, 'utf-8');
    content = content.replace(/status:\s*\w+/, `status: ${status}`);
    fs.writeFileSync(log.path, content, 'utf-8');

    return this.readLog(log.path)!;
  }

  /**
   * List logs
   */
  listLogs(options?: LogListOptions): LogEntry[] {
    const logs: LogEntry[] = [];
    const types: LogType[] = options?.type
      ? [options.type]
      : ['session', 'build', 'deployment', 'test', 'debug', 'audit', 'operational', 'workflow'];

    for (const type of types) {
      const typeDir = this.getTypeDir(type);
      if (!fs.existsSync(typeDir)) continue;

      this.collectLogsFromDir(typeDir, logs, options);
    }

    // Sort by date descending
    logs.sort((a, b) => new Date(b.metadata.date).getTime() - new Date(a.metadata.date).getTime());

    // Apply limit
    if (options?.limit) {
      return logs.slice(0, options.limit);
    }

    return logs;
  }

  /**
   * Recursively collect logs from directory
   */
  private collectLogsFromDir(dir: string, logs: LogEntry[], options?: LogListOptions): void {
    const entries = fs.readdirSync(dir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);

      if (entry.isDirectory()) {
        this.collectLogsFromDir(fullPath, logs, options);
      } else if (entry.name.endsWith('.md')) {
        try {
          const log = this.readLog(fullPath);
          if (!log) continue;

          // Apply filters
          if (options?.status && log.metadata.status !== options.status) continue;
          if (options?.issueNumber && log.metadata.issue_number !== options.issueNumber) continue;
          if (options?.since && new Date(log.metadata.date) < new Date(options.since)) continue;
          if (options?.until && new Date(log.metadata.date) > new Date(options.until)) continue;

          logs.push(log);
        } catch {
          // Skip invalid log files
        }
      }
    }
  }

  /**
   * Search logs
   */
  searchLogs(options: LogSearchOptions): LogSearchResult[] {
    const results: LogSearchResult[] = [];
    const logs = this.listLogs({
      type: options.type,
      issueNumber: options.issueNumber,
      since: options.since,
      until: options.until,
    });

    for (const log of logs) {
      const content = fs.readFileSync(log.path, 'utf-8');
      const lines = content.split('\n');
      const snippets: string[] = [];
      const lineNumbers: number[] = [];

      const pattern = options.regex
        ? new RegExp(options.query, 'gi')
        : new RegExp(options.query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');

      lines.forEach((line, index) => {
        if (pattern.test(line)) {
          snippets.push(line);
          lineNumbers.push(index + 1);
        }
      });

      if (snippets.length > 0) {
        results.push({ log, snippets, lineNumbers });
      }
    }

    return results;
  }

  /**
   * Delete a log
   */
  deleteLog(idOrPath: string): boolean {
    const log = this.readLog(idOrPath);
    if (!log) return false;

    fs.unlinkSync(log.path);
    return true;
  }

  // =========================================================================
  // Session Capture
  // =========================================================================

  /**
   * Start session capture
   */
  startCapture(options: CaptureStartOptions): CaptureResult {
    if (this.activeSession) {
      throw new LogError('capture', 'A capture session is already active');
    }

    const sessionId = generateSessionId();
    const dateDir = this.ensureLogsDir(path.join('session', getDatePath()));
    const filename = `${sessionId}-issue-${options.issueNumber}.md`;
    const logPath = path.join(dateDir, filename);

    // Create initial log
    const content = [
      '---',
      `id: ${sessionId}`,
      'type: session',
      `title: "Session Capture - Issue #${options.issueNumber}"`,
      `date: ${new Date().toISOString()}`,
      'status: active',
      `issue_number: ${options.issueNumber}`,
      options.model ? `model: "${options.model}"` : '',
      '---',
      '',
      `# Session Capture - Issue #${options.issueNumber}`,
      '',
      `**Started:** ${new Date().toISOString()}`,
      options.model ? `**Model:** ${options.model}` : '',
      '',
      '---',
      '',
    ].filter(Boolean).join('\n');

    fs.writeFileSync(logPath, content, 'utf-8');

    // Store active session
    this.activeSession = {
      sessionId,
      logPath,
      issueNumber: options.issueNumber,
      startTime: new Date().toISOString(),
      status: 'active',
      redactSensitive: options.redactSensitive ?? this.config.sessionLogging?.redactSensitive ?? true,
      model: options.model,
      messageCount: 0,
    };

    return {
      sessionId,
      logPath,
      issueNumber: options.issueNumber,
      status: 'active',
    };
  }

  /**
   * Stop session capture
   */
  stopCapture(): CaptureResult | null {
    if (!this.activeSession) {
      return null;
    }

    const session = this.activeSession;

    // Update log with completion info
    const footer = [
      '',
      '---',
      '',
      '## Session Summary',
      '',
      `**Ended:** ${new Date().toISOString()}`,
      `**Duration:** ${this.calculateDuration(session.startTime)}`,
      `**Messages:** ${session.messageCount}`,
      '',
    ].join('\n');

    fs.appendFileSync(session.logPath, footer, 'utf-8');

    // Update status in frontmatter
    let content = fs.readFileSync(session.logPath, 'utf-8');
    content = content.replace(/status:\s*active/, 'status: completed');
    fs.writeFileSync(session.logPath, content, 'utf-8');

    // Clear active session
    this.activeSession = null;

    return {
      sessionId: session.sessionId,
      logPath: session.logPath,
      issueNumber: session.issueNumber,
      status: 'stopped',
    };
  }

  /**
   * Get active capture session
   */
  getActiveCapture(): CaptureSession | null {
    return this.activeSession;
  }

  /**
   * Log a message to the active capture session
   */
  logMessage(role: 'user' | 'assistant' | 'system', content: string): void {
    if (!this.activeSession) {
      return; // Silently ignore if no active session
    }

    let processedContent = content;
    if (this.activeSession.redactSensitive) {
      processedContent = redactSensitive(content);
    }

    const timestamp = new Date().toISOString();
    const entry = [
      '',
      `### [${timestamp}] ${role.toUpperCase()}`,
      '',
      processedContent,
    ].join('\n');

    fs.appendFileSync(this.activeSession.logPath, entry, 'utf-8');
    this.activeSession.messageCount++;
  }

  // =========================================================================
  // Archival
  // =========================================================================

  /**
   * Archive old logs
   */
  archiveLogs(options?: { maxAgeDays?: number; compress?: boolean }): ArchiveResult {
    const maxAge = options?.maxAgeDays || 30;
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - maxAge);

    const result: ArchiveResult = {
      archived: [],
      deleted: [],
      errors: [],
    };

    const logs = this.listLogs();

    for (const log of logs) {
      const logDate = new Date(log.metadata.date);

      if (logDate < cutoffDate) {
        try {
          // For now, just mark as archived in the result
          // Could implement actual archival (compression, moving to archive dir, etc.)
          result.archived.push(log.path);
        } catch (error) {
          result.errors.push(`Failed to archive ${log.path}: ${error}`);
        }
      }
    }

    return result;
  }

  // =========================================================================
  // Helpers
  // =========================================================================

  /**
   * Calculate duration from start time to now
   */
  private calculateDuration(startTime: string): string {
    const start = new Date(startTime).getTime();
    const end = Date.now();
    const durationMs = end - start;

    const hours = Math.floor(durationMs / (1000 * 60 * 60));
    const minutes = Math.floor((durationMs % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((durationMs % (1000 * 60)) / 1000);

    if (hours > 0) {
      return `${hours}h ${minutes}m ${seconds}s`;
    } else if (minutes > 0) {
      return `${minutes}m ${seconds}s`;
    } else {
      return `${seconds}s`;
    }
  }

  /**
   * Get logs directory path
   */
  getLogsDir(): string {
    return this.logsDir;
  }
}
