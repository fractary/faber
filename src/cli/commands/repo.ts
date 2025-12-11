/**
 * @fractary/faber CLI - Repo Commands
 */

import { Command } from 'commander';
import { RepoManager } from '../../repo';

export const repoCommand = new Command('repo')
  .description('Repository operations');

// Branch commands
const branchCommand = new Command('branch')
  .description('Branch operations');

branchCommand
  .command('create <name>')
  .description('Create a new branch')
  .option('-b, --base <base>', 'Base branch')
  .action(async (name: string, options) => {
    try {
      const manager = new RepoManager();
      const branch = await manager.createBranch(name, { baseBranch: options.base });
      console.log('Created branch:', branch.name);
    } catch (error) {
      console.error('Error:', error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

branchCommand
  .command('delete <name>')
  .description('Delete a branch')
  .option('-l, --location <location>', 'Location (local, remote, both)', 'local')
  .option('-f, --force', 'Force delete')
  .action(async (name: string, options) => {
    try {
      const manager = new RepoManager();
      await manager.deleteBranch(name, {
        location: options.location,
        force: options.force,
      });
      console.log('Deleted branch:', name);
    } catch (error) {
      console.error('Error:', error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

branchCommand
  .command('list')
  .description('List branches')
  .option('-p, --pattern <pattern>', 'Filter pattern')
  .option('-m, --merged', 'Show only merged branches')
  .option('-l, --limit <limit>', 'Max results')
  .action(async (options) => {
    try {
      const manager = new RepoManager();
      const branches = await manager.listBranches({
        pattern: options.pattern,
        merged: options.merged,
        limit: options.limit ? parseInt(options.limit, 10) : undefined,
      });
      for (const branch of branches) {
        const markers = [
          branch.isDefault ? '[default]' : '',
          branch.isProtected ? '[protected]' : '',
        ].filter(Boolean).join(' ');
        console.log(`${branch.name} ${markers}`.trim());
      }
    } catch (error) {
      console.error('Error:', error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

repoCommand.addCommand(branchCommand);

// PR commands
const prCommand = new Command('pr')
  .description('Pull request operations');

prCommand
  .command('create')
  .description('Create a pull request')
  .requiredOption('-t, --title <title>', 'PR title')
  .option('-b, --body <body>', 'PR body')
  .option('--base <base>', 'Base branch')
  .option('--head <head>', 'Head branch')
  .option('-d, --draft', 'Create as draft')
  .option('-w, --work-id <workId>', 'Work item ID')
  .action(async (options) => {
    try {
      const manager = new RepoManager();
      const pr = await manager.createPR({
        title: options.title,
        body: options.body,
        base: options.base,
        head: options.head,
        draft: options.draft,
        workId: options.workId,
      });
      console.log('Created PR #%d:', pr.number);
      console.log('URL:', pr.url);
    } catch (error) {
      console.error('Error:', error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

prCommand
  .command('get <number>')
  .description('Get pull request details')
  .action(async (number: string) => {
    try {
      const manager = new RepoManager();
      const pr = await manager.getPR(parseInt(number, 10));
      console.log(JSON.stringify(pr, null, 2));
    } catch (error) {
      console.error('Error:', error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

prCommand
  .command('list')
  .description('List pull requests')
  .option('-s, --state <state>', 'PR state (open, closed, merged, all)', 'open')
  .option('-l, --limit <limit>', 'Max results', '10')
  .action(async (options) => {
    try {
      const manager = new RepoManager();
      const prs = await manager.listPRs({
        state: options.state,
        limit: parseInt(options.limit, 10),
      });
      for (const pr of prs) {
        console.log(`#${pr.number} [${pr.state}] ${pr.title}`);
      }
    } catch (error) {
      console.error('Error:', error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

prCommand
  .command('merge <number>')
  .description('Merge a pull request')
  .option('-s, --strategy <strategy>', 'Merge strategy (merge, squash, rebase)', 'squash')
  .option('-d, --delete-branch', 'Delete branch after merge')
  .action(async (number: string, options) => {
    try {
      const manager = new RepoManager();
      await manager.mergePR(parseInt(number, 10), {
        strategy: options.strategy,
        deleteBranch: options.deleteBranch,
      });
      console.log('Merged PR #%s', number);
    } catch (error) {
      console.error('Error:', error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

repoCommand.addCommand(prCommand);

// Status command
repoCommand
  .command('status')
  .description('Show repository status')
  .action(() => {
    try {
      const manager = new RepoManager();
      const status = manager.getStatus();
      console.log('Branch:', status.branch);
      if (status.ahead > 0 || status.behind > 0) {
        console.log(`Ahead: ${status.ahead}, Behind: ${status.behind}`);
      }
      if (status.staged.length > 0) {
        console.log('Staged:', status.staged.join(', '));
      }
      if (status.modified.length > 0) {
        console.log('Modified:', status.modified.join(', '));
      }
      if (status.untracked.length > 0) {
        console.log('Untracked:', status.untracked.join(', '));
      }
      if (status.conflicts.length > 0) {
        console.log('Conflicts:', status.conflicts.join(', '));
      }
    } catch (error) {
      console.error('Error:', error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

// Push/Pull commands
repoCommand
  .command('push')
  .description('Push to remote')
  .option('-b, --branch <branch>', 'Branch to push')
  .option('-u, --set-upstream', 'Set upstream')
  .option('-f, --force', 'Force push')
  .action((options) => {
    try {
      const manager = new RepoManager();
      manager.push({
        branch: options.branch,
        setUpstream: options.setUpstream,
        force: options.force,
      });
      console.log('Pushed successfully');
    } catch (error) {
      console.error('Error:', error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

repoCommand
  .command('pull')
  .description('Pull from remote')
  .option('-b, --branch <branch>', 'Branch to pull')
  .option('-r, --rebase', 'Pull with rebase')
  .action((options) => {
    try {
      const manager = new RepoManager();
      manager.pull({
        branch: options.branch,
        rebase: options.rebase,
      });
      console.log('Pulled successfully');
    } catch (error) {
      console.error('Error:', error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

// Commit command
repoCommand
  .command('commit')
  .description('Create a commit')
  .requiredOption('-m, --message <message>', 'Commit message')
  .option('-t, --type <type>', 'Commit type (feat, fix, chore, etc.)')
  .option('-s, --scope <scope>', 'Commit scope')
  .option('-w, --work-id <workId>', 'Work item ID')
  .option('--breaking', 'Breaking change')
  .action((options) => {
    try {
      const manager = new RepoManager();
      const commit = manager.commit({
        message: options.message,
        type: options.type,
        scope: options.scope,
        workId: options.workId,
        breaking: options.breaking,
      });
      console.log('Created commit:', commit.sha.slice(0, 7));
      console.log(commit.message);
    } catch (error) {
      console.error('Error:', error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });
