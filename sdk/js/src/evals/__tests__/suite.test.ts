/**
 * @fractary/faber - Eval Suite Loader Tests
 */

import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { loadEvalSuite, EvalSuiteError } from '../suite.js';

// ESM-compatible __dirname (this package is "type": "module").
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FIXTURES = path.resolve(__dirname, '../../../../../evals/fixtures');

describe('loadEvalSuite', () => {
  let dir: string;

  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'faber-eval-suite-test-'));
  });

  afterEach(() => {
    fs.rmSync(dir, { recursive: true, force: true });
  });

  function writeTask(id: string, yaml: string): void {
    fs.mkdirSync(path.join(dir, id), { recursive: true });
    fs.writeFileSync(path.join(dir, id, 'task.yaml'), yaml);
  }

  it('loads the fixture suite with its defaults applied', () => {
    const suite = loadEvalSuite(FIXTURES);

    expect(suite).toMatchObject({ name: 'fixtures', trials: 2 });
    expect(suite.tasks.map((t) => t.id)).toEqual(['greet', 'greet-unsolved']);
    const greet = suite.tasks[0];
    expect(greet).toMatchObject({
      repo: { dir: path.join(FIXTURES, 'repos', 'greet') },
      production_branch: 'main',
      work_item: { number: 1, title: 'Add a greet command', labels: ['enhancement'] },
      workflow: 'fixture-solve',
      phases: ['frame', 'architect', 'build', 'evaluate'],
      skip_steps: [],
      budget_usd: 1,
      solution: path.join(FIXTURES, 'greet', 'solution.patch'),
    });
    expect(greet.answer_key).toEqual({
      files: { 'tests/test_greet.sh': path.join(FIXTURES, 'greet', 'answer-key', 'test_greet.sh') },
      commands: ['sh tests/test_greet.sh'],
    });
  });

  it('loads only the requested tasks', () => {
    expect(loadEvalSuite(FIXTURES, ['greet-unsolved']).tasks.map((t) => t.id)).toEqual(['greet-unsolved']);
    expect(() => loadEvalSuite(FIXTURES, ['missing'])).toThrow(/no task missing/);
  });

  it('adds a task\'s skip_steps to the suite\'s and resolves a local git repository', () => {
    fs.writeFileSync(path.join(dir, 'suite.yaml'), 'defaults:\n  workflow: app\n  skip_steps: [frame-codex-sync]\n');
    writeTask('t1', [
      'repo: { git: ../upstream, commit: abc123 }',
      'work_item: { number: 7, title: Fix it }',
      'skip_steps: [build-create-pr]',
      'answer_key: { commands: [npm test] }',
    ].join('\n'));

    const task = loadEvalSuite(dir).tasks[0];
    expect(task).toMatchObject({
      repo: { git: path.join(dir, 'upstream'), commit: 'abc123' },
      workflow: 'app',
      skip_steps: ['frame-codex-sync', 'build-create-pr'],
      work_item: { number: 7, title: 'Fix it', body: '' },
    });
  });

  it('reports every problem in every task at once', () => {
    writeTask('bad', [
      'repo: { git: https://example.com/r.git }',
      'work_item: { title: No number }',
      'phases: [build, release]',
      'answer_key: { commands: [], files: { "../escape.sh": missing.sh } }',
    ].join('\n'));

    let error: unknown;
    try {
      loadEvalSuite(dir);
    } catch (e) {
      error = e;
    }
    expect(error).toBeInstanceOf(EvalSuiteError);
    const problems = (error as EvalSuiteError).problems.join('\n');
    expect(problems).toContain('repo: must set repo.git and repo.commit, or repo.dir');
    expect(problems).toContain('work_item: must set number and title');
    expect(problems).toContain('workflow must be set here or in suite.yaml defaults');
    expect(problems).toContain('release never runs in an eval');
    expect(problems).toContain('answer_key.commands must list at least one command');
    expect(problems).toContain('missing.sh does not exist');
  });

  it('rejects a directory without tasks', () => {
    expect(() => loadEvalSuite(dir)).toThrow(/has no tasks/);
  });
});
