/**
 * @fractary/faber - Eval Harness Types
 *
 * An eval task is a frozen past work item: the repository before the change,
 * the work item as it was when work started, and a hidden answer key built
 * from the change a person accepted (#272).
 */

import type { RunStatus } from '../state/run-state.js';

/** FABER phases, in run order */
export const EVAL_PHASES = ['frame', 'architect', 'build', 'evaluate', 'release'] as const;
export type EvalPhase = (typeof EVAL_PHASES)[number];

/** The work item a trial works on, as it was when work started */
export interface EvalWorkItem {
  number: number;
  title: string;
  body: string;
  labels?: string[];
  comments?: Array<{ author?: string; body: string; created_at?: string }>;
}

/** Where a task's repository comes from */
export type EvalRepoSource =
  /** A git repository (URL or path) at the commit before the change */
  | { git: string; commit: string }
  /** A directory copied into a new repository, for small fixtures */
  | { dir: string };

/** The hidden checks of a task: files copied in after the run, then commands that must all pass */
export interface EvalAnswerKey {
  /** Repository path → absolute path of the file to copy there */
  files: Record<string, string>;
  /** Shell commands run in the repository; each must exit 0 */
  commands: string[];
  /** Timeout per command, in seconds (default 600) */
  timeout_seconds?: number;
}

/** One eval task, with the suite's defaults applied */
export interface EvalTask {
  id: string;
  /** Absolute path of the task's directory */
  dir: string;
  repo: EvalRepoSource;
  /** Branch that counts as production: an eval must never change it (default main) */
  production_branch: string;
  work_item: EvalWorkItem;
  /** Workflow ID, resolved from the trial's plugins first, then from its repository */
  workflow: string;
  /** Phases to run; Release never runs in an eval */
  phases: EvalPhase[];
  /** Step IDs removed from the resolved workflow, such as delivery steps that reach external systems */
  skip_steps: string[];
  /** Absolute paths of Claude Code plugins loaded into every agent session, such as the pack under test */
  plugins: string[];
  /** Absolute path of a Claude settings file applied to every agent session, such as the permissions trials get */
  settings?: string;
  /** Commands run in the repository before the run, such as installing dependencies */
  setup: string[];
  answer_key: EvalAnswerKey;
  /** Spend limit per trial, in USD, checked as an invariant */
  budget_usd?: number;
  /** Absolute path of the accepted change as a patch, used by `eval check` */
  solution?: string;
}

/** A suite: its tasks and the number of trials per task */
export interface EvalSuite {
  name: string;
  /** Absolute path of the suite's directory */
  dir: string;
  trials: number;
  tasks: EvalTask[];
}

/** One `gh` call recorded by the trial's gh shim */
export interface GhCall {
  args: string[];
  /** What the shim did: served the frozen work item, recorded the call, or refused it */
  outcome: 'served' | 'recorded' | 'refused';
  timestamp: string;
}

/** Result of one answer-key command */
export interface EvalCheckResult {
  command: string;
  exit_code: number;
  /** End of the command's output, for the report */
  output: string;
}

/** Result of grading a trial against its answer key */
export interface EvalGrade {
  passed: boolean;
  checks: EvalCheckResult[];
}

/** An invariant every trial must hold; `ok: null` means it could not be checked */
export interface EvalInvariant {
  id: 'run_ended' | 'no_pr_merge' | 'production_branch_untouched' | 'within_budget' | 'failed_validator_not_ignored';
  ok: boolean | null;
  detail?: string;
}

/** The outcome of one trial of one task */
export interface EvalTrialResult {
  task_id: string;
  trial: number;
  passed: boolean;
  /** Final status of the run, or `crashed` when the runner threw */
  run_status: RunStatus | 'awaiting_approval' | 'crashed';
  cost_usd?: number;
  duration_ms: number;
  grade: EvalGrade;
  invariants: EvalInvariant[];
  gh_calls: GhCall[];
  error?: string;
  /** Directory with the trial's run state, gh log and grade, when results are written */
  artifacts_dir?: string;
}

/** Per-task summary over its trials */
export interface EvalTaskSummary {
  task_id: string;
  trials: number;
  passes: number;
  /** Every trial passed */
  pass_all: boolean;
  /** Mean cost of the trials that reported one */
  mean_cost_usd?: number;
  mean_duration_ms: number;
  invariant_violations: number;
}

/** Suite summary over every trial */
export interface EvalSuiteSummary {
  suite: string;
  trials_per_task: number;
  tasks: EvalTaskSummary[];
  trials: number;
  passes: number;
  /** Tasks where every trial passed (pass^k) */
  tasks_pass_all: number;
  /** Total cost of the trials that reported one */
  total_cost_usd?: number;
  /** Total cost divided by passing trials; undefined when nothing passed or no cost was reported */
  cost_per_verified_success_usd?: number;
  invariant_violations: number;
  /** The plugins the trials loaded, such as the pack under test, and which version of each */
  plugins?: EvalPluginVersion[];
}

/** A plugin directory and the commit of the repository it is in, when it is in one */
export interface EvalPluginVersion {
  path: string;
  commit?: string;
  /** The directory has changes that are not committed, so the commit alone does not identify it */
  modified?: boolean;
}

/** Result of checking one task with `eval check` */
export interface EvalTaskCheck {
  task_id: string;
  /** The answer key fails on the repository before the change, as it must */
  fails_before: boolean;
  /** The answer key passes with the accepted change applied; undefined without a solution */
  passes_after?: boolean;
  before: EvalGrade;
  after?: EvalGrade;
  error?: string;
}
