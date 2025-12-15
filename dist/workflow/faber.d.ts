/**
 * @fractary/faber - FABER Workflow Engine
 *
 * Orchestrates the Frame → Architect → Build → Evaluate → Release workflow.
 */
import { WorkflowConfig, WorkflowOptions, WorkflowResult, UserInputCallback, EventListener } from './types';
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
export declare class FaberWorkflow {
    private workManager;
    private repoManager;
    private specManager;
    private logManager;
    private stateManager;
    private agentExecutor;
    private config;
    private userInput;
    private listeners;
    private artifacts;
    constructor(options?: {
        config?: Partial<WorkflowConfig>;
    });
    /**
     * Set user input callback for interactive mode
     */
    setUserInputCallback(callback: UserInputCallback): void;
    /**
     * Add event listener
     */
    addEventListener(listener: EventListener): void;
    /**
     * Remove event listener
     */
    removeEventListener(listener: EventListener): void;
    /**
     * Emit event to listeners
     */
    private emit;
    /**
     * Record an artifact
     */
    private recordArtifact;
    /**
     * Run the complete FABER workflow
     */
    run(options: WorkflowOptions): Promise<WorkflowResult>;
    /**
     * Run a specific phase
     */
    private runPhase;
    /**
     * Run phase using Forge agent
     */
    private runPhaseWithForge;
    /**
     * Build task description for phase agent
     */
    private buildPhaseTask;
    /**
     * Extract phase-specific outputs from agent result
     */
    private extractPhaseOutputs;
    /**
     * Frame Phase: Gather requirements from issue + conversation
     */
    private runFramePhase;
    /**
     * Architect Phase: Create/refine specification
     */
    private runArchitectPhase;
    /**
     * Build Phase: Implement the solution
     */
    private runBuildPhase;
    /**
     * Evaluate Phase: Validate against requirements
     */
    private runEvaluatePhase;
    /**
     * Release Phase: Create PR and request reviews
     */
    private runReleasePhase;
    /**
     * Generate PR body from context
     */
    private generatePRBody;
    /**
     * Confirm an action with the user
     */
    private confirmAction;
    /**
     * Run a workflow hook
     */
    private runHook;
    /**
     * Resume a paused workflow
     */
    resume(workflowId: string): Promise<WorkflowResult>;
    /**
     * Pause the current workflow
     */
    pause(workflowId: string): void;
    /**
     * Get workflow status
     */
    getStatus(workflowId: string): {
        state: Record<string, unknown> | null;
        currentPhase: string;
        progress: number;
    };
}
//# sourceMappingURL=faber.d.ts.map