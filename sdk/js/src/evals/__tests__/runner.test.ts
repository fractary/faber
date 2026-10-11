/**
 * @fractary/faber - Eval Runner Tests
 *
 * End to end on the fixture suite in evals/fixtures: its workflows are shell
 * steps that stand in for an agent, so no API key is needed.
 */

import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { execFileSync } from 'child_process';
import { fileURLToPath } from 'url';
import { loadEvalSuite } from '../suite.js';
import { runEvalSuite, checkEvalSuite } from '../runner.js';
import { violations } from '../invariants.js';
import { ExecutorRegistry } from '../../executors/registry.js';
import { ClaudeAgentExecutor } from '../../executors/providers/claude-agent.js';
import type { ClaudeAgentExecuteOptions } from '../../executors/providers/claude-agent.js';
import type { ExecutionContext } from '../../executors/types.js';

// ESM-compatible __dirname (this package is "type": "module").
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FIXTURES = path.resolve(__dirname, '../../../../../evals/fixtures');

/** The real executor, which runs ! steps, recording the plugins and settings each step's session gets */
class PluginRecordingExecutor extends ClaudeAgentExecutor {
  readonly sessions: Array<{ plugins?: string[]; settings?: string }> = [];

  override execute(...args: Parameters<ClaudeAgentExecutor['execute']>): ReturnType<ClaudeAgentExecutor['execute']> {
    const { plugins, settings } = (args[1] as ExecutionContext & ClaudeAgentExecuteOptions).runtimeConfig ?? {};
    this.sessions.push({ plugins, settings });
    return super.execute(...args);
  }
}

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

  it('runs the setup commands before the run, and does not grade a trial whose setup failed', async () => {
    const suiteDir = suiteWithBuildSteps('needs-setup', [
      { id: 'solve', prompt: '!test -f .setup-done && sh .fixture/solve.sh' },
    ]);
    const taskFile = path.join(suiteDir, 'task', 'task.yaml');
    fs.appendFileSync(taskFile, '\nsetup: ["touch .setup-done"]\n');
    const setUp = await runEvalSuite(loadEvalSuite(suiteDir));
    expect(setUp.trials[0]).toMatchObject({ passed: true, run_status: 'completed' });

    fs.writeFileSync(taskFile, fs.readFileSync(taskFile, 'utf-8').replace('touch .setup-done', 'echo offline >&2; exit 3'));
    const { trials } = await runEvalSuite(loadEvalSuite(suiteDir));
    expect(trials[0]).toMatchObject({ passed: false, run_status: 'crashed', grade: { passed: false, checks: [] } });
    expect(trials[0].error).toBe('setup command `echo offline >&2; exit 3` exited 3: offline');
    expect(violations(trials[0].invariants).map((v) => v.id)).toEqual(['run_ended']);
  }, 60_000);

  it('loads the suite\'s plugins and settings into every session and takes the workflow from them', async () => {
    const suiteDir = suiteWithBuildSteps('in-repo', [{ id: 'unused', prompt: '!exit 1' }]);
    // The pack under test: a plugin with the workflow, outside the repository
    const pack = path.join(suiteDir, 'packs', 'fixture-pack');
    fs.mkdirSync(path.join(pack, '.fractary', 'faber', 'workflows'), { recursive: true });
    fs.writeFileSync(path.join(pack, '.fractary', 'faber', 'workflows', 'solve.json'), JSON.stringify({
      id: 'solve',
      phases: {
        build: { enabled: true, steps: [{ id: 'solve', name: 'solve', prompt: '!sh .fixture/solve.sh' }] },
        release: { enabled: false, steps: [] },
      },
    }));
    const taskFile = path.join(suiteDir, 'task', 'task.yaml');
    fs.writeFileSync(path.join(suiteDir, 'trial-settings.json'), '{ "permissions": { "allow": ["Bash(sh:*)"] } }');
    fs.writeFileSync(taskFile, fs.readFileSync(taskFile, 'utf-8')
      .replace('workflow: in-repo', 'workflow: fixture-pack@fixture-market:solve\nplugins: [../packs/fixture-pack]\nsettings: ../trial-settings.json'));
    // The pack is a repository with a change that is not committed
    const git = (...args: string[]): string =>
      execFileSync('git', ['-c', 'user.name=t', '-c', 'user.email=t@t.invalid', ...args], { cwd: pack, encoding: 'utf-8' }).trim();
    git('init', '-q');
    git('add', '-A');
    git('commit', '-q', '-m', 'pack');
    fs.writeFileSync(path.join(pack, 'NOTES.md'), 'work in progress\n');

    const agent = new PluginRecordingExecutor();
    const registry = new ExecutorRegistry();
    registry.register('claude-agent', () => agent);
    const { summary, trials } = await runEvalSuite(loadEvalSuite(suiteDir), { registry });

    expect(trials[0]).toMatchObject({ passed: true, run_status: 'completed' });
    expect(agent.sessions).toEqual([{ plugins: [pack], settings: path.join(suiteDir, 'trial-settings.json') }]);
    // The results name the version of the pack they measured
    expect(summary.plugins).toEqual([{ path: pack, commit: git('rev-parse', 'HEAD'), modified: true }]);
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

  it('runs the setup commands before grading, after the change is applied', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'faber-eval-check-test-'));
    try {
      const suiteDir = path.join(dir, 'suite');
      fs.cpSync(FIXTURES, suiteDir, { recursive: true });
      // The answer key needs what setup makes, from the repository as it is then
      const taskFile = path.join(suiteDir, 'greet', 'task.yaml');
      fs.writeFileSync(taskFile, fs.readFileSync(taskFile, 'utf-8')
        .replace('solution: solution.patch', 'solution: solution.patch\nsetup: ["cp greet.sh .greet-at-setup"]')
        .replace('- sh tests/test_greet.sh', '- cmp greet.sh .greet-at-setup && sh tests/test_greet.sh'));

      const [check] = checkEvalSuite(loadEvalSuite(suiteDir, ['greet']));
      expect(check).toMatchObject({ fails_before: true, passes_after: true });
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  }, 60_000);
});
