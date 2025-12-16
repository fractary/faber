/**
 * @fractary/faber - State Manager
 *
 * Workflow state persistence and recovery.
 */
import { StateConfig, FaberPhase, WorkflowState, PhaseState, RunManifest, PhaseManifest, ArtifactManifest, Checkpoint, StateUpdateOptions, StateQueryOptions, RecoveryOptions } from './types';
/**
 * State Manager
 *
 * Handles workflow state persistence, checkpoints, and recovery.
 */
export declare class StateManager {
    private config;
    private stateDir;
    constructor(config?: StateConfig);
    /**
     * Ensure state directory exists
     */
    private ensureStateDir;
    /**
     * Get path for a state file
     */
    private getStatePath;
    /**
     * Create a new workflow state
     */
    createWorkflow(workId: string): WorkflowState;
    /**
     * Save workflow state
     */
    saveWorkflow(state: WorkflowState): void;
    /**
     * Get workflow state by ID
     */
    getWorkflow(workflowId: string): WorkflowState | null;
    /**
     * Get active workflow for a work item
     */
    getActiveWorkflow(workId: string): WorkflowState | null;
    /**
     * List all workflows
     */
    listWorkflows(options?: StateQueryOptions): WorkflowState[];
    /**
     * Update workflow phase
     */
    updatePhase(workflowId: string, phase: FaberPhase, updates: Partial<PhaseState>, options?: StateUpdateOptions): WorkflowState;
    /**
     * Start a phase
     */
    startPhase(workflowId: string, phase: FaberPhase): WorkflowState;
    /**
     * Complete a phase
     */
    completePhase(workflowId: string, phase: FaberPhase, outputs?: Record<string, unknown>): WorkflowState;
    /**
     * Fail a phase
     */
    failPhase(workflowId: string, phase: FaberPhase, error: string): WorkflowState;
    /**
     * Skip a phase
     */
    skipPhase(workflowId: string, phase: FaberPhase, reason?: string): WorkflowState;
    /**
     * Pause workflow
     */
    pauseWorkflow(workflowId: string): WorkflowState;
    /**
     * Resume workflow
     */
    resumeWorkflow(workflowId: string): WorkflowState;
    /**
     * Create a checkpoint
     */
    createCheckpoint(workflowId: string, phase: string, step: string, data: Record<string, unknown>): Checkpoint;
    /**
     * Get checkpoint by ID
     */
    getCheckpoint(checkpointId: string): Checkpoint | null;
    /**
     * List checkpoints for a workflow
     */
    listCheckpoints(workflowId: string): Checkpoint[];
    /**
     * Get latest checkpoint for a workflow
     */
    getLatestCheckpoint(workflowId: string): Checkpoint | null;
    /**
     * Create a run manifest
     */
    createManifest(workflowId: string, workId: string): RunManifest;
    /**
     * Save run manifest
     */
    saveManifest(manifest: RunManifest): void;
    /**
     * Get run manifest
     */
    getManifest(manifestId: string): RunManifest | null;
    /**
     * Add phase to manifest
     */
    addPhaseToManifest(manifestId: string, phaseManifest: PhaseManifest): void;
    /**
     * Add artifact to manifest
     */
    addArtifactToManifest(manifestId: string, artifact: ArtifactManifest): void;
    /**
     * Complete manifest
     */
    completeManifest(manifestId: string, status: 'completed' | 'failed'): RunManifest;
    /**
     * Recover a workflow from a checkpoint or phase
     */
    recoverWorkflow(workflowId: string, options?: RecoveryOptions): WorkflowState;
    /**
     * Delete workflow state
     */
    deleteWorkflow(workflowId: string): boolean;
    /**
     * Clean up old workflows and checkpoints
     */
    cleanup(maxAgeDays?: number): {
        deleted: number;
        errors: string[];
    };
    /**
     * Get state directory path
     */
    getStateDir(): string;
}
//# sourceMappingURL=manager.d.ts.map