/**
 * @fractary/faber - Run State
 *
 * Persistent state for plan-scoped workflow runs. A plan can be run several
 * times; each run keeps its own state file next to the plan:
 *
 *   .fractary/faber/runs/{plan_id}/plan.json
 *   .fractary/faber/runs/{plan_id}/state-{run_suffix}.json
 *
 * The run ID is `{plan_id}-run-{run_suffix}`. The format matches the state the
 * workflow-run skill writes, so `fractary-faber runs verify-complete` works for
 * runs started by either the CLI executor or the skill.
 */

import * as fs from 'fs';
import * as path from 'path';
import { RUN_ID_MARKER, parseRunId } from '../paths.js';

/** Overall status of a run */
export type RunStatus = 'in_progress' | 'paused' | 'completed' | 'failed';

/** Status of a phase within a run */
export type RunPhaseStatus = 'pending' | 'in_progress' | 'completed' | 'failed' | 'skipped';

/** Status of a step within a run */
export type RunStepStatus = 'pending' | 'in_progress' | 'completed' | 'failed' | 'skipped';

/** Persisted state of one step */
export interface RunStepState {
  status: RunStepStatus;
  started_at?: string;
  completed_at?: string;
  /** Number of times the step has been started in this run */
  attempts?: number;
  /** Result status reported by the step's executor */
  result?: 'success' | 'warning' | 'failure';
  error?: string;
  /** Why the result did not come from a valid response block, e.g. `no_response_block` */
  reason?: string;
  duration_ms?: number;
}

/** Persisted state of one phase */
export interface RunPhaseState {
  status: RunPhaseStatus;
  /** Present and false when the phase is disabled in the plan's workflow */
  enabled?: boolean;
  steps: Record<string, RunStepState>;
  retry_count: number;
  started_at?: string;
  completed_at?: string;
  error?: string;
}

/** Persisted state of one run of a plan */
export interface RunState {
  run_id: string;
  plan_id: string;
  work_id: string | null;
  workflow_id: string | null;
  status: RunStatus;
  current_phase: string | null;
  /** Step being executed, as `{phase}:{step_id}` */
  current_step_id: string | null;
  phases: Record<string, RunPhaseState>;
  /** Completed steps, as `{phase}:{step_id}` */
  steps_completed: string[];
  artifacts: Record<string, unknown>;
  started_at: string;
  updated_at: string;
  completed_at?: string;
  error?: string;
  pause_reason?: string;
}

/** Plan information needed to start a run */
export interface RunPlanInfo {
  planId: string;
  workId?: string | null;
  workflowId?: string | null;
  /**
   * The plan's resolved workflow phases. A phase whose `enabled` is not true
   * is recorded as skipped, matching how the workflow executor treats it.
   */
  phases: Record<string, { enabled?: boolean; steps?: ReadonlyArray<{ id: string }> }>;
}

/** Outcome of an executed step */
export interface RunStepOutcome {
  result: 'success' | 'warning' | 'failure';
  error?: string;
  reason?: string;
  duration_ms?: number;
}

export interface RunStateStoreOptions {
  /** Clock override, for tests */
  now?: () => Date;
}

const STATE_FILE_PREFIX = 'state-';
const STATE_FILE_EXTENSION = '.json';

/** Format a run suffix: UTC timestamp `YYYY-MM-DDTHH-MM-SSZ` */
function formatRunSuffix(date: Date): string {
  return date.toISOString().replace(/[:.]/g, '-').slice(0, -5) + 'Z';
}

function isDone(step: RunStepState): boolean {
  return step.status === 'completed' || step.status === 'skipped';
}

function byStartedAtDesc(a: RunState, b: RunState): number {
  return (b.started_at ?? '').localeCompare(a.started_at ?? '');
}

/**
 * Reads and writes the state of one plan-scoped run.
 *
 * Every mutation is saved immediately with an atomic write, so the file on
 * disk always reflects the last completed transition, even after a crash.
 */
export class RunStateStore {
  private constructor(
    private readonly filePath: string,
    private data: RunState,
    private readonly now: () => Date
  ) {}

  /**
   * Start a new run of the plan whose plan.json is in `planDir`.
   */
  static create(planDir: string, plan: RunPlanInfo, options: RunStateStoreOptions = {}): RunStateStore {
    const now = options.now ?? ((): Date => new Date());
    const startedAt = now();
    const baseId = `${plan.planId}${RUN_ID_MARKER}${formatRunSuffix(startedAt)}`;

    // Two runs of one plan started in the same second get a numeric suffix
    let runId = baseId;
    for (let n = 2; fs.existsSync(RunStateStore.statePathFor(planDir, runId)); n++) {
      runId = `${baseId}-${n}`;
    }

    const phases: Record<string, RunPhaseState> = {};
    for (const [name, phase] of Object.entries(plan.phases)) {
      const enabled = phase.enabled === true;
      const steps: Record<string, RunStepState> = {};
      for (const step of phase.steps ?? []) {
        steps[step.id] = { status: enabled ? 'pending' : 'skipped' };
      }
      phases[name] = enabled
        ? { status: 'pending', steps, retry_count: 0 }
        : { status: 'skipped', enabled: false, steps, retry_count: 0 };
    }

    const timestamp = startedAt.toISOString();
    const state: RunState = {
      run_id: runId,
      plan_id: plan.planId,
      work_id: plan.workId ?? null,
      workflow_id: plan.workflowId ?? null,
      status: 'in_progress',
      current_phase: null,
      current_step_id: null,
      phases,
      steps_completed: [],
      artifacts: {},
      started_at: timestamp,
      updated_at: timestamp,
    };

    const store = new RunStateStore(RunStateStore.statePathFor(planDir, runId), state, now);
    store.save();
    return store;
  }

  /**
   * Load an existing run of the plan in `planDir`.
   * @throws Error if the run's state file does not exist
   */
  static load(planDir: string, runId: string, options: RunStateStoreOptions = {}): RunStateStore {
    const filePath = RunStateStore.statePathFor(planDir, runId);
    if (!fs.existsSync(filePath)) {
      throw new Error(`Run state not found: ${filePath}`);
    }
    const data = JSON.parse(fs.readFileSync(filePath, 'utf-8')) as RunState;
    if (data.run_id !== runId) {
      throw new Error(`State file ${filePath} belongs to run ${data.run_id}, not ${runId}`);
    }
    return new RunStateStore(filePath, data, options.now ?? ((): Date => new Date()));
  }

  /**
   * Path of the state file for `runId` in `planDir`.
   * @throws Error if `runId` is not a plan-scoped run ID
   */
  static statePathFor(planDir: string, runId: string): string {
    const parsed = parseRunId(runId);
    if (!parsed) {
      throw new Error(`Invalid run ID: ${runId} (expected {plan_id}${RUN_ID_MARKER}{timestamp})`);
    }
    return path.join(planDir, `${STATE_FILE_PREFIX}${parsed.suffix}${STATE_FILE_EXTENSION}`);
  }

  /**
   * Runs stored in `planDir`, newest first. Unreadable state files are skipped.
   */
  static listForPlan(planDir: string): RunState[] {
    if (!fs.existsSync(planDir)) return [];
    const states: RunState[] = [];
    for (const file of fs.readdirSync(planDir)) {
      if (!file.startsWith(STATE_FILE_PREFIX) || !file.endsWith(STATE_FILE_EXTENSION)) continue;
      try {
        const state = JSON.parse(fs.readFileSync(path.join(planDir, file), 'utf-8')) as RunState;
        if (state && typeof state.run_id === 'string') states.push(state);
      } catch {
        // Skip partial or corrupt state files
      }
    }
    return states.sort(byStartedAtDesc);
  }

  /**
   * Runs stored under `runsDir` (one directory per plan), newest first.
   */
  static listAll(runsDir: string, filter: { workId?: string } = {}): RunState[] {
    if (!fs.existsSync(runsDir)) return [];
    const states: RunState[] = [];
    for (const entry of fs.readdirSync(runsDir, { withFileTypes: true })) {
      if (entry.isDirectory()) {
        states.push(...RunStateStore.listForPlan(path.join(runsDir, entry.name)));
      }
    }
    return states
      .filter((s) => filter.workId === undefined || String(s.work_id) === String(filter.workId))
      .sort(byStartedAtDesc);
  }

  /** The run ID */
  get runId(): string {
    return this.data.run_id;
  }

  /** Absolute path of the run's state file */
  get statePath(): string {
    return this.filePath;
  }

  /** A copy of the current state */
  get state(): RunState {
    return JSON.parse(JSON.stringify(this.data)) as RunState;
  }

  /**
   * True when the step completed, or was skipped, earlier in this run.
   */
  isStepDone(phase: string, stepId: string): boolean {
    const step = this.data.phases[phase]?.steps[stepId];
    return step !== undefined && isDone(step);
  }

  /**
   * Mark the run as executing, when it starts and when it resumes.
   */
  begin(): void {
    this.data.status = 'in_progress';
    delete this.data.completed_at;
    delete this.data.error;
    delete this.data.pause_reason;
    this.save();
  }

  /**
   * Record a phase that is disabled in the workflow: it and its unfinished steps
   * are skipped. Runs started by the workflow-run skill record such phases as pending.
   */
  skipPhase(phase: string): void {
    const phaseState = this.phase(phase);
    if (phaseState.enabled === false && phaseState.status === 'skipped') return;
    phaseState.status = 'skipped';
    phaseState.enabled = false;
    for (const step of Object.values(phaseState.steps)) {
      if (!isDone(step)) step.status = 'skipped';
    }
    this.save();
  }

  startPhase(phase: string): void {
    const phaseState = this.phase(phase);
    // A phase disabled earlier in this run, and enabled now, runs its skipped steps
    if (phaseState.enabled === false) {
      delete phaseState.enabled;
      for (const step of Object.values(phaseState.steps)) {
        if (step.status === 'skipped') step.status = 'pending';
      }
    }
    // A completed phase stays completed when a resumed run passes through it
    if (phaseState.status !== 'in_progress' && phaseState.status !== 'completed') {
      phaseState.status = 'in_progress';
      phaseState.started_at = phaseState.started_at ?? this.timestamp();
      delete phaseState.completed_at;
      delete phaseState.error;
    }
    this.data.current_phase = phase;
    this.save();
  }

  startStep(phase: string, stepId: string): void {
    const step = this.step(phase, stepId);
    step.status = 'in_progress';
    step.started_at = this.timestamp();
    step.attempts = (step.attempts ?? 0) + 1;
    delete step.completed_at;
    delete step.result;
    delete step.error;
    delete step.reason;
    delete step.duration_ms;
    this.data.current_phase = phase;
    this.data.current_step_id = `${phase}:${stepId}`;
    this.save();
  }

  /**
   * Record a step's outcome: success and warning complete the step; failure fails it.
   */
  finishStep(phase: string, stepId: string, outcome: RunStepOutcome): void {
    const step = this.step(phase, stepId);
    step.result = outcome.result;
    step.completed_at = this.timestamp();
    if (outcome.reason) step.reason = outcome.reason;
    if (outcome.duration_ms !== undefined) step.duration_ms = outcome.duration_ms;

    if (outcome.result === 'failure') {
      step.status = 'failed';
      if (outcome.error) step.error = outcome.error;
    } else {
      step.status = 'completed';
      const id = `${phase}:${stepId}`;
      if (!this.data.steps_completed.includes(id)) this.data.steps_completed.push(id);
    }
    this.save();
  }

  /**
   * Close a phase after its steps ran. It fails if any step failed and completes
   * when every step is done; otherwise (some steps were not run) it stays in progress.
   */
  finishPhase(phase: string): void {
    const phaseState = this.phase(phase);
    const steps = Object.values(phaseState.steps);
    const failed = steps.find((s) => s.status === 'failed');
    if (failed) {
      phaseState.status = 'failed';
      if (failed.error) phaseState.error = failed.error;
    } else if (steps.every(isDone) && phaseState.status !== 'completed') {
      phaseState.status = 'completed';
      phaseState.completed_at = this.timestamp();
    }
    this.save();
  }

  /**
   * Close the run. With `failureMessage` the run fails. Otherwise it completes when
   * every step of every enabled phase is done, fails when any step failed, and is
   * paused when some steps were not run (for example a phase or step filter).
   * @returns The run's final status
   */
  finish(failureMessage?: string): RunStatus {
    const steps = Object.values(this.data.phases)
      .filter((p) => p.enabled !== false)
      .flatMap((p) => Object.values(p.steps));
    const failedCount = steps.filter((s) => s.status === 'failed').length;

    if (failureMessage !== undefined) {
      this.data.status = 'failed';
      this.data.error = failureMessage;
    } else if (failedCount > 0) {
      this.data.status = 'failed';
      this.data.error = `${failedCount} step(s) failed`;
    } else if (steps.every(isDone)) {
      this.data.status = 'completed';
      this.data.completed_at = this.timestamp();
    } else {
      this.data.status = 'paused';
      this.data.pause_reason = 'Not every step has run yet (phase or step filter)';
    }
    this.save();
    return this.data.status;
  }

  private phase(name: string): RunPhaseState {
    let phaseState = this.data.phases[name];
    if (!phaseState) {
      phaseState = { status: 'pending', steps: {}, retry_count: 0 };
      this.data.phases[name] = phaseState;
    }
    return phaseState;
  }

  private step(phase: string, stepId: string): RunStepState {
    const phaseState = this.phase(phase);
    let step = phaseState.steps[stepId];
    if (!step) {
      step = { status: 'pending' };
      phaseState.steps[stepId] = step;
    }
    return step;
  }

  private timestamp(): string {
    return this.now().toISOString();
  }

  /** Write the state atomically: write a temporary file, then rename it into place */
  private save(): void {
    this.data.updated_at = this.timestamp();
    fs.mkdirSync(path.dirname(this.filePath), { recursive: true });
    const tempPath = `${this.filePath}.${process.pid}.tmp`;
    fs.writeFileSync(tempPath, JSON.stringify(this.data, null, 2) + '\n', 'utf-8');
    fs.renameSync(tempPath, this.filePath);
  }
}
