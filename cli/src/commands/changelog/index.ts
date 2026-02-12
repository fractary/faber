/**
 * Changelog subcommand - Machine-readable changelog management
 *
 * Provides emit, query, aggregate, and read-run operations via ChangelogManager SDK.
 */

import { Command } from 'commander';
import chalk from 'chalk';
import { ChangelogManager } from '@fractary/faber';

/**
 * Create the changelog command tree
 */
export function createChangelogCommand(): Command {
  const changelog = new Command('changelog')
    .description('Machine-readable changelog management');

  changelog.addCommand(createChangelogEmitCommand());
  changelog.addCommand(createChangelogQueryCommand());
  changelog.addCommand(createChangelogAggregateCommand());
  changelog.addCommand(createChangelogReadRunCommand());

  return changelog;
}

function createChangelogEmitCommand(): Command {
  return new Command('emit')
    .description('Emit a changelog entry for a completed step')
    .requiredOption('--run-id <id>', 'Run identifier')
    .requiredOption('--step-id <id>', 'Step identifier')
    .requiredOption('--step-name <name>', 'Human-readable step name')
    .requiredOption('--phase <phase>', 'FABER phase')
    .requiredOption('--status <status>', 'Step status (success, warning, failure, skipped)')
    .requiredOption('--event-type <type>', 'Semantic event type (e.g., CODE_MERGED)')
    .requiredOption('--workflow-id <id>', 'Workflow identifier')
    .requiredOption('--work-id <id>', 'Work item identifier')
    .option('--target <target>', 'Target branch/environment/resource')
    .option('--environment <env>', 'Target environment (test, prod)')
    .option('--message <msg>', 'Human-readable description')
    .option('--duration-ms <ms>', 'Step duration in milliseconds')
    .option('--metadata <json>', 'Step-specific metadata (JSON string)')
    .option('--custom <json>', 'Project-specific custom data (JSON string)')
    .option('--json', 'Output as JSON')
    .action(async (options) => {
      try {
        const manager = new ChangelogManager();
        const entry = manager.emit({
          run_id: options.runId,
          step_id: options.stepId,
          step_name: options.stepName,
          phase: options.phase,
          status: options.status,
          event_type: options.eventType,
          workflow_id: options.workflowId,
          work_id: options.workId,
          target: options.target,
          environment: options.environment,
          message: options.message,
          duration_ms: options.durationMs ? parseInt(options.durationMs, 10) : undefined,
          metadata: options.metadata ? JSON.parse(options.metadata) : undefined,
          custom: options.custom ? JSON.parse(options.custom) : undefined,
        });

        if (options.json) {
          console.log(JSON.stringify({ status: 'success', data: entry }, null, 2));
        } else {
          console.log(chalk.green(`Emitted changelog entry: ${entry.event_type}`));
          console.log(chalk.gray(`  Event ID: ${entry.event_id}`));
          console.log(chalk.gray(`  Step: ${entry.step_name}`));
        }
      } catch (error) {
        handleChangelogError(error, options);
      }
    });
}

function createChangelogQueryCommand(): Command {
  return new Command('query')
    .description('Query the project-level changelog')
    .option('--event-type <type>', 'Filter by event type')
    .option('--target <target>', 'Filter by target')
    .option('--phase <phase>', 'Filter by phase')
    .option('--status <status>', 'Filter by status')
    .option('--work-id <id>', 'Filter by work item ID')
    .option('--since <date>', 'Filter entries after this date (ISO 8601)')
    .option('--until <date>', 'Filter entries before this date (ISO 8601)')
    .option('--limit <n>', 'Maximum entries to return')
    .option('--json', 'Output as JSON')
    .action(async (options) => {
      try {
        const manager = new ChangelogManager();
        const result = manager.query({
          event_type: options.eventType,
          target: options.target,
          phase: options.phase,
          status: options.status,
          work_id: options.workId,
          since: options.since,
          until: options.until,
          limit: options.limit ? parseInt(options.limit, 10) : undefined,
        });

        if (options.json) {
          console.log(JSON.stringify({ status: 'success', data: result }, null, 2));
        } else {
          if (result.entries.length === 0) {
            console.log(chalk.yellow('No changelog entries found'));
          } else {
            console.log(chalk.bold(`Changelog entries (${result.entries.length} of ${result.total}):\n`));
            for (const entry of result.entries) {
              const statusColor = entry.status === 'success' ? chalk.green
                : entry.status === 'failure' ? chalk.red
                : entry.status === 'warning' ? chalk.yellow
                : chalk.gray;
              console.log(
                `${statusColor(entry.status.padEnd(8))} ${chalk.cyan(entry.event_type.padEnd(22))} ${entry.step_name}`
              );
              console.log(
                chalk.gray(`  ${entry.timestamp}  phase:${entry.phase}  work:${entry.work_id}${entry.environment ? '  env:' + entry.environment : ''}`)
              );
              if (entry.message) {
                console.log(chalk.gray(`  ${entry.message}`));
              }
              console.log('');
            }
          }
        }
      } catch (error) {
        handleChangelogError(error, options);
      }
    });
}

function createChangelogAggregateCommand(): Command {
  return new Command('aggregate')
    .description('Aggregate per-run changelog to project-level file')
    .requiredOption('--run-id <id>', 'Run identifier to aggregate')
    .option('--json', 'Output as JSON')
    .action(async (options) => {
      try {
        const manager = new ChangelogManager();
        const result = manager.aggregate(options.runId);

        if (options.json) {
          console.log(JSON.stringify({ status: 'success', data: result }, null, 2));
        } else {
          if (result.entries_aggregated === 0) {
            console.log(chalk.yellow('No entries to aggregate'));
          } else {
            console.log(chalk.green(`Aggregated ${result.entries_aggregated} changelog entries`));
          }
        }
      } catch (error) {
        handleChangelogError(error, options);
      }
    });
}

function createChangelogReadRunCommand(): Command {
  return new Command('read-run')
    .description('Read changelog entries for a specific run')
    .requiredOption('--run-id <id>', 'Run identifier')
    .option('--json', 'Output as JSON')
    .action(async (options) => {
      try {
        const manager = new ChangelogManager();
        const entries = manager.readRun(options.runId);

        if (options.json) {
          console.log(JSON.stringify({ status: 'success', data: { entries, total: entries.length } }, null, 2));
        } else {
          if (entries.length === 0) {
            console.log(chalk.yellow('No changelog entries for this run'));
          } else {
            console.log(chalk.bold(`Run changelog (${entries.length} entries):\n`));
            for (const entry of entries) {
              const statusColor = entry.status === 'success' ? chalk.green
                : entry.status === 'failure' ? chalk.red
                : entry.status === 'warning' ? chalk.yellow
                : chalk.gray;
              console.log(
                `${statusColor(entry.status.padEnd(8))} ${chalk.cyan(entry.event_type.padEnd(22))} ${entry.step_name}`
              );
              if (entry.message) {
                console.log(chalk.gray(`  ${entry.message}`));
              }
            }
          }
        }
      } catch (error) {
        handleChangelogError(error, options);
      }
    });
}

// Error handling

function handleChangelogError(error: unknown, options: { json?: boolean }): void {
  const message = error instanceof Error ? error.message : String(error);
  if (options.json) {
    console.error(JSON.stringify({
      status: 'error',
      error: { code: 'CHANGELOG_ERROR', message },
    }));
  } else {
    console.error(chalk.red('Error:'), message);
  }
  process.exit(1);
}
