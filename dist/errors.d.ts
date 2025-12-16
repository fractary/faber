/**
 * @fractary/faber - Error Types
 *
 * Hierarchical error classes for the FABER SDK.
 */
/**
 * Base error for all FABER errors
 */
export declare class FaberError extends Error {
    readonly code: string;
    readonly details?: Record<string, unknown>;
    constructor(message: string, code: string, details?: Record<string, unknown>);
    toJSON(): Record<string, unknown>;
}
/**
 * Error for configuration issues
 */
export declare class ConfigurationError extends FaberError {
    constructor(message: string, details?: Record<string, unknown>);
}
/**
 * Error when configuration file is not found
 */
export declare class ConfigNotFoundError extends ConfigurationError {
    constructor(path: string);
}
/**
 * Error when configuration is invalid
 */
export declare class ConfigValidationError extends ConfigurationError {
    readonly errors: string[];
    constructor(errors: string[]);
}
/**
 * Base error for work module operations
 */
export declare class WorkError extends FaberError {
    constructor(message: string, code: string, details?: Record<string, unknown>);
}
/**
 * Error when an issue is not found
 */
export declare class IssueNotFoundError extends WorkError {
    readonly issueId: string | number;
    constructor(issueId: string | number);
}
/**
 * Error when issue creation fails
 */
export declare class IssueCreateError extends WorkError {
    constructor(reason: string, details?: Record<string, unknown>);
}
/**
 * Error when label operation fails
 */
export declare class LabelError extends WorkError {
    constructor(operation: string, label: string, reason: string);
}
/**
 * Error when milestone operation fails
 */
export declare class MilestoneError extends WorkError {
    constructor(operation: string, milestone: string, reason: string);
}
/**
 * Base error for repo module operations
 */
export declare class RepoError extends FaberError {
    constructor(message: string, code: string, details?: Record<string, unknown>);
}
/**
 * Error when a branch already exists
 */
export declare class BranchExistsError extends RepoError {
    readonly branchName: string;
    constructor(branchName: string);
}
/**
 * Error when a branch is not found
 */
export declare class BranchNotFoundError extends RepoError {
    readonly branchName: string;
    constructor(branchName: string);
}
/**
 * Error when attempting operation on protected branch
 */
export declare class ProtectedBranchError extends RepoError {
    readonly branchName: string;
    readonly operation: string;
    constructor(branchName: string, operation: string);
}
/**
 * Error when commit fails
 */
export declare class CommitError extends RepoError {
    constructor(reason: string, details?: Record<string, unknown>);
}
/**
 * Error when push fails
 */
export declare class PushError extends RepoError {
    constructor(reason: string, details?: Record<string, unknown>);
}
/**
 * Error when pull request is not found
 */
export declare class PRNotFoundError extends RepoError {
    readonly prNumber: number;
    constructor(prNumber: number);
}
/**
 * Error when pull request operation fails
 */
export declare class PRError extends RepoError {
    readonly prNumber?: number;
    constructor(operation: string, reason: string, prNumber?: number);
}
/**
 * Error for merge conflicts
 */
export declare class MergeConflictError extends RepoError {
    readonly conflicts: string[];
    constructor(conflicts: string[]);
}
/**
 * Error when working directory has uncommitted changes
 */
export declare class DirtyWorkingDirectoryError extends RepoError {
    readonly files: string[];
    constructor(files: string[]);
}
/**
 * Base error for spec module operations
 */
export declare class SpecError extends FaberError {
    constructor(operation: string, message: string, details?: Record<string, unknown>);
}
/**
 * Error when a specification is not found
 */
export declare class SpecNotFoundError extends SpecError {
    readonly identifier: string;
    constructor(identifier: string);
}
/**
 * Error when specification already exists
 */
export declare class SpecExistsError extends SpecError {
    readonly identifier: string;
    constructor(identifier: string);
}
/**
 * Error when specification validation fails
 */
export declare class SpecValidationError extends SpecError {
    readonly specPath: string;
    readonly validationErrors: string[];
    constructor(specPath: string, errors: string[]);
}
/**
 * Base error for log module operations
 */
export declare class LogError extends FaberError {
    constructor(operation: string, message: string, details?: Record<string, unknown>);
}
/**
 * Error when no active capture session exists
 */
export declare class NoActiveSessionError extends LogError {
    constructor();
}
/**
 * Error when session is already active
 */
export declare class SessionActiveError extends LogError {
    readonly sessionId: string;
    constructor(sessionId: string);
}
/**
 * Error when log is not found
 */
export declare class LogNotFoundError extends LogError {
    readonly logPath: string;
    constructor(logPath: string);
}
/**
 * Base error for state module operations
 */
export declare class StateError extends FaberError {
    constructor(message: string, details?: Record<string, unknown>);
}
/**
 * Base error for workflow module operations
 */
export declare class WorkflowError extends FaberError {
    constructor(message: string, details?: Record<string, unknown>);
}
/**
 * Error when a phase fails
 */
export declare class PhaseFailedError extends WorkflowError {
    readonly phase: string;
    readonly reason: string;
    constructor(phase: string, reason: string);
}
/**
 * Error when workflow state is invalid
 */
export declare class InvalidWorkflowStateError extends WorkflowError {
    constructor(message: string, currentState: string);
}
/**
 * Error when max retries exceeded
 */
export declare class MaxRetriesExceededError extends WorkflowError {
    readonly phase: string;
    readonly attempts: number;
    constructor(phase: string, attempts: number);
}
/**
 * Error when approval is required but not granted
 */
export declare class ApprovalRequiredError extends WorkflowError {
    readonly phase: string;
    constructor(phase: string);
}
/**
 * Error for provider-specific issues
 */
export declare class ProviderError extends FaberError {
    readonly provider: string;
    readonly operation: string;
    constructor(provider: string, operation: string, message: string, details?: Record<string, unknown>);
}
/**
 * Error for authentication failures
 */
export declare class AuthenticationError extends ProviderError {
    constructor(provider: string, message?: string);
}
/**
 * Error for rate limiting
 */
export declare class RateLimitError extends ProviderError {
    readonly retryAfter?: number;
    constructor(provider: string, retryAfter?: number);
}
/**
 * Error for network failures
 */
export declare class NetworkError extends ProviderError {
    constructor(provider: string, operation: string, reason: string);
}
/**
 * Error when shell command execution fails
 */
export declare class CommandExecutionError extends FaberError {
    readonly command: string;
    readonly exitCode: number;
    readonly stderr: string;
    constructor(command: string, exitCode: number, stderr: string);
}
//# sourceMappingURL=errors.d.ts.map