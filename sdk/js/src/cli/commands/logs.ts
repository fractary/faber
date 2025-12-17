/**
 * @fractary/faber CLI - Logs Commands
 */

import { Command } from 'commander';
import { LogManager } from '../../logs';

export const logsCommand = new Command('logs')
  .description('Log management and session capture');

logsCommand
  .command('write')
  .description('Write a new log entry')
  .requiredOption('-t, --title <title>', 'Log title')
  .requiredOption('--type <type>', 'Log type (session, build, deployment, test, debug, audit, operational, workflow)')
  .option('-c, --content <content>', 'Log content')
  .option('-i, --issue <issue>', 'Related issue number')
  .action((options) => {
    try {
      const manager = new LogManager();
      const log = manager.writeLog({
        title: options.title,
        type: options.type,
        content: options.content || '',
        issueNumber: options.issue ? parseInt(options.issue, 10) : undefined,
      });
      console.log('Created log:', log.id);
      console.log('Path:', log.path);
    } catch (error) {
      console.error('Error:', error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

logsCommand
  .command('read <id>')
  .description('Read a log entry')
  .action((id: string) => {
    try {
      const manager = new LogManager();
      const log = manager.readLog(id);
      if (!log) {
        console.error('Log not found:', id);
        process.exit(1);
      }
      console.log('ID:', log.id);
      console.log('Type:', log.type);
      console.log('Title:', log.title);
      console.log('Date:', log.metadata.date);
      console.log('Status:', log.metadata.status);
      console.log('Size:', log.size_bytes, 'bytes');
      console.log('Path:', log.path);
      console.log('\n--- Content ---\n');
      console.log(log.content);
    } catch (error) {
      console.error('Error:', error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

logsCommand
  .command('list')
  .description('List log entries')
  .option('--type <type>', 'Filter by type')
  .option('-s, --status <status>', 'Filter by status')
  .option('-i, --issue <issue>', 'Filter by issue number')
  .option('--since <date>', 'Filter since date')
  .option('--until <date>', 'Filter until date')
  .option('-l, --limit <limit>', 'Max results', '20')
  .action((options) => {
    try {
      const manager = new LogManager();
      const logs = manager.listLogs({
        type: options.type,
        status: options.status,
        issueNumber: options.issue ? parseInt(options.issue, 10) : undefined,
        since: options.since,
        until: options.until,
        limit: parseInt(options.limit, 10),
      });
      if (logs.length === 0) {
        console.log('No logs found');
        return;
      }
      for (const log of logs) {
        const date = new Date(log.metadata.date).toLocaleDateString();
        console.log(`${log.id} [${log.type}] ${date} - ${log.title}`);
      }
    } catch (error) {
      console.error('Error:', error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

logsCommand
  .command('search <query>')
  .description('Search log entries')
  .option('--type <type>', 'Filter by type')
  .option('-r, --regex', 'Use regex pattern')
  .action((query: string, options) => {
    try {
      const manager = new LogManager();
      const results = manager.searchLogs({
        query,
        type: options.type,
        regex: options.regex,
      });
      if (results.length === 0) {
        console.log('No matches found');
        return;
      }
      for (const result of results) {
        console.log(`\n${result.log.id} - ${result.log.title}`);
        console.log(`Path: ${result.log.path}`);
        console.log('Matches:');
        result.snippets.slice(0, 5).forEach((snippet, i) => {
          console.log(`  L${result.lineNumbers[i]}: ${snippet.slice(0, 100)}`);
        });
      }
    } catch (error) {
      console.error('Error:', error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

// Session capture commands
const captureCommand = new Command('capture')
  .description('Session capture operations');

captureCommand
  .command('start')
  .description('Start session capture')
  .requiredOption('-i, --issue <issue>', 'Issue number')
  .option('--no-redact', 'Do not redact sensitive content')
  .option('-m, --model <model>', 'Model name for logging')
  .action((options) => {
    try {
      const manager = new LogManager();
      const result = manager.startCapture({
        issueNumber: parseInt(options.issue, 10),
        redactSensitive: options.redact !== false,
        model: options.model,
      });
      console.log('Session started:', result.sessionId);
      console.log('Log path:', result.logPath);
    } catch (error) {
      console.error('Error:', error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

captureCommand
  .command('stop')
  .description('Stop session capture')
  .action(() => {
    try {
      const manager = new LogManager();
      const result = manager.stopCapture();
      if (result) {
        console.log('Session stopped:', result.sessionId);
        console.log('Log path:', result.logPath);
      } else {
        console.log('No active capture session');
      }
    } catch (error) {
      console.error('Error:', error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

captureCommand
  .command('status')
  .description('Get capture session status')
  .action(() => {
    try {
      const manager = new LogManager();
      const session = manager.getActiveCapture();
      if (session) {
        console.log('Session ID:', session.sessionId);
        console.log('Issue:', session.issueNumber);
        console.log('Status:', session.status);
        console.log('Started:', session.startTime);
        console.log('Messages:', session.messageCount);
        console.log('Log path:', session.logPath);
      } else {
        console.log('No active capture session');
      }
    } catch (error) {
      console.error('Error:', error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

logsCommand.addCommand(captureCommand);

logsCommand
  .command('delete <id>')
  .description('Delete a log entry')
  .action((id: string) => {
    try {
      const manager = new LogManager();
      const deleted = manager.deleteLog(id);
      if (deleted) {
        console.log('Deleted log:', id);
      } else {
        console.log('Log not found:', id);
      }
    } catch (error) {
      console.error('Error:', error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });
