/**
 * @fractary/faber - Eval Results Tests
 */

import { summarizeTrials, renderResultsMarkdown, renderChecksMarkdown, tasksValid } from '../results.js';
import type { EvalInvariant, EvalTrialResult } from '../types.js';

const OK: EvalInvariant[] = [{ id: 'run_ended', ok: true }, { id: 'within_budget', ok: null, detail: 'no budget set' }];

function trial(task: string, n: number, passed: boolean, cost?: number, invariants: EvalInvariant[] = OK): EvalTrialResult {
  return {
    task_id: task,
    trial: n,
    passed,
    run_status: passed ? 'completed' : 'failed',
    ...(cost !== undefined && { cost_usd: cost }),
    duration_ms: 60_000,
    grade: { passed, checks: [{ command: 'npm test', exit_code: passed ? 0 : 1, output: '' }] },
    invariants,
    gh_calls: [],
  };
}

describe('summarizeTrials', () => {
  it('reports pass^k per task and cost per verified success for the suite', () => {
    const summary = summarizeTrials('pilot', 3, [
      trial('a', 1, true, 1.0), trial('a', 2, true, 2.0), trial('a', 3, true, 3.0),
      trial('b', 1, true, 1.5), trial('b', 2, false, 0.5),
      trial('b', 3, false, 1.0, [{ id: 'no_pr_merge', ok: false, detail: '1 merge attempt' }]),
    ]);

    expect(summary.tasks).toEqual([
      { task_id: 'a', trials: 3, passes: 3, pass_all: true, mean_cost_usd: 2, mean_duration_ms: 60_000, invariant_violations: 0 },
      { task_id: 'b', trials: 3, passes: 1, pass_all: false, mean_cost_usd: 1, mean_duration_ms: 60_000, invariant_violations: 1 },
    ]);
    expect(summary).toMatchObject({
      trials: 6,
      passes: 4,
      tasks_pass_all: 1,
      total_cost_usd: 9,
      // Every trial's cost counts, the failed ones too
      cost_per_verified_success_usd: 2.25,
      invariant_violations: 1,
    });
  });

  it('reports no cost when no trial reported one, and no cost per success when nothing passed', () => {
    expect(summarizeTrials('s', 1, [trial('a', 1, true)])).not.toHaveProperty('total_cost_usd');
    const failing = summarizeTrials('s', 1, [trial('a', 1, false, 2)]);
    expect(failing.total_cost_usd).toBe(2);
    expect(failing).not.toHaveProperty('cost_per_verified_success_usd');
  });
});

describe('renderResultsMarkdown', () => {
  it('renders the table, the totals, violations and failed trials', () => {
    const trials = [
      trial('a', 1, true, 1.25),
      trial('a', 2, false, 0.75, [{ id: 'production_branch_untouched', ok: false, detail: 'the run moved main' }]),
    ];
    const markdown = renderResultsMarkdown(summarizeTrials('pilot', 2, trials), trials);

    expect(markdown).toContain('| Task | Passes | pass^2 | Mean cost | Mean time | Invariant violations |');
    expect(markdown).toContain('| a | 1/2 | no | $1.00 | 1m 00s | 1 |');
    expect(markdown).toContain('- **Cost per verified success:** $2.00');
    expect(markdown).toContain('- a trial 2: production_branch_untouched: the run moved main');
    expect(markdown).toContain('- a trial 2 (run failed): `npm test` exited 1');
  });

  it('names the version of each plugin the trials loaded', () => {
    const trials = [trial('a', 1, true, 1)];
    const markdown = renderResultsMarkdown({
      ...summarizeTrials('pilot', 1, trials),
      plugins: [
        { path: '/src/faber-code/plugins/faber-code', commit: 'fe71efd0123456789abcdef0123456789abcdef0' },
        { path: '/src/extra', commit: '0123456789abcdef0123456789abcdef01234567', modified: true },
        { path: '/tmp/pack' },
      ],
    }, trials);

    expect(markdown).toContain('- **Plugin:** `/src/faber-code/plugins/faber-code` at fe71efd01234\n');
    expect(markdown).toContain('- **Plugin:** `/src/extra` at 0123456789ab, with uncommitted changes');
    expect(markdown).toContain('- **Plugin:** `/tmp/pack`, not in a git repository');
  });
});

describe('task checks', () => {
  it('accepts a task whose answer key fails before the change and passes after it', () => {
    const pass = { passed: true, checks: [] };
    const fail = { passed: false, checks: [] };
    const valid = { task_id: 'a', fails_before: true, passes_after: true, before: fail, after: pass };
    const noSolution = { task_id: 'b', fails_before: true, before: fail };
    const weak = { task_id: 'c', fails_before: false, before: pass };

    expect(tasksValid([valid, noSolution])).toBe(true);
    expect(tasksValid([valid, weak])).toBe(false);
    expect(renderChecksMarkdown('s', [valid, weak])).toContain('| c | no (invalid task) | no solution |');
  });
});
