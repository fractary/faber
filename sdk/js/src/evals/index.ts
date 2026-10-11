/**
 * @fractary/faber - Evals Module
 *
 * The eval harness (#272): run frozen work items in clean trials, grade them
 * against hidden answer keys, check invariants, and report pass^k and cost
 * per verified success.
 */

export { loadEvalSuite, EvalSuiteError } from './suite.js';
export { runEvalSuite, checkEvalSuite } from './runner.js';
export type { EvalRunOptions, EvalRunResult } from './runner.js';
export { summarizeTrials, renderResultsMarkdown, renderChecksMarkdown, tasksValid, writeResults } from './results.js';
export { checkInvariants, violations } from './invariants.js';
export { installGhShim, readGhLog, GH_SHIM_FILES } from './gh-shim.js';
export {
  cacheTaskRepo,
  prepareTrial,
  writeTrialPlan,
  withoutSteps,
  trialEnv,
  withTrialEnv,
  gradeTrial,
  applyPatch,
  branchCommit,
} from './workspace.js';
export type { EvalTrialWorkspace } from './workspace.js';
export { EVAL_PHASES } from './types.js';
export type {
  EvalPhase,
  EvalWorkItem,
  EvalRepoSource,
  EvalAnswerKey,
  EvalTask,
  EvalSuite,
  GhCall,
  EvalCheckResult,
  EvalGrade,
  EvalInvariant,
  EvalTrialResult,
  EvalTaskSummary,
  EvalSuiteSummary,
  EvalTaskCheck,
} from './types.js';
