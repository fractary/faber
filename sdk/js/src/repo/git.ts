/**
 * @fractary/faber - Git CLI Wrapper
 *
 * Low-level Git operations using the git CLI.
 */

import { execSync, ExecSyncOptions } from 'child_process';
import {
  GitStatus,
  Commit,
  CommitOptions,
  Branch,
  Tag,
  Worktree,
} from '../types';
import {
  CommandExecutionError,
} from '../errors';
import { findProjectRoot } from '../config';

/**
 * Execute a git command
 */
function git(args: string, cwd?: string): string {
  const execOptions: ExecSyncOptions = {
    encoding: 'utf-8',
    cwd: cwd || findProjectRoot(),
    maxBuffer: 10 * 1024 * 1024,
  };

  try {
    const result = execSync(`git ${args}`, execOptions);
    return (typeof result === 'string' ? result : result.toString()).trim();
  } catch (error: unknown) {
    const err = error as { status?: number; stderr?: Buffer | string; stdout?: Buffer | string };
    const exitCode = err.status || 1;
    const stderr = err.stderr?.toString() || '';
    throw new CommandExecutionError(`git ${args}`, exitCode, stderr);
  }
}

/**
 * Git CLI wrapper class
 */
export class Git {
  private cwd: string;

  constructor(cwd?: string) {
    this.cwd = cwd || findProjectRoot();
  }

  /**
   * Execute a raw git command
   */
  exec(args: string): string {
    return git(args, this.cwd);
  }

  // =========================================================================
  // STATUS & INFO
  // =========================================================================

  /**
   * Get repository status
   */
  getStatus(): GitStatus {
    const branch = this.getCurrentBranch();
    const tracking = this.getTrackingInfo();
    const staged = this.getStagedFiles();
    const modified = this.getModifiedFiles();
    const untracked = this.getUntrackedFiles();
    const conflicts = this.getConflictFiles();

    return {
      branch,
      ahead: tracking.ahead,
      behind: tracking.behind,
      staged,
      modified,
      untracked,
      conflicts,
    };
  }

  /**
   * Get current branch name
   */
  getCurrentBranch(): string {
    return git('rev-parse --abbrev-ref HEAD', this.cwd);
  }

  /**
   * Get tracking info (ahead/behind)
   */
  private getTrackingInfo(): { ahead: number; behind: number } {
    try {
      const result = git('rev-list --left-right --count HEAD...@{upstream}', this.cwd);
      const [ahead, behind] = result.split('\t').map(n => parseInt(n, 10));
      return { ahead: ahead || 0, behind: behind || 0 };
    } catch {
      return { ahead: 0, behind: 0 };
    }
  }

  /**
   * Get staged files
   */
  private getStagedFiles(): string[] {
    try {
      const result = git('diff --cached --name-only', this.cwd);
      return result ? result.split('\n').filter(f => f) : [];
    } catch {
      return [];
    }
  }

  /**
   * Get modified files
   */
  private getModifiedFiles(): string[] {
    try {
      const result = git('diff --name-only', this.cwd);
      return result ? result.split('\n').filter(f => f) : [];
    } catch {
      return [];
    }
  }

  /**
   * Get untracked files
   */
  private getUntrackedFiles(): string[] {
    try {
      const result = git('ls-files --others --exclude-standard', this.cwd);
      return result ? result.split('\n').filter(f => f) : [];
    } catch {
      return [];
    }
  }

  /**
   * Get files with conflicts
   */
  private getConflictFiles(): string[] {
    try {
      const result = git('diff --name-only --diff-filter=U', this.cwd);
      return result ? result.split('\n').filter(f => f) : [];
    } catch {
      return [];
    }
  }

  /**
   * Check if working directory has uncommitted changes
   */
  isDirty(): boolean {
    const status = this.getStatus();
    return status.staged.length > 0 ||
           status.modified.length > 0 ||
           status.conflicts.length > 0;
  }

  /**
   * Check if working directory is clean
   */
  isClean(): boolean {
    return !this.isDirty();
  }

  // =========================================================================
  // BRANCHES
  // =========================================================================

  /**
   * Create a new branch
   */
  createBranch(name: string, baseBranch?: string): void {
    if (baseBranch) {
      git(`checkout -b ${name} ${baseBranch}`, this.cwd);
    } else {
      git(`checkout -b ${name}`, this.cwd);
    }
  }

  /**
   * Switch to a branch
   */
  checkout(branch: string): void {
    git(`checkout ${branch}`, this.cwd);
  }

  /**
   * Delete a branch
   */
  deleteBranch(name: string, force: boolean = false): void {
    const flag = force ? '-D' : '-d';
    git(`branch ${flag} ${name}`, this.cwd);
  }

  /**
   * Delete a remote branch
   */
  deleteRemoteBranch(name: string, remote: string = 'origin'): void {
    git(`push ${remote} --delete ${name}`, this.cwd);
  }

  /**
   * List local branches
   */
  listBranches(): Branch[] {
    const result = git('branch --format="%(refname:short)|%(objectname:short)|%(upstream:short)"', this.cwd);
    if (!result) return [];

    return result.split('\n').filter(l => l).map(line => {
      const [name, sha, upstream] = line.split('|');
      const defaultBranch = this.getDefaultBranch();
      return {
        name,
        sha,
        isDefault: name === defaultBranch,
        isProtected: this.isProtectedBranch(name),
        upstream: upstream || undefined,
      };
    });
  }

  /**
   * Get default branch name
   */
  getDefaultBranch(): string {
    try {
      const result = git('symbolic-ref refs/remotes/origin/HEAD', this.cwd);
      return result.replace('refs/remotes/origin/', '');
    } catch {
      return 'main';
    }
  }

  /**
   * Check if branch is protected (simple heuristic)
   */
  isProtectedBranch(name: string): boolean {
    const protectedNames = ['main', 'master', 'develop', 'production', 'staging'];
    return protectedNames.includes(name);
  }

  /**
   * Check if branch exists
   */
  branchExists(name: string): boolean {
    try {
      git(`rev-parse --verify ${name}`, this.cwd);
      return true;
    } catch {
      return false;
    }
  }

  // =========================================================================
  // COMMITS
  // =========================================================================

  /**
   * Stage files
   */
  stage(patterns: string[]): void {
    git(`add ${patterns.join(' ')}`, this.cwd);
  }

  /**
   * Stage all changes
   */
  stageAll(): void {
    git('add -A', this.cwd);
  }

  /**
   * Unstage files
   */
  unstage(patterns: string[]): void {
    git(`reset HEAD ${patterns.join(' ')}`, this.cwd);
  }

  /**
   * Create a commit
   */
  commit(options: CommitOptions): Commit {
    // Build commit message
    let message = options.message;

    if (options.type) {
      const scope = options.scope ? `(${options.scope})` : '';
      message = `${options.type}${scope}: ${options.message}`;
    }

    if (options.body) {
      message += `\n\n${options.body}`;
    }

    if (options.workId) {
      message += `\n\nWork-Item: ${options.workId}`;
    }

    if (options.breaking) {
      message += '\n\nBREAKING CHANGE: Breaking changes included';
    }

    if (options.coAuthors && options.coAuthors.length > 0) {
      message += '\n\n' + options.coAuthors.map(a => `Co-Authored-By: ${a}`).join('\n');
    }

    // Execute commit
    const args = options.allowEmpty ? '--allow-empty' : '';
    git(`commit ${args} -m "${message.replace(/"/g, '\\"')}"`, this.cwd);

    // Get the commit we just made
    return this.getCommit('HEAD');
  }

  /**
   * Get a commit by ref
   */
  getCommit(ref: string): Commit {
    const format = '%H|%s|%an|%ae|%aI|%P';
    const result = git(`log -1 --format="${format}" ${ref}`, this.cwd);
    const [sha, message, author, authorEmail, date, parents] = result.split('|');

    return {
      sha,
      message,
      author,
      authorEmail,
      date,
      parents: parents ? parents.split(' ') : [],
    };
  }

  /**
   * List commits
   */
  listCommits(options?: { branch?: string; limit?: number; since?: string }): Commit[] {
    const format = '%H|%s|%an|%ae|%aI|%P';
    const args: string[] = [`--format="${format}"`];

    if (options?.limit) {
      args.push(`-n ${options.limit}`);
    }
    if (options?.since) {
      args.push(`--since="${options.since}"`);
    }
    if (options?.branch) {
      args.push(options.branch);
    }

    const result = git(`log ${args.join(' ')}`, this.cwd);
    if (!result) return [];

    return result.split('\n').filter(l => l).map(line => {
      const [sha, message, author, authorEmail, date, parents] = line.split('|');
      return {
        sha,
        message,
        author,
        authorEmail,
        date,
        parents: parents ? parents.split(' ') : [],
      };
    });
  }

  /**
   * Get diff
   */
  getDiff(options?: { staged?: boolean; base?: string; head?: string }): string {
    const args: string[] = [];

    if (options?.staged) {
      args.push('--cached');
    }
    if (options?.base && options?.head) {
      args.push(`${options.base}...${options.head}`);
    } else if (options?.base) {
      args.push(options.base);
    }

    return git(`diff ${args.join(' ')}`, this.cwd);
  }

  // =========================================================================
  // PUSH/PULL
  // =========================================================================

  /**
   * Push to remote
   */
  push(options?: {
    branch?: string;
    remote?: string;
    setUpstream?: boolean;
    force?: boolean;
    forceWithLease?: boolean;
  }): void {
    const args: string[] = [];

    const remote = options?.remote || 'origin';
    const branch = options?.branch || this.getCurrentBranch();

    args.push(remote);
    args.push(branch);

    if (options?.setUpstream) {
      args.unshift('-u');
    }
    if (options?.forceWithLease) {
      args.unshift('--force-with-lease');
    } else if (options?.force) {
      args.unshift('--force');
    }

    git(`push ${args.join(' ')}`, this.cwd);
  }

  /**
   * Pull from remote
   */
  pull(options?: {
    branch?: string;
    remote?: string;
    rebase?: boolean;
  }): void {
    const args: string[] = [];

    if (options?.rebase) {
      args.push('--rebase');
    }

    const remote = options?.remote || 'origin';
    const branch = options?.branch || this.getCurrentBranch();

    git(`pull ${args.join(' ')} ${remote} ${branch}`, this.cwd);
  }

  /**
   * Fetch from remote
   */
  fetch(remote: string = 'origin'): void {
    git(`fetch ${remote}`, this.cwd);
  }

  // =========================================================================
  // TAGS
  // =========================================================================

  /**
   * Create a tag
   */
  createTag(name: string, options?: { message?: string; sha?: string }): void {
    const args: string[] = [];

    if (options?.message) {
      args.push(`-a -m "${options.message.replace(/"/g, '\\"')}"`);
    }

    args.push(name);

    if (options?.sha) {
      args.push(options.sha);
    }

    git(`tag ${args.join(' ')}`, this.cwd);
  }

  /**
   * Delete a tag
   */
  deleteTag(name: string): void {
    git(`tag -d ${name}`, this.cwd);
  }

  /**
   * Push a tag
   */
  pushTag(name: string, remote: string = 'origin'): void {
    git(`push ${remote} ${name}`, this.cwd);
  }

  /**
   * List tags
   */
  listTags(options?: { pattern?: string; limit?: number }): Tag[] {
    const args: string[] = ['--format="%(refname:short)|%(objectname:short)|%(taggerdate:iso)"'];

    if (options?.pattern) {
      args.push(`-l "${options.pattern}"`);
    }

    const result = git(`tag ${args.join(' ')}`, this.cwd);
    if (!result) return [];

    let tags = result.split('\n').filter(l => l).map(line => {
      const [name, sha, date] = line.split('|');
      return { name, sha, date };
    });

    if (options?.limit) {
      tags = tags.slice(-options.limit);
    }

    return tags;
  }

  // =========================================================================
  // WORKTREES
  // =========================================================================

  /**
   * Create a worktree
   */
  createWorktree(path: string, branch: string, baseBranch?: string): void {
    if (baseBranch) {
      git(`worktree add -b ${branch} ${path} ${baseBranch}`, this.cwd);
    } else {
      git(`worktree add ${path} ${branch}`, this.cwd);
    }
  }

  /**
   * List worktrees
   */
  listWorktrees(): Worktree[] {
    const result = git('worktree list --porcelain', this.cwd);
    if (!result) return [];

    const worktrees: Worktree[] = [];
    let current: Partial<Worktree> = {};

    for (const line of result.split('\n')) {
      if (line.startsWith('worktree ')) {
        if (current.path) {
          worktrees.push(current as Worktree);
        }
        current = { path: line.substring(9) };
      } else if (line.startsWith('HEAD ')) {
        current.sha = line.substring(5);
      } else if (line.startsWith('branch ')) {
        current.branch = line.substring(7).replace('refs/heads/', '');
      }
    }

    if (current.path) {
      worktrees.push(current as Worktree);
    }

    // Mark main worktree
    if (worktrees.length > 0) {
      worktrees[0].isMain = true;
    }

    return worktrees;
  }

  /**
   * Remove a worktree
   */
  removeWorktree(path: string, force: boolean = false): void {
    const flag = force ? '--force' : '';
    git(`worktree remove ${flag} ${path}`, this.cwd);
  }

  /**
   * Prune stale worktrees
   */
  pruneWorktrees(): void {
    git('worktree prune', this.cwd);
  }
}
