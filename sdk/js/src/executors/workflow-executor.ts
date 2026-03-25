/**
 * @fractary/faber - Workflow Executor
 *
 * Deterministic workflow executor for CLI-native mode.
 * Code controls the step iteration loop — no LLM needed for orchestration.
 * Each step is dispatched to its configured executor (Claude API, OpenAI, HTTP, etc.).
 *
 * This is the multi-model successor to the legacy FaberWorkflow.run() and the
 * deterministic executor bash prototype (execute-workflow.sh).
 *
 * @example
 * ```typescript
 * const registry = ExecutorRegistry.createDefault();
 * const executor = new WorkflowExecutor(registry);
 * const result = await executor.execute(plan, { workId: '123' });
 * ```
 */

import type {
  ExecutionContext,
  ExecutorResult,
  StepExecutorConfig,
} from './types.js';
import { ExecutorRegistry } from './registry.js';
import type {
  ResolvedPhase,
  ResolvedWorkflow,
  WorkflowStep,
  StepResultHandling,
} from '../workflow/resolver.js';

// ============================================================================
// Types
// ============================================================================

/** Phase names in execution order */
const PHASE_ORDER = ['frame', 'architect', 'build', 'evaluate', 'release'] as const;
/** Options for workflow execution */
export interface WorkflowExecuteOptions {
  /** Work item ID */
  workId: string;
  /** Issue context if available */
  issue?: { number: number; title: string; body: string };
  /** Working directory */
  workingDirectory?: string;
  /** Only run these phases (others are skipped) */
  phasesToRun?: string[];
  /** Only run this specific step */
  stepToRun?: string | null;
  /** Callback for step progress */
  onStepStart?: (phase: string, step: WorkflowStep, index: number, total: number) => void;
  /** Callback for step completion */
  onStepComplete?: (phase: string, step: WorkflowStep, result: ExecutorResult) => void;
  /** Callback for phase start */
  onPhaseStart?: (phase: string) => void;
  /** Callback for phase complete */
  onPhaseComplete?: (phase: string, status: 'completed' | 'failed' | 'skipped') => void;
}

/** Result from a complete workflow execution */
export interface WorkflowExecuteResult {
  status: 'completed' | 'failed' | 'paused';
  phases: PhaseExecuteResult[];
  duration_ms: number;
  steps_completed: number;
  steps_total: number;
}

/** Result from a single phase */
export interface PhaseExecuteResult {
  phase: string;
  status: 'completed' | 'failed' | 'skipped';
  steps: StepExecuteResult[];
  duration_ms: number;
}

/** Result from a single step */
export interface StepExecuteResult {
  stepId: string;
  stepName: string;
  result: ExecutorResult;
}

// ============================================================================
// Workflow Executor
// ============================================================================

export class WorkflowExecutor {
  constructor(private registry: ExecutorRegistry) {}

  /**
   * Execute a resolved workflow.
   *
   * Iterates through phases and steps deterministically.
   * For each step, resolves the executor from the config cascade
   * and dispatches execution.
   *
   * Steps without an executor config use the Claude API executor
   * as the default (since we're in CLI mode, not Claude Code).
   */
  async execute(
    workflow: {
      phases: ResolvedWorkflow['phases'];
      executor?: StepExecutorConfig;
      phase_executors?: Partial<Record<string, StepExecutorConfig>>;
      result_handling?: StepResultHandling;
    },
    options: WorkflowExecuteOptions,
  ): Promise<WorkflowExecuteResult> {
    const startTime = Date.now();
    const phaseResults: PhaseExecuteResult[] = [];
    let totalStepsCompleted = 0;
    let totalSteps = 0;
    let workflowFailed = false;

    // Count total steps
    for (const phaseName of PHASE_ORDER) {
      const phase = workflow.phases[phaseName];
      if (phase.enabled) {
        totalSteps += phase.steps.length;
      }
    }

    // Track outputs from previous steps for context
    const previousOutputs: Record<string, Record<string, unknown>> = {};

    for (const phaseName of PHASE_ORDER) {
      const phase = workflow.phases[phaseName];

      // Skip disabled phases
      if (!phase.enabled) {
        phaseResults.push({
          phase: phaseName,
          status: 'skipped',
          steps: [],
          duration_ms: 0,
        });
        continue;
      }

      // Skip if not in phasesToRun filter
      if (options.phasesToRun && !options.phasesToRun.includes(phaseName)) {
        phaseResults.push({
          phase: phaseName,
          status: 'skipped',
          steps: [],
          duration_ms: 0,
        });
        continue;
      }

      // Execute phase
      options.onPhaseStart?.(phaseName);
      const phaseStartTime = Date.now();
      const stepResults: StepExecuteResult[] = [];
      let phaseFailed = false;

      for (let i = 0; i < phase.steps.length; i++) {
        const step = phase.steps[i];

        // If stepToRun is specified, skip all other steps
        if (options.stepToRun && step.id !== options.stepToRun) {
          continue;
        }

        options.onStepStart?.(phaseName, step, i, phase.steps.length);

        // Build execution context
        const context: ExecutionContext = {
          workId: options.workId,
          phase: phaseName,
          stepId: step.id,
          stepName: step.name,
          previousOutputs,
          issue: options.issue,
          workingDirectory: options.workingDirectory || process.cwd(),
        };

        // Resolve executor (cascade: step > phase > workflow > default 'claude')
        const resolved = this.registry.resolveForStep(
          step,
          phaseName,
          workflow.executor,
          workflow.phase_executors,
        );

        let result: ExecutorResult;

        if (resolved) {
          // Execute with the resolved executor
          result = await resolved.executor.execute(
            step.prompt,
            context,
            resolved.config,
          );
        } else {
          // No executor configured — use claude as default in CLI mode
          const claudeExecutor = this.registry.get('claude');
          result = await claudeExecutor.execute(
            step.prompt,
            context,
            { provider: 'claude' },
          );
        }

        stepResults.push({
          stepId: step.id,
          stepName: step.name,
          result,
        });

        // Track outputs
        previousOutputs[step.id] = {
          output: result.output,
          status: result.status,
        };

        totalStepsCompleted++;
        options.onStepComplete?.(phaseName, step, result);

        // Handle step result
        if (result.status === 'failure') {
          const handling = this.resolveResultHandling(step, phase, workflow);
          if (handling.on_failure === 'stop') {
            phaseFailed = true;
            break;
          }
          // If on_failure is not 'stop', continue to next step
        }
      }

      const phaseStatus = phaseFailed ? 'failed' : 'completed';
      phaseResults.push({
        phase: phaseName,
        status: phaseStatus,
        steps: stepResults,
        duration_ms: Date.now() - phaseStartTime,
      });

      options.onPhaseComplete?.(phaseName, phaseStatus);

      if (phaseFailed) {
        workflowFailed = true;
        break;
      }
    }

    return {
      status: workflowFailed ? 'failed' : 'completed',
      phases: phaseResults,
      duration_ms: Date.now() - startTime,
      steps_completed: totalStepsCompleted,
      steps_total: totalSteps,
    };
  }

  /**
   * Resolve result handling for a step using the cascade:
   * step > phase > workflow > defaults
   */
  private resolveResultHandling(
    step: WorkflowStep,
    phase: ResolvedPhase,
    workflow: { result_handling?: StepResultHandling },
  ): Required<Pick<StepResultHandling, 'on_success' | 'on_warning' | 'on_failure'>> {
    return {
      on_success:
        step.result_handling?.on_success ??
        phase.result_handling?.on_success ??
        workflow.result_handling?.on_success ??
        'continue',
      on_warning:
        step.result_handling?.on_warning ??
        phase.result_handling?.on_warning ??
        workflow.result_handling?.on_warning ??
        'continue',
      on_failure:
        step.result_handling?.on_failure ??
        phase.result_handling?.on_failure ??
        workflow.result_handling?.on_failure ??
        'stop',
    };
  }
}
