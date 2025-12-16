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
  // Workflow State Operations
  // =========================================================================

  /**
   * Create a new workflow state
   */
  createWorkflow(workId: string): WorkflowState {
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

    this.saveWorkflow(state);
    return state;
  }

  /**
   * Save workflow state
   */
  saveWorkflow(state: WorkflowState): void {
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
  getWorkflow(workflowId: string): WorkflowState | null {
    const filePath = this.getStatePath('workflows', workflowId);
    if (!fs.existsSync(filePath)) {
      return null;
    }
    return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  }

  /**
   * Get active workflow for a work item
   */
  getActiveWorkflow(workId: string): WorkflowState | null {
    const activeFile = this.getStatePath('active', workId);
    if (!fs.existsSync(activeFile)) {
      return null;
    }

    const active = JSON.parse(fs.readFileSync(activeFile, 'utf-8'));
    return this.getWorkflow(active.workflow_id);
  }

  /**
   * List all workflows
   */
  listWorkflows(options?: StateQueryOptions): WorkflowState[] {
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
  updatePhase(
    workflowId: string,
    phase: FaberPhase,
    updates: Partial<PhaseState>,
    options?: StateUpdateOptions
  ): WorkflowState {
    const state = this.getWorkflow(workflowId);
    if (!state) {
      throw new StateError(`Workflow not found: ${workflowId}`);
    }

    // Create checkpoint if requested
    if (options?.createCheckpoint) {
      this.createCheckpoint(workflowId, phase, 'phase_update', { updates });
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

    this.saveWorkflow(state);
    return state;
  }

  /**
   * Start a phase
   */
  startPhase(workflowId: string, phase: FaberPhase): WorkflowState {
    return this.updatePhase(workflowId, phase, {
      status: 'in_progress',
      started_at: new Date().toISOString(),
      attempts: (this.getWorkflow(workflowId)?.phase_states[phase].attempts || 0) + 1,
    });
  }

  /**
   * Complete a phase
   */
  completePhase(
    workflowId: string,
    phase: FaberPhase,
    outputs?: Record<string, unknown>
  ): WorkflowState {
    return this.updatePhase(workflowId, phase, {
      status: 'completed',
      completed_at: new Date().toISOString(),
      outputs,
    });
  }

  /**
   * Fail a phase
   */
  failPhase(workflowId: string, phase: FaberPhase, error: string): WorkflowState {
    return this.updatePhase(workflowId, phase, {
      status: 'failed',
      error,
    });
  }

  /**
   * Skip a phase
   */
  skipPhase(workflowId: string, phase: FaberPhase, reason?: string): WorkflowState {
    return this.updatePhase(workflowId, phase, {
      status: 'skipped',
      error: reason,
    });
  }

  /**
   * Pause workflow
   */
  pauseWorkflow(workflowId: string): WorkflowState {
    const state = this.getWorkflow(workflowId);
    if (!state) {
      throw new StateError(`Workflow not found: ${workflowId}`);
    }

    state.status = 'paused';
    this.saveWorkflow(state);

    // Create checkpoint for recovery
    this.createCheckpoint(workflowId, state.current_phase, 'pause', {});

    return state;
  }

  /**
   * Resume workflow
   */
  resumeWorkflow(workflowId: string): WorkflowState {
    const state = this.getWorkflow(workflowId);
    if (!state) {
      throw new StateError(`Workflow not found: ${workflowId}`);
    }

    if (state.status !== 'paused') {
      throw new StateError(`Workflow is not paused: ${workflowId}`);
    }

    state.status = 'running';
    this.saveWorkflow(state);

    return state;
  }

  // =========================================================================
  // Checkpoint Operations
  // =========================================================================

  /**
   * Create a checkpoint
   */
  createCheckpoint(
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
  getCheckpoint(checkpointId: string): Checkpoint | null {
    const filePath = this.getStatePath('checkpoints', checkpointId);
    if (!fs.existsSync(filePath)) {
      return null;
    }
    return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  }

  /**
   * List checkpoints for a workflow
   */
  listCheckpoints(workflowId: string): Checkpoint[] {
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
  getLatestCheckpoint(workflowId: string): Checkpoint | null {
    const checkpoints = this.listCheckpoints(workflowId);
    return checkpoints.length > 0 ? checkpoints[checkpoints.length - 1] : null;
  }

  // =========================================================================
  // Run Manifest Operations
  // =========================================================================

  /**
   * Create a run manifest
   */
  createManifest(workflowId: string, workId: string): RunManifest {
    const manifest: RunManifest = {
      manifest_id: generateManifestId(),
      workflow_id: workflowId,
      work_id: workId,
      created_at: new Date().toISOString(),
      status: 'running',
      phases: [],
      artifacts: [],
    };

    this.saveManifest(manifest);
    return manifest;
  }

  /**
   * Save run manifest
   */
  saveManifest(manifest: RunManifest): void {
    const filePath = this.getStatePath('manifests', manifest.manifest_id);
    fs.writeFileSync(filePath, JSON.stringify(manifest, null, 2), 'utf-8');
  }

  /**
   * Get run manifest
   */
  getManifest(manifestId: string): RunManifest | null {
    const filePath = this.getStatePath('manifests', manifestId);
    if (!fs.existsSync(filePath)) {
      return null;
    }
    return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  }

  /**
   * Add phase to manifest
   */
  addPhaseToManifest(manifestId: string, phaseManifest: PhaseManifest): void {
    const manifest = this.getManifest(manifestId);
    if (!manifest) {
      throw new StateError(`Manifest not found: ${manifestId}`);
    }

    manifest.phases.push(phaseManifest);
    this.saveManifest(manifest);
  }

  /**
   * Add artifact to manifest
   */
  addArtifactToManifest(manifestId: string, artifact: ArtifactManifest): void {
    const manifest = this.getManifest(manifestId);
    if (!manifest) {
      throw new StateError(`Manifest not found: ${manifestId}`);
    }

    manifest.artifacts.push(artifact);
    this.saveManifest(manifest);
  }

  /**
   * Complete manifest
   */
  completeManifest(manifestId: string, status: 'completed' | 'failed'): RunManifest {
    const manifest = this.getManifest(manifestId);
    if (!manifest) {
      throw new StateError(`Manifest not found: ${manifestId}`);
    }

    manifest.completed_at = new Date().toISOString();
    manifest.status = status;
    this.saveManifest(manifest);

    return manifest;
  }

  // =========================================================================
  // Recovery Operations
  // =========================================================================

  /**
   * Recover a workflow from a checkpoint or phase
   */
  recoverWorkflow(workflowId: string, options?: RecoveryOptions): WorkflowState {
    const state = this.getWorkflow(workflowId);
    if (!state) {
      throw new StateError(`Workflow not found: ${workflowId}`);
    }

    // If recovering from a specific checkpoint
    if (options?.checkpointId) {
      const checkpoint = this.getCheckpoint(options.checkpointId);
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
    this.saveWorkflow(state);

    return state;
  }

  // =========================================================================
  // Cleanup Operations
  // =========================================================================

  /**
   * Delete workflow state
   */
  deleteWorkflow(workflowId: string): boolean {
    const workflowPath = this.getStatePath('workflows', workflowId);
    if (!fs.existsSync(workflowPath)) {
      return false;
    }

    // Get the work_id to clean up active state
    const state = this.getWorkflow(workflowId);
    if (state) {
      const activePath = this.getStatePath('active', state.work_id);
      if (fs.existsSync(activePath)) {
        fs.unlinkSync(activePath);
      }
    }

    fs.unlinkSync(workflowPath);
    return true;
  }

  /**
   * Clean up old workflows and checkpoints
   */
  cleanup(maxAgeDays: number = 30): { deleted: number; errors: string[] } {
    const result = { deleted: 0, errors: [] as string[] };
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - maxAgeDays);

    // Clean up completed/failed workflows
    const workflows = this.listWorkflows();
    for (const workflow of workflows) {
      if (
        (workflow.status === 'completed' || workflow.status === 'failed') &&
        new Date(workflow.updated_at) < cutoffDate
      ) {
        try {
          this.deleteWorkflow(workflow.workflow_id);
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
  getStateDir(): string {
    return this.stateDir;
  }
}
