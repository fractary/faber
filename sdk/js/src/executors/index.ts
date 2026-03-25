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
} from './types.js';

// Registry
export { ExecutorRegistry } from './registry.js';

// Providers
export {
  ClaudeExecutor,
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
} from './workflow-executor.js';
