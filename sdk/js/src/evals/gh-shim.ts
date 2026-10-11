/**
 * @fractary/faber - Eval gh Shim
 *
 * A trial must not touch GitHub: its work item is frozen, and its comments,
 * pull requests and merges must not reach a real repository. Each trial gets
 * this `gh` first on its PATH. It serves the frozen work item, keeps comments
 * posted during the run (later steps read them, as they would on GitHub),
 * records pull request calls, and refuses merges and API calls. Every call is
 * logged for the invariants.
 */

import * as fs from 'fs';
import * as path from 'path';
import type { EvalWorkItem, GhCall } from './types.js';

/** The trial directory files the shim reads and writes */
export const GH_SHIM_FILES = {
  workItem: 'work-item.json',
  log: 'gh-log.jsonl',
} as const;

/** Source of the shim: a dependency-free CommonJS script run by node */
const GH_SHIM_SOURCE = `#!/usr/bin/env node
// FABER eval gh shim (see @fractary/faber evals/gh-shim.ts)
'use strict';
const fs = require('fs');
const path = require('path');

const dir = process.env.FABER_EVAL_DIR;
const args = process.argv.slice(2);
const itemFile = path.join(dir, '${GH_SHIM_FILES.workItem}');

function log(outcome) {
  const entry = { args, outcome, timestamp: new Date().toISOString() };
  fs.appendFileSync(path.join(dir, '${GH_SHIM_FILES.log}'), JSON.stringify(entry) + '\\n');
}
function flag(...names) {
  for (const name of names) {
    const i = args.indexOf(name);
    if (i >= 0 && i + 1 < args.length) return args[i + 1];
    const inline = args.find((a) => a.startsWith(name + '='));
    if (inline) return inline.slice(name.length + 1);
  }
  return undefined;
}
function refuse(message) {
  log('refused');
  process.stderr.write('gh (FABER eval): ' + message + '\\n');
  process.exit(1);
}
function readItem() {
  return JSON.parse(fs.readFileSync(itemFile, 'utf8'));
}
function issueJson(item) {
  return {
    number: item.number,
    title: item.title,
    body: item.body,
    state: 'OPEN',
    url: 'https://github.com/faber-eval/repo/issues/' + item.number,
    labels: (item.labels || []).map((name) => ({ name })),
    comments: (item.comments || []).map((c) => ({
      author: { login: c.author || 'unknown' },
      body: c.body,
      createdAt: c.created_at || '',
    })),
  };
}
function select(object, fields) {
  if (!fields) return object;
  const out = {};
  for (const field of fields.split(',')) out[field.trim()] = object[field.trim()];
  return out;
}

const [group, action, target] = args;
if (group === 'auth' && action === 'status') {
  log('served');
  process.stdout.write('Logged in to github.com (FABER eval shim)\\n');
  process.exit(0);
}
if (group === 'issue') {
  const item = readItem();
  if (target !== undefined && String(item.number) !== String(target).replace(/^#/, '')) {
    log('refused');
    process.stderr.write('gh (FABER eval): issue ' + target + ' is not this trial\\'s work item (#' + item.number + ')\\n');
    process.exit(1);
  }
  if (action === 'view') {
    log('served');
    const json = flag('--json');
    if (json !== undefined) {
      process.stdout.write(JSON.stringify(select(issueJson(item), json)) + '\\n');
    } else {
      process.stdout.write(item.title + '\\n\\n' + item.body + '\\n');
    }
    process.exit(0);
  }
  if (action === 'comment') {
    const bodyFile = flag('--body-file', '-F');
    const body = bodyFile ? fs.readFileSync(bodyFile === '-' ? 0 : bodyFile, 'utf8') : flag('--body', '-b');
    if (body === undefined) refuse('issue comment needs --body or --body-file');
    item.comments = item.comments || [];
    item.comments.push({ author: 'faber', body, created_at: new Date().toISOString() });
    fs.writeFileSync(itemFile, JSON.stringify(item, null, 2));
    log('recorded');
    process.stdout.write('https://github.com/faber-eval/repo/issues/' + item.number + '#issuecomment-' + item.comments.length + '\\n');
    process.exit(0);
  }
  if (['edit', 'close', 'reopen', 'develop', 'pin', 'unpin'].includes(action)) {
    log('recorded');
    process.exit(0);
  }
  refuse('issue ' + action + ' is not supported in evals');
}
if (group === 'pr') {
  if (action === 'merge') refuse('merging is disabled in evals');
  if (action === 'create') {
    log('recorded');
    process.stdout.write('https://github.com/faber-eval/repo/pull/1\\n');
    process.exit(0);
  }
  if (action === 'list') {
    log('recorded');
    if (flag('--json') !== undefined) process.stdout.write('[]\\n');
    process.exit(0);
  }
  if (['view', 'checks', 'status', 'diff', 'comment', 'edit', 'review', 'ready'].includes(action)) {
    log('recorded');
    if (action === 'view' && flag('--json') !== undefined) process.stdout.write('{}\\n');
    process.exit(0);
  }
  refuse('pr ' + action + ' is not supported in evals');
}
refuse((group || '(no command)') + ' is not supported in evals');
`;

/**
 * Install the shim in a trial: `<trialDir>/bin/gh`, plus the frozen work item
 * it serves. Put `<trialDir>/bin` first on PATH and set FABER_EVAL_DIR to the
 * trial directory for the shim to take effect.
 * @returns The directory to put on PATH
 */
export function installGhShim(trialDir: string, workItem: EvalWorkItem): string {
  const binDir = path.join(trialDir, 'bin');
  fs.mkdirSync(binDir, { recursive: true });
  const shim = path.join(binDir, 'gh');
  fs.writeFileSync(shim, GH_SHIM_SOURCE, { mode: 0o755 });
  fs.writeFileSync(path.join(trialDir, GH_SHIM_FILES.workItem), JSON.stringify(workItem, null, 2));
  return binDir;
}

/** The calls the trial's shim recorded, in order */
export function readGhLog(trialDir: string): GhCall[] {
  const file = path.join(trialDir, GH_SHIM_FILES.log);
  if (!fs.existsSync(file)) return [];
  return fs.readFileSync(file, 'utf-8')
    .split('\n')
    .filter((line) => line.trim().length > 0)
    .map((line) => JSON.parse(line) as GhCall);
}
