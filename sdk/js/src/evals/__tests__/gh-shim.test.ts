/**
 * @fractary/faber - Eval gh Shim Tests
 */

import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { spawnSync } from 'child_process';
import { installGhShim, readGhLog } from '../gh-shim.js';

describe('gh shim', () => {
  let dir: string;

  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'faber-gh-shim-test-'));
    installGhShim(dir, {
      number: 42,
      title: 'Add a greet command',
      body: 'greet.sh should print a greeting.',
      labels: ['enhancement'],
      comments: [{ author: 'alice', body: 'Use sh, not bash.' }],
    });
  });

  afterEach(() => {
    fs.rmSync(dir, { recursive: true, force: true });
  });

  const gh = (...args: string[]): { status: number | null; stdout: string; stderr: string } =>
    spawnSync(path.join(dir, 'bin', 'gh'), args, { env: { ...process.env, FABER_EVAL_DIR: dir }, encoding: 'utf-8' });

  it('serves the frozen work item, with the fields asked for', () => {
    const view = gh('issue', 'view', '42', '--json', 'title,labels,comments');

    expect(view.status).toBe(0);
    expect(JSON.parse(view.stdout)).toEqual({
      title: 'Add a greet command',
      labels: [{ name: 'enhancement' }],
      comments: [{ author: { login: 'alice' }, body: 'Use sh, not bash.', createdAt: '' }],
    });
  });

  it('keeps comments posted during the run, so later steps read them', () => {
    expect(gh('issue', 'comment', '42', '--body', 'Research done').status).toBe(0);

    const comments = JSON.parse(gh('issue', 'view', '42', '--json', 'comments').stdout).comments as Array<{ body: string }>;
    expect(comments.map((c) => c.body)).toEqual(['Use sh, not bash.', 'Research done']);
  });

  it('refuses other issues, merges and API calls, and logs every call', () => {
    expect(gh('issue', 'view', '7').status).toBe(1);
    const merge = gh('pr', 'merge', '1', '--squash');
    expect(merge.status).toBe(1);
    expect(merge.stderr).toContain('merging is disabled in evals');
    expect(gh('pr', 'create', '--title', 'x', '--body', 'y').stdout).toContain('/pull/1');
    expect(gh('api', 'repos/x/y').status).toBe(1);

    expect(readGhLog(dir).map((call) => `${call.args.slice(0, 2).join(' ')}:${call.outcome}`)).toEqual([
      'issue view:refused',
      'pr merge:refused',
      'pr create:recorded',
      'api repos/x/y:refused',
    ]);
  });
});
