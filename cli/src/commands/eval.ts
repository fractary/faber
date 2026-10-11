/**
 * Eval commands - run eval suites (#272)
 *
 * fractary-faber eval run <suite-dir>    run every task k times and print the results table
 * fractary-faber eval check <suite-dir>  check each task's answer key without running a workflow
 */

import { Command } from 'commander';
import chalk from 'chalk';
import * as path from 'path';
import {
  loadEvalSuite,
  runEvalSuite,
  checkEvalSuite,
  renderResultsMarkdown,
  renderChecksMarkdown,
  tasksValid,
  violations,
  EvalSuiteError,
} from '@fractary/faber';
import type { EvalTrialResult } from '@fractary/faber';

/** eval run exit code when a trial broke an invariant */
export const EXIT_INVARIANT_VIOLATION = 2;

function taskIds(option?: string): string[] | undefined {
  const ids = option?.split(',').map((id) => id.trim()).filter((id) => id.length > 0);
  return ids && ids.length > 0 ? ids : undefined;
}

function timestamp(): string {
  return new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5) + 'Z';
}

function describeTrial(result: EvalTrialResult): string {
  const outcome = result.passed ? chalk.green('passed') : chalk.red('failed');
  const cost = result.cost_usd !== undefined ? `, $${result.cost_usd.toFixed(2)}` : '';
  const broken = violations(result.invariants);
  const warning = broken.length > 0 ? chalk.yellow(` — broke ${broken.map((v) => v.id).join(', ')}`) : '';
  return `${outcome} (run ${result.run_status}${cost}, ${Math.round(result.duration_ms / 1000)}s)${warning}`;
}

function fail(error: unknown, json?: boolean): never {
  const message = error instanceof Error ? error.message : String(error);
  if (json) {
    console.log(JSON.stringify({ status: 'error', error: { message } }, null, 2));
  } else {
    console.error(chalk.red(message));
  }
  process.exit(1);
}

export function createEvalCommand(): Command {
  const evalCommand = new Command('eval')
    .description('Run eval suites: frozen work items in clean trials, graded against hidden answer keys');

  evalCommand
    .command('run')
    .description('Run every task of a suite k times and print the results table')
    .argument('<suite-dir>', 'Directory of the eval suite')
    .option('--trials <k>', "Trials per task (default: the suite's trials, or 3)")
    .option('--task <ids>', 'Run only these tasks (comma-separated)')
    .option('--output <dir>', 'Directory for results.json, results.md and trial artifacts (default: evals/results/<suite>-<timestamp>)')
    .option('--keep-workspaces', 'Keep the trial workspaces for inspection')
    .option('--json', 'Output the results as JSON')
    .action(async (suiteDir: string, options: { trials?: string; task?: string; output?: string; keepWorkspaces?: boolean; json?: boolean }) => {
      try {
        const trials = options.trials === undefined ? undefined : Number(options.trials);
        if (trials !== undefined && (!Number.isInteger(trials) || trials < 1)) {
          throw new Error(`--trials must be a positive integer, not ${options.trials}`);
        }
        const suite = loadEvalSuite(suiteDir, taskIds(options.task));
        const outputDir = path.resolve(options.output ?? path.join('evals', 'results', `${suite.name}-${timestamp()}`));
        const k = trials ?? suite.trials;

        if (!options.json) {
          console.log(chalk.blue.bold(`FABER eval: ${suite.name}`));
          console.log(chalk.gray(`${suite.tasks.length} task(s) × ${k} trial(s), results in ${outputDir}\n`));
        }

        const result = await runEvalSuite(suite, {
          trials,
          outputDir,
          keepWorkspaces: options.keepWorkspaces,
          onTrialStart: (task, trial) => {
            if (!options.json) process.stdout.write(chalk.gray(`  ${task.id} trial ${trial}/${k} … `));
          },
          onTrialEnd: (trialResult) => {
            if (!options.json) console.log(describeTrial(trialResult));
          },
          onWarning: (message) => {
            if (!options.json) console.log(chalk.yellow(`\n  ⚠ ${message}`));
          },
        });

        if (options.json) {
          console.log(JSON.stringify({ status: 'success', data: result }, null, 2));
        } else {
          console.log('\n' + renderResultsMarkdown(result.summary, result.trials));
          if (result.files) console.log(chalk.gray(`Results: ${result.files.markdown}`));
          if (result.workDir) console.log(chalk.gray(`Workspaces: ${result.workDir}`));
        }
        if (result.summary.invariant_violations > 0) process.exit(EXIT_INVARIANT_VIOLATION);
      } catch (error) {
        if (error instanceof EvalSuiteError && !options.json) {
          console.error(chalk.red(error.message));
          process.exit(1);
        }
        fail(error, options.json);
      }
    });

  evalCommand
    .command('check')
    .description("Check each task without running a workflow: its answer key must fail before the change and pass with the task's solution")
    .argument('<suite-dir>', 'Directory of the eval suite')
    .option('--task <ids>', 'Check only these tasks (comma-separated)')
    .option('--json', 'Output the checks as JSON')
    .action((suiteDir: string, options: { task?: string; json?: boolean }) => {
      try {
        const suite = loadEvalSuite(suiteDir, taskIds(options.task));
        const checks = checkEvalSuite(suite);
        const valid = tasksValid(checks);
        if (options.json) {
          console.log(JSON.stringify({ status: valid ? 'success' : 'invalid', data: checks }, null, 2));
        } else {
          console.log(renderChecksMarkdown(suite.name, checks));
          console.log(valid ? chalk.green('Every task is valid.') : chalk.red('Some tasks are invalid: fix their answer keys or solutions.'));
        }
        if (!valid) process.exit(1);
      } catch (error) {
        fail(error, options.json);
      }
    });

  return evalCommand;
}
