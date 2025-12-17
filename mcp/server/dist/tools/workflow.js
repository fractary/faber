/**
 * Workflow Orchestration Tools for FABER MCP Server
 *
 * Provides workflow control and management via MCP.
 */
import { FaberWorkflow } from '@fractary/faber/workflow';
import { StateManager } from '@fractary/faber/state';
/**
 * Create tool error response
 */
function createToolError(toolName, error) {
    return {
        content: [{
                type: 'text',
                text: JSON.stringify({ status: 'error', operation: toolName, error }, null, 2)
            }],
        isError: true,
    };
}
/**
 * Create workflow orchestration tools
 *
 * @returns Array of tool definitions
 */
export function createWorkflowTools() {
    return [
        // Tool 1: fractary_faber_workflow_run
        {
            name: 'fractary_faber_workflow_run',
            description: 'Run FABER workflow (Frame → Architect → Build → Evaluate → Release) for a work item',
            inputSchema: {
                type: 'object',
                required: ['work_id'],
                properties: {
                    work_id: {
                        type: 'string',
                        description: 'Work item ID to process (e.g., "123" for issue #123)',
                    },
                    autonomy: {
                        type: 'string',
                        enum: ['dry-run', 'assisted', 'guarded', 'autonomous'],
                        description: 'Autonomy level: dry-run (report only), assisted (prompt for actions), guarded (safety checks), autonomous (full auto)',
                        default: 'assisted',
                    },
                    config: {
                        type: 'object',
                        description: 'Optional workflow configuration overrides',
                        properties: {
                            phases: {
                                type: 'object',
                                description: 'Phase-specific configuration',
                            },
                            forge: {
                                type: 'object',
                                description: 'Forge integration settings',
                                properties: {
                                    enabled: { type: 'boolean' },
                                    prefer_local: { type: 'boolean' },
                                },
                            },
                        },
                    },
                },
            },
            handler: async (params) => {
                const { work_id, autonomy, config } = params;
                const workflow = new FaberWorkflow({ config: config });
                try {
                    const result = await workflow.run({
                        workId: work_id,
                        autonomy: (autonomy || 'assisted'),
                        config: config,
                    });
                    return {
                        content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
                    };
                }
                catch (error) {
                    return createToolError('workflow_run', error.message);
                }
            },
        },
        // Tool 2: fractary_faber_workflow_status
        {
            name: 'fractary_faber_workflow_status',
            description: 'Get workflow status and progress by workflow ID or work item ID',
            inputSchema: {
                type: 'object',
                properties: {
                    workflow_id: {
                        type: 'string',
                        description: 'Workflow ID to check (e.g., "WF-abc123")',
                    },
                    work_id: {
                        type: 'string',
                        description: 'Work item ID to find active workflow for',
                    },
                },
            },
            handler: async (params) => {
                const { workflow_id, work_id } = params;
                let workflowId = workflow_id;
                // If work_id provided, find active workflow
                if (!workflowId && work_id) {
                    const stateManager = new StateManager();
                    const state = stateManager.getActiveWorkflow(work_id);
                    if (state) {
                        workflowId = state.workflow_id;
                    }
                }
                if (!workflowId) {
                    return createToolError('workflow_status', 'No workflow_id or work_id provided');
                }
                const workflow = new FaberWorkflow();
                const status = workflow.getStatus(workflowId);
                return {
                    content: [{ type: 'text', text: JSON.stringify(status, null, 2) }],
                };
            },
        },
        // Tool 3: fractary_faber_workflow_resume
        {
            name: 'fractary_faber_workflow_resume',
            description: 'Resume a paused workflow from where it left off',
            inputSchema: {
                type: 'object',
                required: ['workflow_id'],
                properties: {
                    workflow_id: {
                        type: 'string',
                        description: 'Workflow ID to resume',
                    },
                },
            },
            handler: async (params) => {
                const { workflow_id } = params;
                const workflow = new FaberWorkflow();
                try {
                    const result = await workflow.resume(workflow_id);
                    return {
                        content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
                    };
                }
                catch (error) {
                    return createToolError('workflow_resume', error.message);
                }
            },
        },
        // Tool 4: fractary_faber_workflow_pause
        {
            name: 'fractary_faber_workflow_pause',
            description: 'Pause a running workflow (can be resumed later)',
            inputSchema: {
                type: 'object',
                required: ['workflow_id'],
                properties: {
                    workflow_id: {
                        type: 'string',
                        description: 'Workflow ID to pause',
                    },
                },
            },
            handler: async (params) => {
                const { workflow_id } = params;
                const workflow = new FaberWorkflow();
                try {
                    workflow.pause(workflow_id);
                    return {
                        content: [
                            {
                                type: 'text',
                                text: JSON.stringify({
                                    status: 'success',
                                    workflow_id,
                                    message: 'Workflow paused',
                                }, null, 2),
                            },
                        ],
                    };
                }
                catch (error) {
                    return createToolError('workflow_pause', error.message);
                }
            },
        },
        // Tool 5: fractary_faber_workflow_recover (Option B: Direct StateManager)
        {
            name: 'fractary_faber_workflow_recover',
            description: 'Recover a failed workflow from a checkpoint or specific phase',
            inputSchema: {
                type: 'object',
                required: ['workflow_id'],
                properties: {
                    workflow_id: {
                        type: 'string',
                        description: 'Workflow ID to recover',
                    },
                    checkpoint_id: {
                        type: 'string',
                        description: 'Optional checkpoint ID to recover from',
                    },
                    from_phase: {
                        type: 'string',
                        enum: ['frame', 'architect', 'build', 'evaluate', 'release'],
                        description: 'Optional phase to restart from',
                    },
                    skip_phases: {
                        type: 'array',
                        items: {
                            type: 'string',
                            enum: ['frame', 'architect', 'build', 'evaluate', 'release'],
                        },
                        description: 'Phases to skip during recovery',
                    },
                },
            },
            handler: async (params) => {
                const { workflow_id, checkpoint_id, from_phase, skip_phases } = params;
                try {
                    // Option B: Use StateManager directly (fallback until SDK method added)
                    const stateManager = new StateManager();
                    const recoveredState = stateManager.recoverWorkflow(workflow_id, {
                        checkpointId: checkpoint_id,
                        fromPhase: from_phase,
                        skipPhases: skip_phases,
                    });
                    // Re-run workflow with recovered state
                    const workflow = new FaberWorkflow();
                    const result = await workflow.run({
                        workId: recoveredState.work_id,
                        autonomy: 'assisted',
                    });
                    return {
                        content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
                    };
                }
                catch (error) {
                    return createToolError('workflow_recover', error.message);
                }
            },
        },
        // Tool 6: fractary_faber_workflow_cleanup (Option B: Direct StateManager)
        {
            name: 'fractary_faber_workflow_cleanup',
            description: 'Clean up old completed/failed workflow state files',
            inputSchema: {
                type: 'object',
                properties: {
                    max_age_days: {
                        type: 'number',
                        description: 'Delete workflows older than this many days',
                        default: 30,
                        minimum: 1,
                    },
                },
            },
            handler: async (params) => {
                const { max_age_days } = params;
                try {
                    // Option B: Use StateManager directly (fallback until SDK method added)
                    const stateManager = new StateManager();
                    const result = stateManager.cleanup(max_age_days || 30);
                    return {
                        content: [
                            {
                                type: 'text',
                                text: JSON.stringify({
                                    status: 'success',
                                    ...result,
                                }, null, 2),
                            },
                        ],
                    };
                }
                catch (error) {
                    return createToolError('workflow_cleanup', error.message);
                }
            },
        },
    ];
}
//# sourceMappingURL=workflow.js.map