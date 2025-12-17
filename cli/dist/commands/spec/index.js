/**
 * Spec subcommand - Specification management
 *
 * Provides spec operations via @fractary/faber SpecManager.
 */
import { Command } from 'commander';
import chalk from 'chalk';
import { SpecManager } from '@fractary/faber';
/**
 * Create the spec command tree
 */
export function createSpecCommand() {
    const spec = new Command('spec')
        .description('Specification management');
    spec.addCommand(createSpecCreateCommand());
    spec.addCommand(createSpecGetCommand());
    spec.addCommand(createSpecListCommand());
    spec.addCommand(createSpecUpdateCommand());
    spec.addCommand(createSpecValidateCommand());
    spec.addCommand(createSpecRefineCommand());
    spec.addCommand(createSpecDeleteCommand());
    spec.addCommand(createSpecTemplatesCommand());
    return spec;
}
function createSpecCreateCommand() {
    return new Command('create')
        .description('Create a new specification')
        .argument('<title>', 'Specification title')
        .option('--template <type>', 'Specification template (feature, bugfix, refactor)', 'feature')
        .option('--work-id <id>', 'Associated work item ID')
        .option('--json', 'Output as JSON')
        .action(async (title, options) => {
        try {
            const specManager = new SpecManager();
            const spec = specManager.createSpec(title, {
                template: options.template,
                workId: options.workId,
            });
            if (options.json) {
                console.log(JSON.stringify({ status: 'success', data: spec }, null, 2));
            }
            else {
                console.log(chalk.green(`✓ Created specification: ${spec.title}`));
                console.log(chalk.gray(`  ID: ${spec.id}`));
                console.log(chalk.gray(`  Path: ${spec.path}`));
            }
        }
        catch (error) {
            handleSpecError(error, options);
        }
    });
}
function createSpecGetCommand() {
    return new Command('get')
        .description('Get a specification by ID or path')
        .argument('<id>', 'Specification ID or path')
        .option('--json', 'Output as JSON')
        .action(async (id, options) => {
        try {
            const specManager = new SpecManager();
            const spec = specManager.getSpec(id);
            if (!spec) {
                if (options.json) {
                    console.error(JSON.stringify({
                        status: 'error',
                        error: { code: 'SPEC_NOT_FOUND', message: `Specification not found: ${id}` },
                    }));
                }
                else {
                    console.error(chalk.red(`Specification not found: ${id}`));
                }
                process.exit(5);
            }
            if (options.json) {
                console.log(JSON.stringify({ status: 'success', data: spec }, null, 2));
            }
            else {
                console.log(chalk.bold(`${spec.title}`));
                console.log(chalk.gray(`ID: ${spec.id}`));
                console.log(chalk.gray(`Status: ${spec.metadata.validation_status || 'not_validated'}`));
                console.log(chalk.gray(`Work ID: ${spec.workId || 'N/A'}`));
                console.log('\n' + spec.content);
            }
        }
        catch (error) {
            handleSpecError(error, options);
        }
    });
}
function createSpecListCommand() {
    return new Command('list')
        .description('List specifications')
        .option('--status <status>', 'Filter by status (draft, validated, needs_revision)')
        .option('--work-id <id>', 'Filter by work item ID')
        .option('--json', 'Output as JSON')
        .action(async (options) => {
        try {
            const specManager = new SpecManager();
            const specs = specManager.listSpecs({
                status: options.status,
                workId: options.workId,
            });
            if (options.json) {
                console.log(JSON.stringify({ status: 'success', data: specs }, null, 2));
            }
            else {
                if (specs.length === 0) {
                    console.log(chalk.yellow('No specifications found'));
                }
                else {
                    specs.forEach((spec) => {
                        const status = spec.metadata.validation_status || 'not_validated';
                        const statusColor = status === 'complete' ? chalk.green :
                            status === 'failed' ? chalk.red :
                                status === 'partial' ? chalk.yellow : chalk.gray;
                        console.log(`${spec.id} ${spec.title} [${statusColor(status)}]`);
                    });
                }
            }
        }
        catch (error) {
            handleSpecError(error, options);
        }
    });
}
function createSpecUpdateCommand() {
    return new Command('update')
        .description('Update a specification')
        .argument('<id>', 'Specification ID or path')
        .option('--title <title>', 'New title')
        .option('--content <content>', 'New content')
        .option('--work-id <id>', 'Associated work item ID')
        .option('--status <status>', 'Validation status')
        .option('--json', 'Output as JSON')
        .action(async (id, options) => {
        try {
            const specManager = new SpecManager();
            const spec = specManager.updateSpec(id, {
                title: options.title,
                content: options.content,
                workId: options.workId,
                validationStatus: options.status,
            });
            if (options.json) {
                console.log(JSON.stringify({ status: 'success', data: spec }, null, 2));
            }
            else {
                console.log(chalk.green(`✓ Updated specification: ${spec.title}`));
            }
        }
        catch (error) {
            handleSpecError(error, options);
        }
    });
}
function createSpecValidateCommand() {
    return new Command('validate')
        .description('Validate a specification')
        .argument('<id>', 'Specification ID or path')
        .option('--json', 'Output as JSON')
        .action(async (id, options) => {
        try {
            const specManager = new SpecManager();
            const result = specManager.validateSpec(id);
            if (options.json) {
                console.log(JSON.stringify({ status: 'success', data: result }, null, 2));
            }
            else {
                const statusColor = result.status === 'pass' ? chalk.green :
                    result.status === 'fail' ? chalk.red : chalk.yellow;
                console.log(`Validation: ${statusColor(result.status.toUpperCase())}`);
                console.log(chalk.gray(`  Score: ${result.score}%`));
                // Show check results
                console.log(chalk.yellow('\nChecks:'));
                const { requirements, acceptanceCriteria } = result.checks;
                console.log(`  Requirements: ${requirements.completed}/${requirements.total} [${requirements.status}]`);
                console.log(`  Acceptance Criteria: ${acceptanceCriteria.met}/${acceptanceCriteria.total} [${acceptanceCriteria.status}]`);
            }
        }
        catch (error) {
            handleSpecError(error, options);
        }
    });
}
function createSpecRefineCommand() {
    return new Command('refine')
        .description('Generate refinement questions for a specification')
        .argument('<id>', 'Specification ID or path')
        .option('--json', 'Output as JSON')
        .action(async (id, options) => {
        try {
            const specManager = new SpecManager();
            const questions = specManager.generateRefinementQuestions(id);
            if (options.json) {
                console.log(JSON.stringify({ status: 'success', data: questions }, null, 2));
            }
            else {
                if (questions.length === 0) {
                    console.log(chalk.green('✓ Specification appears complete, no refinement questions'));
                }
                else {
                    console.log(chalk.yellow('Refinement Questions:'));
                    questions.forEach((q, i) => {
                        const priorityColor = q.priority === 'high' ? chalk.red :
                            q.priority === 'medium' ? chalk.yellow : chalk.gray;
                        console.log(`\n${i + 1}. [${priorityColor(q.priority)}] ${q.category}`);
                        console.log(`   ${q.question}`);
                    });
                }
            }
        }
        catch (error) {
            handleSpecError(error, options);
        }
    });
}
function createSpecDeleteCommand() {
    return new Command('delete')
        .description('Delete a specification')
        .argument('<id>', 'Specification ID or path')
        .option('--json', 'Output as JSON')
        .action(async (id, options) => {
        try {
            const specManager = new SpecManager();
            const deleted = specManager.deleteSpec(id);
            if (options.json) {
                console.log(JSON.stringify({ status: 'success', data: { deleted } }, null, 2));
            }
            else {
                if (deleted) {
                    console.log(chalk.green(`✓ Deleted specification: ${id}`));
                }
                else {
                    console.log(chalk.yellow(`Specification not found: ${id}`));
                }
            }
        }
        catch (error) {
            handleSpecError(error, options);
        }
    });
}
function createSpecTemplatesCommand() {
    return new Command('templates')
        .description('List available specification templates')
        .option('--json', 'Output as JSON')
        .action(async (options) => {
        try {
            const specManager = new SpecManager();
            const templates = specManager.getTemplates();
            if (options.json) {
                console.log(JSON.stringify({ status: 'success', data: templates }, null, 2));
            }
            else {
                console.log(chalk.bold('Available Templates:'));
                templates.forEach((t) => {
                    console.log(`  ${chalk.cyan(t.id)} - ${t.name}`);
                    console.log(chalk.gray(`    ${t.description}`));
                });
            }
        }
        catch (error) {
            handleSpecError(error, options);
        }
    });
}
// Error handling
function handleSpecError(error, options) {
    const message = error instanceof Error ? error.message : String(error);
    if (options.json) {
        console.error(JSON.stringify({
            status: 'error',
            error: { code: 'SPEC_ERROR', message },
        }));
    }
    else {
        console.error(chalk.red('Error:'), message);
    }
    process.exit(1);
}
