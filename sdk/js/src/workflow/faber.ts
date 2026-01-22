/**
 * @fractary/faber - FABER Workflow Engine
 *
 * Orchestrates the Frame → Architect → Build → Evaluate → Release workflow.
 */

import { execSync } from 'child_process';
import {
  WorkflowConfig,
  WorkflowOptions,
  WorkflowResult,
  PhaseResult,
  FaberPhase,
  PhaseContext,
  PhaseHandlerResult,
  UserInputCallback,
  WorkflowEvent,
  EventListener,
  ArtifactManifest,
} from './types.js';
import { WorkManager } from '../work/index.js';
import { RepoManager } from '../repo/index.js';
import { LogManager } from '../logs/index.js';
import { StateManager } from '../state/index.js';
import { WorkflowError } from '../errors.js';

/**
 * Default workflow configuration
 */
const defaultConfig: WorkflowConfig = {
  autonomy: 'assisted',
  phases: {
    frame: { enabled: true },
    architect: { enabled: true, refineSpec: true },
    build: { enabled: true },
    evaluate: { enabled: true, maxRetries: 3 },
    release: { enabled: true, requestReviews: true, reviewers: [] },
  },
};

/**
 * FABER Workflow Engine
 *
 * Coordinates the development workflow phases:
 * - Frame: Gather requirements from issue + conversation
 * - Architect: Create/refine specification
 * - Build: Implement the solution
 * - Evaluate: Validate against requirements
 * - Release: Create PR and request reviews
 */
export class FaberWorkflow {
  private workManager: WorkManager;
  private repoManager: RepoManager;
  private logManager: LogManager;
  private stateManager: StateManager;

  private config: WorkflowConfig;
  private userInput: UserInputCallback | null = null;
  private listeners: EventListener[] = [];
  private artifacts: ArtifactManifest[] = [];

  constructor(options?: { config?: Partial<WorkflowConfig> }) {
    this.workManager = new WorkManager();
    this.repoManager = new RepoManager();
    this.logManager = new LogManager();
    this.stateManager = new StateManager();

    this.config = { ...defaultConfig, ...options?.config };
    if (options?.config?.phases) {
      this.config.phases = { ...defaultConfig.phases, ...options.config.phases };
    }
  }

  /**
   * Set user input callback for interactive mode
   */
  setUserInputCallback(callback: UserInputCallback): void {
    this.userInput = callback;
  }

  /**
   * Add event listener
   */
  addEventListener(listener: EventListener): void {
    this.listeners.push(listener);
  }

  /**
   * Remove event listener
   */
  removeEventListener(listener: EventListener): void {
    const index = this.listeners.indexOf(listener);
    if (index !== -1) {
      this.listeners.splice(index, 1);
    }
  }

  /**
   * Emit event to listeners
   */
  private emit(event: WorkflowEvent, data: unknown): void {
    for (const listener of this.listeners) {
      try {
        listener(event, data as Record<string, unknown>);
      } catch {
        // Ignore listener errors
      }
    }
  }

  /**
   * Record an artifact
   */
  private recordArtifact(type: ArtifactManifest['type'], path: string): void {
    const artifact: ArtifactManifest = {
      type,
      path,
      created_at: new Date().toISOString(),
    };
    this.artifacts.push(artifact);
    this.emit('artifact:create', artifact);
  }

  /**
   * Run the complete FABER workflow
   */
  async run(options: WorkflowOptions): Promise<WorkflowResult> {
    const startTime = Date.now();
    const workId = String(options.workId);
    const autonomy = options.autonomy || this.config.autonomy;

    // Merge config overrides
    if (options.config) {
      this.config = { ...this.config, ...options.config };
    }

    // Reset artifacts for this run
    this.artifacts = [];

    // Create or resume workflow state
    let state = this.stateManager.workflow.getActive(workId);
    if (!state) {
      state = this.stateManager.workflow.create(workId);
    }

    const workflowId = state.workflow_id;

    this.emit('workflow:start', { workflowId, workId, autonomy });

    // Create run manifest
    const manifest = this.stateManager.manifest.create(workflowId, workId);

    // Build phase context
    const context: PhaseContext = {
      workflowId,
      workId,
      phase: '',
      autonomy,
      issue: null,
      spec: null,
      branch: null,
      previousOutputs: {},
    };

    const phaseResults: PhaseResult[] = [];
    const phases: FaberPhase[] = ['frame', 'architect', 'build', 'evaluate', 'release'];

    try {
      // Fetch issue for context
      try {
        context.issue = await this.workManager.fetchIssue(workId);
      } catch {
        // Issue fetch failed, will need to proceed with conversation context only
      }

      // Run each phase
      for (const phase of phases) {
        // Skip if phase is disabled
        if (!this.config.phases[phase]?.enabled) {
          phaseResults.push({
            phase,
            status: 'skipped',
            duration_ms: 0,
          });
          this.stateManager.phase.skip(workflowId, phase, 'disabled');
          continue;
        }

        // Skip if already completed
        if (state.phase_states[phase].status === 'completed') {
          phaseResults.push({
            phase,
            status: 'completed',
            duration_ms: 0,
            outputs: state.phase_states[phase].outputs,
          });
          continue;
        }

        // Run phase
        context.phase = phase;
        const phaseStartTime = Date.now();

        this.emit('phase:start', { workflowId, phase });
        this.stateManager.phase.start(workflowId, phase);

        // Execute pre-hook if defined
        await this.runHook(`pre_${phase}` as keyof typeof this.config.hooks);

        // Run phase handler
        const result = await this.runPhase(phase, context);

        // Execute post-hook if defined
        await this.runHook(`post_${phase}` as keyof typeof this.config.hooks);

        const phaseDuration = Date.now() - phaseStartTime;

        if (result.status === 'completed') {
          this.stateManager.phase.complete(workflowId, phase, result.outputs);
          context.previousOutputs[phase] = result.outputs || {};
          this.emit('phase:complete', { workflowId, phase, outputs: result.outputs });
        } else if (result.status === 'failed') {
          this.stateManager.phase.fail(workflowId, phase, result.error || 'Unknown error');
          this.emit('phase:fail', { workflowId, phase, error: result.error });
        } else if (result.status === 'skipped') {
          this.stateManager.phase.skip(workflowId, phase);
          this.emit('phase:skip', { workflowId, phase });
        }

        phaseResults.push({
          phase,
          status: result.status as PhaseResult['status'],
          duration_ms: phaseDuration,
          outputs: result.outputs,
          error: result.error,
        });

        // Add phase to manifest
        this.stateManager.manifest.addPhase(manifest.manifest_id, {
          phase,
          status: result.status,
          duration_ms: phaseDuration,
          steps: [],
        });

        // Stop on failure unless in autonomous mode with retries
        if (result.status === 'failed' && autonomy !== 'autonomous') {
          break;
        }

        // Handle needs_input status
        if (result.status === 'needs_input') {
          // Pause workflow for user input
          this.stateManager.workflow.pause(workflowId);
          this.emit('workflow:pause', { workflowId, phase, message: result.message });
          break;
        }

        // Update state for next iteration
        state = this.stateManager.workflow.get(workflowId)!;
      }

      // Determine final status
      const failedPhases = phaseResults.filter(p => p.status === 'failed');
      const finalStatus = failedPhases.length > 0 ? 'failed' :
                          phaseResults.every(p => p.status === 'completed' || p.status === 'skipped') ? 'completed' : 'paused';

      // Complete manifest
      this.stateManager.manifest.complete(manifest.manifest_id, finalStatus === 'failed' ? 'failed' : 'completed');

      // Add artifacts to manifest
      for (const artifact of this.artifacts) {
        this.stateManager.manifest.addArtifact(manifest.manifest_id, artifact);
      }

      const duration = Date.now() - startTime;

      const result: WorkflowResult = {
        workflow_id: workflowId,
        work_id: workId,
        status: finalStatus,
        phases: phaseResults,
        duration_ms: duration,
        artifacts: this.artifacts,
      };

      if (finalStatus === 'completed') {
        this.emit('workflow:complete', result);
      } else if (finalStatus === 'failed') {
        this.emit('workflow:fail', result);
      }

      return result;
    } catch (error) {
      const duration = Date.now() - startTime;

      this.emit('workflow:fail', { workflowId, error });
      this.stateManager.manifest.complete(manifest.manifest_id, 'failed');

      return {
        workflow_id: workflowId,
        work_id: workId,
        status: 'failed',
        phases: phaseResults,
        duration_ms: duration,
        artifacts: this.artifacts,
      };
    }
  }

  /**
   * Run a specific phase
   */
  private async runPhase(phase: FaberPhase, context: PhaseContext): Promise<PhaseHandlerResult> {
    switch (phase) {
      case 'frame':
        return this.runFramePhase(context);
      case 'architect':
        return this.runArchitectPhase(context);
      case 'build':
        return this.runBuildPhase(context);
      case 'evaluate':
        return this.runEvaluatePhase(context);
      case 'release':
        return this.runReleasePhase(context);
      default:
        return { status: 'skipped' };
    }
  }

  /**
   * Frame Phase: Gather requirements from issue + conversation
   */
  private async runFramePhase(context: PhaseContext): Promise<PhaseHandlerResult> {
    const outputs: Record<string, unknown> = {};

    // Gather requirements from issue
    if (context.issue) {
      outputs.issue = {
        number: context.issue.number,
        title: context.issue.title,
        body: context.issue.body,
        labels: context.issue.labels,
        state: context.issue.state,
      };

      // Classify work type
      const workType = await this.workManager.classifyWorkType(context.issue);
      outputs.workType = workType;
    }

    // Check if we have enough context
    if (!context.issue) {
      // In assisted mode, prompt for context
      if (context.autonomy === 'assisted' || context.autonomy === 'guarded') {
        return {
          status: 'needs_input',
          message: 'No issue found. Please provide work context or issue number.',
        };
      }

      // In dry-run mode, just record what would happen
      if (context.autonomy === 'dry-run') {
        return {
          status: 'completed',
          outputs: { dryRun: true, message: 'Would gather requirements from issue' },
        };
      }
    }

    return { status: 'completed', outputs };
  }

  /**
   * Architect Phase: Create/refine specification
   *
   * NOTE: This is a legacy no-op. Spec operations should be done via
   * Fractary Core (/fractary-spec:create). Modern FABER workflows use
   * agents (faber-planner, faber-manager) which call Fractary Core skills.
   */
  private async runArchitectPhase(_context: PhaseContext): Promise<PhaseHandlerResult> {
    // Legacy no-op - spec operations are handled by Fractary Core
    return {
      status: 'completed',
      outputs: {
        legacy: true,
        message: 'Spec operations should use Fractary Core (/fractary-spec:create)',
      },
    };
  }

  /**
   * Build Phase: Implement the solution
   */
  private async runBuildPhase(context: PhaseContext): Promise<PhaseHandlerResult> {
    const outputs: Record<string, unknown> = {};

    // Create branch
    const workType = context.previousOutputs.frame?.workType as string || 'feature';
    const issueTitle = context.issue?.title || `work-${context.workId}`;

    const branchName = this.repoManager.generateBranchName({
      type: workType === 'bug' ? 'fix' : 'feature',
      description: issueTitle,
      workId: context.workId,
    });

    // Check if branch exists
    const existingBranch = await this.repoManager.getBranch(branchName);
    if (!existingBranch) {
      // In dry-run mode, just report
      if (context.autonomy === 'dry-run') {
        return {
          status: 'completed',
          outputs: { dryRun: true, branchName, message: 'Would create branch' },
        };
      }

      // Confirm in assisted/guarded mode
      if (context.autonomy === 'assisted' || context.autonomy === 'guarded') {
        const confirmed = await this.confirmAction({
          phase: 'build',
          action: 'create_branch',
          message: `Create branch: ${branchName}?`,
        });

        if (!confirmed) {
          return { status: 'skipped', outputs: { reason: 'User declined branch creation' } };
        }
      }

      await this.repoManager.createBranch(branchName);
      this.recordArtifact('branch', branchName);
    }

    outputs.branch = branchName;

    // Start session capture for build
    this.logManager.startCapture({
      issueNumber: Number(context.workId),
    });

    outputs.sessionStarted = true;

    return { status: 'completed', outputs };
  }

  /**
   * Evaluate Phase: Validate against requirements
   *
   * NOTE: This is a legacy no-op. Spec validation should be done via
   * Fractary Core (/fractary-spec:validate). Modern FABER workflows use
   * agents (faber-planner, faber-manager) which call Fractary Core skills.
   */
  private async runEvaluatePhase(_context: PhaseContext): Promise<PhaseHandlerResult> {
    // Stop session capture
    this.logManager.stopCapture();

    // Legacy no-op - spec validation is handled by Fractary Core
    return {
      status: 'completed',
      outputs: {
        legacy: true,
        message: 'Spec validation should use Fractary Core (/fractary-spec:validate)',
      },
    };
  }

  /**
   * Release Phase: Create PR and request reviews
   */
  private async runReleasePhase(context: PhaseContext): Promise<PhaseHandlerResult> {
    const outputs: Record<string, unknown> = {};

    const branch = context.previousOutputs.build?.branch as string;
    if (!branch) {
      return { status: 'skipped', outputs: { reason: 'No branch to release' } };
    }

    // Push branch
    if (context.autonomy !== 'dry-run') {
      this.repoManager.push({ branch, setUpstream: true });
      outputs.pushed = true;
    }

    // Create PR
    const prTitle = context.issue?.title || `Work ${context.workId}`;
    const prBody = this.generatePRBody(context);

    if (context.autonomy === 'dry-run') {
      return {
        status: 'completed',
        outputs: {
          dryRun: true,
          prTitle,
          branch,
          message: 'Would create PR',
        },
      };
    }

    // Confirm in assisted/guarded mode
    if (context.autonomy === 'assisted' || context.autonomy === 'guarded') {
      const confirmed = await this.confirmAction({
        phase: 'release',
        action: 'create_pr',
        message: `Create PR: "${prTitle}"?`,
      });

      if (!confirmed) {
        return { status: 'skipped', outputs: { reason: 'User declined PR creation' } };
      }
    }

    const pr = await this.repoManager.createPR({
      title: prTitle,
      body: prBody,
      head: branch,
      workId: context.workId,
    });

    outputs.pr = {
      number: pr.number,
      url: pr.url,
    };
    this.recordArtifact('pr', pr.url);

    // Request reviews if enabled
    if (this.config.phases.release.requestReviews && this.config.phases.release.reviewers.length > 0) {
      await this.repoManager.requestReview(pr.number, this.config.phases.release.reviewers);
      outputs.reviewsRequested = this.config.phases.release.reviewers;
    }

    // Update issue with PR link
    if (context.issue) {
      await this.workManager.createComment(
        context.issue.number,
        `Created PR: ${pr.url}`
      );
    }

    return { status: 'completed', outputs };
  }

  /**
   * Generate PR body from context
   */
  private generatePRBody(context: PhaseContext): string {
    const lines: string[] = [];

    lines.push('## Summary');
    lines.push('');

    if (context.issue) {
      lines.push(`Closes #${context.issue.number}`);
      lines.push('');
      if (context.issue.body) {
        lines.push('### Issue Description');
        lines.push(context.issue.body.slice(0, 500));
        lines.push('');
      }
    }

    const specPath = context.previousOutputs.architect?.specPath;
    if (specPath) {
      lines.push(`### Specification`);
      lines.push(`See [spec](${String(specPath)})`);
      lines.push('');
    }

    lines.push('## Test Plan');
    lines.push('- [ ] Manual testing');
    lines.push('- [ ] Unit tests pass');
    lines.push('');

    lines.push('---');
    lines.push('*Generated by FABER workflow*');

    return lines.join('\n');
  }

  /**
   * Confirm an action with the user
   */
  private async confirmAction(request: {
    phase: string;
    action: string;
    message: string;
  }): Promise<boolean> {
    if (!this.userInput) {
      // No user input callback, default to true
      return true;
    }

    const result = await this.userInput(request);
    return typeof result === 'boolean' ? result : result === 'yes' || result === 'y';
  }

  /**
   * Run a workflow hook
   */
  private async runHook(hookName: keyof WorkflowConfig['hooks']): Promise<void> {
    const hookCommand = this.config.hooks?.[hookName];
    if (!hookCommand) return;

    try {
      execSync(hookCommand, {
        encoding: 'utf-8',
        stdio: 'inherit',
      });
    } catch (error) {
      throw new WorkflowError(`Hook ${hookName} failed: ${error}`);
    }
  }

  /**
   * Resume a paused workflow
   */
  async resume(workflowId: string): Promise<WorkflowResult> {
    const state = this.stateManager.workflow.get(workflowId);
    if (!state) {
      throw new WorkflowError(`Workflow not found: ${workflowId}`);
    }

    this.stateManager.workflow.resume(workflowId);

    return this.run({
      workId: state.work_id,
      autonomy: this.config.autonomy,
    });
  }

  /**
   * Pause the current workflow
   */
  pause(workflowId: string): void {
    this.stateManager.workflow.pause(workflowId);
  }

  /**
   * Status operations
   */
  public readonly status = {
    get: (workflowId: string): {
      state: Record<string, unknown> | null;
      currentPhase: string;
      progress: number;
    } => {
      const state = this.stateManager.workflow.get(workflowId);
      if (!state) {
        return { state: null, currentPhase: '', progress: 0 };
      }

      const phases: FaberPhase[] = ['frame', 'architect', 'build', 'evaluate', 'release'];
      const completedCount = phases.filter(
        p => state.phase_states[p].status === 'completed' || state.phase_states[p].status === 'skipped'
      ).length;

      return {
        state: state as unknown as Record<string, unknown>,
        currentPhase: state.current_phase,
        progress: Math.round((completedCount / phases.length) * 100),
      };
    }
  };

  /**
   * Get workflow status
   * @deprecated Use workflow.status.get() instead. Will be removed in v2.0
   */
  getStatus(workflowId: string): {
    state: Record<string, unknown> | null;
    currentPhase: string;
    progress: number;
  } {
    console.warn('DEPRECATED: FaberWorkflow.getStatus() is deprecated. Use workflow.status.get() instead.');
    return this.status.get(workflowId);
  }
}
