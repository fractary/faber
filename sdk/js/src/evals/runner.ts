/**
 * @fractary/faber - Eval Runner
 *
 * Runs every task of a suite k times, each trial in a clean workspace, and
 * grades it against the task's hidden answer key (#272).
 */

import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { ExecutorRegistry } from '../executors/registry.js';
import { WorkflowExecutor } from '../executors/workflow-executor.js';
import type { WorkflowExecuteResult } from '../executors/workflow-executor.js';
import { RunStateStore } from '../state/run-state.js';
import type { RunState } from '../state/run-state.js';
import { WorkflowResolver } from '../workflow/resolver.js';
import type { ResolvedWorkflow, WorkflowResolverOptions } from '../workflow/resolver.js';
import { readGhLog, GH_SHIM_FILES } from './gh-shim.js';
import { checkInvariants } from './invariants.js';
import { summarizeTrials, writeResults } from './results.js';
import {
  applyPatch,
  branchCommit,
  cacheTaskRepo,
  gradeTrial,
  prepareTrial,
  withoutSteps,
  withTrialEnv,
  writeTrialPlan,
} from './workspace.js';
import type { EvalTrialWorkspace } from './workspace.js';
import type { EvalGrade, EvalSuite, EvalSuiteSummary, EvalTask, EvalTaskCheck, EvalTrialResult } from './types.js';

export interface EvalRunOptions {
  /** Trials per task; overrides the suite's */
  trials?: number;
  /** Executors for the steps (default: ExecutorRegistry.createDefault()) */
  registry?: ExecutorRegistry;
  /** Options for resolving each task's workflow from its trial's repository */
  resolverOptions?: Omit<WorkflowResolverOptions, 'projectRoot'>;
  /** Directory for the trials' workspaces (default: a new temporary directory) */
  workDir?: string;
  /** Write results.json, results.md and each trial's artifacts here */
  outputDir?: string;
  /** Keep the trials' workspaces instead of deleting them */
  keepWorkspaces?: boolean;
  onTrialStart?: (task: EvalTask, trial: number) => void;
  onTrialEnd?: (result: EvalTrialResult) => void;
  onWarning?: (message: string) => void;
}

export interface EvalRunResult {
  summary: EvalSuiteSummary;
  trials: EvalTrialResult[];
  /** Paths of results.json and results.md, when written */
  files?: { json: string; markdown: string };
  /** Directory of the trials' workspaces, when kept */
  workDir?: string;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/** Copy a trial's run state, gh log and grade next to the results */
function saveArtifacts(outputDir: string, result: EvalTrialResult, ws: EvalTrialWorkspace, statePath?: string): string {
  const dir = path.join(outputDir, result.task_id, `trial-${result.trial}`);
  fs.mkdirSync(dir, { recursive: true });
  if (statePath && fs.existsSync(statePath)) fs.copyFileSync(statePath, path.join(dir, 'state.json'));
  const ghLog = path.join(ws.dir, GH_SHIM_FILES.log);
  if (fs.existsSync(ghLog)) fs.copyFileSync(ghLog, path.join(dir, GH_SHIM_FILES.log));
  fs.writeFileSync(path.join(dir, 'grade.json'), JSON.stringify(result.grade, null, 2) + '\n');
  return dir;
}

async function runTrial(
  task: EvalTask,
  trial: number,
  cachedRepo: string,
  workDir: string,
  registry: ExecutorRegistry,
  options: EvalRunOptions,
): Promise<{ result: EvalTrialResult; ws?: EvalTrialWorkspace; statePath?: string }> {
  const start = Date.now();
  const trialDir = path.join(workDir, task.id, `trial-${trial}`);
  let ws: EvalTrialWorkspace | undefined;
  let workflow: ResolvedWorkflow | undefined;
  let runState: RunStateStore | undefined;
  let executeResult: WorkflowExecuteResult | undefined;
  let crashed: string | undefined;

  try {
    ws = prepareTrial(task, trialDir, cachedRepo);
    const resolved = await new WorkflowResolver({ ...options.resolverOptions, projectRoot: ws.repoDir })
      .resolveWorkflow(task.workflow);
    const filtered = withoutSteps(resolved, task.skip_steps);
    if (filtered.unknown.length > 0) {
      options.onWarning?.(`${task.id}: skip_steps names steps the workflow does not have: ${filtered.unknown.join(', ')}`);
    }
    workflow = filtered.workflow;
    const plan = writeTrialPlan(ws, task, trial, workflow);
    const workId = String(task.work_item.number);
    runState = RunStateStore.create(plan.planDir, {
      planId: plan.planId,
      workId,
      workflowId: workflow.id,
      phases: workflow.phases,
    });

    const executor = new WorkflowExecutor(registry);
    const runWorkflow = workflow;
    const trialWs = ws;
    const state = runState;
    executeResult = await withTrialEnv(ws, () =>
      executor.execute(
        {
          phases: runWorkflow.phases,
          result_handling: runWorkflow.result_handling,
          prompt: runWorkflow.prompt,
          defaults: runWorkflow.defaults,
          phase_defaults: runWorkflow.phase_defaults,
          autonomy: runWorkflow.autonomy,
        },
        {
          workId,
          issue: { number: task.work_item.number, title: task.work_item.title, body: task.work_item.body },
          workingDirectory: trialWs.repoDir,
          phasesToRun: task.phases,
          planId: plan.planId,
          planPath: plan.planPath,
          branch: trialWs.branch,
          runState: state,
          onWarning: options.onWarning,
        },
      ),
    );
  } catch (error) {
    crashed = errorMessage(error);
  }

  let grade: EvalGrade = { passed: false, checks: [] };
  if (ws) {
    try {
      grade = gradeTrial(task, ws);
    } catch (error) {
      crashed ??= `grading failed: ${errorMessage(error)}`;
    }
  }

  const state: RunState | undefined = runState ? RunStateStore.load(path.dirname(runState.statePath), runState.runId).state : undefined;
  const ghCalls = ws ? readGhLog(ws.dir) : [];
  const invariants = workflow
    ? checkInvariants({
        crashed,
        state,
        workflow,
        ghCalls,
        productionBranch: task.production_branch,
        productionBefore: ws?.productionBefore,
        productionAfter: ws ? branchCommit(ws.remoteDir, task.production_branch) : undefined,
        budgetUsd: task.budget_usd,
      })
    : [{ id: 'run_ended' as const, ok: false, detail: `the trial could not start: ${crashed ?? 'unknown error'}` }];

  const result: EvalTrialResult = {
    task_id: task.id,
    trial,
    // A trial that crashed does not pass, whatever its working tree holds
    passed: crashed === undefined && grade.passed,
    run_status: crashed !== undefined ? 'crashed' : executeResult?.status === 'awaiting_approval' ? 'awaiting_approval' : state?.status ?? 'crashed',
    ...(state?.cost_usd !== undefined && { cost_usd: state.cost_usd }),
    duration_ms: Date.now() - start,
    grade,
    invariants,
    gh_calls: ghCalls,
    ...(crashed !== undefined && { error: crashed }),
  };
  return { result, ws, statePath: runState?.statePath };
}

/**
 * Run every task of a suite k times and summarize the results.
 * Trials run one at a time: each sets the process environment for its sessions.
 */
export async function runEvalSuite(suite: EvalSuite, options: EvalRunOptions = {}): Promise<EvalRunResult> {
  const trialsPerTask = options.trials ?? suite.trials;
  const registry = options.registry ?? ExecutorRegistry.createDefault();
  const workDir = options.workDir ?? fs.mkdtempSync(path.join(os.tmpdir(), 'faber-eval-'));
  const cacheDir = path.join(workDir, '.repos');
  const trials: EvalTrialResult[] = [];

  try {
    for (const task of suite.tasks) {
      let cachedRepo: string | undefined;
      let cacheError: string | undefined;
      try {
        cachedRepo = cacheTaskRepo(task, cacheDir);
      } catch (error) {
        cacheError = errorMessage(error);
      }
      for (let trial = 1; trial <= trialsPerTask; trial++) {
        options.onTrialStart?.(task, trial);
        let outcome: Awaited<ReturnType<typeof runTrial>>;
        if (cachedRepo) {
          outcome = await runTrial(task, trial, cachedRepo, workDir, registry, options);
        } else {
          outcome = {
            result: {
              task_id: task.id,
              trial,
              passed: false,
              run_status: 'crashed',
              duration_ms: 0,
              grade: { passed: false, checks: [] },
              invariants: [{ id: 'run_ended', ok: false, detail: `the repository could not be fetched: ${cacheError}` }],
              gh_calls: [],
              error: cacheError,
            },
          };
        }
        if (options.outputDir && outcome.ws) {
          outcome.result.artifacts_dir = saveArtifacts(options.outputDir, outcome.result, outcome.ws, outcome.statePath);
        }
        if (!options.keepWorkspaces && outcome.ws) fs.rmSync(outcome.ws.dir, { recursive: true, force: true });
        trials.push(outcome.result);
        options.onTrialEnd?.(outcome.result);
      }
    }
  } finally {
    if (!options.keepWorkspaces) fs.rmSync(workDir, { recursive: true, force: true });
  }

  const summary = summarizeTrials(suite.name, trialsPerTask, trials);
  const files = options.outputDir ? writeResults(options.outputDir, summary, trials) : undefined;
  return { summary, trials, ...(files && { files }), ...(options.keepWorkspaces && { workDir }) };
}

/**
 * Check that each task is valid without running any workflow: its answer key
 * must fail on the repository before the change, and pass with the accepted
 * change (`solution`) applied.
 */
export function checkEvalSuite(suite: EvalSuite, options: { workDir?: string } = {}): EvalTaskCheck[] {
  const workDir = options.workDir ?? fs.mkdtempSync(path.join(os.tmpdir(), 'faber-eval-check-'));
  const cacheDir = path.join(workDir, '.repos');
  try {
    return suite.tasks.map((task) => {
      try {
        const cachedRepo = cacheTaskRepo(task, cacheDir);
        const before = gradeTrial(task, prepareTrial(task, path.join(workDir, task.id, 'before'), cachedRepo));
        const check: EvalTaskCheck = { task_id: task.id, fails_before: !before.passed, before };
        if (task.solution) {
          const ws = prepareTrial(task, path.join(workDir, task.id, 'after'), cachedRepo);
          applyPatch(ws, task.solution);
          const after = gradeTrial(task, ws);
          check.after = after;
          check.passes_after = after.passed;
        }
        return check;
      } catch (error) {
        return {
          task_id: task.id,
          fails_before: false,
          before: { passed: false, checks: [] },
          error: errorMessage(error),
        };
      }
    });
  } finally {
    if (!options.workDir) fs.rmSync(workDir, { recursive: true, force: true });
  }
}
