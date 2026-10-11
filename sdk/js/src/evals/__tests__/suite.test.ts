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

  it('adds a task\'s plugins and setup to the suite\'s, each path relative to the file that lists it', () => {
    fs.mkdirSync(path.join(dir, 'packs', 'faber-code'), { recursive: true });
    fs.mkdirSync(path.join(dir, 't1', 'extra'), { recursive: true });
    fs.writeFileSync(path.join(dir, 'trial-settings.json'), '{ "permissions": { "allow": ["Bash(npm:*)"] } }');
    fs.writeFileSync(path.join(dir, 't1', 'settings.json'), '{}');
    fs.writeFileSync(path.join(dir, 'suite.yaml'), [
      'defaults:',
      '  workflow: faber-code@fractary-faber-code:default',
      '  plugins: [packs/faber-code]',
      '  setup: [npm ci]',
      '  settings: trial-settings.json',
    ].join('\n'));
    writeTask('t1', [
      'repo: { dir: extra }',
      'work_item: { number: 7, title: Fix it }',
      'plugins: [extra]',
      'setup: [npm run build]',
      'settings: settings.json',
      'answer_key: { commands: [npm test] }',
    ].join('\n'));
    writeTask('t2', [
      'repo: { dir: ../t1/extra }',
      'work_item: { number: 8, title: Fix that }',
      'answer_key: { commands: [npm test] }',
    ].join('\n'));

    const [t1, t2] = loadEvalSuite(dir).tasks;
    expect(t1.plugins).toEqual([path.join(dir, 'packs', 'faber-code'), path.join(dir, 't1', 'extra')]);
    expect(t1.setup).toEqual(['npm ci', 'npm run build']);
    // A task's settings file replaces the suite's
    expect(t1.settings).toBe(path.join(dir, 't1', 'settings.json'));
    expect(t2).toMatchObject({
      plugins: [path.join(dir, 'packs', 'faber-code')],
      setup: ['npm ci'],
      settings: path.join(dir, 'trial-settings.json'),
    });
  });

  it('rejects a settings file that is missing or not a JSON object', () => {
    fs.writeFileSync(path.join(dir, 'suite.yaml'), 'defaults:\n  workflow: app\n  settings: missing.json\n');
    writeTask('t1', 'repo: { dir: . }\nwork_item: { number: 1, title: T }\nsettings: list.json\nanswer_key: { commands: [echo ok] }\n');
    fs.writeFileSync(path.join(dir, 't1', 'list.json'), '["Bash(*)"]');

    let error: unknown;
    try {
      loadEvalSuite(dir);
    } catch (e) {
      error = e;
    }
    const problems = (error as EvalSuiteError).problems.join('\n');
    expect(problems).toContain(`defaults.settings: ${path.join(dir, 'missing.json')} does not exist`);
    expect(problems).toContain(`settings: ${path.join(dir, 't1', 'list.json')} must hold a JSON object`);
  });

  it('reports a plugin directory that does not exist once, not for every task', () => {
    fs.writeFileSync(path.join(dir, 'suite.yaml'), 'defaults:\n  workflow: app\n  plugins: [missing-pack]\n');
    for (const id of ['t1', 't2']) {
      writeTask(id, 'repo: { dir: . }\nwork_item: { number: 1, title: T }\nanswer_key: { commands: [echo ok] }\n');
    }

    let error: unknown;
    try {
      loadEvalSuite(dir);
    } catch (e) {
      error = e;
    }
    expect((error as EvalSuiteError).problems).toEqual([
      `${path.join(dir, 'suite.yaml')}: defaults.plugins: ${path.join(dir, 'missing-pack')} is not a directory`,
    ]);
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
