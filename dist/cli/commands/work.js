"use strict";
/**
 * @fractary/faber CLI - Work Commands
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.workCommand = void 0;
const commander_1 = require("commander");
const work_1 = require("../../work");
exports.workCommand = new commander_1.Command('work')
    .description('Work tracking operations');
exports.workCommand
    .command('fetch <issue>')
    .description('Fetch issue details')
    .action(async (issue) => {
    try {
        const manager = new work_1.WorkManager();
        const result = await manager.fetchIssue(issue);
        console.log(JSON.stringify(result, null, 2));
    }
    catch (error) {
        console.error('Error:', error instanceof Error ? error.message : error);
        process.exit(1);
    }
});
exports.workCommand
    .command('create')
    .description('Create a new issue')
    .requiredOption('-t, --title <title>', 'Issue title')
    .option('-b, --body <body>', 'Issue body')
    .option('--type <type>', 'Work type (feature, bug, chore, patch)', 'feature')
    .option('-l, --labels <labels>', 'Comma-separated labels')
    .option('-a, --assignee <assignee>', 'Assignee')
    .action(async (options) => {
    try {
        const manager = new work_1.WorkManager();
        const result = await manager.createIssue({
            title: options.title,
            body: options.body,
            workType: options.type,
            labels: options.labels?.split(','),
            assignees: options.assignee ? [options.assignee] : undefined,
        });
        console.log('Created issue:', result.number);
        console.log(JSON.stringify(result, null, 2));
    }
    catch (error) {
        console.error('Error:', error instanceof Error ? error.message : error);
        process.exit(1);
    }
});
exports.workCommand
    .command('search [query]')
    .description('Search issues')
    .option('-s, --state <state>', 'Issue state (open, closed, all)', 'open')
    .option('-l, --limit <limit>', 'Max results', '10')
    .action(async (query, options) => {
    try {
        const manager = new work_1.WorkManager();
        const results = await manager.searchIssues(query || '', {
            state: options.state,
        });
        console.log(JSON.stringify(results.slice(0, parseInt(options.limit, 10)), null, 2));
    }
    catch (error) {
        console.error('Error:', error instanceof Error ? error.message : error);
        process.exit(1);
    }
});
exports.workCommand
    .command('close <issue>')
    .description('Close an issue')
    .action(async (issue) => {
    try {
        const manager = new work_1.WorkManager();
        await manager.closeIssue(issue);
        console.log('Issue closed:', issue);
    }
    catch (error) {
        console.error('Error:', error instanceof Error ? error.message : error);
        process.exit(1);
    }
});
exports.workCommand
    .command('comment <issue>')
    .description('Add a comment to an issue')
    .requiredOption('-b, --body <body>', 'Comment body')
    .action(async (issue, options) => {
    try {
        const manager = new work_1.WorkManager();
        await manager.createComment(issue, options.body);
        console.log('Comment added to issue:', issue);
    }
    catch (error) {
        console.error('Error:', error instanceof Error ? error.message : error);
        process.exit(1);
    }
});
exports.workCommand
    .command('classify <issue>')
    .description('Classify issue work type')
    .action(async (issue) => {
    try {
        const manager = new work_1.WorkManager();
        const issueData = await manager.fetchIssue(issue);
        const workType = await manager.classifyWorkType(issueData);
        console.log('Work type:', workType);
    }
    catch (error) {
        console.error('Error:', error instanceof Error ? error.message : error);
        process.exit(1);
    }
});
//# sourceMappingURL=work.js.map