/**
 * @fractary/faber - State Module Types
 *
 * Re-exports from main types + state-specific interfaces.
 */
export { StateConfig, FaberPhase, WorkflowState, PhaseState, RunManifest, PhaseManifest, StepManifest, ArtifactManifest, } from '../types';
/**
 * State store key
 */
export type StateKey = 'workflow' | 'session' | 'manifest' | 'checkpoint';
/**
 * Checkpoint for recovery
 */
export interface Checkpoint {
    id: string;
    workflow_id: string;
    phase: string;
    step: string;
    timestamp: string;
    data: Record<string, unknown>;
}
/**
 * State update options
 */
export interface StateUpdateOptions {
    merge?: boolean;
    createCheckpoint?: boolean;
}
/**
 * State query options
 */
export interface StateQueryOptions {
    workId?: string;
    status?: string;
    since?: string;
    limit?: number;
}
/**
 * Recovery options
 */
export interface RecoveryOptions {
    checkpointId?: string;
    fromPhase?: string;
    skipPhases?: string[];
}
//# sourceMappingURL=types.d.ts.map