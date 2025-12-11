/**
 * @fractary/faber - Workflow Module Types
 *
 * Re-exports from main types + workflow-specific interfaces.
 */

// Re-export common types
export {
  AutonomyLevel,
  WorkflowConfig,
  WorkflowHooks,
  WorkflowOptions,
  WorkflowResult,
  PhaseResult,
  WorkflowStatus,
  FaberPhase,
  ArtifactManifest,
} from '../types';

/**
 * Phase handler function type
 */
export type PhaseHandler = (context: PhaseContext) => Promise<PhaseHandlerResult>;

/**
 * Context passed to phase handlers
 */
export interface PhaseContext {
  workflowId: string;
  workId: string;
  phase: string;
  autonomy: string;
  issue: import('../types').Issue | null;
  spec: import('../types').Specification | null;
  branch: string | null;
  previousOutputs: Record<string, Record<string, unknown>>;
}

/**
 * Result from a phase handler
 */
export interface PhaseHandlerResult {
  status: 'completed' | 'failed' | 'skipped' | 'needs_input';
  outputs?: Record<string, unknown>;
  error?: string;
  message?: string;
}

/**
 * User confirmation request
 */
export interface ConfirmationRequest {
  phase: string;
  action: string;
  message: string;
  options?: string[];
}

/**
 * User input callback
 */
export type UserInputCallback = (request: ConfirmationRequest) => Promise<boolean | string>;

/**
 * Workflow event types
 */
export type WorkflowEvent =
  | 'workflow:start'
  | 'workflow:complete'
  | 'workflow:fail'
  | 'workflow:pause'
  | 'phase:start'
  | 'phase:complete'
  | 'phase:fail'
  | 'phase:skip'
  | 'artifact:create';

/**
 * Event listener callback
 */
export type EventListener = (event: WorkflowEvent, data: Record<string, unknown>) => void;
