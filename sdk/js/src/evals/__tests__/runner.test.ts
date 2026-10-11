/**
 * @fractary/faber - Eval Runner Tests
 *
 * End to end on the fixture suite in evals/fixtures: its workflows are shell
 * steps that stand in for an agent, so no API key is needed.
 */

import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { loadEvalSuite } from '../suite.js';
import { runEvalSuite, checkEvalSuite } from '../runner.js';
import { violations } from '../invariants.js';

// ESM-compatible __dirname (this package is "type": "module").
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FIXTURES = path.resolve(__dirname, '../../../../../evals/fixtures');

/** gh calls as `<group> <action>:<outcome>` */
function ghSummary(calls: Array<{ args: string[]; outcome: string }>): string[] {
  return calls.map((call) => `${call.args[0]} ${call.args[1]}:${call.outcome}`);
}

describe('runEvalSuite', () => {
  let dir: string;

  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'faber-eval-runner-test-'));
  });

  afterEach(() => {
    fs.rmSync(dir, { recursive: true, force: true });
  });

  /** A one-task suite on the fixture repository, with the given workflow steps for build */
  function suiteWithBuildSteps(workflowId: string, buildSteps: Array<{ id: string; prompt: string }>): string {
    const suiteDir = path.join(dir, 'suite');
    const repoDir = path.join(suiteDir, 'repos', 'greet');
    fs.cpSync(path.join(FIXTURES, 'repos', 'greet'), repoDir, { recursive: true });
    fs.writeFileSync(path.join(repoDir, '.fractary', 'faber', 'workflows', `${workflowId}.json`), JSON.stringify({
      id: workflowId,
      phases: {
        frame: { enabled: false, steps: [] },
        architect: { enabled: false, steps: [] },
        build: { enabled: true, steps: buildSteps.map((s) => ({ ...s, name: s.id })) },
        evaluate: { enabled: false, steps: [] },
        release: { enabled: false, steps: [] },
      },
    }));
    fs.mkdirSync(path.join(suiteDir, 'task'), { recursive: true });
    fs.copyFileSync(path.join(FIXTURES, 'greet', 'answer-key', 'test_greet.sh'), path.join(suiteDir, 'task', 'test_greet.sh'));
    fs.writeFileSync(path.join(suiteDir, 'suite.yaml'), 'trials: 1\n');
    fs.writeFileSync(path.join(suiteDir, 'task', 'task.yaml'), [
      'repo: { dir: ../repos/greet }',
      'work_item: { number: 1, title: Add a greet command }',
      `workflow: ${workflowId}`,
      'answer_key:',
      '  files: { tests/test_greet.sh: test_greet.sh }',
      '  commands: [sh tests/test_greet.sh]',
    ].join('\n'));
    return suiteDir;
  }

  it('runs each task k times in clean trials and grades them against the answer key', async () => {
    const outputDir = path.join(dir, 'results');
    const { summary, trials, files } = await runEvalSuite(loadEvalSuite(FIXTURES), { outputDir });

    expect(summary.tasks).toEqual([
      expect.objectContaining({ task_id: 'greet', trials: 2, passes: 2, pass_all: true, invariant_violations: 0 }),
      expect.objectContaining({ task_id: 'greet-unsolved', trials: 2, passes: 0, pass_all: false, invariant_violations: 0 }),
    ]);
    expect(summary).toMatchObject({ trials: 4, passes: 2, tasks_pass_all: 1, invariant_violations: 0 });

    const [solved, , unsolved] = trials;
    // Release never runs in an eval, so a workflow with an enabled Release phase ends paused
    expect(solved).toMatchObject({ task_id: 'greet', trial: 1, passed: true, run_status: 'paused' });
    expect(violations(solved.invariants)).toEqual([]);
    // The frozen work item was served and the comment recorded; Release never ran, so nothing merged
    expect(ghSummary(solved.gh_calls)).toEqual(['issue view:served', 'issue comment:recorded']);
    expect(unsolved).toMatchObject({ task_id: 'greet-unsolved', passed: false, run_status: 'completed' });
    expect(unsolved.grade.checks[0]).toMatchObject({ command: 'sh tests/test_greet.sh', exit_code: 1 });

    expect(fs.readFileSync(files?.markdown ?? '', 'utf-8')).toContain('| greet | 2/2 | yes |');
    const artifacts = solved.artifacts_dir ?? '';
    expect(fs.existsSync(path.join(artifacts, 'state.json'))).toBe(true);
    expect(fs.existsSync(path.join(artifacts, 'gh-log.jsonl'))).toBe(true);
  }, 120_000);

  it('flags a trial that tries to merge or moves the production branch', async () => {
    const suite = loadEvalSuite(suiteWithBuildSteps('reckless', [
      { id: 'solve', prompt: '!sh .fixture/solve.sh' },
      { id: 'merge', prompt: '!gh pr merge 1 --squash || true' },
      { id: 'push-main', prompt: '!git add -A && git commit -q -m solve && git push -q origin HEAD:main' },
    ]));
    const { trials } = await runEvalSuite(suite);

    // The answer key passes, but the trial broke two invariants
    expect(trials[0].passed).toBe(true);
    expect(violations(trials[0].invariants).map((v) => v.id)).toEqual(['no_pr_merge', 'production_branch_untouched']);
    expect(ghSummary(trials[0].gh_calls)).toEqual(['pr merge:refused']);
  }, 60_000);

  it('fails a trial whose workflow cannot run, and says why', async () => {
    const suiteDir = suiteWithBuildSteps('exists', [{ id: 'solve', prompt: '!sh .fixture/solve.sh' }]);
    const taskFile = path.join(suiteDir, 'task', 'task.yaml');
    fs.writeFileSync(taskFile, fs.readFileSync(taskFile, 'utf-8').replace('workflow: exists', 'workflow: missing'));

    const { trials } = await runEvalSuite(loadEvalSuite(suiteDir));
    expect(trials[0]).toMatchObject({ passed: false, run_status: 'crashed' });
    expect(trials[0].error).toContain('missing');
    expect(violations(trials[0].invariants).map((v) => v.id)).toEqual(['run_ended']);
  }, 60_000);
});

describe('checkEvalSuite', () => {
  it('confirms each answer key fails before the change and passes with it', () => {
    const checks = checkEvalSuite(loadEvalSuite(FIXTURES));

    expect(checks).toEqual([
      expect.objectContaining({ task_id: 'greet', fails_before: true, passes_after: true }),
      expect.objectContaining({ task_id: 'greet-unsolved', fails_before: true, passes_after: true }),
    ]);
  }, 60_000);
});
