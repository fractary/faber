"use strict";
/**
 * @fractary/faber CLI - Spec Commands
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.specCommand = void 0;
const commander_1 = require("commander");
const spec_1 = require("../../spec");
exports.specCommand = new commander_1.Command('spec')
    .description('Specification management');
exports.specCommand
    .command('create <title>')
    .description('Create a new specification')
    .option('-t, --template <template>', 'Template type (basic, feature, bug, infrastructure, api)', 'basic')
    .option('-w, --work-id <workId>', 'Work item ID')
    .option('-c, --context <context>', 'Additional context')
    .option('-f, --force', 'Overwrite existing spec')
    .action((title, options) => {
    try {
        const manager = new spec_1.SpecManager();
        const spec = manager.createSpec(title, {
            template: options.template,
            workId: options.workId,
            context: options.context,
            force: options.force,
        });
        console.log('Created spec:', spec.id);
        console.log('Path:', spec.path);
    }
    catch (error) {
        console.error('Error:', error instanceof Error ? error.message : error);
        process.exit(1);
    }
});
exports.specCommand
    .command('get <id>')
    .description('Get specification details')
    .action((id) => {
    try {
        const manager = new spec_1.SpecManager();
        const spec = manager.getSpec(id);
        if (!spec) {
            console.error('Spec not found:', id);
            process.exit(1);
        }
        console.log('ID:', spec.id);
        console.log('Title:', spec.title);
        console.log('Template:', spec.template);
        console.log('Work Type:', spec.workType);
        console.log('Work ID:', spec.workId || 'N/A');
        console.log('Path:', spec.path);
        console.log('Status:', spec.metadata.validation_status);
        console.log('Created:', spec.metadata.created_at);
        console.log('Updated:', spec.metadata.updated_at);
        if (spec.phases && spec.phases.length > 0) {
            console.log('\nPhases:');
            for (const phase of spec.phases) {
                console.log(`  ${phase.id}: ${phase.title} [${phase.status}]`);
            }
        }
    }
    catch (error) {
        console.error('Error:', error instanceof Error ? error.message : error);
        process.exit(1);
    }
});
exports.specCommand
    .command('list')
    .description('List specifications')
    .option('-w, --work-id <workId>', 'Filter by work ID')
    .option('-t, --template <template>', 'Filter by template')
    .option('-s, --status <status>', 'Filter by validation status')
    .action((options) => {
    try {
        const manager = new spec_1.SpecManager();
        const specs = manager.listSpecs({
            workId: options.workId,
            template: options.template,
            status: options.status,
        });
        if (specs.length === 0) {
            console.log('No specs found');
            return;
        }
        for (const spec of specs) {
            const status = spec.metadata.validation_status || 'not_validated';
            console.log(`${spec.id} [${status}] ${spec.title}`);
        }
    }
    catch (error) {
        console.error('Error:', error instanceof Error ? error.message : error);
        process.exit(1);
    }
});
exports.specCommand
    .command('validate <id>')
    .description('Validate a specification')
    .action((id) => {
    try {
        const manager = new spec_1.SpecManager();
        const result = manager.validateSpec(id);
        console.log('Status:', result.status);
        console.log('Score:', result.score + '%');
        console.log('\nChecks:');
        console.log('  Requirements:', `${result.checks.requirements.completed}/${result.checks.requirements.total}`, `[${result.checks.requirements.status}]`);
        console.log('  Acceptance Criteria:', `${result.checks.acceptanceCriteria.met}/${result.checks.acceptanceCriteria.total}`, `[${result.checks.acceptanceCriteria.status}]`);
        console.log('  Files Modified:', `[${result.checks.filesModified.status}]`);
        console.log('  Tests Added:', `${result.checks.testsAdded.added}/${result.checks.testsAdded.expected}`, `[${result.checks.testsAdded.status}]`);
        console.log('  Docs Updated:', `[${result.checks.docsUpdated.status}]`);
        if (result.suggestions && result.suggestions.length > 0) {
            console.log('\nSuggestions:');
            for (const suggestion of result.suggestions) {
                console.log(`  - ${suggestion}`);
            }
        }
    }
    catch (error) {
        console.error('Error:', error instanceof Error ? error.message : error);
        process.exit(1);
    }
});
exports.specCommand
    .command('questions <id>')
    .description('Generate refinement questions for a specification')
    .action((id) => {
    try {
        const manager = new spec_1.SpecManager();
        const questions = manager.generateRefinementQuestions(id);
        if (questions.length === 0) {
            console.log('No refinement questions - spec looks complete');
            return;
        }
        console.log('Refinement Questions:\n');
        for (const q of questions) {
            const priority = q.priority === 'high' ? '!' : q.priority === 'medium' ? '*' : '-';
            console.log(`[${priority}] ${q.question}`);
            console.log(`    Category: ${q.category}`);
            console.log('');
        }
    }
    catch (error) {
        console.error('Error:', error instanceof Error ? error.message : error);
        process.exit(1);
    }
});
exports.specCommand
    .command('delete <id>')
    .description('Delete a specification')
    .action((id) => {
    try {
        const manager = new spec_1.SpecManager();
        const deleted = manager.deleteSpec(id);
        if (deleted) {
            console.log('Deleted spec:', id);
        }
        else {
            console.log('Spec not found:', id);
        }
    }
    catch (error) {
        console.error('Error:', error instanceof Error ? error.message : error);
        process.exit(1);
    }
});
exports.specCommand
    .command('templates')
    .description('List available templates')
    .action(() => {
    try {
        const manager = new spec_1.SpecManager();
        const templates = manager.getTemplates();
        console.log('Available Templates:\n');
        for (const t of templates) {
            console.log(`${t.id}`);
            console.log(`  ${t.name}: ${t.description}`);
            console.log('');
        }
    }
    catch (error) {
        console.error('Error:', error instanceof Error ? error.message : error);
        process.exit(1);
    }
});
//# sourceMappingURL=spec.js.map