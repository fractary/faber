/**
 * @fractary/faber - State Manager
 *
 * Workflow state persistence and recovery.
 */

import * as fs from 'fs';
import * as path from 'path';
import {
  StateConfig,
  FaberPhase,
  WorkflowState,
  PhaseState,
  RunManifest,
  PhaseManifest,
  ArtifactManifest,
  Checkpoint,
  StateUpdateOptions,
  StateQueryOptions,
  RecoveryOptions,
} from './types';
import { loadStateConfig, findProjectRoot } from '../config';
import { StateError } from '../errors';

/**
 * Generate a unique workflow ID
 */
function generateWorkflowId(): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 6);
  return `WF-${timestamp}-${random}`.toUpperCase();
}

/**
 * Generate a unique manifest ID
 */
function generateManifestId(): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 6);
  return `MAN-${timestamp}-${random}`.toUpperCase();
}

/**
 * Generate a unique checkpoint ID
 */
function generateCheckpointId(): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 4);
  return `CP-${timestamp}-${random}`.toUpperCase();
}

/**
 * Default phase state
 */
function defaultPhaseState(): PhaseState {
  return {
    status: 'pending',
    attempts: 0,
  };
}

/**
 * State Manager
 *
 * Handles workflow state persistence, checkpoints, and recovery.
 */
export class StateManager {
  private config: StateConfig;
  private stateDir: string;

  constructor(config?: StateConfig) {
    this.config = config || loadStateConfig();
    const projectRoot = findProjectRoot();
    this.stateDir = this.config.localPath || path.join(projectRoot, '.faber', 'state');
  }

  // =========================================================================
  // Noun-First Grouped API (New)
  // =========================================================================

  /**
   * Workflow operations
   */
  public readonly workflow = {
    create: (workId: string) => this._createWorkflow(workId),
    save: (state: WorkflowState) => this._saveWorkflow(state),
    get: (workflowId: string) => this._getWorkflow(workflowId),
    getActive: (workId: string) => this._getActiveWorkflow(workId),
    list: (options?: StateQueryOptions) => this._listWorkflows(options),
    delete: (workflowId: string) => this._deleteWorkflow(workflowId),
    pause: (workflowId: string) => this._pauseWorkflow(workflowId),
    resume: (workflowId: string) => this._resumeWorkflow(workflowId),
    recover: (workflowId: string, options?: RecoveryOptions) => this._recoverWorkflow(workflowId, options),
  };

  /**
   * Phase operations
   */
  public readonly phase = {
    update: (
      workflowId: string,
      phase: FaberPhase,
      updates: Partial<PhaseState>,
      options?: StateUpdateOptions
    ) => this._updatePhase(workflowId, phase, updates, options),
    start: (workflowId: string, phase: FaberPhase) => this._startPhase(workflowId, phase),
    complete: (workflowId: string, phase: FaberPhase, outputs?: Record<string, unknown>) =>
      this._completePhase(workflowId, phase, outputs),
    fail: (workflowId: string, phase: FaberPhase, error: string) => this._failPhase(workflowId, phase, error),
    skip: (workflowId: string, phase: FaberPhase, reason?: string) => this._skipPhase(workflowId, phase, reason),
  };

  /**
   * Checkpoint operations
   */
  public readonly checkpoint = {
    create: (workflowId: string, phase: string, step: string, data: Record<string, unknown>) =>
      this._createCheckpoint(workflowId, phase, step, data),
    get: (checkpointId: string) => this._getCheckpoint(checkpointId),
    list: (workflowId: string) => this._listCheckpoints(workflowId),
    getLatest: (workflowId: string) => this._getLatestCheckpoint(workflowId),
  };

  /**
   * Manifest operations
   */
  public readonly manifest = {
    create: (workflowId: string, workId: string) => this._createManifest(workflowId, workId),
    save: (manifest: RunManifest) => this._saveManifest(manifest),
    get: (manifestId: string) => this._getManifest(manifestId),
    addPhase: (manifestId: string, phaseManifest: PhaseManifest) =>
      this._addPhaseToManifest(manifestId, phaseManifest),
    addArtifact: (manifestId: string, artifact: ArtifactManifest) =>
      this._addArtifactToManifest(manifestId, artifact),
    complete: (manifestId: string, status: 'completed' | 'failed') => this._completeManifest(manifestId, status),
  };

  // =========================================================================
  // Private Implementation Methods
  // =========================================================================

  /**
   * Ensure state directory exists
   */
  private ensureStateDir(subDir?: string): string {
    const dir = subDir ? path.join(this.stateDir, subDir) : this.stateDir;
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    return dir;
  }

  /**
   * Get path for a state file
   */
  private getStatePath(type: string, id: string): string {
    return path.join(this.ensureStateDir(type), `${id}.json`);
  }

  // =========================================================================
  // Workflow State Operations (Private)
  // =========================================================================

  /**
   * Create a new workflow state
   */
  private _createWorkflow(workId: string): WorkflowState {
    const workflowId = generateWorkflowId();
    const now = new Date().toISOString();

    const state: WorkflowState = {
      workflow_id: workflowId,
      work_id: workId,
      current_phase: 'frame',
      phase_states: {
        frame: defaultPhaseState(),
        architect: defaultPhaseState(),
        build: defaultPhaseState(),
        evaluate: defaultPhaseState(),
        release: defaultPhaseState(),
      },
      started_at: now,
      updated_at: now,
      status: 'running',
    };

    this._saveWorkflow(state);
    return state;
  }

  /**
   * Save workflow state
   */
  private _saveWorkflow(state: WorkflowState): void {
    const filePath = this.getStatePath('workflows', state.workflow_id);
    state.updated_at = new Date().toISOString();
    fs.writeFileSync(filePath, JSON.stringify(state, null, 2), 'utf-8');

    // Also save as active workflow for the work item
    const activeFile = this.getStatePath('active', state.work_id);
    fs.writeFileSync(activeFile, JSON.stringify({ workflow_id: state.workflow_id }, null, 2), 'utf-8');
  }

  /**
   * Get workflow state by ID
   */
  private _getWorkflow(workflowId: string): WorkflowState | null {
    const filePath = this.getStatePath('workflows', workflowId);
    if (!fs.existsSync(filePath)) {
      return null;
    }
    return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  }

  /**
   * Get active workflow for a work item
   */
  private _getActiveWorkflow(workId: string): WorkflowState | null {
    const activeFile = this.getStatePath('active', workId);
    if (!fs.existsSync(activeFile)) {
      return null;
    }

    const active = JSON.parse(fs.readFileSync(activeFile, 'utf-8'));
    return this._getWorkflow(active.workflow_id);
  }

  /**
   * List all workflows
   */
  private _listWorkflows(options?: StateQueryOptions): WorkflowState[] {
    const workflowsDir = this.ensureStateDir('workflows');
    const files = fs.readdirSync(workflowsDir).filter(f => f.endsWith('.json'));
    const workflows: WorkflowState[] = [];

    for (const file of files) {
      const state = JSON.parse(fs.readFileSync(path.join(workflowsDir, file), 'utf-8'));

      // Apply filters
      if (options?.workId && state.work_id !== options.workId) continue;
      if (options?.status && state.status !== options.status) continue;
      if (options?.since && new Date(state.started_at) < new Date(options.since)) continue;

      workflows.push(state);
    }

    // Sort by updated_at descending
    workflows.sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());

    // Apply limit
    if (options?.limit) {
      return workflows.slice(0, options.limit);
    }

    return workflows;
  }

  /**
   * Update workflow phase
   */
  private _updatePhase(
    workflowId: string,
    phase: FaberPhase,
    updates: Partial<PhaseState>,
    options?: StateUpdateOptions
  ): WorkflowState {
    const state = this._getWorkflow(workflowId);
    if (!state) {
      throw new StateError(`Workflow not found: ${workflowId}`);
    }

    // Create checkpoint if requested
    if (options?.createCheckpoint) {
      this._createCheckpoint(workflowId, phase, 'phase_update', { updates });
    }

    // Update phase state
    const currentPhaseState = state.phase_states[phase];
    state.phase_states[phase] = {
      ...currentPhaseState,
      ...updates,
    };

    // Update current phase if progressing
    if (updates.status === 'completed') {
      const phases: FaberPhase[] = ['frame', 'architect', 'build', 'evaluate', 'release'];
      const currentIndex = phases.indexOf(phase);
      if (currentIndex < phases.length - 1) {
        state.current_phase = phases[currentIndex + 1];
      }
    }

    // Update workflow status based on phase states
    if (updates.status === 'failed') {
      state.status = 'failed';
    } else if (phase === 'release' && updates.status === 'completed') {
      state.status = 'completed';
    }

    this._saveWorkflow(state);
    return state;
  }

  /**
   * Start a phase
   */
  private _startPhase(workflowId: string, phase: FaberPhase): WorkflowState {
    return this._updatePhase(workflowId, phase, {
      status: 'in_progress',
      started_at: new Date().toISOString(),
      attempts: (this._getWorkflow(workflowId)?.phase_states[phase].attempts || 0) + 1,
    });
  }

  /**
   * Complete a phase
   */
  private _completePhase(
    workflowId: string,
    phase: FaberPhase,
    outputs?: Record<string, unknown>
  ): WorkflowState {
    return this._updatePhase(workflowId, phase, {
      status: 'completed',
      completed_at: new Date().toISOString(),
      outputs,
    });
  }

  /**
   * Fail a phase
   */
  private _failPhase(workflowId: string, phase: FaberPhase, error: string): WorkflowState {
    return this._updatePhase(workflowId, phase, {
      status: 'failed',
      error,
    });
  }

  /**
   * Skip a phase
   */
  private _skipPhase(workflowId: string, phase: FaberPhase, reason?: string): WorkflowState {
    return this._updatePhase(workflowId, phase, {
      status: 'skipped',
      error: reason,
    });
  }

  /**
   * Pause workflow
   */
  private _pauseWorkflow(workflowId: string): WorkflowState {
    const state = this._getWorkflow(workflowId);
    if (!state) {
      throw new StateError(`Workflow not found: ${workflowId}`);
    }

    state.status = 'paused';
    this._saveWorkflow(state);

    // Create checkpoint for recovery
    this._createCheckpoint(workflowId, state.current_phase, 'pause', {});

    return state;
  }

  /**
   * Resume workflow
   */
  private _resumeWorkflow(workflowId: string): WorkflowState {
    const state = this._getWorkflow(workflowId);
    if (!state) {
      throw new StateError(`Workflow not found: ${workflowId}`);
    }

    if (state.status !== 'paused') {
      throw new StateError(`Workflow is not paused: ${workflowId}`);
    }

    state.status = 'running';
    this._saveWorkflow(state);

    return state;
  }

  // =========================================================================
  // Checkpoint Operations (Private)
  // =========================================================================

  /**
   * Create a checkpoint
   */
  private _createCheckpoint(
    workflowId: string,
    phase: string,
    step: string,
    data: Record<string, unknown>
  ): Checkpoint {
    const checkpoint: Checkpoint = {
      id: generateCheckpointId(),
      workflow_id: workflowId,
      phase,
      step,
      timestamp: new Date().toISOString(),
      data,
    };

    const filePath = this.getStatePath('checkpoints', checkpoint.id);
    fs.writeFileSync(filePath, JSON.stringify(checkpoint, null, 2), 'utf-8');

    return checkpoint;
  }

  /**
   * Get checkpoint by ID
   */
  private _getCheckpoint(checkpointId: string): Checkpoint | null {
    const filePath = this.getStatePath('checkpoints', checkpointId);
    if (!fs.existsSync(filePath)) {
      return null;
    }
    return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  }

  /**
   * List checkpoints for a workflow
   */
  private _listCheckpoints(workflowId: string): Checkpoint[] {
    const checkpointsDir = this.ensureStateDir('checkpoints');
    const files = fs.readdirSync(checkpointsDir).filter(f => f.endsWith('.json'));
    const checkpoints: Checkpoint[] = [];

    for (const file of files) {
      const checkpoint = JSON.parse(fs.readFileSync(path.join(checkpointsDir, file), 'utf-8'));
      if (checkpoint.workflow_id === workflowId) {
        checkpoints.push(checkpoint);
      }
    }

    // Sort by timestamp
    checkpoints.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

    return checkpoints;
  }

  /**
   * Get latest checkpoint for a workflow
   */
  private _getLatestCheckpoint(workflowId: string): Checkpoint | null {
    const checkpoints = this._listCheckpoints(workflowId);
    return checkpoints.length > 0 ? checkpoints[checkpoints.length - 1] : null;
  }

  // =========================================================================
  // Run Manifest Operations (Private)
  // =========================================================================

  /**
   * Create a run manifest
   */
  private _createManifest(workflowId: string, workId: string): RunManifest {
    const manifest: RunManifest = {
      manifest_id: generateManifestId(),
      workflow_id: workflowId,
      work_id: workId,
      created_at: new Date().toISOString(),
      status: 'running',
      phases: [],
      artifacts: [],
    };

    this._saveManifest(manifest);
    return manifest;
  }

  /**
   * Save run manifest
   */
  private _saveManifest(manifest: RunManifest): void {
    const filePath = this.getStatePath('manifests', manifest.manifest_id);
    fs.writeFileSync(filePath, JSON.stringify(manifest, null, 2), 'utf-8');
  }

  /**
   * Get run manifest
   */
  private _getManifest(manifestId: string): RunManifest | null {
    const filePath = this.getStatePath('manifests', manifestId);
    if (!fs.existsSync(filePath)) {
      return null;
    }
    return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  }

  /**
   * Add phase to manifest
   */
  private _addPhaseToManifest(manifestId: string, phaseManifest: PhaseManifest): void {
    const manifest = this._getManifest(manifestId);
    if (!manifest) {
      throw new StateError(`Manifest not found: ${manifestId}`);
    }

    manifest.phases.push(phaseManifest);
    this._saveManifest(manifest);
  }

  /**
   * Add artifact to manifest
   */
  private _addArtifactToManifest(manifestId: string, artifact: ArtifactManifest): void {
    const manifest = this._getManifest(manifestId);
    if (!manifest) {
      throw new StateError(`Manifest not found: ${manifestId}`);
    }

    manifest.artifacts.push(artifact);
    this._saveManifest(manifest);
  }

  /**
   * Complete manifest
   */
  private _completeManifest(manifestId: string, status: 'completed' | 'failed'): RunManifest {
    const manifest = this._getManifest(manifestId);
    if (!manifest) {
      throw new StateError(`Manifest not found: ${manifestId}`);
    }

    manifest.completed_at = new Date().toISOString();
    manifest.status = status;
    this._saveManifest(manifest);

    return manifest;
  }

  // =========================================================================
  // Recovery Operations (Private)
  // =========================================================================

  /**
   * Recover a workflow from a checkpoint or phase
   */
  private _recoverWorkflow(workflowId: string, options?: RecoveryOptions): WorkflowState {
    const state = this._getWorkflow(workflowId);
    if (!state) {
      throw new StateError(`Workflow not found: ${workflowId}`);
    }

    // If recovering from a specific checkpoint
    if (options?.checkpointId) {
      const checkpoint = this._getCheckpoint(options.checkpointId);
      if (!checkpoint) {
        throw new StateError(`Checkpoint not found: ${options.checkpointId}`);
      }

      state.current_phase = checkpoint.phase as FaberPhase;
    }

    // If recovering from a specific phase
    if (options?.fromPhase) {
      const phases: FaberPhase[] = ['frame', 'architect', 'build', 'evaluate', 'release'];
      const fromIndex = phases.indexOf(options.fromPhase as FaberPhase);

      if (fromIndex === -1) {
        throw new StateError(`Invalid phase: ${options.fromPhase}`);
      }

      state.current_phase = options.fromPhase as FaberPhase;

      // Reset phases from the recovery point
      for (let i = fromIndex; i < phases.length; i++) {
        if (!options.skipPhases?.includes(phases[i])) {
          state.phase_states[phases[i]] = defaultPhaseState();
        }
      }
    }

    // Skip specified phases
    if (options?.skipPhases) {
      for (const phase of options.skipPhases) {
        state.phase_states[phase as FaberPhase].status = 'skipped';
      }
    }

    state.status = 'running';
    this._saveWorkflow(state);

    return state;
  }

  // =========================================================================
  // Cleanup Operations (Private)
  // =========================================================================

  /**
   * Delete workflow state
   */
  private _deleteWorkflow(workflowId: string): boolean {
    const workflowPath = this.getStatePath('workflows', workflowId);
    if (!fs.existsSync(workflowPath)) {
      return false;
    }

    // Get the work_id to clean up active state
    const state = this._getWorkflow(workflowId);
    if (state) {
      const activePath = this.getStatePath('active', state.work_id);
      if (fs.existsSync(activePath)) {
        fs.unlinkSync(activePath);
      }
    }

    fs.unlinkSync(workflowPath);
    return true;
  }

  // =========================================================================
  // Public Utility Methods
  // =========================================================================

  /**
   * Clean up old workflows and checkpoints
   */
  public cleanup(maxAgeDays: number = 30): { deleted: number; errors: string[] } {
    const result = { deleted: 0, errors: [] as string[] };
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - maxAgeDays);

    // Clean up completed/failed workflows
    const workflows = this.workflow.list();
    for (const workflow of workflows) {
      if (
        (workflow.status === 'completed' || workflow.status === 'failed') &&
        new Date(workflow.updated_at) < cutoffDate
      ) {
        try {
          this.workflow.delete(workflow.workflow_id);
          result.deleted++;
        } catch (error) {
          result.errors.push(`Failed to delete workflow ${workflow.workflow_id}: ${error}`);
        }
      }
    }

    return result;
  }

  /**
   * Get state directory path
   */
  public getStateDir(): string {
    return this.stateDir;
  }

  // =========================================================================
  // Deprecated Methods (Backwards Compatibility)
  // =========================================================================

  /** @deprecated Use state.workflow.create() instead. Will be removed in v2.0 */
  public createWorkflow(workId: string): WorkflowState {
    console.warn('DEPRECATED: StateManager.createWorkflow() is deprecated. Use state.workflow.create() instead.');
    return this.workflow.create(workId);
  }

  /** @deprecated Use state.workflow.save() instead. Will be removed in v2.0 */
  public saveWorkflow(state: WorkflowState): void {
    console.warn('DEPRECATED: StateManager.saveWorkflow() is deprecated. Use state.workflow.save() instead.');
    return this.workflow.save(state);
  }

  /** @deprecated Use state.workflow.get() instead. Will be removed in v2.0 */
  public getWorkflow(workflowId: string): WorkflowState | null {
    console.warn('DEPRECATED: StateManager.getWorkflow() is deprecated. Use state.workflow.get() instead.');
    return this.workflow.get(workflowId);
  }

  /** @deprecated Use state.workflow.getActive() instead. Will be removed in v2.0 */
  public getActiveWorkflow(workId: string): WorkflowState | null {
    console.warn('DEPRECATED: StateManager.getActiveWorkflow() is deprecated. Use state.workflow.getActive() instead.');
    return this.workflow.getActive(workId);
  }

  /** @deprecated Use state.workflow.list() instead. Will be removed in v2.0 */
  public listWorkflows(options?: StateQueryOptions): WorkflowState[] {
    console.warn('DEPRECATED: StateManager.listWorkflows() is deprecated. Use state.workflow.list() instead.');
    return this.workflow.list(options);
  }

  /** @deprecated Use state.workflow.delete() instead. Will be removed in v2.0 */
  public deleteWorkflow(workflowId: string): boolean {
    console.warn('DEPRECATED: StateManager.deleteWorkflow() is deprecated. Use state.workflow.delete() instead.');
    return this.workflow.delete(workflowId);
  }

  /** @deprecated Use state.workflow.pause() instead. Will be removed in v2.0 */
  public pauseWorkflow(workflowId: string): WorkflowState {
    console.warn('DEPRECATED: StateManager.pauseWorkflow() is deprecated. Use state.workflow.pause() instead.');
    return this.workflow.pause(workflowId);
  }

  /** @deprecated Use state.workflow.resume() instead. Will be removed in v2.0 */
  public resumeWorkflow(workflowId: string): WorkflowState {
    console.warn('DEPRECATED: StateManager.resumeWorkflow() is deprecated. Use state.workflow.resume() instead.');
    return this.workflow.resume(workflowId);
  }

  /** @deprecated Use state.workflow.recover() instead. Will be removed in v2.0 */
  public recoverWorkflow(workflowId: string, options?: RecoveryOptions): WorkflowState {
    console.warn('DEPRECATED: StateManager.recoverWorkflow() is deprecated. Use state.workflow.recover() instead.');
    return this.workflow.recover(workflowId, options);
  }

  /** @deprecated Use state.phase.update() instead. Will be removed in v2.0 */
  public updatePhase(
    workflowId: string,
    phase: FaberPhase,
    updates: Partial<PhaseState>,
    options?: StateUpdateOptions
  ): WorkflowState {
    console.warn('DEPRECATED: StateManager.updatePhase() is deprecated. Use state.phase.update() instead.');
    return this.phase.update(workflowId, phase, updates, options);
  }

  /** @deprecated Use state.phase.start() instead. Will be removed in v2.0 */
  public startPhase(workflowId: string, phase: FaberPhase): WorkflowState {
    console.warn('DEPRECATED: StateManager.startPhase() is deprecated. Use state.phase.start() instead.');
    return this.phase.start(workflowId, phase);
  }

  /** @deprecated Use state.phase.complete() instead. Will be removed in v2.0 */
  public completePhase(
    workflowId: string,
    phase: FaberPhase,
    outputs?: Record<string, unknown>
  ): WorkflowState {
    console.warn('DEPRECATED: StateManager.completePhase() is deprecated. Use state.phase.complete() instead.');
    return this.phase.complete(workflowId, phase, outputs);
  }

  /** @deprecated Use state.phase.fail() instead. Will be removed in v2.0 */
  public failPhase(workflowId: string, phase: FaberPhase, error: string): WorkflowState {
    console.warn('DEPRECATED: StateManager.failPhase() is deprecated. Use state.phase.fail() instead.');
    return this.phase.fail(workflowId, phase, error);
  }

  /** @deprecated Use state.phase.skip() instead. Will be removed in v2.0 */
  public skipPhase(workflowId: string, phase: FaberPhase, reason?: string): WorkflowState {
    console.warn('DEPRECATED: StateManager.skipPhase() is deprecated. Use state.phase.skip() instead.');
    return this.phase.skip(workflowId, phase, reason);
  }

  /** @deprecated Use state.checkpoint.create() instead. Will be removed in v2.0 */
  public createCheckpoint(
    workflowId: string,
    phase: string,
    step: string,
    data: Record<string, unknown>
  ): Checkpoint {
    console.warn('DEPRECATED: StateManager.createCheckpoint() is deprecated. Use state.checkpoint.create() instead.');
    return this.checkpoint.create(workflowId, phase, step, data);
  }

  /** @deprecated Use state.checkpoint.get() instead. Will be removed in v2.0 */
  public getCheckpoint(checkpointId: string): Checkpoint | null {
    console.warn('DEPRECATED: StateManager.getCheckpoint() is deprecated. Use state.checkpoint.get() instead.');
    return this.checkpoint.get(checkpointId);
  }

  /** @deprecated Use state.checkpoint.list() instead. Will be removed in v2.0 */
  public listCheckpoints(workflowId: string): Checkpoint[] {
    console.warn('DEPRECATED: StateManager.listCheckpoints() is deprecated. Use state.checkpoint.list() instead.');
    return this.checkpoint.list(workflowId);
  }

  /** @deprecated Use state.checkpoint.getLatest() instead. Will be removed in v2.0 */
  public getLatestCheckpoint(workflowId: string): Checkpoint | null {
    console.warn('DEPRECATED: StateManager.getLatestCheckpoint() is deprecated. Use state.checkpoint.getLatest() instead.');
    return this.checkpoint.getLatest(workflowId);
  }

  /** @deprecated Use state.manifest.create() instead. Will be removed in v2.0 */
  public createManifest(workflowId: string, workId: string): RunManifest {
    console.warn('DEPRECATED: StateManager.createManifest() is deprecated. Use state.manifest.create() instead.');
    return this.manifest.create(workflowId, workId);
  }

  /** @deprecated Use state.manifest.save() instead. Will be removed in v2.0 */
  public saveManifest(manifest: RunManifest): void {
    console.warn('DEPRECATED: StateManager.saveManifest() is deprecated. Use state.manifest.save() instead.');
    return this.manifest.save(manifest);
  }

  /** @deprecated Use state.manifest.get() instead. Will be removed in v2.0 */
  public getManifest(manifestId: string): RunManifest | null {
    console.warn('DEPRECATED: StateManager.getManifest() is deprecated. Use state.manifest.get() instead.');
    return this.manifest.get(manifestId);
  }

  /** @deprecated Use state.manifest.addPhase() instead. Will be removed in v2.0 */
  public addPhaseToManifest(manifestId: string, phaseManifest: PhaseManifest): void {
    console.warn('DEPRECATED: StateManager.addPhaseToManifest() is deprecated. Use state.manifest.addPhase() instead.');
    return this.manifest.addPhase(manifestId, phaseManifest);
  }

  /** @deprecated Use state.manifest.addArtifact() instead. Will be removed in v2.0 */
  public addArtifactToManifest(manifestId: string, artifact: ArtifactManifest): void {
    console.warn('DEPRECATED: StateManager.addArtifactToManifest() is deprecated. Use state.manifest.addArtifact() instead.');
    return this.manifest.addArtifact(manifestId, artifact);
  }

  /** @deprecated Use state.manifest.complete() instead. Will be removed in v2.0 */
  public completeManifest(manifestId: string, status: 'completed' | 'failed'): RunManifest {
    console.warn('DEPRECATED: StateManager.completeManifest() is deprecated. Use state.manifest.complete() instead.');
    return this.manifest.complete(manifestId, status);
  }
}
