/**
 * @fractary/faber - State Module
 *
 * Workflow state persistence and recovery.
 */

export { StateManager } from './manager.js';
export { SessionManager } from './session.js';
export { RunStateStore } from './run-state.js';
export type {
  RunState,
  RunStatus,
  RunPhaseState,
  RunPhaseStatus,
  RunStepState,
  RunStepStatus,
  RunPlanInfo,
  RunStepOutcome,
  RunStateStoreOptions,
  RunApprovalWait,
} from './run-state.js';
export type { SessionContext, LoadSessionOptions, SaveSessionOptions } from './session.js';
export * from './types.js';
