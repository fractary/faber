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
  StepRuntimeConfig,
  StepPromptContext,
  StepWorkflowMetadata,
  HarnessType,
} from './types.js';
import { resolveRuntimeConfig } from './types.js';
import { ExecutorRegistry } from './registry.js';
import type { ClaudeAgentExecuteOptions } from './providers/claude-agent.js';
import type {
  ResolvedPhase,
  ResolvedWorkflow,
  WorkflowStep,
  WorkflowFileConfig,
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

  // ── CLI-native execution options ───────────────────────────────────

  /** Run ID for state tracking */
  runId?: string;
  /** Plan ID for metadata */
  planId?: string;
  /** Plan file path for metadata */
  planPath?: string;
  /** State file path for metadata */
  statePath?: string;
  /** Git branch name */
  branch?: string;

  /** CLI-level harness override (applies to all steps) */
  cliHarness?: HarnessType;
  /** CLI-level model override (applies to all steps) */
  cliModel?: string;
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
   * Routing priority:
   * 1. If step prompt starts with `!` → direct shell command (via claude-agent executor)
   * 2. If step has `harness` (directly or via cascade) → use harness-mapped executor
   * 3. If step has legacy `executor` config → use ExecutorRegistry
   * 4. Default → 'claude-agent' executor (Agent SDK)
   */
  async execute(
    workflow: {
      phases: ResolvedWorkflow['phases'];
      executor?: StepExecutorConfig;
      phase_executors?: Partial<Record<string, StepExecutorConfig>>;
      result_handling?: StepResultHandling;
      /** Workflow-level system prompt for CLI-native execution */
      prompt?: string;
      /** Default runtime configuration */
      defaults?: WorkflowFileConfig['defaults'];
      /** Per-phase runtime defaults */
      phase_defaults?: WorkflowFileConfig['phase_defaults'];
    },
    options: WorkflowExecuteOptions,
  ): Promise<WorkflowExecuteResult> {
    const startTime = Date.now();
    const phaseResults: PhaseExecuteResult[] = [];
    let totalStepsCompleted = 0;
    let totalSteps = 0;
    let workflowFailed = false;
    let globalStepIndex = 0;

    // Count total steps
    for (const phaseName of PHASE_ORDER) {
      const phase = workflow.phases[phaseName];
      if (phase.enabled) {
        totalSteps += phase.steps.length;
      }
    }

    // Track outputs from previous steps for context
    const previousOutputs: Record<string, Record<string, unknown>> = {};

    // Build CLI overrides for runtime config resolution
    const cliOverrides: Partial<StepRuntimeConfig> | undefined =
      (options.cliHarness || options.cliModel)
        ? { harness: options.cliHarness, model: options.cliModel }
        : undefined;

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

      // Get phase-level defaults
      const phaseDefaults = workflow.phase_defaults?.[phaseName];

      for (let i = 0; i < phase.steps.length; i++) {
        const step = phase.steps[i];

        // If stepToRun is specified, skip all other steps
        if (options.stepToRun && step.id !== options.stepToRun) {
          globalStepIndex++;
          continue;
        }

        options.onStepStart?.(phaseName, step, i, phase.steps.length);

        // Resolve runtime config via cascade:
        //   step > phase_defaults > workflow.defaults > CLI args > system defaults
        const stepRuntimeAttrs: Partial<StepRuntimeConfig> = {
          model: step.model,
          harness: step.harness as HarnessType | undefined,
          maxTurns: step.max_turns,
          maxBudgetUsd: step.max_budget_usd,
          allowedTools: step.allowed_tools,
          skills: step.skills,
          mcp: step.mcp,
        };
        const runtimeConfig = resolveRuntimeConfig(
          stepRuntimeAttrs,
          phaseDefaults,
          workflow.defaults,
          cliOverrides,
        );

        // Build workflow metadata for system prompt
        const metadata: StepWorkflowMetadata = {
          work_id: options.workId,
          plan_id: options.planId,
          run_id: options.runId,
          state_path: options.statePath,
          plan_path: options.planPath,
          branch: options.branch,
          phase: phaseName,
          step_id: step.id,
          step_index: globalStepIndex,
          steps_total: totalSteps,
          project_root: options.workingDirectory || process.cwd(),
        };

        // Build prompt context (workflow prompt + phase prompt + metadata)
        const promptContext: StepPromptContext = {
          workflowPrompt: workflow.prompt || workflow.defaults?.prompt,
          phasePrompt: phaseDefaults?.prompt,
          metadata,
        };

        // Build execution context (extended with runtime config and prompt context)
        const context: ExecutionContext & ClaudeAgentExecuteOptions = {
          workId: options.workId,
          phase: phaseName,
          stepId: step.id,
          stepName: step.name,
          previousOutputs,
          issue: options.issue,
          workingDirectory: options.workingDirectory || process.cwd(),
          runId: options.runId,
          runtimeConfig,
          promptContext,
        };

        let result: ExecutorResult;

        // Determine execution path
        const isCommand = step.prompt.trim().startsWith('!');
        const hasHarness = runtimeConfig.harness != null;
        const hasLegacyExecutor = step.executor != null;

        if (isCommand || hasHarness) {
          // Harness-based routing (new path)
          // Commands (! prefix) always go to claude-agent executor which handles them
          // Other steps route based on harness type
          const executorName = this.harnessToExecutor(runtimeConfig.harness || 'claude-code');
          const executor = this.registry.get(executorName);
          result = await executor.execute(step.prompt, context, { provider: executorName });
        } else if (hasLegacyExecutor) {
          // Legacy executor-based routing
          const resolved = this.registry.resolveForStep(
            step,
            phaseName,
            workflow.executor,
            workflow.phase_executors,
          );
          if (resolved) {
            result = await resolved.executor.execute(step.prompt, context, resolved.config);
          } else {
            const claudeAgent = this.registry.get('claude-agent');
            result = await claudeAgent.execute(step.prompt, context, { provider: 'claude-agent' });
          }
        } else {
          // No routing config — use default executor (claude-agent for full agentic)
          const executorName = this.harnessToExecutor(runtimeConfig.harness || 'claude-code');
          const executor = this.registry.get(executorName);
          result = await executor.execute(step.prompt, context, { provider: executorName });
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
        globalStepIndex++;
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
   * Map a harness type to an executor provider name in the registry.
   */
  private harnessToExecutor(harness: HarnessType): string {
    switch (harness) {
      case 'claude-code': return 'claude-agent';
      case 'api': return 'claude';
      case 'opencode': return 'claude-agent'; // TODO: OpenCode executor
      case 'codex': return 'claude-agent';     // TODO: Codex executor
      default: return 'claude-agent';
    }
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
