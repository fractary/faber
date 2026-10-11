/**
 * @fractary/faber - Eval Results
 *
 * Summaries over trials and the results table (#272): pass^k per task, and
 * cost per verified success for the suite.
 */

import * as fs from 'fs';
import * as path from 'path';
import { violations } from './invariants.js';
import type { EvalSuiteSummary, EvalTaskCheck, EvalTaskSummary, EvalTrialResult } from './types.js';

function mean(values: number[]): number | undefined {
  return values.length === 0 ? undefined : values.reduce((sum, v) => sum + v, 0) / values.length;
}

function roundUsd(value: number): number {
  return Math.round(value * 1e6) / 1e6;
}

/** Summarize trials per task and for the whole suite, in task order */
export function summarizeTrials(suite: string, trialsPerTask: number, results: EvalTrialResult[]): EvalSuiteSummary {
  const taskIds = [...new Set(results.map((r) => r.task_id))];
  const tasks: EvalTaskSummary[] = taskIds.map((taskId) => {
    const trials = results.filter((r) => r.task_id === taskId);
    const costs = trials.map((r) => r.cost_usd).filter((c): c is number => c !== undefined);
    const meanCost = mean(costs);
    return {
      task_id: taskId,
      trials: trials.length,
      passes: trials.filter((r) => r.passed).length,
      pass_all: trials.length > 0 && trials.every((r) => r.passed),
      ...(meanCost !== undefined && { mean_cost_usd: roundUsd(meanCost) }),
      mean_duration_ms: Math.round(mean(trials.map((r) => r.duration_ms)) ?? 0),
      invariant_violations: trials.reduce((sum, r) => sum + violations(r.invariants).length, 0),
    };
  });

  const costs = results.map((r) => r.cost_usd).filter((c): c is number => c !== undefined);
  const totalCost = costs.length > 0 ? roundUsd(costs.reduce((sum, c) => sum + c, 0)) : undefined;
  const passes = results.filter((r) => r.passed).length;
  return {
    suite,
    trials_per_task: trialsPerTask,
    tasks,
    trials: results.length,
    passes,
    tasks_pass_all: tasks.filter((t) => t.pass_all).length,
    ...(totalCost !== undefined && { total_cost_usd: totalCost }),
    ...(totalCost !== undefined && passes > 0 && { cost_per_verified_success_usd: roundUsd(totalCost / passes) }),
    invariant_violations: tasks.reduce((sum, t) => sum + t.invariant_violations, 0),
  };
}

function usd(value: number | undefined): string {
  return value === undefined ? '—' : `$${value.toFixed(2)}`;
}

function duration(ms: number): string {
  const seconds = Math.round(ms / 1000);
  return seconds < 60 ? `${seconds}s` : `${Math.floor(seconds / 60)}m ${String(seconds % 60).padStart(2, '0')}s`;
}

function percent(part: number, whole: number): string {
  return whole === 0 ? '—' : `${Math.round((100 * part) / whole)}%`;
}

/** The results table, as Markdown */
export function renderResultsMarkdown(summary: EvalSuiteSummary, results: EvalTrialResult[], title?: string): string {
  const k = summary.trials_per_task;
  const lines = [
    `# Eval results: ${summary.suite}`,
    '',
    ...(title ? [title, ''] : []),
    `| Task | Passes | pass^${k} | Mean cost | Mean time | Invariant violations |`,
    '|---|---|---|---|---|---|',
    ...summary.tasks.map((t) =>
      `| ${t.task_id} | ${t.passes}/${t.trials} | ${t.pass_all ? 'yes' : 'no'} | ${usd(t.mean_cost_usd)} | ${duration(t.mean_duration_ms)} | ${t.invariant_violations} |`),
    '',
    `- **pass^${k}:** ${summary.tasks_pass_all} of ${summary.tasks.length} tasks (${percent(summary.tasks_pass_all, summary.tasks.length)})`,
    `- **Trials passed:** ${summary.passes} of ${summary.trials} (${percent(summary.passes, summary.trials)})`,
    `- **Total cost:** ${usd(summary.total_cost_usd)}`,
    `- **Cost per verified success:** ${usd(summary.cost_per_verified_success_usd)}`,
    `- **Invariant violations:** ${summary.invariant_violations}`,
  ];

  const broken = results.flatMap((r) => violations(r.invariants).map((v) => `- ${r.task_id} trial ${r.trial}: ${v.id}${v.detail ? `: ${v.detail}` : ''}`));
  if (broken.length > 0) lines.push('', '## Invariant violations', '', ...broken);

  const failed = results.filter((r) => !r.passed);
  if (failed.length > 0) {
    lines.push('', '## Failed trials', '');
    for (const r of failed) {
      const check = r.grade.checks.find((c) => c.exit_code !== 0);
      const why = r.error ?? (check ? `\`${check.command}\` exited ${check.exit_code}` : 'no answer-key check ran');
      lines.push(`- ${r.task_id} trial ${r.trial} (run ${r.run_status}): ${why}`);
    }
  }
  return lines.join('\n') + '\n';
}

/** The task check table, as Markdown */
export function renderChecksMarkdown(suite: string, checks: EvalTaskCheck[]): string {
  const lines = [
    `# Eval task check: ${suite}`,
    '',
    '| Task | Answer key fails before | Passes with the solution |',
    '|---|---|---|',
    ...checks.map((c) =>
      `| ${c.task_id} | ${c.error ? `error: ${c.error}` : c.fails_before ? 'yes' : 'no (invalid task)'} | ${c.passes_after === undefined ? 'no solution' : c.passes_after ? 'yes' : 'no (invalid task)'} |`),
  ];
  return lines.join('\n') + '\n';
}

/** Whether every checked task is valid: its answer key fails before the change and passes with it */
export function tasksValid(checks: EvalTaskCheck[]): boolean {
  return checks.every((c) => !c.error && c.fails_before && c.passes_after !== false);
}

/** Write `results.json` and `results.md` to a directory */
export function writeResults(outputDir: string, summary: EvalSuiteSummary, results: EvalTrialResult[]): { json: string; markdown: string } {
  fs.mkdirSync(outputDir, { recursive: true });
  const json = path.join(outputDir, 'results.json');
  const markdown = path.join(outputDir, 'results.md');
  fs.writeFileSync(json, JSON.stringify({ summary, trials: results }, null, 2) + '\n');
  fs.writeFileSync(markdown, renderResultsMarkdown(summary, results));
  return { json, markdown };
}
