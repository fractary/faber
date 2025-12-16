"use strict";
/**
 * @fractary/faber - Log Manager
 *
 * Session and operational logging for FABER workflows.
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.LogManager = void 0;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const config_1 = require("../config");
const errors_1 = require("../errors");
/**
 * Generate a unique log ID
 */
function generateLogId() {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substring(2, 6);
    return `LOG-${timestamp}-${random}`.toUpperCase();
}
/**
 * Generate a session ID
 */
function generateSessionId() {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substring(2, 8);
    return `SESSION-${timestamp}-${random}`.toUpperCase();
}
/**
 * Get date string for directory structure
 */
function getDatePath() {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    return `${year}/${month}/${day}`;
}
/**
 * Parse log frontmatter
 */
function parseLogFrontmatter(content) {
    const match = content.match(/^---\n([\s\S]*?)\n---/);
    if (!match)
        return {};
    const frontmatter = {};
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
function redactSensitive(content) {
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
class LogManager {
    config;
    logsDir;
    activeSession = null;
    constructor(config) {
        this.config = config || (0, config_1.loadLogConfig)();
        const projectRoot = (0, config_1.findProjectRoot)();
        this.logsDir = this.config.localPath || path.join(projectRoot, 'logs');
    }
    /**
     * Ensure logs directory exists
     */
    ensureLogsDir(subDir) {
        const dir = subDir ? path.join(this.logsDir, subDir) : this.logsDir;
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
        return dir;
    }
    /**
     * Get log directory for a type
     */
    getTypeDir(type) {
        return path.join(this.logsDir, type);
    }
    // =========================================================================
    // Log CRUD Operations
    // =========================================================================
    /**
     * Write a new log entry
     */
    writeLog(options) {
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
        const lines = [];
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
    readLog(idOrPath) {
        let filePath = idOrPath;
        // If it's an ID, search for the file
        if (!path.isAbsolute(idOrPath) && !idOrPath.endsWith('.md')) {
            const found = this.findLogById(idOrPath);
            if (!found)
                return null;
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
            type: frontmatter.type || 'operational',
            path: filePath,
            title: frontmatter.title || 'Untitled',
            content: body,
            metadata: {
                date: frontmatter.date || '',
                status: frontmatter.status || 'active',
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
    findLogById(id) {
        // Search through all type directories
        const types = ['session', 'build', 'deployment', 'test', 'debug', 'audit', 'operational', 'workflow'];
        for (const type of types) {
            const typeDir = this.getTypeDir(type);
            if (!fs.existsSync(typeDir))
                continue;
            const found = this.searchDirForId(typeDir, id);
            if (found)
                return found;
        }
        return null;
    }
    /**
     * Recursively search directory for log ID
     */
    searchDirForId(dir, id) {
        const entries = fs.readdirSync(dir, { withFileTypes: true });
        for (const entry of entries) {
            const fullPath = path.join(dir, entry.name);
            if (entry.isDirectory()) {
                const found = this.searchDirForId(fullPath, id);
                if (found)
                    return found;
            }
            else if (entry.name.startsWith(id) && entry.name.endsWith('.md')) {
                return fullPath;
            }
        }
        return null;
    }
    /**
     * Append to an existing log
     */
    appendToLog(idOrPath, options) {
        const log = this.readLog(idOrPath);
        if (!log) {
            throw new errors_1.LogError('append', `Log not found: ${idOrPath}`);
        }
        const timestamp = options.timestamp || new Date().toISOString();
        let content = options.content;
        // Redact if needed
        if (this.config.sessionLogging?.redactSensitive) {
            content = redactSensitive(content);
        }
        // Build append content
        const lines = [];
        lines.push('');
        lines.push(`### [${timestamp}] ${options.role.toUpperCase()}`);
        lines.push('');
        lines.push(content);
        // Append to file
        fs.appendFileSync(log.path, lines.join('\n'), 'utf-8');
        // Return updated log
        return this.readLog(log.path);
    }
    /**
     * Update log status
     */
    updateLogStatus(idOrPath, status) {
        const log = this.readLog(idOrPath);
        if (!log) {
            throw new errors_1.LogError('updateStatus', `Log not found: ${idOrPath}`);
        }
        // Read full content and update frontmatter
        let content = fs.readFileSync(log.path, 'utf-8');
        content = content.replace(/status:\s*\w+/, `status: ${status}`);
        fs.writeFileSync(log.path, content, 'utf-8');
        return this.readLog(log.path);
    }
    /**
     * List logs
     */
    listLogs(options) {
        const logs = [];
        const types = options?.type
            ? [options.type]
            : ['session', 'build', 'deployment', 'test', 'debug', 'audit', 'operational', 'workflow'];
        for (const type of types) {
            const typeDir = this.getTypeDir(type);
            if (!fs.existsSync(typeDir))
                continue;
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
    collectLogsFromDir(dir, logs, options) {
        const entries = fs.readdirSync(dir, { withFileTypes: true });
        for (const entry of entries) {
            const fullPath = path.join(dir, entry.name);
            if (entry.isDirectory()) {
                this.collectLogsFromDir(fullPath, logs, options);
            }
            else if (entry.name.endsWith('.md')) {
                try {
                    const log = this.readLog(fullPath);
                    if (!log)
                        continue;
                    // Apply filters
                    if (options?.status && log.metadata.status !== options.status)
                        continue;
                    if (options?.issueNumber && log.metadata.issue_number !== options.issueNumber)
                        continue;
                    if (options?.since && new Date(log.metadata.date) < new Date(options.since))
                        continue;
                    if (options?.until && new Date(log.metadata.date) > new Date(options.until))
                        continue;
                    logs.push(log);
                }
                catch {
                    // Skip invalid log files
                }
            }
        }
    }
    /**
     * Search logs
     */
    searchLogs(options) {
        const results = [];
        const logs = this.listLogs({
            type: options.type,
            issueNumber: options.issueNumber,
            since: options.since,
            until: options.until,
        });
        for (const log of logs) {
            const content = fs.readFileSync(log.path, 'utf-8');
            const lines = content.split('\n');
            const snippets = [];
            const lineNumbers = [];
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
    deleteLog(idOrPath) {
        const log = this.readLog(idOrPath);
        if (!log)
            return false;
        fs.unlinkSync(log.path);
        return true;
    }
    // =========================================================================
    // Session Capture
    // =========================================================================
    /**
     * Start session capture
     */
    startCapture(options) {
        if (this.activeSession) {
            throw new errors_1.LogError('capture', 'A capture session is already active');
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
    stopCapture() {
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
    getActiveCapture() {
        return this.activeSession;
    }
    /**
     * Log a message to the active capture session
     */
    logMessage(role, content) {
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
    archiveLogs(options) {
        const maxAge = options?.maxAgeDays || 30;
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - maxAge);
        const result = {
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
                }
                catch (error) {
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
    calculateDuration(startTime) {
        const start = new Date(startTime).getTime();
        const end = Date.now();
        const durationMs = end - start;
        const hours = Math.floor(durationMs / (1000 * 60 * 60));
        const minutes = Math.floor((durationMs % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((durationMs % (1000 * 60)) / 1000);
        if (hours > 0) {
            return `${hours}h ${minutes}m ${seconds}s`;
        }
        else if (minutes > 0) {
            return `${minutes}m ${seconds}s`;
        }
        else {
            return `${seconds}s`;
        }
    }
    /**
     * Get logs directory path
     */
    getLogsDir() {
        return this.logsDir;
    }
}
exports.LogManager = LogManager;
//# sourceMappingURL=manager.js.map