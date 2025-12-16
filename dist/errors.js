"use strict";
/**
 * @fractary/faber - Error Types
 *
 * Hierarchical error classes for the FABER SDK.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.CommandExecutionError = exports.NetworkError = exports.RateLimitError = exports.AuthenticationError = exports.ProviderError = exports.ApprovalRequiredError = exports.MaxRetriesExceededError = exports.InvalidWorkflowStateError = exports.PhaseFailedError = exports.WorkflowError = exports.StateError = exports.LogNotFoundError = exports.SessionActiveError = exports.NoActiveSessionError = exports.LogError = exports.SpecValidationError = exports.SpecExistsError = exports.SpecNotFoundError = exports.SpecError = exports.DirtyWorkingDirectoryError = exports.MergeConflictError = exports.PRError = exports.PRNotFoundError = exports.PushError = exports.CommitError = exports.ProtectedBranchError = exports.BranchNotFoundError = exports.BranchExistsError = exports.RepoError = exports.MilestoneError = exports.LabelError = exports.IssueCreateError = exports.IssueNotFoundError = exports.WorkError = exports.ConfigValidationError = exports.ConfigNotFoundError = exports.ConfigurationError = exports.FaberError = void 0;
/**
 * Base error for all FABER errors
 */
class FaberError extends Error {
    code;
    details;
    constructor(message, code, details) {
        super(message);
        this.name = 'FaberError';
        this.code = code;
        this.details = details;
        Error.captureStackTrace?.(this, this.constructor);
    }
    toJSON() {
        return {
            name: this.name,
            code: this.code,
            message: this.message,
            details: this.details,
        };
    }
}
exports.FaberError = FaberError;
// ============================================================================
// Configuration Errors
// ============================================================================
/**
 * Error for configuration issues
 */
class ConfigurationError extends FaberError {
    constructor(message, details) {
        super(message, 'CONFIG_ERROR', details);
        this.name = 'ConfigurationError';
    }
}
exports.ConfigurationError = ConfigurationError;
/**
 * Error when configuration file is not found
 */
class ConfigNotFoundError extends ConfigurationError {
    constructor(path) {
        super(`Configuration file not found: ${path}`, { path });
        this.name = 'ConfigNotFoundError';
    }
}
exports.ConfigNotFoundError = ConfigNotFoundError;
/**
 * Error when configuration is invalid
 */
class ConfigValidationError extends ConfigurationError {
    errors;
    constructor(errors) {
        super(`Configuration validation failed: ${errors.join(', ')}`, { errors });
        this.name = 'ConfigValidationError';
        this.errors = errors;
    }
}
exports.ConfigValidationError = ConfigValidationError;
// ============================================================================
// Work Module Errors
// ============================================================================
/**
 * Base error for work module operations
 */
class WorkError extends FaberError {
    constructor(message, code, details) {
        super(message, code, details);
        this.name = 'WorkError';
    }
}
exports.WorkError = WorkError;
/**
 * Error when an issue is not found
 */
class IssueNotFoundError extends WorkError {
    issueId;
    constructor(issueId) {
        super(`Issue not found: ${issueId}`, 'ISSUE_NOT_FOUND', { issueId });
        this.name = 'IssueNotFoundError';
        this.issueId = issueId;
    }
}
exports.IssueNotFoundError = IssueNotFoundError;
/**
 * Error when issue creation fails
 */
class IssueCreateError extends WorkError {
    constructor(reason, details) {
        super(`Failed to create issue: ${reason}`, 'ISSUE_CREATE_FAILED', details);
        this.name = 'IssueCreateError';
    }
}
exports.IssueCreateError = IssueCreateError;
/**
 * Error when label operation fails
 */
class LabelError extends WorkError {
    constructor(operation, label, reason) {
        super(`Failed to ${operation} label '${label}': ${reason}`, 'LABEL_ERROR', {
            operation,
            label,
            reason,
        });
        this.name = 'LabelError';
    }
}
exports.LabelError = LabelError;
/**
 * Error when milestone operation fails
 */
class MilestoneError extends WorkError {
    constructor(operation, milestone, reason) {
        super(`Failed to ${operation} milestone '${milestone}': ${reason}`, 'MILESTONE_ERROR', {
            operation,
            milestone,
            reason,
        });
        this.name = 'MilestoneError';
    }
}
exports.MilestoneError = MilestoneError;
// ============================================================================
// Repo Module Errors
// ============================================================================
/**
 * Base error for repo module operations
 */
class RepoError extends FaberError {
    constructor(message, code, details) {
        super(message, code, details);
        this.name = 'RepoError';
    }
}
exports.RepoError = RepoError;
/**
 * Error when a branch already exists
 */
class BranchExistsError extends RepoError {
    branchName;
    constructor(branchName) {
        super(`Branch already exists: ${branchName}`, 'BRANCH_EXISTS', { branchName });
        this.name = 'BranchExistsError';
        this.branchName = branchName;
    }
}
exports.BranchExistsError = BranchExistsError;
/**
 * Error when a branch is not found
 */
class BranchNotFoundError extends RepoError {
    branchName;
    constructor(branchName) {
        super(`Branch not found: ${branchName}`, 'BRANCH_NOT_FOUND', { branchName });
        this.name = 'BranchNotFoundError';
        this.branchName = branchName;
    }
}
exports.BranchNotFoundError = BranchNotFoundError;
/**
 * Error when attempting operation on protected branch
 */
class ProtectedBranchError extends RepoError {
    branchName;
    operation;
    constructor(branchName, operation) {
        super(`Cannot ${operation} protected branch: ${branchName}`, 'PROTECTED_BRANCH', { branchName, operation });
        this.name = 'ProtectedBranchError';
        this.branchName = branchName;
        this.operation = operation;
    }
}
exports.ProtectedBranchError = ProtectedBranchError;
/**
 * Error when commit fails
 */
class CommitError extends RepoError {
    constructor(reason, details) {
        super(`Commit failed: ${reason}`, 'COMMIT_FAILED', details);
        this.name = 'CommitError';
    }
}
exports.CommitError = CommitError;
/**
 * Error when push fails
 */
class PushError extends RepoError {
    constructor(reason, details) {
        super(`Push failed: ${reason}`, 'PUSH_FAILED', details);
        this.name = 'PushError';
    }
}
exports.PushError = PushError;
/**
 * Error when pull request is not found
 */
class PRNotFoundError extends RepoError {
    prNumber;
    constructor(prNumber) {
        super(`Pull request not found: #${prNumber}`, 'PR_NOT_FOUND', { prNumber });
        this.name = 'PRNotFoundError';
        this.prNumber = prNumber;
    }
}
exports.PRNotFoundError = PRNotFoundError;
/**
 * Error when pull request operation fails
 */
class PRError extends RepoError {
    prNumber;
    constructor(operation, reason, prNumber) {
        super(`PR ${operation} failed: ${reason}`, 'PR_ERROR', { operation, reason, prNumber });
        this.name = 'PRError';
        this.prNumber = prNumber;
    }
}
exports.PRError = PRError;
/**
 * Error for merge conflicts
 */
class MergeConflictError extends RepoError {
    conflicts;
    constructor(conflicts) {
        super(`Merge conflict in files: ${conflicts.join(', ')}`, 'MERGE_CONFLICT', { conflicts });
        this.name = 'MergeConflictError';
        this.conflicts = conflicts;
    }
}
exports.MergeConflictError = MergeConflictError;
/**
 * Error when working directory has uncommitted changes
 */
class DirtyWorkingDirectoryError extends RepoError {
    files;
    constructor(files) {
        super('Working directory has uncommitted changes', 'DIRTY_WORKING_DIRECTORY', { files });
        this.name = 'DirtyWorkingDirectoryError';
        this.files = files;
    }
}
exports.DirtyWorkingDirectoryError = DirtyWorkingDirectoryError;
// ============================================================================
// Spec Module Errors
// ============================================================================
/**
 * Base error for spec module operations
 */
class SpecError extends FaberError {
    constructor(operation, message, details) {
        super(`Spec ${operation}: ${message}`, 'SPEC_ERROR', details);
        this.name = 'SpecError';
    }
}
exports.SpecError = SpecError;
/**
 * Error when a specification is not found
 */
class SpecNotFoundError extends SpecError {
    identifier;
    constructor(identifier) {
        super(`Specification not found: ${identifier}`, 'SPEC_NOT_FOUND', { identifier });
        this.name = 'SpecNotFoundError';
        this.identifier = identifier;
    }
}
exports.SpecNotFoundError = SpecNotFoundError;
/**
 * Error when specification already exists
 */
class SpecExistsError extends SpecError {
    identifier;
    constructor(identifier) {
        super(`Specification already exists: ${identifier}`, 'SPEC_EXISTS', { identifier });
        this.name = 'SpecExistsError';
        this.identifier = identifier;
    }
}
exports.SpecExistsError = SpecExistsError;
/**
 * Error when specification validation fails
 */
class SpecValidationError extends SpecError {
    specPath;
    validationErrors;
    constructor(specPath, errors) {
        super(`Specification validation failed: ${specPath}`, 'SPEC_VALIDATION_FAILED', { specPath, errors });
        this.name = 'SpecValidationError';
        this.specPath = specPath;
        this.validationErrors = errors;
    }
}
exports.SpecValidationError = SpecValidationError;
// ============================================================================
// Log Module Errors
// ============================================================================
/**
 * Base error for log module operations
 */
class LogError extends FaberError {
    constructor(operation, message, details) {
        super(`Log ${operation}: ${message}`, 'LOG_ERROR', details);
        this.name = 'LogError';
    }
}
exports.LogError = LogError;
/**
 * Error when no active capture session exists
 */
class NoActiveSessionError extends LogError {
    constructor() {
        super('No active capture session', 'NO_ACTIVE_SESSION', {});
        this.name = 'NoActiveSessionError';
    }
}
exports.NoActiveSessionError = NoActiveSessionError;
/**
 * Error when session is already active
 */
class SessionActiveError extends LogError {
    sessionId;
    constructor(sessionId) {
        super(`Capture session already active: ${sessionId}`, 'SESSION_ACTIVE', { sessionId });
        this.name = 'SessionActiveError';
        this.sessionId = sessionId;
    }
}
exports.SessionActiveError = SessionActiveError;
/**
 * Error when log is not found
 */
class LogNotFoundError extends LogError {
    logPath;
    constructor(logPath) {
        super(`Log not found: ${logPath}`, 'LOG_NOT_FOUND', { logPath });
        this.name = 'LogNotFoundError';
        this.logPath = logPath;
    }
}
exports.LogNotFoundError = LogNotFoundError;
// ============================================================================
// State Module Errors
// ============================================================================
/**
 * Base error for state module operations
 */
class StateError extends FaberError {
    constructor(message, details) {
        super(message, 'STATE_ERROR', details);
        this.name = 'StateError';
    }
}
exports.StateError = StateError;
// ============================================================================
// Workflow Module Errors
// ============================================================================
/**
 * Base error for workflow module operations
 */
class WorkflowError extends FaberError {
    constructor(message, details) {
        super(message, 'WORKFLOW_ERROR', details);
        this.name = 'WorkflowError';
    }
}
exports.WorkflowError = WorkflowError;
/**
 * Error when a phase fails
 */
class PhaseFailedError extends WorkflowError {
    phase;
    reason;
    constructor(phase, reason) {
        super(`Phase ${phase} failed: ${reason}`, { phase, reason });
        this.name = 'PhaseFailedError';
        this.phase = phase;
        this.reason = reason;
    }
}
exports.PhaseFailedError = PhaseFailedError;
/**
 * Error when workflow state is invalid
 */
class InvalidWorkflowStateError extends WorkflowError {
    constructor(message, currentState) {
        super(message, { currentState });
        this.name = 'InvalidWorkflowStateError';
    }
}
exports.InvalidWorkflowStateError = InvalidWorkflowStateError;
/**
 * Error when max retries exceeded
 */
class MaxRetriesExceededError extends WorkflowError {
    phase;
    attempts;
    constructor(phase, attempts) {
        super(`Max retries exceeded for phase ${phase} (${attempts} attempts)`, { phase, attempts });
        this.name = 'MaxRetriesExceededError';
        this.phase = phase;
        this.attempts = attempts;
    }
}
exports.MaxRetriesExceededError = MaxRetriesExceededError;
/**
 * Error when approval is required but not granted
 */
class ApprovalRequiredError extends WorkflowError {
    phase;
    constructor(phase) {
        super(`Approval required for phase: ${phase}`, { phase });
        this.name = 'ApprovalRequiredError';
        this.phase = phase;
    }
}
exports.ApprovalRequiredError = ApprovalRequiredError;
// ============================================================================
// Provider Errors
// ============================================================================
/**
 * Error for provider-specific issues
 */
class ProviderError extends FaberError {
    provider;
    operation;
    constructor(provider, operation, message, details) {
        super(message, 'PROVIDER_ERROR', { ...details, provider, operation });
        this.name = 'ProviderError';
        this.provider = provider;
        this.operation = operation;
    }
}
exports.ProviderError = ProviderError;
/**
 * Error for authentication failures
 */
class AuthenticationError extends ProviderError {
    constructor(provider, message) {
        super(provider, 'authenticate', message || `Authentication failed for ${provider}`, {});
        this.name = 'AuthenticationError';
    }
}
exports.AuthenticationError = AuthenticationError;
/**
 * Error for rate limiting
 */
class RateLimitError extends ProviderError {
    retryAfter;
    constructor(provider, retryAfter) {
        super(provider, 'request', `Rate limit exceeded for ${provider}${retryAfter ? `, retry after ${retryAfter}s` : ''}`, { retryAfter });
        this.name = 'RateLimitError';
        this.retryAfter = retryAfter;
    }
}
exports.RateLimitError = RateLimitError;
/**
 * Error for network failures
 */
class NetworkError extends ProviderError {
    constructor(provider, operation, reason) {
        super(provider, operation, `Network error: ${reason}`, { reason });
        this.name = 'NetworkError';
    }
}
exports.NetworkError = NetworkError;
// ============================================================================
// Command Execution Errors
// ============================================================================
/**
 * Error when shell command execution fails
 */
class CommandExecutionError extends FaberError {
    command;
    exitCode;
    stderr;
    constructor(command, exitCode, stderr) {
        super(`Command failed with exit code ${exitCode}: ${command}`, 'COMMAND_EXECUTION_FAILED', { command, exitCode, stderr });
        this.name = 'CommandExecutionError';
        this.command = command;
        this.exitCode = exitCode;
        this.stderr = stderr;
    }
}
exports.CommandExecutionError = CommandExecutionError;
//# sourceMappingURL=errors.js.map