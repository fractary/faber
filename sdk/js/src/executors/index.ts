/**
 * @fractary/faber - Executors Module
 *
 * Multi-model step execution framework for FABER workflows.
 *
 * @example
 * ```typescript
 * import { ExecutorRegistry, ClaudeExecutor, OpenAIExecutor } from '@fractary/faber';
 *
 * const registry = ExecutorRegistry.createDefault();
 * const result = await registry.get('openai').execute(prompt, context, config);
 * ```
 */

// Types
export type {
  StepExecutorConfig,
  ExecutionContext,
  ExecutorResult,
  Executor,
  ExecutorFactory,
  HarnessType,
  StepRuntimeConfig,
  StepWorkflowMetadata,
  StepPromptContext,
  RuntimeDefaults,
  PhaseRuntimeDefaults,
  PermissionMode,
} from './types.js';

// Runtime config utilities
export {
  buildSystemPrompt,
  resolveRuntimeConfig,
  PERMISSION_MODES,
  DEFAULT_PERMISSION_MODE,
} from './types.js';

// Step responses (FABER response blocks decide step status)
export {
  applyStepResponse,
  findResponseBlock,
  StepResponseSchema,
  type StepResponse,
  type StepResponseReason,
  type StepResponseOptions,
} from './step-response.js';

// Registry
export { ExecutorRegistry } from './registry.js';

// Providers
export {
  ClaudeExecutor,
  ClaudeAgentExecutor,
  OpenAIExecutor,
  OpenAICompatibleExecutor,
  HttpExecutor,
} from './providers/index.js';

// CLI entry point (for Claude Code Bash invocation)
export { executeStepCli } from './cli-entry.js';

// Workflow executor
export {
  WorkflowExecutor,
  type WorkflowExecuteOptions,
  type WorkflowExecuteResult,
  type PhaseExecuteResult,
  type StepExecuteResult,
  type ApprovalRequired,
} from './workflow-executor.js';
