/**
 * Work subcommand - Work tracking operations
 *
 * Provides issue, comment, label, and milestone operations via @fractary/faber WorkManager.
 */

import { Command } from 'commander';
import chalk from 'chalk';
import { promises as fs } from 'fs';
import path from 'path';
import { WorkManager } from '@fractary/faber';

/**
 * Create the work command tree
 */
export function createWorkCommand(): Command {
  const work = new Command('work')
    .description('Work item tracking operations');

  // Issue operations
  const issue = new Command('issue')
    .description('Issue operations');

  issue.addCommand(createIssueFetchCommand());
  issue.addCommand(createIssueCreateCommand());
  issue.addCommand(createIssueUpdateCommand());
  issue.addCommand(createIssueCloseCommand());
  issue.addCommand(createIssueReopenCommand());
  issue.addCommand(createIssueAssignCommand());
  issue.addCommand(createIssueClassifyCommand());
  issue.addCommand(createIssueSearchCommand());

  // Comment operations
  const comment = new Command('comment')
    .description('Comment operations');

  comment.addCommand(createCommentCreateCommand());
  comment.addCommand(createCommentListCommand());

  // Label operations
  const label = new Command('label')
    .description('Label operations');

  label.addCommand(createLabelAddCommand());
  label.addCommand(createLabelRemoveCommand());
  label.addCommand(createLabelListCommand());

  // Milestone operations
  const milestone = new Command('milestone')
    .description('Milestone operations');

  milestone.addCommand(createMilestoneCreateCommand());
  milestone.addCommand(createMilestoneListCommand());
  milestone.addCommand(createMilestoneSetCommand());

  work.addCommand(issue);
  work.addCommand(comment);
  work.addCommand(label);
  work.addCommand(milestone);
  work.addCommand(createInitCommand());

  return work;
}

// Issue Commands

function createIssueFetchCommand(): Command {
  return new Command('fetch')
    .description('Fetch a work item by ID')
    .argument('<number>', 'Issue number')
    .option('--json', 'Output as JSON')
    .option('--verbose', 'Show additional details')
    .action(async (number: string, options) => {
      try {
        const workManager = new WorkManager();
        const issue = await workManager.fetchIssue(parseInt(number, 10));

        if (options.json) {
          console.log(JSON.stringify({ status: 'success', data: issue }, null, 2));
        } else {
          console.log(chalk.bold(`#${issue.number}: ${issue.title}`));
          console.log(chalk.gray(`State: ${issue.state}`));
          if (issue.body) {
            console.log('\n' + issue.body);
          }
        }
      } catch (error) {
        handleWorkError(error, options);
      }
    });
}

function createIssueCreateCommand(): Command {
  return new Command('create')
    .description('Create a new work item')
    .requiredOption('--title <title>', 'Issue title')
    .option('--body <body>', 'Issue body')
    .option('--labels <labels>', 'Comma-separated labels')
    .option('--assignees <assignees>', 'Comma-separated assignees')
    .option('--json', 'Output as JSON')
    .action(async (options) => {
      try {
        const workManager = new WorkManager();
        const issue = await workManager.createIssue({
          title: options.title,
          body: options.body,
          labels: options.labels?.split(',').map((l: string) => l.trim()),
          assignees: options.assignees?.split(',').map((a: string) => a.trim()),
        });

        if (options.json) {
          console.log(JSON.stringify({ status: 'success', data: issue }, null, 2));
        } else {
          console.log(chalk.green(`✓ Created issue #${issue.number}: ${issue.title}`));
        }
      } catch (error) {
        handleWorkError(error, options);
      }
    });
}

function createIssueUpdateCommand(): Command {
  return new Command('update')
    .description('Update a work item')
    .argument('<number>', 'Issue number')
    .option('--title <title>', 'New title')
    .option('--body <body>', 'New body')
    .option('--state <state>', 'New state (open, closed)')
    .option('--json', 'Output as JSON')
    .action(async (number: string, options) => {
      try {
        const workManager = new WorkManager();
        const issue = await workManager.updateIssue(parseInt(number, 10), {
          title: options.title,
          body: options.body,
          state: options.state,
        });

        if (options.json) {
          console.log(JSON.stringify({ status: 'success', data: issue }, null, 2));
        } else {
          console.log(chalk.green(`✓ Updated issue #${issue.number}`));
        }
      } catch (error) {
        handleWorkError(error, options);
      }
    });
}

function createIssueCloseCommand(): Command {
  return new Command('close')
    .description('Close a work item')
    .argument('<number>', 'Issue number')
    .option('--comment <text>', 'Add closing comment')
    .option('--json', 'Output as JSON')
    .action(async (number: string, options) => {
      try {
        const workManager = new WorkManager();

        // Add comment if provided
        if (options.comment) {
          await workManager.createComment(parseInt(number, 10), options.comment);
        }

        const issue = await workManager.closeIssue(parseInt(number, 10));

        if (options.json) {
          console.log(JSON.stringify({ status: 'success', data: issue }, null, 2));
        } else {
          console.log(chalk.green(`✓ Closed issue #${number}`));
        }
      } catch (error) {
        handleWorkError(error, options);
      }
    });
}

function createIssueSearchCommand(): Command {
  return new Command('search')
    .description('Search work items')
    .requiredOption('--query <query>', 'Search query')
    .option('--state <state>', 'Filter by state (open, closed, all)', 'open')
    .option('--labels <labels>', 'Filter by labels (comma-separated)')
    .option('--limit <n>', 'Max results', '10')
    .option('--json', 'Output as JSON')
    .action(async (options) => {
      try {
        const workManager = new WorkManager();
        const issues = await workManager.searchIssues(options.query, {
          state: options.state,
          labels: options.labels?.split(',').map((l: string) => l.trim()),
        });
        const limitedIssues = options.limit ? issues.slice(0, parseInt(options.limit, 10)) : issues;

        if (options.json) {
          console.log(JSON.stringify({ status: 'success', data: limitedIssues }, null, 2));
        } else {
          if (limitedIssues.length === 0) {
            console.log(chalk.yellow('No issues found'));
          } else {
            limitedIssues.forEach((issue: any) => {
              console.log(`#${issue.number} ${issue.title} [${issue.state}]`);
            });
          }
        }
      } catch (error) {
        handleWorkError(error, options);
      }
    });
}

function createIssueReopenCommand(): Command {
  return new Command('reopen')
    .description('Reopen a closed work item')
    .argument('<number>', 'Issue number')
    .option('--comment <text>', 'Add comment when reopening')
    .option('--json', 'Output as JSON')
    .action(async (number: string, options) => {
      try {
        const workManager = new WorkManager();

        // Add comment if provided
        if (options.comment) {
          await workManager.createComment(parseInt(number, 10), options.comment);
        }

        const issue = await workManager.reopenIssue(parseInt(number, 10));

        if (options.json) {
          console.log(JSON.stringify({
            status: 'success',
            data: {
              number: issue.number,
              state: issue.state,
              url: issue.url,
            },
          }, null, 2));
        } else {
          console.log(chalk.green(`✓ Reopened issue #${number}`));
        }
      } catch (error) {
        handleWorkError(error, options);
      }
    });
}

function createIssueAssignCommand(): Command {
  return new Command('assign')
    .description('Assign or unassign a work item')
    .argument('<number>', 'Issue number')
    .option('--user <username>', 'User to assign (use @me for self, omit to unassign)')
    .option('--json', 'Output as JSON')
    .action(async (number: string, options) => {
      try {
        const workManager = new WorkManager();
        let issue;

        if (options.user) {
          issue = await workManager.assignIssue(parseInt(number, 10), options.user);
        } else {
          issue = await workManager.unassignIssue(parseInt(number, 10));
        }

        if (options.json) {
          console.log(JSON.stringify({
            status: 'success',
            data: {
              number: issue.number,
              assignees: issue.assignees || [],
              url: issue.url,
            },
          }, null, 2));
        } else {
          if (options.user) {
            console.log(chalk.green(`✓ Assigned issue #${number} to ${options.user}`));
          } else {
            console.log(chalk.green(`✓ Unassigned issue #${number}`));
          }
        }
      } catch (error) {
        handleWorkError(error, options);
      }
    });
}

function createIssueClassifyCommand(): Command {
  return new Command('classify')
    .description('Classify work item type (feature, bug, chore, patch)')
    .argument('<number>', 'Issue number')
    .option('--json', 'Output as JSON')
    .action(async (number: string, options) => {
      try {
        const workManager = new WorkManager();
        const issue = await workManager.fetchIssue(parseInt(number, 10));

        const result = classifyWorkType(issue);

        if (options.json) {
          console.log(JSON.stringify({
            status: 'success',
            data: {
              number: parseInt(number, 10),
              work_type: result.work_type,
              confidence: result.confidence,
              signals: result.signals,
            },
          }, null, 2));
        } else {
          console.log(result.work_type);

          if (result.confidence < 0.5) {
            console.log(chalk.red(`⚠ LOW CONFIDENCE: ${Math.round(result.confidence * 100)}% - review manually`));
          } else if (result.confidence < 0.8) {
            console.log(chalk.yellow(`(confidence: ${Math.round(result.confidence * 100)}%)`));
          }
        }
      } catch (error) {
        handleWorkError(error, options);
      }
    });
}

// Comment Commands

function createCommentCreateCommand(): Command {
  return new Command('create')
    .description('Add a comment to an issue')
    .argument('<issue_number>', 'Issue number')
    .requiredOption('--body <text>', 'Comment body')
    .option('--json', 'Output as JSON')
    .action(async (issueNumber: string, options) => {
      try {
        const workManager = new WorkManager();
        const comment = await workManager.createComment(parseInt(issueNumber, 10), options.body);

        if (options.json) {
          console.log(JSON.stringify({ status: 'success', data: comment }, null, 2));
        } else {
          console.log(chalk.green(`✓ Added comment to issue #${issueNumber}`));
        }
      } catch (error) {
        handleWorkError(error, options);
      }
    });
}

function createCommentListCommand(): Command {
  return new Command('list')
    .description('List comments on an issue')
    .argument('<issue_number>', 'Issue number')
    .option('--limit <n>', 'Max results', '20')
    .option('--json', 'Output as JSON')
    .action(async (issueNumber: string, options) => {
      try {
        const workManager = new WorkManager();
        const comments = await workManager.listComments(parseInt(issueNumber, 10), {
          limit: parseInt(options.limit, 10),
        });

        if (options.json) {
          console.log(JSON.stringify({ status: 'success', data: comments }, null, 2));
        } else {
          if (comments.length === 0) {
            console.log(chalk.yellow('No comments found'));
          } else {
            comments.forEach((comment: any) => {
              console.log(chalk.gray(`[${comment.author}] ${comment.created_at}`));
              console.log(comment.body);
              console.log('');
            });
          }
        }
      } catch (error) {
        handleWorkError(error, options);
      }
    });
}

// Label Commands

function createLabelAddCommand(): Command {
  return new Command('add')
    .description('Add labels to an issue')
    .argument('<issue_number>', 'Issue number')
    .requiredOption('--label <names>', 'Label name(s), comma-separated')
    .option('--json', 'Output as JSON')
    .action(async (issueNumber: string, options) => {
      try {
        const workManager = new WorkManager();
        const labels = options.label.split(',').map((l: string) => l.trim());
        const result = await workManager.addLabels(parseInt(issueNumber, 10), labels);

        if (options.json) {
          console.log(JSON.stringify({ status: 'success', data: result }, null, 2));
        } else {
          console.log(chalk.green(`✓ Added label(s) to issue #${issueNumber}`));
        }
      } catch (error) {
        handleWorkError(error, options);
      }
    });
}

function createLabelRemoveCommand(): Command {
  return new Command('remove')
    .description('Remove labels from an issue')
    .argument('<issue_number>', 'Issue number')
    .requiredOption('--label <names>', 'Label name(s), comma-separated')
    .option('--json', 'Output as JSON')
    .action(async (issueNumber: string, options) => {
      try {
        const workManager = new WorkManager();
        const labels = options.label.split(',').map((l: string) => l.trim());
        await workManager.removeLabels(parseInt(issueNumber, 10), labels);

        if (options.json) {
          console.log(JSON.stringify({ status: 'success', data: { removed: labels } }, null, 2));
        } else {
          console.log(chalk.green(`✓ Removed label(s) from issue #${issueNumber}`));
        }
      } catch (error) {
        handleWorkError(error, options);
      }
    });
}

function createLabelListCommand(): Command {
  return new Command('list')
    .description('List labels')
    .option('--issue <number>', 'List labels for specific issue')
    .option('--json', 'Output as JSON')
    .action(async (options) => {
      try {
        const workManager = new WorkManager();
        const labels = options.issue
          ? await workManager.listLabels(parseInt(options.issue, 10))
          : await workManager.listLabels();

        if (options.json) {
          console.log(JSON.stringify({ status: 'success', data: labels }, null, 2));
        } else {
          if (labels.length === 0) {
            console.log(chalk.yellow('No labels found'));
          } else {
            labels.forEach((label: any) => {
              console.log(`- ${label.name}`);
            });
          }
        }
      } catch (error) {
        handleWorkError(error, options);
      }
    });
}

// Milestone Commands

function createMilestoneCreateCommand(): Command {
  return new Command('create')
    .description('Create a milestone')
    .requiredOption('--title <title>', 'Milestone title')
    .option('--description <text>', 'Milestone description')
    .option('--due-on <date>', 'Due date (ISO format)')
    .option('--json', 'Output as JSON')
    .action(async (options) => {
      try {
        const workManager = new WorkManager();
        const milestone = await workManager.createMilestone({
          title: options.title,
          description: options.description,
          due_on: options.dueOn,
        });

        if (options.json) {
          console.log(JSON.stringify({ status: 'success', data: milestone }, null, 2));
        } else {
          console.log(chalk.green(`✓ Created milestone: ${milestone.title}`));
        }
      } catch (error) {
        handleWorkError(error, options);
      }
    });
}

function createMilestoneListCommand(): Command {
  return new Command('list')
    .description('List milestones')
    .option('--state <state>', 'Filter by state (open, closed, all)', 'open')
    .option('--json', 'Output as JSON')
    .action(async (options) => {
      try {
        const workManager = new WorkManager();
        const milestones = await workManager.listMilestones(options.state);

        if (options.json) {
          console.log(JSON.stringify({ status: 'success', data: milestones }, null, 2));
        } else {
          if (milestones.length === 0) {
            console.log(chalk.yellow('No milestones found'));
          } else {
            milestones.forEach((ms: any) => {
              console.log(`${ms.title} [${ms.state}]`);
            });
          }
        }
      } catch (error) {
        handleWorkError(error, options);
      }
    });
}

function createMilestoneSetCommand(): Command {
  return new Command('set')
    .description('Set milestone on an issue')
    .argument('<issue_number>', 'Issue number')
    .requiredOption('--milestone <title>', 'Milestone title')
    .option('--json', 'Output as JSON')
    .action(async (issueNumber: string, options) => {
      try {
        const workManager = new WorkManager();
        const issue = await workManager.setMilestone(parseInt(issueNumber, 10), options.milestone);

        if (options.json) {
          console.log(JSON.stringify({ status: 'success', data: issue }, null, 2));
        } else {
          console.log(chalk.green(`✓ Set milestone '${options.milestone}' on issue #${issueNumber}`));
        }
      } catch (error) {
        handleWorkError(error, options);
      }
    });
}

// Init Command

function createInitCommand(): Command {
  return new Command('init')
    .description('Initialize work tracking configuration')
    .option('--platform <name>', 'Platform: github, jira, linear (auto-detect if not specified)')
    .option('--token <value>', 'API token (or use env var)')
    .option('--project <key>', 'Project key for Jira/Linear')
    .option('--yes', 'Accept defaults without prompting')
    .option('--json', 'Output as JSON')
    .action(async (options) => {
      try {
        const platform = options.platform || await detectPlatformFromGit();
        const config = await buildWorkConfig(platform, options);
        const configPath = await writeWorkConfig(config);

        if (options.json) {
          console.log(JSON.stringify({
            status: 'success',
            data: {
              platform: config.work.platform,
              config_path: configPath,
              repository: config.work.repository
                ? `${config.work.repository.owner}/${config.work.repository.name}`
                : config.work.project,
            },
          }, null, 2));
        } else {
          console.log(chalk.green(`✓ Work tracking initialized`));
          console.log(chalk.gray(`Platform: ${config.work.platform}`));
          console.log(chalk.gray(`Config: ${configPath}`));
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        if (options.json) {
          console.error(JSON.stringify({
            status: 'error',
            error: { code: 'INIT_ERROR', message },
          }));
        } else {
          console.error(chalk.red('Error:'), message);
        }
        process.exit(1);
      }
    });
}

// Helper functions

async function detectPlatformFromGit(): Promise<string> {
  try {
    const gitConfigPath = path.join(process.cwd(), '.git', 'config');
    const gitConfig = await fs.readFile(gitConfigPath, 'utf-8');

    const remoteMatch = gitConfig.match(/\[remote "origin"\][\s\S]*?url\s*=\s*(.+)/);
    if (!remoteMatch) {
      throw new Error('No origin remote found');
    }

    const remoteUrl = remoteMatch[1].trim();

    if (remoteUrl.includes('github.com')) {
      return 'github';
    } else if (remoteUrl.includes('gitlab.com')) {
      return 'gitlab';
    } else if (remoteUrl.includes('bitbucket.org')) {
      return 'bitbucket';
    } else if (remoteUrl.includes('atlassian.net')) {
      return 'jira';
    }

    return 'github';
  } catch {
    return 'github';
  }
}

function parseGitRemote(url: string): { owner: string; name: string } | null {
  const sshMatch = url.match(/@[^:]+:([^/]+)\/([^.]+)/);
  if (sshMatch) {
    return { owner: sshMatch[1], name: sshMatch[2] };
  }

  const httpsMatch = url.match(/https?:\/\/[^/]+\/([^/]+)\/([^/.]+)/);
  if (httpsMatch) {
    return { owner: httpsMatch[1], name: httpsMatch[2] };
  }

  return null;
}

interface WorkConfig {
  work: {
    platform: string;
    repository?: {
      owner: string;
      name: string;
    };
    instance?: string;
    project?: string;
  };
}

async function buildWorkConfig(platform: string, options: { project?: string }): Promise<WorkConfig> {
  const config: WorkConfig = {
    work: {
      platform,
    },
  };

  if (platform === 'github' || platform === 'gitlab' || platform === 'bitbucket') {
    try {
      const gitConfigPath = path.join(process.cwd(), '.git', 'config');
      const gitConfig = await fs.readFile(gitConfigPath, 'utf-8');
      const remoteMatch = gitConfig.match(/\[remote "origin"\][\s\S]*?url\s*=\s*(.+)/);
      if (remoteMatch) {
        const repoInfo = parseGitRemote(remoteMatch[1].trim());
        if (repoInfo) {
          config.work.repository = repoInfo;
        }
      }
    } catch {
      // Ignore errors
    }
  } else if (platform === 'jira' || platform === 'linear') {
    if (options.project) {
      config.work.project = options.project;
    }
  }

  return config;
}

async function writeWorkConfig(config: WorkConfig): Promise<string> {
  const configDir = path.join(process.cwd(), '.fractary', 'faber');
  const configPath = path.join(configDir, 'config.json');

  await fs.mkdir(configDir, { recursive: true });

  let existingConfig: Record<string, unknown> = {};
  try {
    const existing = await fs.readFile(configPath, 'utf-8');
    existingConfig = JSON.parse(existing);
  } catch {
    // No existing config
  }

  const mergedConfig = {
    ...existingConfig,
    ...config,
  };

  await fs.writeFile(configPath, JSON.stringify(mergedConfig, null, 2) + '\n');

  return configPath;
}

interface IssueForClassification {
  title?: string;
  labels?: Array<{ name: string } | string>;
  body?: string;
}

interface ClassifyResult {
  work_type: 'feature' | 'bug' | 'chore' | 'patch';
  confidence: number;
  signals: {
    labels: string[];
    title_keywords: string[];
    has_bug_markers: boolean;
  };
}

function classifyWorkType(issue: IssueForClassification): ClassifyResult {
  const title = (issue.title || '').toLowerCase();
  const labels = (issue.labels || []).map((l) =>
    typeof l === 'string' ? l.toLowerCase() : l.name.toLowerCase()
  );

  const signals = {
    labels: labels,
    title_keywords: [] as string[],
    has_bug_markers: false,
  };

  const labelScores: Record<string, { type: ClassifyResult['work_type']; score: number }> = {
    'bug': { type: 'bug', score: 0.95 },
    'defect': { type: 'bug', score: 0.95 },
    'regression': { type: 'bug', score: 0.9 },
    'enhancement': { type: 'feature', score: 0.9 },
    'feature': { type: 'feature', score: 0.95 },
    'new feature': { type: 'feature', score: 0.95 },
    'chore': { type: 'chore', score: 0.9 },
    'maintenance': { type: 'chore', score: 0.85 },
    'dependencies': { type: 'chore', score: 0.8 },
    'hotfix': { type: 'patch', score: 0.95 },
    'urgent': { type: 'patch', score: 0.7 },
    'security': { type: 'patch', score: 0.85 },
    'critical': { type: 'patch', score: 0.8 },
  };

  for (const label of labels) {
    if (labelScores[label]) {
      return {
        work_type: labelScores[label].type,
        confidence: labelScores[label].score,
        signals,
      };
    }
  }

  const bugKeywords = ['fix', 'bug', 'error', 'crash', 'broken', 'issue', 'problem'];
  const featureKeywords = ['add', 'implement', 'new', 'create', 'feature', 'support'];
  const choreKeywords = ['update', 'upgrade', 'refactor', 'clean', 'remove', 'deprecate', 'migrate'];
  const patchKeywords = ['hotfix', 'urgent', 'critical', 'security'];

  let workType: ClassifyResult['work_type'] = 'feature';
  let confidence = 0.5;

  for (const keyword of bugKeywords) {
    if (title.includes(keyword)) {
      signals.title_keywords.push(keyword);
      signals.has_bug_markers = true;
      workType = 'bug';
      confidence = 0.7;
      break;
    }
  }

  for (const keyword of patchKeywords) {
    if (title.includes(keyword)) {
      signals.title_keywords.push(keyword);
      workType = 'patch';
      confidence = 0.75;
      break;
    }
  }

  if (workType !== 'patch') {
    for (const keyword of featureKeywords) {
      if (title.includes(keyword)) {
        signals.title_keywords.push(keyword);
        if (!signals.has_bug_markers) {
          workType = 'feature';
          confidence = 0.7;
        }
        break;
      }
    }
  }

  for (const keyword of choreKeywords) {
    if (title.includes(keyword)) {
      signals.title_keywords.push(keyword);
      if (!signals.has_bug_markers && workType !== 'patch') {
        workType = 'chore';
        confidence = 0.65;
      }
      break;
    }
  }

  return {
    work_type: workType,
    confidence,
    signals,
  };
}

// Error handling

function handleWorkError(error: unknown, options: { json?: boolean }): void {
  const message = error instanceof Error ? error.message : String(error);
  if (options.json) {
    console.error(JSON.stringify({
      status: 'error',
      error: { code: 'WORK_ERROR', message },
    }));
  } else {
    console.error(chalk.red('Error:'), message);
  }
  process.exit(1);
}
