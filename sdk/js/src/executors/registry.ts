/**
 * @fractary/faber - Executor Registry
 *
 * Maps provider names to executor implementations and resolves which executor
 * to use for a given step based on the config cascade:
 *   step.executor > phase_executors[phase] > workflow.executor > null (default)
 *
 * When resolution returns null, the caller should use the default behavior
 * (Claude Code direct execution in skill mode, or Claude API in CLI mode).
 */

import type {
  Executor,
  ExecutorFactory,
  StepExecutorConfig,
} from './types.js';
import { ClaudeExecutor } from './providers/claude.js';
import { OpenAIExecutor } from './providers/openai.js';
import { OpenAICompatibleExecutor } from './providers/openai-compatible.js';
import { HttpExecutor } from './providers/http.js';

// ============================================================================
// Registry
// ============================================================================

export class ExecutorRegistry {
  private executors = new Map<string, ExecutorFactory>();
  private instances = new Map<string, Executor>();

  /**
   * Register an executor factory for a provider.
   * Factories are called lazily on first use.
   */
  register(provider: string, factory: ExecutorFactory): void {
    this.executors.set(provider, factory);
    // Clear cached instance if re-registering
    this.instances.delete(provider);
  }

  /**
   * Get an executor for a provider. Creates the instance lazily.
   * @throws Error if provider is not registered
   */
  get(provider: string): Executor {
    let instance = this.instances.get(provider);
    if (instance) return instance;

    const factory = this.executors.get(provider);
    if (!factory) {
      const available = Array.from(this.executors.keys()).join(', ');
      throw new Error(
        `Executor provider '${provider}' not registered. Available: ${available || 'none'}`
      );
    }

    instance = factory();
    this.instances.set(provider, instance);
    return instance;
  }

  /**
   * Check if a provider is registered.
   */
  has(provider: string): boolean {
    return this.executors.has(provider);
  }

  /**
   * List all registered provider names.
   */
  listProviders(): string[] {
    return Array.from(this.executors.keys());
  }

  /**
   * Resolve the executor for a step, applying the config cascade.
   *
   * Returns the executor and merged config, or null if no executor is configured
   * (meaning the step should use the default execution path).
   *
   * Cascade order (most specific wins):
   * 1. step.executor — explicit on the step
   * 2. phaseExecutors[phase] — workflow-level per-phase override
   * 3. workflowExecutor — workflow-level default
   *
   * @param step - The workflow step to resolve
   * @param phase - Current phase name
   * @param workflowExecutor - Workflow-level default executor config
   * @param phaseExecutors - Per-phase executor overrides
   * @returns Resolved executor and config, or null if no executor applies
   */
  resolveForStep(
    step: { executor?: StepExecutorConfig },
    phase: string,
    workflowExecutor?: StepExecutorConfig,
    phaseExecutors?: Partial<Record<string, StepExecutorConfig>>,
  ): { executor: Executor; config: StepExecutorConfig } | null {
    // Cascade: step > phase > workflow
    const config =
      step.executor ??
      phaseExecutors?.[phase] ??
      workflowExecutor ??
      null;

    if (!config) return null;

    const executor = this.get(config.provider);
    return { executor, config };
  }

  /**
   * Validate all executor configs in a resolved workflow.
   * Returns errors for any invalid configurations (missing API keys, etc.).
   * Useful for fast-fail at plan time before execution starts.
   */
  async validateWorkflow(
    steps: Array<{ executor?: StepExecutorConfig }>,
    workflowExecutor?: StepExecutorConfig,
    phaseExecutors?: Partial<Record<string, StepExecutorConfig>>,
  ): Promise<Array<{ stepIndex: number; error: string }>> {
    const errors: Array<{ stepIndex: number; error: string }> = [];

    // Collect all unique configs to validate
    const configsToValidate = new Map<string, StepExecutorConfig>();

    if (workflowExecutor) {
      configsToValidate.set(`workflow:${workflowExecutor.provider}`, workflowExecutor);
    }

    if (phaseExecutors) {
      for (const [phase, config] of Object.entries(phaseExecutors)) {
        if (config) {
          configsToValidate.set(`phase:${phase}:${config.provider}`, config);
        }
      }
    }

    for (let i = 0; i < steps.length; i++) {
      const step = steps[i];
      if (step.executor) {
        configsToValidate.set(`step:${i}:${step.executor.provider}`, step.executor);
      }
    }

    // Validate each unique config
    for (const [key, config] of configsToValidate) {
      if (!this.has(config.provider)) {
        const [scope, id] = key.split(':');
        errors.push({
          stepIndex: scope === 'step' ? parseInt(id) : -1,
          error: `Provider '${config.provider}' is not registered`,
        });
        continue;
      }

      const executor = this.get(config.provider);
      const result = await executor.validate(config);
      if (!result.valid) {
        const [scope, id] = key.split(':');
        errors.push({
          stepIndex: scope === 'step' ? parseInt(id) : -1,
          error: result.error || `Validation failed for provider '${config.provider}'`,
        });
      }
    }

    return errors;
  }

  /**
   * Create a registry with all built-in providers registered.
   */
  static createDefault(): ExecutorRegistry {
    const registry = new ExecutorRegistry();

    registry.register('claude', () => new ClaudeExecutor());
    registry.register('openai', () => new OpenAIExecutor());
    registry.register('openai-compatible', () => new OpenAICompatibleExecutor());
    registry.register('http', () => new HttpExecutor());

    return registry;
  }
}
