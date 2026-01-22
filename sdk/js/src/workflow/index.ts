/**
 * @fractary/faber - Workflow Module
 *
 * FABER workflow orchestration.
 */

export { FaberWorkflow } from './faber.js';
export * from './types.js';

// Workflow inheritance resolution
export { WorkflowResolver } from './resolver.js';
export type {
  WorkflowStep,
  WorkflowPhaseConfig,
  WorkflowAutonomyConfig,
  CriticalArtifact,
  CriticalArtifactsConfig,
  WorkflowFileConfig,
  ResolvedWorkflow,
  ResolvedPhase,
  WorkflowResolverOptions,
} from './resolver.js';
export {
  WorkflowNotFoundError,
  CircularInheritanceError,
  DuplicateStepIdError,
  InvalidWorkflowError,
} from './resolver.js';
