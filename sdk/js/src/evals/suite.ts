/**
 * @fractary/faber - Eval Suite Loader
 *
 * A suite is a directory with an optional `suite.yaml` of defaults and one
 * subdirectory per task, each with a `task.yaml`:
 *
 * ```
 * <suite>/
 *   suite.yaml            name, trials, defaults for every task
 *   <task-id>/
 *     task.yaml           the frozen work item and its answer key
 *     answer-key/...      files copied in after the run
 *     solution.patch      the accepted change, for `eval check`
 * ```
 */

import * as fs from 'fs';
import * as path from 'path';
import yaml from 'js-yaml';
import { EVAL_PHASES } from './types.js';
import type { EvalPhase, EvalRepoSource, EvalSuite, EvalTask, EvalWorkItem } from './types.js';

const SUITE_FILE = 'suite.yaml';
const TASK_FILE = 'task.yaml';
const DEFAULT_PHASES: EvalPhase[] = ['frame', 'architect', 'build', 'evaluate'];
const DEFAULT_TRIALS = 3;

/** A suite or task file is missing fields or has invalid ones */
export class EvalSuiteError extends Error {
  constructor(public readonly problems: string[]) {
    super(`Invalid eval suite:\n${problems.map((p) => `  - ${p}`).join('\n')}`);
    this.name = 'EvalSuiteError';
  }
}

type Data = Record<string, unknown>;

function isRecord(value: unknown): value is Data {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function readYaml(file: string, problems: string[]): Data | undefined {
  try {
    const data = yaml.load(fs.readFileSync(file, 'utf-8'));
    if (data === undefined || data === null) return {};
    if (!isRecord(data)) {
      problems.push(`${file}: must be a mapping`);
      return undefined;
    }
    return data;
  } catch (error) {
    problems.push(`${file}: ${error instanceof Error ? error.message : String(error)}`);
    return undefined;
  }
}

function stringList(value: unknown, where: string, problems: string[]): string[] | undefined {
  if (value === undefined) return undefined;
  if (!Array.isArray(value) || value.some((item) => typeof item !== 'string')) {
    problems.push(`${where}: must be a list of strings`);
    return undefined;
  }
  return value as string[];
}

function phaseList(value: unknown, where: string, problems: string[]): EvalPhase[] | undefined {
  const phases = stringList(value, where, problems);
  if (!phases) return undefined;
  const unknown = phases.filter((p) => !(EVAL_PHASES as readonly string[]).includes(p));
  if (unknown.length > 0) {
    problems.push(`${where}: unknown phase ${unknown.join(', ')}`);
    return undefined;
  }
  if (phases.includes('release')) {
    problems.push(`${where}: release never runs in an eval`);
    return undefined;
  }
  return phases as EvalPhase[];
}

function positiveNumber(value: unknown, where: string, problems: string[]): number | undefined {
  if (value === undefined) return undefined;
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) {
    problems.push(`${where}: must be a positive number`);
    return undefined;
  }
  return value;
}

/** Plugin directories, resolved against the directory of the file that lists them */
function pluginDirs(value: unknown, baseDir: string, where: string, problems: string[]): string[] {
  return (stringList(value, where, problems) ?? []).flatMap((dir) => {
    const resolved = path.resolve(baseDir, dir);
    if (!fs.existsSync(resolved) || !fs.statSync(resolved).isDirectory()) {
      problems.push(`${where}: ${resolved} is not a directory`);
      return [];
    }
    return [resolved];
  });
}

/** A Claude settings file, resolved against the directory of the file that names it */
function settingsFile(value: unknown, baseDir: string, where: string, problems: string[]): string | undefined {
  if (value === undefined) return undefined;
  if (typeof value !== 'string' || value.length === 0) {
    problems.push(`${where}: must be the path of a Claude settings file`);
    return undefined;
  }
  const file = path.resolve(baseDir, value);
  if (!fs.existsSync(file)) {
    problems.push(`${where}: ${file} does not exist`);
    return undefined;
  }
  let data: unknown;
  try {
    data = JSON.parse(fs.readFileSync(file, 'utf-8'));
  } catch (error) {
    problems.push(`${where}: ${file} is not valid JSON: ${(error as Error).message}`);
    return undefined;
  }
  if (!isRecord(data)) {
    problems.push(`${where}: ${file} must hold a JSON object`);
    return undefined;
  }
  return file;
}

function repoSource(value: unknown, taskDir: string, where: string, problems: string[]): EvalRepoSource | undefined {
  if (!isRecord(value)) {
    problems.push(`${where}: must set repo.git and repo.commit, or repo.dir`);
    return undefined;
  }
  if (typeof value.dir === 'string') {
    const dir = path.resolve(taskDir, value.dir);
    if (!fs.existsSync(dir) || !fs.statSync(dir).isDirectory()) {
      problems.push(`${where}.dir: ${dir} is not a directory`);
      return undefined;
    }
    return { dir };
  }
  if (typeof value.git === 'string' && typeof value.commit === 'string' && value.commit.length > 0) {
    // A relative git path is a local repository next to the task
    const git = /^[a-z][a-z0-9+.-]*:\/\//i.test(value.git) || value.git.startsWith('git@')
      ? value.git
      : path.resolve(taskDir, value.git);
    return { git, commit: value.commit };
  }
  problems.push(`${where}: must set repo.git and repo.commit, or repo.dir`);
  return undefined;
}

function workItem(value: unknown, where: string, problems: string[]): EvalWorkItem | undefined {
  if (!isRecord(value) || typeof value.number !== 'number' || typeof value.title !== 'string') {
    problems.push(`${where}: must set number and title`);
    return undefined;
  }
  const comments = value.comments;
  if (comments !== undefined && (!Array.isArray(comments) || comments.some((c) => !isRecord(c) || typeof c.body !== 'string'))) {
    problems.push(`${where}.comments: each comment must have a body`);
    return undefined;
  }
  return {
    number: value.number,
    title: value.title,
    body: typeof value.body === 'string' ? value.body : '',
    labels: stringList(value.labels, `${where}.labels`, problems),
    comments: (comments as Data[] | undefined)?.map((c) => ({
      author: typeof c.author === 'string' ? c.author : undefined,
      body: c.body as string,
      created_at: typeof c.created_at === 'string' ? c.created_at : undefined,
    })),
  };
}

/** Suite defaults with paths, resolved once against the suite's directory */
interface SuiteShared {
  /** Added to each task's plugins */
  plugins: string[];
  /** Run before each task's setup */
  setup: string[];
  /** Used unless the task names its own */
  settings?: string;
}

function loadTask(taskDir: string, defaults: Data, shared: SuiteShared, problems: string[]): EvalTask | undefined {
  const file = path.join(taskDir, TASK_FILE);
  const data = readYaml(file, problems);
  if (!data) return undefined;
  const at = (field: string): string => `${file}: ${field}`;
  const before = problems.length;

  const repo = repoSource(data.repo, taskDir, at('repo'), problems);
  const item = workItem(data.work_item, at('work_item'), problems);
  const workflow = data.workflow ?? defaults.workflow;
  if (typeof workflow !== 'string' || workflow.length === 0) {
    problems.push(`${at('workflow')} must be set here or in suite.yaml defaults`);
  }
  const phases = phaseList(data.phases ?? defaults.phases, at('phases'), problems) ?? DEFAULT_PHASES;
  const skipSteps = [
    ...(stringList(defaults.skip_steps, `${SUITE_FILE} defaults.skip_steps`, problems) ?? []),
    ...(stringList(data.skip_steps, at('skip_steps'), problems) ?? []),
  ];
  const plugins = [...shared.plugins, ...pluginDirs(data.plugins, taskDir, at('plugins'), problems)];
  const setup = [...shared.setup, ...(stringList(data.setup, at('setup'), problems) ?? [])];
  const settings = data.settings !== undefined ? settingsFile(data.settings, taskDir, at('settings'), problems) : shared.settings;
  const budget = positiveNumber(data.budget_usd ?? defaults.budget_usd, at('budget_usd'), problems);
  const productionBranch = data.production_branch ?? defaults.production_branch ?? 'main';
  if (typeof productionBranch !== 'string') problems.push(`${at('production_branch')} must be a string`);

  const key = data.answer_key;
  const files: Record<string, string> = {};
  let commands: string[] | undefined;
  let timeout: number | undefined;
  if (!isRecord(key)) {
    problems.push(`${at('answer_key')} must set commands`);
  } else {
    commands = stringList(key.commands, at('answer_key.commands'), problems);
    if (!commands || commands.length === 0) problems.push(`${at('answer_key.commands')} must list at least one command`);
    timeout = positiveNumber(key.timeout_seconds, at('answer_key.timeout_seconds'), problems);
    if (key.files !== undefined && !isRecord(key.files)) {
      problems.push(`${at('answer_key.files')} must map repository paths to files in the task`);
    } else {
      for (const [target, source] of Object.entries(key.files ?? {})) {
        const resolved = typeof source === 'string' ? path.resolve(taskDir, source) : '';
        if (!resolved || !fs.existsSync(resolved)) {
          problems.push(`${at(`answer_key.files.${target}`)}: ${String(source)} does not exist`);
        } else if (path.isAbsolute(target) || target.split(/[\\/]/).includes('..')) {
          problems.push(`${at(`answer_key.files.${target}`)}: must be a path inside the repository`);
        } else {
          files[target] = resolved;
        }
      }
    }
  }

  let solution: string | undefined;
  if (data.solution !== undefined) {
    solution = typeof data.solution === 'string' ? path.resolve(taskDir, data.solution) : undefined;
    if (!solution || !fs.existsSync(solution)) problems.push(`${at('solution')}: ${String(data.solution)} does not exist`);
  }

  if (problems.length > before || !repo || !item || !commands) return undefined;
  return {
    id: path.basename(taskDir),
    dir: taskDir,
    repo,
    production_branch: productionBranch as string,
    work_item: item,
    workflow: workflow as string,
    phases,
    skip_steps: [...new Set(skipSteps)],
    plugins: [...new Set(plugins)],
    setup,
    ...(settings && { settings }),
    answer_key: { files, commands, ...(timeout !== undefined && { timeout_seconds: timeout }) },
    ...(budget !== undefined && { budget_usd: budget }),
    ...(solution && { solution }),
  };
}

/**
 * Load a suite and its tasks. Every problem in every file is reported at once.
 * @param suiteDir - The suite's directory
 * @param taskIds - Load only these tasks
 * @throws EvalSuiteError when a file is invalid or a requested task does not exist
 */
export function loadEvalSuite(suiteDir: string, taskIds?: string[]): EvalSuite {
  const dir = path.resolve(suiteDir);
  const problems: string[] = [];
  if (!fs.existsSync(dir) || !fs.statSync(dir).isDirectory()) {
    throw new EvalSuiteError([`${dir} is not a directory`]);
  }

  const suiteFile = path.join(dir, SUITE_FILE);
  const suiteData = fs.existsSync(suiteFile) ? readYaml(suiteFile, problems) ?? {} : {};
  const defaults = isRecord(suiteData.defaults) ? suiteData.defaults : {};
  const trials = suiteData.trials === undefined
    ? DEFAULT_TRIALS
    : Number.isInteger(suiteData.trials) && (suiteData.trials as number) > 0
      ? (suiteData.trials as number)
      : (problems.push(`${suiteFile}: trials must be a positive integer`), DEFAULT_TRIALS);

  const taskDirs = fs.readdirSync(dir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && fs.existsSync(path.join(dir, entry.name, TASK_FILE)))
    .map((entry) => entry.name)
    .sort();
  const missing = (taskIds ?? []).filter((id) => !taskDirs.includes(id));
  if (missing.length > 0) problems.push(`no task ${missing.join(', ')} in ${dir}`);
  const selected = taskIds && taskIds.length > 0 ? taskDirs.filter((id) => taskIds.includes(id)) : taskDirs;
  if (selected.length === 0 && missing.length === 0) problems.push(`${dir} has no tasks (subdirectories with ${TASK_FILE})`);

  // Paths in suite.yaml are relative to the suite; a task's, to the task
  const shared: SuiteShared = {
    plugins: pluginDirs(defaults.plugins, dir, `${suiteFile}: defaults.plugins`, problems),
    setup: stringList(defaults.setup, `${suiteFile}: defaults.setup`, problems) ?? [],
    settings: settingsFile(defaults.settings, dir, `${suiteFile}: defaults.settings`, problems),
  };
  const tasks = selected
    .map((id) => loadTask(path.join(dir, id), defaults, shared, problems))
    .filter((task): task is EvalTask => task !== undefined);

  if (problems.length > 0) throw new EvalSuiteError(problems);
  return {
    name: typeof suiteData.name === 'string' ? suiteData.name : path.basename(dir),
    dir,
    trials,
    tasks,
  };
}
