/**
 * @fractary/faber CLI - Work Commands
 */

import { Command } from 'commander';
import { WorkManager } from '../../work';

export const workCommand = new Command('work')
  .description('Work tracking operations');

workCommand
  .command('fetch <issue>')
  .description('Fetch issue details')
  .action(async (issue: string) => {
    try {
      const manager = new WorkManager();
      const result = await manager.fetchIssue(issue);
      console.log(JSON.stringify(result, null, 2));
    } catch (error) {
      console.error('Error:', error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

workCommand
  .command('create')
  .description('Create a new issue')
  .requiredOption('-t, --title <title>', 'Issue title')
  .option('-b, --body <body>', 'Issue body')
  .option('--type <type>', 'Work type (feature, bug, chore, patch)', 'feature')
  .option('-l, --labels <labels>', 'Comma-separated labels')
  .option('-a, --assignee <assignee>', 'Assignee')
  .action(async (options) => {
    try {
      const manager = new WorkManager();
      const result = await manager.createIssue({
        title: options.title,
        body: options.body,
        workType: options.type,
        labels: options.labels?.split(','),
        assignees: options.assignee ? [options.assignee] : undefined,
      });
      console.log('Created issue:', result.number);
      console.log(JSON.stringify(result, null, 2));
    } catch (error) {
      console.error('Error:', error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

workCommand
  .command('search [query]')
  .description('Search issues')
  .option('-s, --state <state>', 'Issue state (open, closed, all)', 'open')
  .option('-l, --limit <limit>', 'Max results', '10')
  .action(async (query: string | undefined, options) => {
    try {
      const manager = new WorkManager();
      const results = await manager.searchIssues(query || '', {
        state: options.state,
      });
      console.log(JSON.stringify(results.slice(0, parseInt(options.limit, 10)), null, 2));
    } catch (error) {
      console.error('Error:', error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

workCommand
  .command('close <issue>')
  .description('Close an issue')
  .action(async (issue: string) => {
    try {
      const manager = new WorkManager();
      await manager.closeIssue(issue);
      console.log('Issue closed:', issue);
    } catch (error) {
      console.error('Error:', error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

workCommand
  .command('comment <issue>')
  .description('Add a comment to an issue')
  .requiredOption('-b, --body <body>', 'Comment body')
  .action(async (issue: string, options) => {
    try {
      const manager = new WorkManager();
      await manager.createComment(issue, options.body);
      console.log('Comment added to issue:', issue);
    } catch (error) {
      console.error('Error:', error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

workCommand
  .command('classify <issue>')
  .description('Classify issue work type')
  .action(async (issue: string) => {
    try {
      const manager = new WorkManager();
      const issueData = await manager.fetchIssue(issue);
      const workType = await manager.classifyWorkType(issueData);
      console.log('Work type:', workType);
    } catch (error) {
      console.error('Error:', error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });
