/**
 * @fractary/faber - Step Executor Types
 *
 * Defines the abstraction layer between workflow steps and the models/services
 * that execute them. Enables multi-model workflows where individual steps can
 * be routed to different providers (Claude, OpenAI, self-hosted LLMs, HTTP APIs)
 * or agentic harnesses (Claude Code, OpenCode, Codex).
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

// ============================================================================
// Step Runtime Configuration (CLI-native execution)
// ============================================================================

/**
 * Agentic harness identifiers for CLI-native workflow execution.
 *
 * Each harness represents a runtime environment that can execute workflow steps.
 * Steps specify their harness to control how they're executed when running
 * via `workflow-execute` (CLI-native mode).
 *
 * In LLM-based mode (workflow-run skill), these are ignored — the orchestrating
 * LLM executes steps directly within its own session.
 */
export type HarnessType = 'claude-code' | 'opencode' | 'codex' | 'api';

/**
 * Runtime configuration for a workflow step in CLI-native execution mode.
 *
 * These attributes are resolved via a cascade:
 *   step-level > phase_defaults[phase] > workflow.defaults > CLI args > system defaults
 *
 * All fields are optional — unset fields inherit from the next level in the cascade.
 */
export interface StepRuntimeConfig {
  /** Model identifier (e.g., 'claude-sonnet-4-6-20250514', 'gpt-4o') */
  model?: string;

  /**
   * Agentic harness to use for step execution.
   * - 'claude-code': Claude Agent SDK — full tool use, file access, skills
   * - 'opencode': OpenCode CLI/SDK (future)
   * - 'codex': OpenAI Codex CLI (future)
   * - 'api': Direct Messages API — text-in/text-out, no tool use
   */
  harness?: HarnessType;

  /** Maximum agentic turns (tool-use round trips) */
  maxTurns?: number;

  /** Maximum budget in USD for this step */
  maxBudgetUsd?: number;

  /** Tools the agent is allowed to use (e.g., ['Read', 'Write', 'Edit', 'Bash']) */
  allowedTools?: string[];

  /** Skills to make available (e.g., ['fractary-repo', 'fractary-work']) */
  skills?: string[];

  /** MCP server configurations keyed by server name */
  mcp?: Record<string, { command: string; args?: string[] }>;
}

/**
 * Structured metadata auto-injected into each step's system prompt.
 *
 * Provides self-service pointers so the step can pull additional context
 * if needed, without paying the token cost of loading it all upfront.
 * Steps are designed to be stateless by default — the metadata block
 * is a safety net for self-service lookups, not a context dump.
 */
export interface StepWorkflowMetadata {
  work_id: string;
  plan_id?: string;
  run_id?: string;
  state_path?: string;
  plan_path?: string;
  branch?: string;
  phase: string;
  step_id: string;
  step_index: number;
  steps_total: number;
  project_root: string;
}

/**
 * Context for building a step's hierarchical system prompt.
 *
 * System prompt composition order:
 *   1. Workflow-level prompt (from workflow.prompt or defaults.prompt)
 *   2. Phase-level prompt (from phase_defaults[phase].prompt)
 *   3. Structured metadata (auto-injected)
 */
export interface StepPromptContext {
  /** Workflow-level prompt setting the overall mission */
  workflowPrompt?: string;

  /** Phase-level prompt adding phase-specific guidance */
  phasePrompt?: string;

  /** Structured metadata for self-service context lookups */
  metadata: StepWorkflowMetadata;
}

/**
 * Compose the hierarchical system prompt for a step.
 *
 * Concatenates workflow prompt, phase prompt, and structured metadata
 * into a single string suitable for `systemPrompt.append` in the Agent SDK
 * or the system prompt body in direct API mode.
 */
export function buildSystemPrompt(promptContext: StepPromptContext): string {
  const parts: string[] = [];

  if (promptContext.workflowPrompt) {
    parts.push(promptContext.workflowPrompt);
  }

  if (promptContext.phasePrompt) {
    parts.push(promptContext.phasePrompt);
  }

  // Structured metadata block
  const meta = promptContext.metadata;
  const metadataBlock = [
    'FABER_WORKFLOW_CONTEXT:',
    `  work_id: "${meta.work_id}"`,
    meta.plan_id ? `  plan_id: "${meta.plan_id}"` : null,
    meta.run_id ? `  run_id: "${meta.run_id}"` : null,
    meta.state_path ? `  state_path: "${meta.state_path}"` : null,
    meta.plan_path ? `  plan_path: "${meta.plan_path}"` : null,
    meta.branch ? `  branch: "${meta.branch}"` : null,
    `  phase: "${meta.phase}"`,
    `  step_id: "${meta.step_id}"`,
    `  step_index: ${meta.step_index}`,
    `  steps_total: ${meta.steps_total}`,
    `  project_root: "${meta.project_root}"`,
  ].filter(Boolean).join('\n');

  parts.push(metadataBlock);

  return parts.join('\n\n');
}

/**
 * Default runtime configuration for workflow steps.
 *
 * Workflow-level defaults that apply when no step, phase, or workflow
 * override is specified. Used as the final fallback in the cascade.
 */
export interface RuntimeDefaults {
  /** Workflow-level system prompt (sets overall mission context) */
  prompt?: string;
  /** Default model for all steps */
  model?: string;
  /** Default harness for all steps */
  harness?: string;
  /** Default max agentic turns */
  max_turns?: number;
  /** Default max budget per step */
  max_budget_usd?: number;
  /** Default allowed tools */
  allowed_tools?: string[];
  /** Default skills */
  skills?: string[];
  /** Default MCP servers */
  mcp?: Record<string, { command: string; args?: string[] }>;
}

/**
 * Per-phase runtime defaults (extends RuntimeDefaults with phase-specific prompt).
 */
export interface PhaseRuntimeDefaults extends RuntimeDefaults {
  /** Phase-level system prompt (adds phase-specific guidance) */
  prompt?: string;
}

/**
 * Resolve runtime configuration for a step using the cascade:
 *   step-level > phase_defaults[phase] > workflow.defaults > cliOverrides > system defaults
 *
 * @param step - Step-level runtime config (from workflow step definition)
 * @param phaseDefaults - Phase-level defaults (from workflow.phase_defaults[phase])
 * @param workflowDefaults - Workflow-level defaults (from workflow.defaults)
 * @param cliOverrides - CLI-provided overrides (from --model, --harness flags)
 * @returns Fully resolved runtime config
 */
export function resolveRuntimeConfig(
  step: Partial<StepRuntimeConfig> | undefined,
  phaseDefaults: Partial<RuntimeDefaults> | undefined,
  workflowDefaults: Partial<RuntimeDefaults> | undefined,
  cliOverrides?: Partial<StepRuntimeConfig>,
): StepRuntimeConfig {
  return {
    model:
      step?.model ??
      phaseDefaults?.model ??
      workflowDefaults?.model ??
      cliOverrides?.model ??
      undefined,
    harness: (
      step?.harness ??
      phaseDefaults?.harness ??
      workflowDefaults?.harness ??
      cliOverrides?.harness ??
      'claude-code'
    ) as HarnessType,
    maxTurns:
      step?.maxTurns ??
      phaseDefaults?.max_turns ??
      workflowDefaults?.max_turns ??
      cliOverrides?.maxTurns ??
      undefined,
    maxBudgetUsd:
      step?.maxBudgetUsd ??
      phaseDefaults?.max_budget_usd ??
      workflowDefaults?.max_budget_usd ??
      cliOverrides?.maxBudgetUsd ??
      undefined,
    allowedTools:
      step?.allowedTools ??
      phaseDefaults?.allowed_tools ??
      workflowDefaults?.allowed_tools ??
      cliOverrides?.allowedTools ??
      undefined,
    skills:
      step?.skills ??
      phaseDefaults?.skills ??
      workflowDefaults?.skills ??
      cliOverrides?.skills ??
      undefined,
    mcp:
      step?.mcp ??
      phaseDefaults?.mcp ??
      workflowDefaults?.mcp ??
      cliOverrides?.mcp ??
      undefined,
  };
}
