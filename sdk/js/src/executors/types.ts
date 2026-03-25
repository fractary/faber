/**
 * @fractary/faber - Step Executor Types
 *
 * Defines the abstraction layer between workflow steps and the models/services
 * that execute them. Enables multi-model workflows where individual steps can
 * be routed to different providers (Claude, OpenAI, self-hosted LLMs, HTTP APIs).
 */

// ============================================================================
// Step Executor Configuration
// ============================================================================

/**
 * Executor configuration for a workflow step.
 *
 * When specified on a step, overrides the default execution behavior
 * (Claude Code direct execution) and routes to the specified provider.
 *
 * Config cascade: step.executor > phase_executors[phase] > workflow.executor > system default
 *
 * @example
 * ```yaml
 * steps:
 *   - id: review-code
 *     prompt: "Review this code for security issues..."
 *     executor:
 *       provider: openai
 *       model: gpt-4o
 * ```
 */
export interface StepExecutorConfig {
  /**
   * Provider identifier.
   *
   * Built-in providers:
   * - 'claude': Anthropic Messages API (default env: ANTHROPIC_API_KEY)
   * - 'openai': OpenAI Chat Completions API (default env: OPENAI_API_KEY)
   * - 'openai-compatible': Any OpenAI-compatible endpoint (Ollama, vLLM, Together, Groq)
   * - 'http': Generic HTTP POST (for non-LLM APIs like Banana, Replicate)
   * - 'command': Shell command execution
   */
  provider: string;

  /** Model identifier within the provider (e.g., 'gpt-4o', 'claude-haiku-4-5', 'llama3') */
  model?: string;

  /** Base URL for openai-compatible or http providers */
  base_url?: string;

  /**
   * Environment variable name containing the API key.
   * When omitted, uses provider default (e.g., OPENAI_API_KEY for 'openai').
   */
  api_key_env?: string;

  /** Maximum tokens for the response */
  max_tokens?: number;

  /** Temperature (0-2) */
  temperature?: number;

  /**
   * System prompt override.
   * Replaces the default system prompt for this step's execution.
   * Useful for specializing model behavior (e.g., "You are an image generation assistant").
   */
  system_prompt?: string;
}

// ============================================================================
// Execution Context
// ============================================================================

/**
 * Context passed to executors for each step invocation.
 * Provides the executor with information about the workflow, current step,
 * and outputs from previous steps.
 */
export interface ExecutionContext {
  /** Work item identifier (e.g., GitHub issue number) */
  workId: string;

  /** Current phase name (frame, architect, build, evaluate, release) */
  phase: string;

  /** Current step ID */
  stepId: string;

  /** Current step display name */
  stepName: string;

  /** Outputs from previously completed steps, keyed by step ID */
  previousOutputs: Record<string, Record<string, unknown>>;

  /** Issue context if available */
  issue?: {
    number: number;
    title: string;
    body: string;
  };

  /** Working directory for file operations */
  workingDirectory: string;

  /** Run ID for state tracking */
  runId?: string;
}

// ============================================================================
// Executor Result
// ============================================================================

/**
 * Result from an executor invocation.
 * Maps to the existing result_handling system (success/warning/failure).
 */
export interface ExecutorResult {
  /** The textual output from the executor */
  output: string;

  /** Execution status, aligns with step result_handling */
  status: 'success' | 'warning' | 'failure';

  /** Metadata about the execution */
  metadata: {
    /** Provider that executed this step */
    provider: string;
    /** Model used (if applicable) */
    model?: string;
    /** Execution duration in milliseconds */
    duration_ms: number;
    /** Token usage (if the provider reports it) */
    tokens_used?: {
      input: number;
      output: number;
    };
  };

  /** Error message if status is 'failure' */
  error?: string;
}

// ============================================================================
// Executor Interface
// ============================================================================

/**
 * The Executor interface that all providers implement.
 *
 * Executors are stateless — each `execute()` call is independent.
 * Configuration (API keys, endpoints) comes from the StepExecutorConfig
 * and environment variables.
 */
export interface Executor {
  /** Provider name (e.g., 'claude', 'openai', 'http') */
  readonly provider: string;

  /**
   * Execute a step prompt and return the result.
   *
   * @param prompt - The step prompt text (may include context overlays)
   * @param context - Workflow execution context
   * @param config - Executor-specific configuration from the step/workflow
   * @returns Structured result with output, status, and metadata
   */
  execute(
    prompt: string,
    context: ExecutionContext,
    config: StepExecutorConfig,
  ): Promise<ExecutorResult>;

  /**
   * Validate that the executor can run with the given config.
   * Checks for required environment variables, endpoint reachability, etc.
   * Called during plan validation for fast-fail before execution starts.
   *
   * @param config - Executor configuration to validate
   * @returns Validation result with error message if invalid
   */
  validate(config: StepExecutorConfig): Promise<{ valid: boolean; error?: string }>;
}

// ============================================================================
// Executor Factory
// ============================================================================

/**
 * Factory function that creates an Executor instance.
 * Used by the ExecutorRegistry for lazy instantiation.
 */
export type ExecutorFactory = () => Executor;
