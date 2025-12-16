"use strict";
/**
 * @fractary/faber CLI - Workflow Commands
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.workflowCommand = void 0;
const commander_1 = require("commander");
const workflow_1 = require("../../workflow");
const state_1 = require("../../state");
exports.workflowCommand = new commander_1.Command('workflow')
    .description('FABER workflow orchestration');
exports.workflowCommand
    .command('run <workId>')
    .description('Run the FABER workflow for a work item')
    .option('-a, --autonomy <level>', 'Autonomy level (dry-run, assisted, guarded, autonomous)', 'assisted')
    .option('--skip-frame', 'Skip Frame phase')
    .option('--skip-architect', 'Skip Architect phase')
    .option('--skip-build', 'Skip Build phase')
    .option('--skip-evaluate', 'Skip Evaluate phase')
    .option('--skip-release', 'Skip Release phase')
    .action(async (workId, options) => {
    try {
        const workflow = new workflow_1.FaberWorkflow({
            config: {
                autonomy: options.autonomy,
                phases: {
                    frame: { enabled: !options.skipFrame },
                    architect: { enabled: !options.skipArchitect, refineSpec: true },
                    build: { enabled: !options.skipBuild },
                    evaluate: { enabled: !options.skipEvaluate, maxRetries: 3 },
                    release: { enabled: !options.skipRelease, requestReviews: true, reviewers: [] },
                },
            },
        });
        // Add event listener for progress
        workflow.addEventListener((event, data) => {
            switch (event) {
                case 'workflow:start':
                    console.log(`\nStarting workflow ${data.workflowId} for work item ${data.workId}`);
                    console.log(`Autonomy level: ${data.autonomy}`);
                    console.log('');
                    break;
                case 'phase:start':
                    console.log(`[${data.phase}] Starting...`);
                    break;
                case 'phase:complete':
                    console.log(`[${data.phase}] Completed`);
                    break;
                case 'phase:fail':
                    console.log(`[${data.phase}] Failed: ${data.error}`);
                    break;
                case 'phase:skip':
                    console.log(`[${data.phase}] Skipped`);
                    break;
                case 'artifact:create':
                    console.log(`  -> Created artifact: ${data.type} at ${data.path}`);
                    break;
                case 'workflow:complete':
                    console.log('\nWorkflow completed!');
                    break;
                case 'workflow:fail':
                    console.log('\nWorkflow failed');
                    break;
                case 'workflow:pause':
                    console.log(`\nWorkflow paused at ${data.phase}: ${data.message}`);
                    break;
            }
        });
        const result = await workflow.run({
            workId,
            autonomy: options.autonomy,
        });
        console.log('\n--- Summary ---');
        console.log('Workflow ID:', result.workflow_id);
        console.log('Status:', result.status);
        console.log('Duration:', (result.duration_ms / 1000).toFixed(2), 'seconds');
        console.log('\nPhases:');
        for (const phase of result.phases) {
            const status = phase.status === 'completed' ? '✓' :
                phase.status === 'failed' ? '✗' :
                    phase.status === 'skipped' ? '-' : '?';
            console.log(`  ${status} ${phase.phase}: ${phase.status}`);
            if (phase.error) {
                console.log(`    Error: ${phase.error}`);
            }
        }
        if (result.artifacts.length > 0) {
            console.log('\nArtifacts:');
            for (const artifact of result.artifacts) {
                console.log(`  [${artifact.type}] ${artifact.path}`);
            }
        }
        process.exit(result.status === 'completed' ? 0 : 1);
    }
    catch (error) {
        console.error('Error:', error instanceof Error ? error.message : error);
        process.exit(1);
    }
});
exports.workflowCommand
    .command('resume <workflowId>')
    .description('Resume a paused workflow')
    .action(async (workflowId) => {
    try {
        const workflow = new workflow_1.FaberWorkflow();
        // Add event listener for progress
        workflow.addEventListener((event, data) => {
            if (event === 'phase:start') {
                console.log(`[${data.phase}] Starting...`);
            }
            else if (event === 'phase:complete') {
                console.log(`[${data.phase}] Completed`);
            }
        });
        const result = await workflow.resume(workflowId);
        console.log('\nStatus:', result.status);
        process.exit(result.status === 'completed' ? 0 : 1);
    }
    catch (error) {
        console.error('Error:', error instanceof Error ? error.message : error);
        process.exit(1);
    }
});
exports.workflowCommand
    .command('status <workflowId>')
    .description('Get workflow status')
    .action((workflowId) => {
    try {
        const workflow = new workflow_1.FaberWorkflow();
        const status = workflow.getStatus(workflowId);
        if (!status.state) {
            console.error('Workflow not found:', workflowId);
            process.exit(1);
        }
        console.log('Workflow ID:', workflowId);
        console.log('Work ID:', status.state.work_id);
        console.log('Status:', status.state.status);
        console.log('Current Phase:', status.currentPhase);
        console.log('Progress:', status.progress + '%');
    }
    catch (error) {
        console.error('Error:', error instanceof Error ? error.message : error);
        process.exit(1);
    }
});
exports.workflowCommand
    .command('list')
    .description('List workflows')
    .option('-w, --work-id <workId>', 'Filter by work ID')
    .option('-s, --status <status>', 'Filter by status')
    .option('-l, --limit <limit>', 'Max results', '10')
    .action((options) => {
    try {
        const stateManager = new state_1.StateManager();
        const workflows = stateManager.listWorkflows({
            workId: options.workId,
            status: options.status,
            limit: parseInt(options.limit, 10),
        });
        if (workflows.length === 0) {
            console.log('No workflows found');
            return;
        }
        for (const wf of workflows) {
            const updated = new Date(wf.updated_at).toLocaleString();
            console.log(`${wf.workflow_id} [${wf.status}] Work: ${wf.work_id} - Phase: ${wf.current_phase} (${updated})`);
        }
    }
    catch (error) {
        console.error('Error:', error instanceof Error ? error.message : error);
        process.exit(1);
    }
});
exports.workflowCommand
    .command('delete <workflowId>')
    .description('Delete a workflow')
    .action((workflowId) => {
    try {
        const stateManager = new state_1.StateManager();
        const deleted = stateManager.deleteWorkflow(workflowId);
        if (deleted) {
            console.log('Deleted workflow:', workflowId);
        }
        else {
            console.log('Workflow not found:', workflowId);
        }
    }
    catch (error) {
        console.error('Error:', error instanceof Error ? error.message : error);
        process.exit(1);
    }
});
exports.workflowCommand
    .command('cleanup')
    .description('Clean up old workflows')
    .option('-d, --days <days>', 'Max age in days', '30')
    .action((options) => {
    try {
        const stateManager = new state_1.StateManager();
        const result = stateManager.cleanup(parseInt(options.days, 10));
        console.log('Deleted:', result.deleted, 'workflows');
        if (result.errors.length > 0) {
            console.log('Errors:');
            for (const error of result.errors) {
                console.log(' -', error);
            }
        }
    }
    catch (error) {
        console.error('Error:', error instanceof Error ? error.message : error);
        process.exit(1);
    }
});
//# sourceMappingURL=workflow.js.map