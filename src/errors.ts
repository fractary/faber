/**
 * @fractary/faber - Error Types
 *
 * Hierarchical error classes for the FABER SDK.
 */

/**
 * Base error for all FABER errors
 */
export class FaberError extends Error {
  readonly code: string;
  readonly details?: Record<string, unknown>;

  constructor(message: string, code: string, details?: Record<string, unknown>) {
    super(message);
    this.name = 'FaberError';
    this.code = code;
    this.details = details;
    Error.captureStackTrace?.(this, this.constructor);
  }

  toJSON(): Record<string, unknown> {
    return {
      name: this.name,
      code: this.code,
      message: this.message,
      details: this.details,
    };
  }
}

// ============================================================================
// Configuration Errors
// ============================================================================

/**
 * Error for configuration issues
 */
export class ConfigurationError extends FaberError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(message, 'CONFIG_ERROR', details);
    this.name = 'ConfigurationError';
  }
}

/**
 * Error when configuration file is not found
 */
export class ConfigNotFoundError extends ConfigurationError {
  constructor(path: string) {
    super(`Configuration file not found: ${path}`, { path });
    this.name = 'ConfigNotFoundError';
  }
}

/**
 * Error when configuration is invalid
 */
export class ConfigValidationError extends ConfigurationError {
  readonly errors: string[];

  constructor(errors: string[]) {
    super(`Configuration validation failed: ${errors.join(', ')}`, { errors });
    this.name = 'ConfigValidationError';
    this.errors = errors;
  }
}

// ============================================================================
// Work Module Errors
// ============================================================================

/**
 * Base error for work module operations
 */
export class WorkError extends FaberError {
  constructor(message: string, code: string, details?: Record<string, unknown>) {
    super(message, code, details);
    this.name = 'WorkError';
  }
}

/**
 * Error when an issue is not found
 */
export class IssueNotFoundError extends WorkError {
  readonly issueId: string | number;

  constructor(issueId: string | number) {
    super(`Issue not found: ${issueId}`, 'ISSUE_NOT_FOUND', { issueId });
    this.name = 'IssueNotFoundError';
    this.issueId = issueId;
  }
}

/**
 * Error when issue creation fails
 */
export class IssueCreateError extends WorkError {
  constructor(reason: string, details?: Record<string, unknown>) {
    super(`Failed to create issue: ${reason}`, 'ISSUE_CREATE_FAILED', details);
    this.name = 'IssueCreateError';
  }
}

/**
 * Error when label operation fails
 */
export class LabelError extends WorkError {
  constructor(operation: string, label: string, reason: string) {
    super(`Failed to ${operation} label '${label}': ${reason}`, 'LABEL_ERROR', {
      operation,
      label,
      reason,
    });
    this.name = 'LabelError';
  }
}

/**
 * Error when milestone operation fails
 */
export class MilestoneError extends WorkError {
  constructor(operation: string, milestone: string, reason: string) {
    super(`Failed to ${operation} milestone '${milestone}': ${reason}`, 'MILESTONE_ERROR', {
      operation,
      milestone,
      reason,
    });
    this.name = 'MilestoneError';
  }
}

// ============================================================================
// Repo Module Errors
// ============================================================================

/**
 * Base error for repo module operations
 */
export class RepoError extends FaberError {
  constructor(message: string, code: string, details?: Record<string, unknown>) {
    super(message, code, details);
    this.name = 'RepoError';
  }
}

/**
 * Error when a branch already exists
 */
export class BranchExistsError extends RepoError {
  readonly branchName: string;

  constructor(branchName: string) {
    super(`Branch already exists: ${branchName}`, 'BRANCH_EXISTS', { branchName });
    this.name = 'BranchExistsError';
    this.branchName = branchName;
  }
}

/**
 * Error when a branch is not found
 */
export class BranchNotFoundError extends RepoError {
  readonly branchName: string;

  constructor(branchName: string) {
    super(`Branch not found: ${branchName}`, 'BRANCH_NOT_FOUND', { branchName });
    this.name = 'BranchNotFoundError';
    this.branchName = branchName;
  }
}

/**
 * Error when attempting operation on protected branch
 */
export class ProtectedBranchError extends RepoError {
  readonly branchName: string;
  readonly operation: string;

  constructor(branchName: string, operation: string) {
    super(
      `Cannot ${operation} protected branch: ${branchName}`,
      'PROTECTED_BRANCH',
      { branchName, operation }
    );
    this.name = 'ProtectedBranchError';
    this.branchName = branchName;
    this.operation = operation;
  }
}

/**
 * Error when commit fails
 */
export class CommitError extends RepoError {
  constructor(reason: string, details?: Record<string, unknown>) {
    super(`Commit failed: ${reason}`, 'COMMIT_FAILED', details);
    this.name = 'CommitError';
  }
}

/**
 * Error when push fails
 */
export class PushError extends RepoError {
  constructor(reason: string, details?: Record<string, unknown>) {
    super(`Push failed: ${reason}`, 'PUSH_FAILED', details);
    this.name = 'PushError';
  }
}

/**
 * Error when pull request is not found
 */
export class PRNotFoundError extends RepoError {
  readonly prNumber: number;

  constructor(prNumber: number) {
    super(`Pull request not found: #${prNumber}`, 'PR_NOT_FOUND', { prNumber });
    this.name = 'PRNotFoundError';
    this.prNumber = prNumber;
  }
}

/**
 * Error when pull request operation fails
 */
export class PRError extends RepoError {
  readonly prNumber?: number;

  constructor(operation: string, reason: string, prNumber?: number) {
    super(
      `PR ${operation} failed: ${reason}`,
      'PR_ERROR',
      { operation, reason, prNumber }
    );
    this.name = 'PRError';
    this.prNumber = prNumber;
  }
}

/**
 * Error for merge conflicts
 */
export class MergeConflictError extends RepoError {
  readonly conflicts: string[];

  constructor(conflicts: string[]) {
    super(
      `Merge conflict in files: ${conflicts.join(', ')}`,
      'MERGE_CONFLICT',
      { conflicts }
    );
    this.name = 'MergeConflictError';
    this.conflicts = conflicts;
  }
}

/**
 * Error when working directory has uncommitted changes
 */
export class DirtyWorkingDirectoryError extends RepoError {
  readonly files: string[];

  constructor(files: string[]) {
    super(
      'Working directory has uncommitted changes',
      'DIRTY_WORKING_DIRECTORY',
      { files }
    );
    this.name = 'DirtyWorkingDirectoryError';
    this.files = files;
  }
}

// ============================================================================
// Spec Module Errors
// ============================================================================

/**
 * Base error for spec module operations
 */
export class SpecError extends FaberError {
  constructor(operation: string, message: string, details?: Record<string, unknown>) {
    super(`Spec ${operation}: ${message}`, 'SPEC_ERROR', details);
    this.name = 'SpecError';
  }
}

/**
 * Error when a specification is not found
 */
export class SpecNotFoundError extends SpecError {
  readonly identifier: string;

  constructor(identifier: string) {
    super(`Specification not found: ${identifier}`, 'SPEC_NOT_FOUND', { identifier });
    this.name = 'SpecNotFoundError';
    this.identifier = identifier;
  }
}

/**
 * Error when specification already exists
 */
export class SpecExistsError extends SpecError {
  readonly identifier: string;

  constructor(identifier: string) {
    super(`Specification already exists: ${identifier}`, 'SPEC_EXISTS', { identifier });
    this.name = 'SpecExistsError';
    this.identifier = identifier;
  }
}

/**
 * Error when specification validation fails
 */
export class SpecValidationError extends SpecError {
  readonly specPath: string;
  readonly validationErrors: string[];

  constructor(specPath: string, errors: string[]) {
    super(
      `Specification validation failed: ${specPath}`,
      'SPEC_VALIDATION_FAILED',
      { specPath, errors }
    );
    this.name = 'SpecValidationError';
    this.specPath = specPath;
    this.validationErrors = errors;
  }
}

// ============================================================================
// Log Module Errors
// ============================================================================

/**
 * Base error for log module operations
 */
export class LogError extends FaberError {
  constructor(operation: string, message: string, details?: Record<string, unknown>) {
    super(`Log ${operation}: ${message}`, 'LOG_ERROR', details);
    this.name = 'LogError';
  }
}

/**
 * Error when no active capture session exists
 */
export class NoActiveSessionError extends LogError {
  constructor() {
    super('No active capture session', 'NO_ACTIVE_SESSION', {});
    this.name = 'NoActiveSessionError';
  }
}

/**
 * Error when session is already active
 */
export class SessionActiveError extends LogError {
  readonly sessionId: string;

  constructor(sessionId: string) {
    super(`Capture session already active: ${sessionId}`, 'SESSION_ACTIVE', { sessionId });
    this.name = 'SessionActiveError';
    this.sessionId = sessionId;
  }
}

/**
 * Error when log is not found
 */
export class LogNotFoundError extends LogError {
  readonly logPath: string;

  constructor(logPath: string) {
    super(`Log not found: ${logPath}`, 'LOG_NOT_FOUND', { logPath });
    this.name = 'LogNotFoundError';
    this.logPath = logPath;
  }
}

// ============================================================================
// State Module Errors
// ============================================================================

/**
 * Base error for state module operations
 */
export class StateError extends FaberError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(message, 'STATE_ERROR', details);
    this.name = 'StateError';
  }
}

// ============================================================================
// Workflow Module Errors
// ============================================================================

/**
 * Base error for workflow module operations
 */
export class WorkflowError extends FaberError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(message, 'WORKFLOW_ERROR', details);
    this.name = 'WorkflowError';
  }
}

/**
 * Error when a phase fails
 */
export class PhaseFailedError extends WorkflowError {
  readonly phase: string;
  readonly reason: string;

  constructor(phase: string, reason: string) {
    super(`Phase ${phase} failed: ${reason}`, { phase, reason });
    this.name = 'PhaseFailedError';
    this.phase = phase;
    this.reason = reason;
  }
}

/**
 * Error when workflow state is invalid
 */
export class InvalidWorkflowStateError extends WorkflowError {
  constructor(message: string, currentState: string) {
    super(message, { currentState });
    this.name = 'InvalidWorkflowStateError';
  }
}

/**
 * Error when max retries exceeded
 */
export class MaxRetriesExceededError extends WorkflowError {
  readonly phase: string;
  readonly attempts: number;

  constructor(phase: string, attempts: number) {
    super(
      `Max retries exceeded for phase ${phase} (${attempts} attempts)`,
      { phase, attempts }
    );
    this.name = 'MaxRetriesExceededError';
    this.phase = phase;
    this.attempts = attempts;
  }
}

/**
 * Error when approval is required but not granted
 */
export class ApprovalRequiredError extends WorkflowError {
  readonly phase: string;

  constructor(phase: string) {
    super(`Approval required for phase: ${phase}`, { phase });
    this.name = 'ApprovalRequiredError';
    this.phase = phase;
  }
}

// ============================================================================
// Provider Errors
// ============================================================================

/**
 * Error for provider-specific issues
 */
export class ProviderError extends FaberError {
  readonly provider: string;
  readonly operation: string;

  constructor(
    provider: string,
    operation: string,
    message: string,
    details?: Record<string, unknown>
  ) {
    super(message, 'PROVIDER_ERROR', { ...details, provider, operation });
    this.name = 'ProviderError';
    this.provider = provider;
    this.operation = operation;
  }
}

/**
 * Error for authentication failures
 */
export class AuthenticationError extends ProviderError {
  constructor(provider: string, message?: string) {
    super(
      provider,
      'authenticate',
      message || `Authentication failed for ${provider}`,
      {}
    );
    this.name = 'AuthenticationError';
  }
}

/**
 * Error for rate limiting
 */
export class RateLimitError extends ProviderError {
  readonly retryAfter?: number;

  constructor(provider: string, retryAfter?: number) {
    super(
      provider,
      'request',
      `Rate limit exceeded for ${provider}${retryAfter ? `, retry after ${retryAfter}s` : ''}`,
      { retryAfter }
    );
    this.name = 'RateLimitError';
    this.retryAfter = retryAfter;
  }
}

/**
 * Error for network failures
 */
export class NetworkError extends ProviderError {
  constructor(provider: string, operation: string, reason: string) {
    super(provider, operation, `Network error: ${reason}`, { reason });
    this.name = 'NetworkError';
  }
}

// ============================================================================
// Command Execution Errors
// ============================================================================

/**
 * Error when shell command execution fails
 */
export class CommandExecutionError extends FaberError {
  readonly command: string;
  readonly exitCode: number;
  readonly stderr: string;

  constructor(command: string, exitCode: number, stderr: string) {
    super(
      `Command failed with exit code ${exitCode}: ${command}`,
      'COMMAND_EXECUTION_FAILED',
      { command, exitCode, stderr }
    );
    this.name = 'CommandExecutionError';
    this.command = command;
    this.exitCode = exitCode;
    this.stderr = stderr;
  }
}
