/**
 * Logs subcommand - Log management
 *
 * Provides capture, write, search, list, archive operations via LogManager SDK.
 */

import { Command } from 'commander';
import chalk from 'chalk';
import { LogManager } from '@fractary/faber';
import { parseOptionalInteger, parseValidInteger, parsePositiveInteger } from '../../utils/validation.js';

/**
 * Create the logs command tree
 */
export function createLogsCommand(): Command {
  const logs = new Command('logs')
    .description('Log management');

  logs.addCommand(createLogsCaptureCommand());
  logs.addCommand(createLogsStopCommand());
  logs.addCommand(createLogsWriteCommand());
  logs.addCommand(createLogsReadCommand());
  logs.addCommand(createLogsSearchCommand());
  logs.addCommand(createLogsListCommand());
  logs.addCommand(createLogsArchiveCommand());
  logs.addCommand(createLogsDeleteCommand());

  return logs;
}

function createLogsCaptureCommand(): Command {
  return new Command('capture')
    .description('Start session capture')
    .argument('<issue_number>', 'Issue number to associate with session')
    .option('--model <model>', 'Model being used')
    .option('--json', 'Output as JSON')
    .action(async (issueNumber: string, options) => {
      try {
        const logManager = new LogManager();
        const result = await logManager.startCapture({
          issueNumber: parseValidInteger(issueNumber, 'issue number'),
          model: options.model,
        });

        if (options.json) {
          console.log(JSON.stringify({ status: 'success', data: result }, null, 2));
        } else {
          console.log(chalk.green(`✓ Started session capture for issue #${issueNumber}`));
          console.log(chalk.gray(`  Session ID: ${result.sessionId}`));
        }
      } catch (error) {
        handleLogsError(error, options);
      }
    });
}

function createLogsStopCommand(): Command {
  return new Command('stop')
    .description('Stop session capture')
    .option('--json', 'Output as JSON')
    .action(async (options) => {
      try {
        const logManager = new LogManager();
        const result = await logManager.stopCapture();

        if (options.json) {
          console.log(JSON.stringify({ status: 'success', data: result }, null, 2));
        } else {
          console.log(chalk.green('✓ Stopped session capture'));
          if (result?.logPath) {
            console.log(chalk.gray(`  Log saved to: ${result.logPath}`));
          }
        }
      } catch (error) {
        handleLogsError(error, options);
      }
    });
}

function createLogsWriteCommand(): Command {
  return new Command('write')
    .description('Write a typed log entry')
    .requiredOption('--type <type>', 'Log type: session|build|deployment|debug|test|audit|operational')
    .requiredOption('--title <title>', 'Log entry title')
    .requiredOption('--content <text>', 'Log content')
    .option('--issue <number>', 'Associated issue number')
    .option('--json', 'Output as JSON')
    .action(async (options) => {
      try {
        const logManager = new LogManager();
        const result = logManager.writeLog({
          type: options.type,
          title: options.title,
          content: options.content,
          issueNumber: parseOptionalInteger(options.issue, 'issue number'),
        });

        if (options.json) {
          console.log(JSON.stringify({ status: 'success', data: result }, null, 2));
        } else {
          console.log(chalk.green(`✓ Created ${options.type} log: ${options.title}`));
          console.log(chalk.gray(`  ID: ${result.id}`));
          console.log(chalk.gray(`  Path: ${result.path}`));
        }
      } catch (error) {
        handleLogsError(error, options);
      }
    });
}

function createLogsReadCommand(): Command {
  return new Command('read')
    .description('Read a log entry by ID or path')
    .argument('<id>', 'Log ID or path')
    .option('--json', 'Output as JSON')
    .action(async (id: string, options) => {
      try {
        const logManager = new LogManager();
        const log = logManager.readLog(id);

        if (!log) {
          if (options.json) {
            console.error(JSON.stringify({
              status: 'error',
              error: { code: 'LOG_NOT_FOUND', message: `Log not found: ${id}` },
            }));
          } else {
            console.error(chalk.red(`Log not found: ${id}`));
          }
          process.exit(5);
        }

        if (options.json) {
          console.log(JSON.stringify({ status: 'success', data: log }, null, 2));
        } else {
          console.log(chalk.bold(`[${log.type}] ${log.title}`));
          console.log(chalk.gray(`ID: ${log.id}`));
          console.log(chalk.gray(`Date: ${log.metadata.date}`));
          console.log(chalk.gray(`Path: ${log.path}`));
          console.log('\n' + log.content);
        }
      } catch (error) {
        handleLogsError(error, options);
      }
    });
}

function createLogsSearchCommand(): Command {
  return new Command('search')
    .description('Search logs')
    .requiredOption('--query <text>', 'Search query')
    .option('--type <type>', 'Filter by log type')
    .option('--issue <number>', 'Filter by issue number')
    .option('--regex', 'Use regex search')
    .option('--json', 'Output as JSON')
    .action(async (options) => {
      try {
        const logManager = new LogManager();
        const results = logManager.searchLogs({
          query: options.query,
          type: options.type,
          issueNumber: parseOptionalInteger(options.issue, 'issue number'),
          regex: options.regex,
        });

        if (options.json) {
          console.log(JSON.stringify({ status: 'success', data: results }, null, 2));
        } else {
          if (results.length === 0) {
            console.log(chalk.yellow('No logs found'));
          } else {
            results.forEach((result) => {
              console.log(chalk.bold(`[${result.log.type}] ${result.log.title}`));
              console.log(chalk.gray(`  ${result.log.path}`));
              if (result.snippets && result.snippets.length > 0) {
                result.snippets.forEach((snippet) => {
                  console.log(chalk.gray(`  ...${snippet}...`));
                });
              }
              console.log('');
            });
          }
        }
      } catch (error) {
        handleLogsError(error, options);
      }
    });
}

function createLogsListCommand(): Command {
  return new Command('list')
    .description('List logs')
    .option('--type <type>', 'Filter by log type')
    .option('--status <status>', 'Filter by status (active, archived)', 'active')
    .option('--issue <number>', 'Filter by issue number')
    .option('--limit <n>', 'Max results', '50')
    .option('--json', 'Output as JSON')
    .action(async (options) => {
      try {
        const logManager = new LogManager();
        const logs = logManager.listLogs({
          type: options.type,
          status: options.status,
          issueNumber: parseOptionalInteger(options.issue, 'issue number'),
          limit: parsePositiveInteger(options.limit, 'limit'),
        });

        if (options.json) {
          console.log(JSON.stringify({ status: 'success', data: logs }, null, 2));
        } else {
          if (logs.length === 0) {
            console.log(chalk.yellow('No logs found'));
          } else {
            logs.forEach((log) => {
              const typeColor = getTypeColor(log.type);
              console.log(`${typeColor(`[${log.type}]`)} ${log.title} (${log.metadata.date})`);
            });
          }
        }
      } catch (error) {
        handleLogsError(error, options);
      }
    });
}

function createLogsArchiveCommand(): Command {
  return new Command('archive')
    .description('Archive old logs')
    .option('--max-age <days>', 'Archive logs older than N days', '30')
    .option('--compress', 'Compress archived logs')
    .option('--json', 'Output as JSON')
    .action(async (options) => {
      try {
        const logManager = new LogManager();
        const result = logManager.archiveLogs({
          maxAgeDays: parsePositiveInteger(options.maxAge, 'max age (days)'),
          compress: options.compress,
        });

        if (options.json) {
          console.log(JSON.stringify({ status: 'success', data: result }, null, 2));
        } else {
          if (result.archived.length === 0 && result.deleted.length === 0) {
            console.log(chalk.yellow('No logs to archive'));
          } else {
            if (result.archived.length > 0) {
              console.log(chalk.green(`✓ Archived ${result.archived.length} log(s)`));
              result.archived.forEach((log) => {
                console.log(chalk.gray(`  - ${log}`));
              });
            }
            if (result.deleted.length > 0) {
              console.log(chalk.green(`✓ Deleted ${result.deleted.length} log(s)`));
              result.deleted.forEach((log) => {
                console.log(chalk.gray(`  - ${log}`));
              });
            }
            if (result.errors.length > 0) {
              console.log(chalk.yellow(`\nErrors (${result.errors.length}):`));
              result.errors.forEach((err) => {
                console.log(chalk.red(`  - ${err}`));
              });
            }
          }
        }
      } catch (error) {
        handleLogsError(error, options);
      }
    });
}

function createLogsDeleteCommand(): Command {
  return new Command('delete')
    .description('Delete a log entry')
    .argument('<id>', 'Log ID or path')
    .option('--json', 'Output as JSON')
    .action(async (id: string, options) => {
      try {
        const logManager = new LogManager();
        const deleted = logManager.deleteLog(id);

        if (options.json) {
          console.log(JSON.stringify({ status: 'success', data: { deleted } }, null, 2));
        } else {
          if (deleted) {
            console.log(chalk.green(`✓ Deleted log: ${id}`));
          } else {
            console.log(chalk.yellow(`Log not found: ${id}`));
          }
        }
      } catch (error) {
        handleLogsError(error, options);
      }
    });
}

// Helper functions

function getTypeColor(type: string): (text: string) => string {
  switch (type) {
    case 'session':
      return chalk.blue;
    case 'build':
      return chalk.cyan;
    case 'deployment':
      return chalk.magenta;
    case 'debug':
      return chalk.yellow;
    case 'test':
      return chalk.green;
    case 'audit':
      return chalk.red;
    case 'operational':
      return chalk.gray;
    default:
      return chalk.white;
  }
}

// Error handling

function handleLogsError(error: unknown, options: { json?: boolean }): void {

  const message = error instanceof Error ? error.message : String(error);
  if (options.json) {
    console.error(JSON.stringify({
      status: 'error',
      error: { code: 'LOGS_ERROR', message },
    }));
  } else {
    console.error(chalk.red('Error:'), message);
  }
  process.exit(1);
}
