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

import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import type {
  ExecutionContext,
  ExecutorResult,
  StepExecutorConfig,
  StepRuntimeConfig,
  StepPromptContext,
  StepWorkflowMetadata,
  HarnessType,
  RuntimeDefaults,
} from './types.js';
import { resolveRuntimeConfig } from './types.js';
import { ExecutorRegistry } from './registry.js';
import { applyStepResponse, findResponseBlock } from './step-response.js';
import type { ClaudeAgentExecuteOptions } from './providers/claude-agent.js';
import type {
  ResolvedPhase,
  ResolvedWorkflow,
  WorkflowStep,
  WorkflowFileConfig,
  StepResultHandling,
  WorkflowAutonomyConfig,
} from '../workflow/resolver.js';
import type { RunStateStore, RunStatus } from '../state/run-state.js';
import { parseRunId } from '../paths.js';

// ============================================================================
// Types
// ============================================================================

/** Phase names in execution order */
const PHASE_ORDER = ['frame', 'architect', 'build', 'evaluate', 'release'] as const;
/** Characters of a failed step's output passed to its on_failure handler */
const HANDLER_OUTPUT_TAIL = 4000;
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

  /** Run ID for state tracking (defaults to the run ID of `runState`) */
  runId?: string;
  /** Plan ID for metadata */
  planId?: string;
  /** Plan file path for metadata */
  planPath?: string;
  /** State file path for metadata (defaults to the state file of `runState`) */
  statePath?: string;
  /** Git branch name */
  branch?: string;

  /** CLI-level harness override (applies to all steps) */
  cliHarness?: HarnessType;
  /** CLI-level model override (applies to all steps) */
  cliModel?: string;

  /**
   * Persistent run state. When set, progress is saved after every step
   * transition, and steps already completed in this run are skipped, so an
   * interrupted or failed run can be resumed.
   */
  runState?: RunStateStore;
  /** Callback for a step skipped because it already completed in this run */
  onStepSkipped?: (phase: string, step: WorkflowStep, reason: string) => void;

  /**
   * Steps a person approved for this invocation. A step behind an approval
   * gate runs only when listed here; otherwise the run stops before it with
   * status `awaiting_approval`.
   */
  approvedSteps?: string[];
  /** Callback when the run stops before a step that needs approval */
  onApprovalRequired?: (phase: string, step: WorkflowStep, reason: string) => void;

  /** Callback before a failed step runs again; `attempt` is the attempt about to start */
  onStepRetry?: (phase: string, step: WorkflowStep, attempt: number, reason: string) => void;
  /** Callback after a failed step's on_failure handler (a slash command) ran */
  onFailureHandler?: (phase: string, step: WorkflowStep, handler: string, result: ExecutorResult) => void;
}

/** What happens after a step fails */
interface FailureDecision {
  /** retry: run the step again; stop: stop the run; continue: go on to the next step */
  action: 'retry' | 'stop' | 'continue';
  /** Why, when on_failure is not a plain `stop` */
  reason?: string;
}

/** A failed step attempt, with what handling its on_failure needs */
interface FailedAttempt {
  step: WorkflowStep;
  phaseName: string;
  phase: ResolvedPhase;
  workflow: {
    executor?: StepExecutorConfig;
    phase_executors?: Partial<Record<string, StepExecutorConfig>>;
    result_handling?: StepResultHandling;
    defaults?: Partial<RuntimeDefaults>;
  };
  result: ExecutorResult;
  attempt: number;
  /** Retries already used in the phase */
  retriesUsed: number;
  context: ExecutionContext & ClaudeAgentExecuteOptions;
  phaseDefaults?: Partial<RuntimeDefaults>;
  cliOverrides?: Partial<StepRuntimeConfig>;
  options: WorkflowExecuteOptions;
  runId?: string;
  statePath?: string;
}

/** The step a run stopped before, until a person approves it */
export interface ApprovalRequired {
  phase: string;
  step_id: string;
  /** Why the step needs approval */
  reason: string;
}

/** Result from a complete workflow execution */
export interface WorkflowExecuteResult {
  status: 'completed' | 'failed' | 'paused' | 'awaiting_approval';
  phases: PhaseExecuteResult[];
  duration_ms: number;
  steps_completed: number;
  steps_total: number;
  /** Steps skipped because they completed earlier in this run (resume) */
  steps_already_completed?: number;
  /** Run ID, when executed with run state */
  run_id?: string;
  /** Path of the run's state file, when executed with run state */
  state_path?: string;
  /** Final status recorded in the run state, when executed with run state */
  run_status?: RunStatus;
  /** The step the run stopped before, when its status is `awaiting_approval` */
  awaiting_approval?: ApprovalRequired;
}

/** Result from a single phase */
export interface PhaseExecuteResult {
  phase: string;
  status: 'completed' | 'failed' | 'skipped' | 'awaiting_approval';
  steps: StepExecuteResult[];
  duration_ms: number;
}

/** Result from a single step */
export interface StepExecuteResult {
  stepId: string;
  stepName: string;
  /** Result of the step's last attempt */
  result: ExecutorResult;
  /** Times the step ran in this execution (more than 1 when it was retried) */
  attempts?: number;
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
      /** Approval gates: require_approval_for, pause_before_release */
      autonomy?: WorkflowAutonomyConfig;
    },
    options: WorkflowExecuteOptions,
  ): Promise<WorkflowExecuteResult> {
    const startTime = Date.now();
    const phaseResults: PhaseExecuteResult[] = [];
    let totalStepsCompleted = 0;
    let totalSteps = 0;
    let workflowFailed = false;
    let workflowError: string | undefined;
    let globalStepIndex = 0;
    let stepsAlreadyCompleted = 0;
    let awaitingApproval: ApprovalRequired | undefined;
    const approvedSteps = new Set(options.approvedSteps ?? []);
    // Retries used per phase, when there is no run state to record them
    const retriesUsed = new Map<string, number>();
    const runState = options.runState;
    const runId = options.runId ?? runState?.runId;
    const statePath = options.statePath ?? runState?.statePath;
    runState?.begin();

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
        runState?.skipPhase(phaseName);
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
      runState?.startPhase(phaseName);
      const phaseStartTime = Date.now();
      const stepResults: StepExecuteResult[] = [];
      let phaseFailed = false;

      // Get phase-level defaults
      const phaseDefaults = workflow.phase_defaults?.[phaseName];

      // A phase gate applies once, before the first step of the phase runs
      let phaseEntered = runState?.hasPhaseStarted(phaseName) ?? false;

      for (let i = 0; i < phase.steps.length; i++) {
        const step = phase.steps[i];

        // If stepToRun is specified, skip all other steps
        if (options.stepToRun && step.id !== options.stepToRun) {
          globalStepIndex++;
          continue;
        }

        // Resume: a step already completed in this run is not executed again
        if (runState?.isStepDone(phaseName, step.id)) {
          stepsAlreadyCompleted++;
          totalStepsCompleted++;
          globalStepIndex++;
          options.onStepSkipped?.(phaseName, step, 'already completed in this run');
          continue;
        }

        // Approval gate: a gated step runs only when a person approved it for
        // this invocation. Nothing else (autonomy level, unattended runs)
        // counts as approval.
        const gateReasons = this.approvalReasons(step, phaseName, phase, workflow.autonomy, phaseEntered);
        if (gateReasons.length > 0) {
          if (!approvedSteps.has(step.id)) {
            const reason = gateReasons.join('; ');
            awaitingApproval = { phase: phaseName, step_id: step.id, reason };
            runState?.awaitApproval(phaseName, step.id, reason);
            options.onApprovalRequired?.(phaseName, step, reason);
            break;
          }
          runState?.approveStep(phaseName, step.id);
        }
        phaseEntered = true;

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
          run_id: runId,
          state_path: statePath,
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
          runId,
          runtimeConfig,
          promptContext,
        };

        // Run the step. When it fails, on_failure decides whether it runs
        // again (capped by the phase's max_retries), the run stops, or the
        // run goes on to the next step.
        let result: ExecutorResult;
        let attempt = 0;
        let failure: FailureDecision | undefined;
        for (;;) {
          attempt++;
          runState?.startStep(phaseName, step.id);
          try {
            result = await this.dispatchStep(step, phaseName, workflow, runtimeConfig, context);
          } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            runState?.finishStep(phaseName, step.id, { result: 'failure', error: message });
            runState?.finishPhase(phaseName);
            runState?.finish(message);
            throw error;
          }
          // The step's own FABER response block decides its status
          result = applyStepResponse(result, { requireResponse: step.role === 'validator' });
          runState?.finishStep(phaseName, step.id, {
            result: result.status,
            error: result.error,
            reason: result.reason,
            duration_ms: result.metadata.duration_ms,
          });
          options.onStepComplete?.(phaseName, step, result);

          if (result.status !== 'failure') break;
          failure = await this.handleFailure({
            step,
            phaseName,
            phase,
            workflow,
            result,
            attempt,
            retriesUsed: runState?.retryCount(phaseName) ?? retriesUsed.get(phaseName) ?? 0,
            context,
            phaseDefaults,
            cliOverrides,
            options,
            runId,
            statePath,
          });
          if (failure.action !== 'retry') break;
          retriesUsed.set(phaseName, (retriesUsed.get(phaseName) ?? 0) + 1);
          options.onStepRetry?.(phaseName, step, attempt + 1, failure.reason ?? 'retry');
        }

        stepResults.push({
          stepId: step.id,
          stepName: step.name,
          result,
          attempts: attempt,
        });

        // Track outputs
        previousOutputs[step.id] = {
          output: result.output,
          status: result.status,
        };

        totalStepsCompleted++;
        globalStepIndex++;

        if (result.status === 'failure' && failure?.action === 'stop') {
          phaseFailed = true;
          workflowError =
            `Step ${phaseName}:${step.id} failed` +
            (attempt > 1 ? ` after ${attempt} attempts` : '') +
            (result.error ? `: ${result.error}` : '') +
            (failure.reason ? ` (${failure.reason})` : '');
          break;
        }
        // on_failure: continue goes on to the next step; the run ends failed
      }

      if (awaitingApproval) {
        // The phase is not finished: it continues when the run resumes
        phaseResults.push({
          phase: phaseName,
          status: 'awaiting_approval',
          steps: stepResults,
          duration_ms: Date.now() - phaseStartTime,
        });
        break;
      }

      const phaseStatus = phaseFailed ? 'failed' : 'completed';
      phaseResults.push({
        phase: phaseName,
        status: phaseStatus,
        steps: stepResults,
        duration_ms: Date.now() - phaseStartTime,
      });

      runState?.finishPhase(phaseName);
      options.onPhaseComplete?.(phaseName, phaseStatus);

      if (phaseFailed) {
        workflowFailed = true;
        break;
      }
    }

    if (awaitingApproval) {
      return {
        status: 'awaiting_approval',
        phases: phaseResults,
        duration_ms: Date.now() - startTime,
        steps_completed: totalStepsCompleted,
        steps_total: totalSteps,
        awaiting_approval: awaitingApproval,
        ...(runState && {
          steps_already_completed: stepsAlreadyCompleted,
          run_id: runState.runId,
          state_path: runState.statePath,
          run_status: runState.state.status,
        }),
      };
    }

    const runStatus = runState?.finish(workflowFailed ? workflowError : undefined);

    return {
      status: workflowFailed ? 'failed' : 'completed',
      phases: phaseResults,
      duration_ms: Date.now() - startTime,
      steps_completed: totalStepsCompleted,
      steps_total: totalSteps,
      ...(runState && {
        steps_already_completed: stepsAlreadyCompleted,
        run_id: runState.runId,
        state_path: runState.statePath,
        run_status: runStatus,
      }),
    };
  }

  /**
   * Route a step to its executor and run it.
   *
   * Routing priority:
   * 1. If step prompt starts with `!` → direct shell command (via claude-agent executor)
   * 2. If step has `harness` (directly or via cascade) → use harness-mapped executor
   * 3. If step has legacy `executor` config → use ExecutorRegistry
   * 4. Default → 'claude-agent' executor (Agent SDK)
   */
  private dispatchStep(
    step: WorkflowStep,
    phaseName: string,
    workflow: {
      executor?: StepExecutorConfig;
      phase_executors?: Partial<Record<string, StepExecutorConfig>>;
    },
    runtimeConfig: StepRuntimeConfig,
    context: ExecutionContext & ClaudeAgentExecuteOptions,
  ): Promise<ExecutorResult> {
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
      return executor.execute(step.prompt, context, { provider: executorName });
    } else if (hasLegacyExecutor) {
      // Legacy executor-based routing
      const resolved = this.registry.resolveForStep(
        step,
        phaseName,
        workflow.executor,
        workflow.phase_executors,
      );
      if (resolved) {
        return resolved.executor.execute(step.prompt, context, resolved.config);
      } else {
        const claudeAgent = this.registry.get('claude-agent');
        return claudeAgent.execute(step.prompt, context, { provider: 'claude-agent' });
      }
    } else {
      // No routing config — use default executor (claude-agent for full agentic)
      const executorName = this.harnessToExecutor(runtimeConfig.harness || 'claude-code');
      const executor = this.registry.get(executorName);
      return executor.execute(step.prompt, context, { provider: executorName });
    }
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
   * Why a step needs a person's approval before it runs, if it does:
   * - it is listed in `autonomy.require_approval_for`
   * - it is the first step of a phase with `require_approval`
   * - it is the first release step and `autonomy.pause_before_release` is set
   */
  private approvalReasons(
    step: WorkflowStep,
    phaseName: string,
    phase: ResolvedPhase,
    autonomy: WorkflowAutonomyConfig | undefined,
    phaseEntered: boolean,
  ): string[] {
    const reasons: string[] = [];
    if (autonomy?.require_approval_for?.includes(step.id)) {
      reasons.push(`${step.id} is listed in autonomy.require_approval_for`);
    }
    if (!phaseEntered && phase.require_approval) {
      reasons.push(`the ${phaseName} phase requires approval`);
    }
    if (!phaseEntered && phaseName === 'release' && autonomy?.pause_before_release) {
      reasons.push('the workflow pauses before release (autonomy.pause_before_release)');
    }
    return reasons;
  }

  /**
   * Decide what happens after a step fails, from its on_failure:
   * - stop (default): the run stops
   * - continue: the run goes on to the next step, and ends failed
   * - retry: the step runs again while the phase has retries left
   * - a slash command: the command runs as a recovery step. The step runs
   *   again only when the command's recovery plan is `retry` with
   *   `requires_approval: false`, and the phase has retries left
   * Any other value stops the run. Retries are counted per phase, against its
   * `max_retries`, across resumes of the run.
   */
  private async handleFailure(failed: FailedAttempt): Promise<FailureDecision> {
    const { step, phaseName, phase, workflow, attempt, retriesUsed, options } = failed;
    const onFailure = this.resolveResultHandling(step, phase, workflow).on_failure.trim();
    if (onFailure === 'stop') return { action: 'stop' };
    if (onFailure === 'continue') return { action: 'continue' };

    const maxRetries = phase.max_retries ?? 0;
    const retryLeft = retriesUsed < maxRetries;
    const nextRetry = `retry ${retriesUsed + 1} of ${maxRetries}`;
    const noRetries = maxRetries > 0
      ? `no retries left (max_retries ${maxRetries})`
      : `the ${phaseName} phase allows no retries (max_retries 0)`;

    let decision: FailureDecision & { action: 'retry' | 'stop' };
    let handlerStatus: ExecutorResult['status'] | undefined;
    if (onFailure === 'retry') {
      decision = retryLeft
        ? { action: 'retry', reason: `on_failure is retry, ${nextRetry}` }
        : { action: 'stop', reason: `on_failure is retry, but ${noRetries}` };
    } else if (onFailure.startsWith('/')) {
      const handlerResult = await this.runFailureHandler(onFailure, failed, maxRetries);
      handlerStatus = handlerResult.status;
      options.onFailureHandler?.(phaseName, step, onFailure, handlerResult);

      const block = handlerResult.status === 'failure' ? null : findResponseBlock(handlerResult.output);
      const rawPlan = block?.recovery_plan;
      const plan = isRecord(rawPlan) ? rawPlan : undefined;
      const action = typeof plan?.action === 'string' ? plan.action : undefined;
      if (handlerResult.status === 'failure') {
        decision = { action: 'stop', reason: `the on_failure handler failed${handlerResult.error ? `: ${handlerResult.error}` : ''}` };
      } else if (action === 'retry' && plan?.requires_approval === false) {
        decision = retryLeft
          ? { action: 'retry', reason: `the on_failure handler asked for a retry, ${nextRetry}` }
          : { action: 'stop', reason: `the on_failure handler asked for a retry, but ${noRetries}` };
      } else if (action === 'retry') {
        decision = { action: 'stop', reason: 'the on_failure handler proposes a retry that needs a person\'s approval: resume the run to retry' };
      } else {
        decision = {
          action: 'stop',
          reason: action ? `the on_failure handler's recovery plan is ${action}` : 'the on_failure handler returned no recovery plan',
        };
      }
    } else {
      decision = { action: 'stop', reason: `on_failure "${onFailure}" is not supported` };
    }

    options.runState?.recordFailureRecovery(phaseName, step.id, {
      attempt,
      ...(onFailure.startsWith('/') && { handler: onFailure, handler_status: handlerStatus }),
      action: decision.action,
      reason: decision.reason ?? '',
    });
    return decision;
  }

  /**
   * Run a step's on_failure handler (a slash command) as a recovery step: a
   * fresh session with the phase's runtime settings. The failed step's context
   * (IDs, error, the end of its output, retries) is written to a JSON file and
   * passed as `--step-context-file`, so the error reaches the handler as data,
   * not as part of its command. `{error}` in the command is not filled in.
   */
  private async runFailureHandler(handler: string, failed: FailedAttempt, maxRetries: number): Promise<ExecutorResult> {
    const startTime = Date.now();
    try {
      const contextFile = this.writeStepContext(failed, maxRetries);
      const handlerStep: WorkflowStep = {
        id: failed.step.id,
        name: `${failed.step.name} (on_failure)`,
        prompt: `${handler} --step-context-file "${contextFile}"`,
      };
      const runtimeConfig = resolveRuntimeConfig(
        undefined,
        failed.phaseDefaults,
        failed.workflow.defaults,
        failed.cliOverrides,
      );
      const context = { ...failed.context, stepName: handlerStep.name, runtimeConfig };
      const result = await this.dispatchStep(handlerStep, failed.phaseName, failed.workflow, runtimeConfig, context);
      return applyStepResponse(result);
    } catch (error) {
      return {
        output: '',
        status: 'failure',
        error: `could not run: ${error instanceof Error ? error.message : String(error)}`,
        metadata: { provider: 'on_failure', duration_ms: Date.now() - startTime },
      };
    }
  }

  /**
   * Write the context of a failed step for its on_failure handler. It goes in
   * the run's directory next to its state file (`{run_suffix}/`), or in a
   * temporary directory when the execution has no run state.
   * @returns The file's absolute path
   */
  private writeStepContext(failed: FailedAttempt, maxRetries: number): string {
    const { step, phaseName, result, attempt, options, runId, statePath } = failed;
    const suffix = runId ? parseRunId(runId)?.suffix : undefined;
    const dir = statePath && suffix
      ? path.join(path.dirname(statePath), suffix)
      : fs.mkdtempSync(path.join(os.tmpdir(), 'faber-step-context-'));
    fs.mkdirSync(dir, { recursive: true });

    const rawErrors = findResponseBlock(result.output)?.errors;
    const errors = Array.isArray(rawErrors) ? rawErrors.filter((e): e is string => typeof e === 'string') : [];
    const stepContext = {
      work_id: options.workId,
      run_id: runId ?? null,
      plan_id: options.planId ?? null,
      phase: phaseName,
      step_id: step.id,
      step_name: step.name,
      attempt,
      status: result.status,
      error: result.error ?? null,
      ...(errors.length > 0 && { errors }),
      ...(result.reason && { reason: result.reason }),
      output: result.output.slice(-HANDLER_OUTPUT_TAIL),
      retry_count: failed.retriesUsed,
      max_retries: maxRetries,
      timestamp: new Date().toISOString(),
    };

    const safeStepId = step.id.replace(/[^A-Za-z0-9_.-]/g, '_');
    const file = path.join(dir, `step-context-${phaseName}-${safeStepId}-${attempt}.json`);
    fs.writeFileSync(file, JSON.stringify(stepContext, null, 2) + '\n', 'utf-8');
    return path.resolve(file);
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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
