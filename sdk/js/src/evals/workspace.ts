/**
 * @fractary/faber - Eval Trial Workspace
 *
 * Each trial runs in a directory of its own:
 *
 * ```
 * <trial>/
 *   repo/            the repository at the commit before the change, on a work branch
 *   remote.git/      its origin: a local bare repository, so pushes stay local
 *   bin/gh           the gh shim (gh-shim.ts)
 *   work-item.json   the frozen work item the shim serves
 *   gh-log.jsonl     every gh call
 * ```
 */

import * as fs from 'fs';
import * as path from 'path';
import { execFileSync, spawnSync } from 'child_process';
import type { ResolvedWorkflow } from '../workflow/resolver.js';
import { FABER_RUNS_DIR } from '../paths.js';
import { installGhShim } from './gh-shim.js';
import type { EvalCheckResult, EvalGrade, EvalPluginVersion, EvalTask } from './types.js';

/** A prepared trial directory */
export interface EvalTrialWorkspace {
  /** The trial directory */
  dir: string;
  /** The repository's working tree */
  repoDir: string;
  /** The bare repository that is the repository's origin */
  remoteDir: string;
  /** The directory with the gh shim, first on the trial's PATH */
  binDir: string;
  /** The work branch the run starts on */
  branch: string;
  /** The production branch's commit in the remote before the run, if the branch exists */
  productionBefore?: string;
}

/** Commit identity for the trial's repositories */
const GIT_IDENTITY = ['-c', 'user.name=FABER eval', '-c', 'user.email=eval@faber.invalid'];
/** Most of a command's output kept for the report */
const OUTPUT_TAIL = 2000;
/** Longest a setup command, or an answer-key command by default, may run */
const COMMAND_TIMEOUT_SECONDS = 600;

function git(cwd: string, args: string[]): string {
  try {
    return execFileSync('git', [...GIT_IDENTITY, ...args], { cwd, encoding: 'utf-8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
  } catch (error) {
    const stderr = (error as { stderr?: string }).stderr?.trim();
    throw new Error(`git ${args.join(' ')} failed in ${cwd}${stderr ? `: ${stderr}` : ''}`);
  }
}

/** The commit a branch points at in a repository, or undefined if it does not exist */
export function branchCommit(repoDir: string, branch: string): string | undefined {
  const result = spawnSync('git', ['rev-parse', '--verify', '--quiet', `refs/heads/${branch}`], { cwd: repoDir, encoding: 'utf-8' });
  return result.status === 0 ? result.stdout.trim() : undefined;
}

/**
 * Clone a task's repository once, for its trials to clone from locally.
 * A `dir` source becomes a new repository with one commit on the production branch.
 * @returns Path of the cached repository
 */
export function cacheTaskRepo(task: EvalTask, cacheDir: string): string {
  const cached = path.join(cacheDir, `${task.id}.git`);
  if (fs.existsSync(cached)) return cached;
  fs.mkdirSync(cacheDir, { recursive: true });
  if ('dir' in task.repo) {
    const work = path.join(cacheDir, `${task.id}-src`);
    fs.cpSync(task.repo.dir, work, { recursive: true });
    git(work, ['init', '-q', '-b', task.production_branch]);
    git(work, ['add', '-A']);
    git(work, ['commit', '-q', '--allow-empty', '-m', `Eval base for ${task.id}`]);
    git(cacheDir, ['clone', '-q', '--bare', work, cached]);
    fs.rmSync(work, { recursive: true, force: true });
  } else {
    git(cacheDir, ['clone', '-q', '--bare', task.repo.git, cached]);
    // The production branch starts at the commit before the change
    git(cached, ['branch', '-f', task.production_branch, task.repo.commit]);
  }
  return cached;
}

/**
 * Prepare a trial: a fresh clone at the commit before the change, a local bare
 * origin, a work branch, and the gh shim with the frozen work item.
 */
export function prepareTrial(task: EvalTask, trialDir: string, cachedRepo: string): EvalTrialWorkspace {
  fs.mkdirSync(trialDir, { recursive: true });
  const repoDir = path.join(trialDir, 'repo');
  const remoteDir = path.join(trialDir, 'remote.git');

  // The origin holds only the production branch at the commit before the change
  git(trialDir, ['clone', '-q', '--bare', '--single-branch', '--branch', task.production_branch, cachedRepo, remoteDir]);
  git(trialDir, ['clone', '-q', remoteDir, repoDir]);
  const branch = `feat/${task.work_item.number}`;
  git(repoDir, ['checkout', '-q', '-b', branch]);
  git(repoDir, ['config', 'user.name', 'FABER eval']);
  git(repoDir, ['config', 'user.email', 'eval@faber.invalid']);
  // Run state lives inside the repository; keep it out of the run's commits
  fs.appendFileSync(path.join(repoDir, '.git', 'info', 'exclude'), `\n${FABER_RUNS_DIR}/\n`);

  const binDir = installGhShim(trialDir, task.work_item);
  return {
    dir: trialDir,
    repoDir,
    remoteDir,
    binDir,
    branch,
    productionBefore: branchCommit(remoteDir, task.production_branch),
  };
}

/** A resolved workflow without the given steps, and the step IDs it did not contain */
export function withoutSteps(workflow: ResolvedWorkflow, stepIds: string[]): { workflow: ResolvedWorkflow; unknown: string[] } {
  const skip = new Set(stepIds);
  const found = new Set<string>();
  const phases = Object.fromEntries(
    Object.entries(workflow.phases).map(([name, phase]) => [
      name,
      {
        ...phase,
        steps: phase.steps.filter((step) => {
          if (!skip.has(step.id)) return true;
          found.add(step.id);
          return false;
        }),
      },
    ]),
  ) as ResolvedWorkflow['phases'];
  return { workflow: { ...workflow, phases }, unknown: stepIds.filter((id) => !found.has(id)) };
}

/**
 * Write the trial's plan where `workflow-execute` keeps plans, built offline
 * from the resolved workflow: `workflow-plan` calls GitHub and the Anthropic API.
 */
export function writeTrialPlan(
  ws: EvalTrialWorkspace,
  task: EvalTask,
  trial: number,
  workflow: ResolvedWorkflow,
): { planId: string; planPath: string; planDir: string } {
  const planId = `eval-${task.id}-${trial}`;
  const planDir = path.join(ws.repoDir, ...FABER_RUNS_DIR.split('/'), planId);
  fs.mkdirSync(planDir, { recursive: true });
  const workId = String(task.work_item.number);
  const plan = {
    id: planId,
    source: { work_id: workId, eval_task: task.id, trial },
    items: [{
      work_id: workId,
      issue: { number: task.work_item.number, title: task.work_item.title },
      branch: { name: ws.branch },
    }],
    workflow,
  };
  const planPath = path.join(planDir, 'plan.json');
  fs.writeFileSync(planPath, JSON.stringify(plan, null, 2) + '\n');
  return { planId, planPath, planDir };
}

/** Environment for a trial: the shim first on PATH, and no GitHub credentials */
export function trialEnv(ws: EvalTrialWorkspace, base: NodeJS.ProcessEnv = process.env): NodeJS.ProcessEnv {
  const env: NodeJS.ProcessEnv = {
    ...base,
    PATH: `${ws.binDir}${path.delimiter}${base.PATH ?? ''}`,
    FABER_EVAL_DIR: ws.dir,
  };
  delete env.GH_TOKEN;
  delete env.GITHUB_TOKEN;
  delete env.GH_ENTERPRISE_TOKEN;
  return env;
}

/**
 * Run `fn` with the trial's environment in `process.env`, then restore it.
 * Agent sessions and command steps inherit `process.env`, so trials run one at a time.
 */
export async function withTrialEnv<T>(ws: EvalTrialWorkspace, fn: () => Promise<T>): Promise<T> {
  const saved = { ...process.env };
  const env = trialEnv(ws, saved);
  for (const key of Object.keys(process.env)) {
    if (!(key in env)) delete process.env[key];
  }
  Object.assign(process.env, env);
  try {
    return await fn();
  } finally {
    for (const key of Object.keys(process.env)) {
      if (!(key in saved)) delete process.env[key];
    }
    Object.assign(process.env, saved);
  }
}

/** Run a shell command in the trial's repository, with the trial's environment */
function runCommand(command: string, ws: EvalTrialWorkspace, timeoutSeconds: number): EvalCheckResult {
  const result = spawnSync('bash', ['-c', command], {
    cwd: ws.repoDir,
    env: trialEnv(ws),
    encoding: 'utf-8',
    timeout: timeoutSeconds * 1000,
    maxBuffer: 64 * 1024 * 1024,
  });
  const output = `${result.stdout ?? ''}${result.stderr ?? ''}${result.error ? `\n${result.error.message}` : ''}`;
  return {
    command,
    // A command killed by the timeout has no exit code
    exit_code: result.status ?? 124,
    output: output.length > OUTPUT_TAIL ? output.slice(-OUTPUT_TAIL) : output,
  };
}

/**
 * Run the task's setup commands in the trial's repository, in order, such as
 * installing its dependencies. Each may take up to 600 seconds.
 * @throws Error naming the first command that failed, with the end of its output
 */
export function runSetup(task: EvalTask, ws: EvalTrialWorkspace): void {
  for (const command of task.setup) {
    const result = runCommand(command, ws, COMMAND_TIMEOUT_SECONDS);
    if (result.exit_code !== 0) {
      throw new Error(`setup command \`${command}\` exited ${result.exit_code}: ${result.output.trim().slice(-500)}`);
    }
  }
}

/**
 * Grade the working tree against the task's answer key: copy its files in,
 * then run its commands. The trial passes when every command exits 0.
 */
export function gradeTrial(task: EvalTask, ws: EvalTrialWorkspace): EvalGrade {
  for (const [target, source] of Object.entries(task.answer_key.files)) {
    const destination = path.join(ws.repoDir, target);
    fs.mkdirSync(path.dirname(destination), { recursive: true });
    fs.copyFileSync(source, destination);
  }
  const timeoutSeconds = task.answer_key.timeout_seconds ?? COMMAND_TIMEOUT_SECONDS;
  const checks = task.answer_key.commands.map((command) => runCommand(command, ws, timeoutSeconds));
  return { passed: checks.every((check) => check.exit_code === 0), checks };
}

/** Which version of a plugin a run loads: the commit of its repository, and whether it has uncommitted changes */
export function pluginVersion(dir: string): EvalPluginVersion {
  const head = spawnSync('git', ['rev-parse', 'HEAD'], { cwd: dir, encoding: 'utf-8' });
  if (head.status !== 0) return { path: dir };
  const status = spawnSync('git', ['status', '--porcelain', '--', '.'], { cwd: dir, encoding: 'utf-8' });
  return { path: dir, commit: head.stdout.trim(), ...(status.stdout.trim().length > 0 && { modified: true }) };
}

/** Apply a patch to the trial's working tree, for checking a task's answer key */
export function applyPatch(ws: EvalTrialWorkspace, patchFile: string): void {
  git(ws.repoDir, ['apply', '--whitespace=nowarn', patchFile]);
}
