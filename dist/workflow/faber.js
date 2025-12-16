"use strict";
/**
 * @fractary/faber - FABER Workflow Engine
 *
 * Orchestrates the Frame → Architect → Build → Evaluate → Release workflow.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.FaberWorkflow = void 0;
const child_process_1 = require("child_process");
const work_1 = require("../work");
const repo_1 = require("../repo");
const spec_1 = require("../spec");
const logs_1 = require("../logs");
const state_1 = require("../state");
const errors_1 = require("../errors");
const agent_executor_1 = require("./agent-executor");
/**
 * Default workflow configuration
 */
const defaultConfig = {
    autonomy: 'assisted',
    phases: {
        frame: { enabled: true },
        architect: { enabled: true, refineSpec: true },
        build: { enabled: true },
        evaluate: { enabled: true, maxRetries: 3 },
        release: { enabled: true, requestReviews: true, reviewers: [] },
    },
    // NEW: Enable Forge by default (v1.x: false for backward compatibility, v2.0: true)
    forge: {
        enabled: false, // TODO: Change to true in v2.0
        prefer_local: true,
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
class FaberWorkflow {
    workManager;
    repoManager;
    specManager;
    logManager;
    stateManager;
    agentExecutor;
    config;
    userInput = null;
    listeners = [];
    artifacts = [];
    constructor(options) {
        this.workManager = new work_1.WorkManager();
        this.repoManager = new repo_1.RepoManager();
        this.specManager = new spec_1.SpecManager();
        this.logManager = new logs_1.LogManager();
        this.stateManager = new state_1.StateManager();
        this.config = { ...defaultConfig, ...options?.config };
        if (options?.config?.phases) {
            this.config.phases = { ...defaultConfig.phases, ...options.config.phases };
        }
        if (options?.config?.forge) {
            this.config.forge = { ...defaultConfig.forge, ...options.config.forge };
        }
        // Initialize AgentExecutor
        this.agentExecutor = new agent_executor_1.AgentExecutor({
            forge: this.config.forge,
        });
    }
    /**
     * Set user input callback for interactive mode
     */
    setUserInputCallback(callback) {
        this.userInput = callback;
    }
    /**
     * Add event listener
     */
    addEventListener(listener) {
        this.listeners.push(listener);
    }
    /**
     * Remove event listener
     */
    removeEventListener(listener) {
        const index = this.listeners.indexOf(listener);
        if (index !== -1) {
            this.listeners.splice(index, 1);
        }
    }
    /**
     * Emit event to listeners
     */
    emit(event, data) {
        for (const listener of this.listeners) {
            try {
                listener(event, data);
            }
            catch {
                // Ignore listener errors
            }
        }
    }
    /**
     * Record an artifact
     */
    recordArtifact(type, path) {
        const artifact = {
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
    async run(options) {
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
        let state = this.stateManager.getActiveWorkflow(workId);
        if (!state) {
            state = this.stateManager.createWorkflow(workId);
        }
        const workflowId = state.workflow_id;
        this.emit('workflow:start', { workflowId, workId, autonomy });
        // Create run manifest
        const manifest = this.stateManager.createManifest(workflowId, workId);
        // Build phase context
        let context = {
            workflowId,
            workId,
            phase: '',
            autonomy,
            issue: null,
            spec: null,
            branch: null,
            previousOutputs: {},
        };
        const phaseResults = [];
        const phases = ['frame', 'architect', 'build', 'evaluate', 'release'];
        try {
            // Fetch issue for context
            try {
                context.issue = await this.workManager.fetchIssue(workId);
            }
            catch {
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
                    this.stateManager.skipPhase(workflowId, phase, 'disabled');
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
                this.stateManager.startPhase(workflowId, phase);
                // Execute pre-hook if defined
                await this.runHook(`pre_${phase}`);
                // Run phase handler
                const result = await this.runPhase(phase, context);
                // Execute post-hook if defined
                await this.runHook(`post_${phase}`);
                const phaseDuration = Date.now() - phaseStartTime;
                if (result.status === 'completed') {
                    this.stateManager.completePhase(workflowId, phase, result.outputs);
                    context.previousOutputs[phase] = result.outputs || {};
                    this.emit('phase:complete', { workflowId, phase, outputs: result.outputs });
                }
                else if (result.status === 'failed') {
                    this.stateManager.failPhase(workflowId, phase, result.error || 'Unknown error');
                    this.emit('phase:fail', { workflowId, phase, error: result.error });
                }
                else if (result.status === 'skipped') {
                    this.stateManager.skipPhase(workflowId, phase);
                    this.emit('phase:skip', { workflowId, phase });
                }
                phaseResults.push({
                    phase,
                    status: result.status,
                    duration_ms: phaseDuration,
                    outputs: result.outputs,
                    error: result.error,
                });
                // Add phase to manifest
                this.stateManager.addPhaseToManifest(manifest.manifest_id, {
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
                    this.stateManager.pauseWorkflow(workflowId);
                    this.emit('workflow:pause', { workflowId, phase, message: result.message });
                    break;
                }
                // Update state for next iteration
                state = this.stateManager.getWorkflow(workflowId);
            }
            // Determine final status
            const failedPhases = phaseResults.filter(p => p.status === 'failed');
            const finalStatus = failedPhases.length > 0 ? 'failed' :
                phaseResults.every(p => p.status === 'completed' || p.status === 'skipped') ? 'completed' : 'paused';
            // Complete manifest
            this.stateManager.completeManifest(manifest.manifest_id, finalStatus === 'failed' ? 'failed' : 'completed');
            // Add artifacts to manifest
            for (const artifact of this.artifacts) {
                this.stateManager.addArtifactToManifest(manifest.manifest_id, artifact);
            }
            const duration = Date.now() - startTime;
            const result = {
                workflow_id: workflowId,
                work_id: workId,
                status: finalStatus,
                phases: phaseResults,
                duration_ms: duration,
                artifacts: this.artifacts,
            };
            if (finalStatus === 'completed') {
                this.emit('workflow:complete', result);
            }
            else if (finalStatus === 'failed') {
                this.emit('workflow:fail', result);
            }
            return result;
        }
        catch (error) {
            const duration = Date.now() - startTime;
            this.emit('workflow:fail', { workflowId, error });
            this.stateManager.completeManifest(manifest.manifest_id, 'failed');
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
    async runPhase(phase, context) {
        // Check if Forge mode is enabled
        if (this.agentExecutor.isForgeEnabled()) {
            return this.runPhaseWithForge(phase, context);
        }
        // Legacy mode - use hardcoded logic
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
     * Run phase using Forge agent
     */
    async runPhaseWithForge(phase, context) {
        // Get custom agent name if specified in phase config
        const phaseConfig = this.config.phases[phase];
        const customAgent = phaseConfig?.agent;
        // Build task description based on phase
        const task = this.buildPhaseTask(phase, context);
        try {
            const result = await this.agentExecutor.executePhaseAgent(customAgent || phase, // Use custom agent or phase name
            task, context);
            // Convert Forge result to FABER result
            return {
                status: 'completed',
                outputs: {
                    agentOutput: result.output,
                    structured: result.structured_output,
                    usage: result.usage,
                    ...this.extractPhaseOutputs(phase, result),
                },
            };
        }
        catch (error) {
            return {
                status: 'failed',
                error: error instanceof Error ? error.message : 'Agent execution failed',
            };
        }
    }
    /**
     * Build task description for phase agent
     */
    buildPhaseTask(phase, context) {
        switch (phase) {
            case 'frame':
                return `Analyze and frame the requirements for work item ${context.workId}. ` +
                    `Issue: ${JSON.stringify(context.issue)}`;
            case 'architect':
                return `Create or refine the specification for work item ${context.workId}. ` +
                    `Previous frame output: ${JSON.stringify(context.previousOutputs.frame)}`;
            case 'build':
                return `Implement the solution for work item ${context.workId}. ` +
                    `Spec: ${JSON.stringify(context.previousOutputs.architect)}`;
            case 'evaluate':
                return `Validate the implementation against requirements for ${context.workId}. ` +
                    `Build output: ${JSON.stringify(context.previousOutputs.build)}`;
            case 'release':
                return `Prepare release artifacts for work item ${context.workId}. ` +
                    `Evaluation: ${JSON.stringify(context.previousOutputs.evaluate)}`;
            default:
                return `Execute ${phase} phase for work item ${context.workId}`;
        }
    }
    /**
     * Extract phase-specific outputs from agent result
     */
    extractPhaseOutputs(_phase, result) {
        // Parse structured output or extract from text
        if (result.structured_output) {
            return result.structured_output;
        }
        // Default extraction based on phase
        // For now, return empty object - agents will provide structured output
        return {};
    }
    /**
     * Frame Phase: Gather requirements from issue + conversation
     */
    async runFramePhase(context) {
        const outputs = {};
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
     */
    async runArchitectPhase(context) {
        const outputs = {};
        // Check for existing spec
        let spec = context.spec;
        const existingSpecs = this.specManager.listSpecs({ workId: context.workId });
        if (existingSpecs.length > 0) {
            spec = existingSpecs[0];
        }
        // Create spec if none exists
        if (!spec && context.issue) {
            const workType = context.previousOutputs.frame?.workType || 'feature';
            const template = workType === 'bug' ? 'bug' : workType === 'chore' ? 'basic' : 'feature';
            spec = this.specManager.createSpec(context.issue.title, {
                workId: context.workId,
                template,
                context: context.issue.body,
            });
            this.recordArtifact('spec', spec.path);
            outputs.specCreated = true;
        }
        if (spec) {
            outputs.specId = spec.id;
            outputs.specPath = spec.path;
            // Refine spec if enabled
            if (this.config.phases.architect.refineSpec) {
                const questions = this.specManager.generateRefinementQuestions(spec.id);
                if (questions.length > 0 && context.autonomy !== 'autonomous') {
                    outputs.refinementQuestions = questions;
                    // In assisted mode, pause for refinement
                    if (context.autonomy === 'assisted') {
                        return {
                            status: 'needs_input',
                            message: 'Specification needs refinement. Review generated questions.',
                            outputs,
                        };
                    }
                }
            }
            // Validate spec
            const validation = this.specManager.validateSpec(spec.id);
            outputs.validation = validation;
        }
        return { status: 'completed', outputs };
    }
    /**
     * Build Phase: Implement the solution
     */
    async runBuildPhase(context) {
        const outputs = {};
        // Create branch
        const workType = context.previousOutputs.frame?.workType || 'feature';
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
     */
    async runEvaluatePhase(context) {
        const outputs = {};
        // Get the spec to validate against
        const specId = context.previousOutputs.architect?.specId;
        if (!specId) {
            return { status: 'skipped', outputs: { reason: 'No spec to validate against' } };
        }
        // Validate spec
        const validation = this.specManager.validateSpec(specId);
        outputs.validation = validation;
        // Check if validation passed
        if (validation.status === 'fail') {
            const attempts = context.previousOutputs.evaluate?.attempts || 0;
            const maxRetries = this.config.phases.evaluate.maxRetries;
            if (attempts < maxRetries) {
                outputs.attempts = attempts + 1;
                return {
                    status: 'needs_input',
                    message: `Validation failed, retry ${attempts + 1}/${maxRetries}`,
                    outputs,
                    error: `Validation failed: ${validation.suggestions?.join(', ')}`,
                };
            }
            return {
                status: 'failed',
                outputs,
                error: `Validation failed after ${maxRetries} attempts`,
            };
        }
        // Stop session capture
        this.logManager.stopCapture();
        return { status: 'completed', outputs };
    }
    /**
     * Release Phase: Create PR and request reviews
     */
    async runReleasePhase(context) {
        const outputs = {};
        const branch = context.previousOutputs.build?.branch;
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
            await this.workManager.createComment(context.issue.number, `Created PR: ${pr.url}`);
        }
        return { status: 'completed', outputs };
    }
    /**
     * Generate PR body from context
     */
    generatePRBody(context) {
        const lines = [];
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
            lines.push(`See [spec](${specPath})`);
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
    async confirmAction(request) {
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
    async runHook(hookName) {
        const hookCommand = this.config.hooks?.[hookName];
        if (!hookCommand)
            return;
        try {
            (0, child_process_1.execSync)(hookCommand, {
                encoding: 'utf-8',
                stdio: 'inherit',
            });
        }
        catch (error) {
            throw new errors_1.WorkflowError(`Hook ${hookName} failed: ${error}`);
        }
    }
    /**
     * Resume a paused workflow
     */
    async resume(workflowId) {
        const state = this.stateManager.getWorkflow(workflowId);
        if (!state) {
            throw new errors_1.WorkflowError(`Workflow not found: ${workflowId}`);
        }
        this.stateManager.resumeWorkflow(workflowId);
        return this.run({
            workId: state.work_id,
            autonomy: this.config.autonomy,
        });
    }
    /**
     * Pause the current workflow
     */
    pause(workflowId) {
        this.stateManager.pauseWorkflow(workflowId);
    }
    /**
     * Get workflow status
     */
    getStatus(workflowId) {
        const state = this.stateManager.getWorkflow(workflowId);
        if (!state) {
            return { state: null, currentPhase: '', progress: 0 };
        }
        const phases = ['frame', 'architect', 'build', 'evaluate', 'release'];
        const completedCount = phases.filter(p => state.phase_states[p].status === 'completed' || state.phase_states[p].status === 'skipped').length;
        return {
            state: state,
            currentPhase: state.current_phase,
            progress: Math.round((completedCount / phases.length) * 100),
        };
    }
}
exports.FaberWorkflow = FaberWorkflow;
//# sourceMappingURL=faber.js.map