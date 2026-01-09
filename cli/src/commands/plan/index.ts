/**
 * Plan command - FABER CLI planning command
 *
 * Batch workflow planning for GitHub issues
 */

import { Command } from 'commander';
import chalk from 'chalk';
import { AnthropicClient } from '../../lib/anthropic-client.js';
import { RepoClient } from '../../lib/repo-client.js';
import { ConfigManager } from '../../lib/config.js';
import { prompt } from '../../utils/prompt.js';
import {
  validateWorkIds,
  validateLabels,
  validateWorkflowName,
  validateSafePath,
  validatePlanId,
} from '../../utils/validation.js';
import type { FaberConfig } from '../../types/config.js';
import fs from 'fs/promises';
import path from 'path';

interface PlanOptions {
  workId?: string;
  workLabel?: string;
  workflow?: string;
  noWorktree?: boolean;
  noBranch?: boolean;
  skipConfirm?: boolean;
  output?: string;
  json?: boolean;
  // Backlog management options
  limit?: number;
  orderBy?: string;
  orderDirection?: string;
}

interface Issue {
  id: string;
  number: number;
  title: string;
  description: string;
  labels: string[];
  url: string;
  state: string;
  workflow?: string; // Extracted workflow label
  createdAt?: string; // Issue creation date
  updatedAt?: string; // Issue last update date
}

interface PlanResult {
  issue: Issue;
  planId: string;
  branch: string;
  worktree: string;
  error?: string;
}

/**
 * Create the plan command
 */
export function createPlanCommand(): Command {
  return new Command('plan')
    .description('Plan workflows for GitHub issues')
    .option('--work-id <ids>', 'Comma-separated list of work item IDs (e.g., "258,259,260")')
    .option('--work-label <labels>', 'Comma-separated label filters (e.g., "workflow:etl,status:approved")')
    .option('--workflow <name>', 'Override workflow (default: read from issue "workflow:*" label)')
    .option('--no-worktree', 'Skip worktree creation')
    .option('--no-branch', 'Skip branch creation')
    .option('--skip-confirm', 'Skip confirmation prompt (use with caution)')
    .option('--output <format>', 'Output format: text|json|yaml', 'text')
    .option('--json', 'Output as JSON (shorthand for --output json)')
    .option('--limit <n>', 'Maximum number of issues to plan', parseInt)
    .option('--order-by <strategy>', 'Order issues by: priority|created|updated (default: none)', 'none')
    .option('--order-direction <dir>', 'Order direction: asc|desc (default: desc)', 'desc')
    .action(async (options: PlanOptions) => {
      try {
        await executePlanCommand(options);
      } catch (error) {
        handlePlanError(error, options);
      }
    });
}

/**
 * Main execution logic for plan command
 */
async function executePlanCommand(options: PlanOptions): Promise<void> {
  const outputFormat = options.json ? 'json' : options.output || 'text';

  // Validate arguments
  if (!options.workId && !options.workLabel) {
    throw new Error('Either --work-id or --work-label must be provided');
  }

  if (options.workId && options.workLabel) {
    throw new Error('Cannot use both --work-id and --work-label at the same time');
  }

  // Validate backlog management options
  if (options.limit !== undefined) {
    if (!Number.isInteger(options.limit) || options.limit <= 0) {
      throw new Error('--limit must be a positive integer');
    }
    if (options.limit > 100) {
      throw new Error('--limit cannot exceed 100');
    }
  }

  if (options.orderBy && options.orderBy !== 'none') {
    const validOrderBy = ['priority', 'created', 'updated'];
    if (!validOrderBy.includes(options.orderBy)) {
      throw new Error(`--order-by must be one of: ${validOrderBy.join(', ')}, or 'none'`);
    }
  }

  if (options.orderDirection) {
    const validDirections = ['asc', 'desc'];
    if (!validDirections.includes(options.orderDirection)) {
      throw new Error(`--order-direction must be one of: ${validDirections.join(', ')}`);
    }
  }

  // Initialize clients
  const config = await ConfigManager.load();
  const repoClient = await RepoClient.create(config);
  const anthropicClient = new AnthropicClient(config);

  if (outputFormat === 'text') {
    console.log(chalk.blue('FABER CLI - Workflow Planning'));
    console.log(chalk.gray('═'.repeat(50)));
  }

  // Step 1: Fetch issues from GitHub
  if (outputFormat === 'text') {
    console.log(chalk.cyan('\n→ Fetching issues from GitHub...'));
  }

  let issues: Issue[];
  try {
    if (options.workId) {
      // Validate work IDs before fetching
      const ids = validateWorkIds(options.workId);
      issues = await repoClient.fetchIssues(ids);
      if (outputFormat === 'text') {
        console.log(chalk.green(`  ✓ Fetched ${issues.length} issue(s) by ID`));
      }
    } else if (options.workLabel) {
      // Validate labels before searching
      const labels = validateLabels(options.workLabel);
      issues = await repoClient.searchIssues(labels);
      if (outputFormat === 'text') {
        console.log(chalk.green(`  ✓ Found ${issues.length} issue(s) matching labels`));
      }
    } else {
      throw new Error('No issues to process');
    }
  } catch (error) {
    if (error instanceof Error && error.message.includes('not yet implemented')) {
      if (outputFormat === 'text') {
        console.log(chalk.yellow('\n⚠️  fractary-repo commands not yet available'));
        console.log(chalk.gray('   This command requires fractary-repo plugin implementation.'));
        console.log(chalk.gray('   See SPEC-00030-FRACTARY-REPO-ENHANCEMENTS.md'));
      } else {
        console.log(JSON.stringify({
          status: 'error',
          error: {
            code: 'DEPENDENCY_NOT_AVAILABLE',
            message: 'fractary-repo commands not yet implemented',
            details: 'See SPEC-00030-FRACTARY-REPO-ENHANCEMENTS.md',
          },
        }, null, 2));
      }
      return;
    }
    throw error;
  }

  if (issues.length === 0) {
    if (outputFormat === 'text') {
      console.log(chalk.yellow('\n⚠️  No issues found'));
    } else {
      console.log(JSON.stringify({ status: 'success', issues: [], message: 'No issues found' }, null, 2));
    }
    return;
  }

  // Auto-create priority labels if using priority ordering and labels don't exist
  if (options.orderBy === 'priority') {
    const { ensurePriorityLabels } = await import('../../utils/labels.js');
    const priorityLabelPrefix = config.backlog_management?.priority_config?.label_prefix || 'priority';

    // Try to ensure labels exist (quiet mode - won't spam console)
    const labelsEnsured = await ensurePriorityLabels(priorityLabelPrefix, true);

    if (outputFormat === 'text' && labelsEnsured) {
      console.log(chalk.gray(`\n→ Priority labels are ready (using prefix: ${priorityLabelPrefix})`));
    }
  }

  // Apply ordering if requested
  if (options.orderBy && options.orderBy !== 'none') {
    const { sortIssues } = await import('../../utils/sorting.js');

    // Load priority label prefix from config (with fallback)
    const priorityLabelPrefix = config.backlog_management?.priority_config?.label_prefix || 'priority';

    const originalCount = issues.length;
    issues = sortIssues(issues, {
      orderBy: options.orderBy as 'priority' | 'created' | 'updated',
      direction: (options.orderDirection || 'desc') as 'asc' | 'desc',
      priorityConfig: {
        labelPrefix: priorityLabelPrefix,
      }
    });

    if (outputFormat === 'text') {
      console.log(chalk.blue(`\n→ Sorted ${originalCount} issue(s) by ${options.orderBy} (${options.orderDirection || 'desc'})`));
    }
  }

  // Apply limit if specified
  if (options.limit && issues.length > options.limit) {
    const totalFound = issues.length;
    issues = issues.slice(0, options.limit);

    if (outputFormat === 'text') {
      console.log(chalk.yellow(`→ Limiting to top ${options.limit} issue(s) (found ${totalFound})`));
    }
  }

  // Step 2: Extract workflows from labels or prompt user
  if (outputFormat === 'text') {
    console.log(chalk.cyan('\n→ Identifying workflows...'));
  }

  const availableWorkflows = await loadAvailableWorkflows(config);
  const issuesWithWorkflows = await assignWorkflows(issues, availableWorkflows, options, outputFormat);

  // Step 3: Show confirmation prompt
  if (!options.skipConfirm) {
    const confirmed = await showConfirmationPrompt(issuesWithWorkflows, config, outputFormat);
    if (!confirmed) {
      if (outputFormat === 'text') {
        console.log(chalk.yellow('\n✖ Planning cancelled'));
      } else {
        console.log(JSON.stringify({ status: 'cancelled', message: 'User cancelled planning' }, null, 2));
      }
      return;
    }
  }

  // Step 4: Plan each issue
  if (outputFormat === 'text') {
    console.log(chalk.cyan('\n→ Planning workflows...'));
    process.stdout.write(''); // Force flush
  }

  const results: PlanResult[] = [];

  for (const issue of issuesWithWorkflows) {
    if (outputFormat === 'text') {
      console.log(chalk.gray(`\n[${results.length + 1}/${issuesWithWorkflows.length}] Issue #${issue.number}: ${issue.title}`));
      process.stdout.write(''); // Force flush
    }

    try {
      const result = await planSingleIssue(issue, config, repoClient, anthropicClient, options, outputFormat);
      results.push(result);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      if (outputFormat === 'text') {
        console.log(chalk.red(`  ✗ Error: ${errorMessage}`));
      }
      results.push({
        issue,
        planId: '',
        branch: '',
        worktree: '',
        error: errorMessage,
      });
    }
  }

  // Step 5: Output summary
  if (outputFormat === 'json') {
    console.log(JSON.stringify({
      status: 'success',
      total: results.length,
      successful: results.filter(r => !r.error).length,
      failed: results.filter(r => r.error).length,
      results,
    }, null, 2));
  } else {
    outputTextSummary(results);
  }
}

/**
 * Load available workflow configurations
 */
async function loadAvailableWorkflows(config: FaberConfig): Promise<string[]> {
  const workflowDir = config.workflow?.config_path || './plugins/faber/config/workflows';
  try {
    const files = await fs.readdir(workflowDir);
    return files
      .filter(f => f.endsWith('.json'))
      .map(f => path.basename(f, '.json'));
  } catch (error) {
    // Default workflows if directory doesn't exist
    return ['core', 'etl', 'bugfix', 'feature'];
  }
}

/**
 * Assign workflows to issues (extract from labels or prompt user)
 */
async function assignWorkflows(
  issues: Issue[],
  availableWorkflows: string[],
  options: PlanOptions,
  outputFormat: string
): Promise<Issue[]> {
  const issuesWithWorkflows: Issue[] = [];

  for (const issue of issues) {
    let workflow = options.workflow; // Command-line override

    // Validate workflow override if provided
    if (workflow) {
      validateWorkflowName(workflow);
    }

    if (!workflow) {
      // Extract from issue labels - support both 'workflow:' and 'faber-workflow:' prefixes
      const workflowLabel = issue.labels.find(label =>
        label.startsWith('workflow:') || label.startsWith('faber-workflow:')
      );
      if (workflowLabel) {
        workflow = workflowLabel
          .replace(/^workflow:/, '')
          .replace(/^faber-workflow:/, '');
        // Validate extracted workflow name
        validateWorkflowName(workflow);
      }
    }

    if (!workflow) {
      // Prompt user
      if (outputFormat === 'text') {
        console.log(chalk.yellow(`\n⚠️  Issue #${issue.number} is missing a workflow label:`));
        console.log(chalk.gray(`    ${issue.title}`));
        console.log(chalk.gray(`    Available workflows: ${availableWorkflows.join(', ')}`));

        workflow = await prompt(`    Select workflow for this issue [${availableWorkflows[0]}]: `);
        if (!workflow) {
          workflow = availableWorkflows[0];
        }

        if (!availableWorkflows.includes(workflow)) {
          throw new Error(`Invalid workflow: ${workflow}. Available: ${availableWorkflows.join(', ')}`);
        }
      } else {
        throw new Error(`Issue #${issue.number} is missing workflow label and interactive prompts are disabled in JSON mode`);
      }
    }

    issuesWithWorkflows.push({ ...issue, workflow });
  }

  if (outputFormat === 'text') {
    console.log(chalk.green(`  ✓ All issues have workflows assigned`));
  }

  return issuesWithWorkflows;
}

/**
 * Show confirmation prompt before planning
 */
async function showConfirmationPrompt(
  issues: Issue[],
  config: FaberConfig,
  outputFormat: string
): Promise<boolean> {
  if (outputFormat !== 'text') {
    return true; // Skip in JSON mode
  }

  console.log(chalk.cyan('\n📋 Will plan workflows for the following issues:\n'));

  for (const issue of issues) {
    const { organization, project } = getRepoInfoFromConfig(config);
    const branch = `feature/${issue.number}`;
    const worktree = `~/.claude-worktrees/${organization}-${project}-${issue.number}`;

    console.log(chalk.bold(`#${issue.number}: ${issue.title}`));
    console.log(chalk.gray(`  Workflow: ${issue.workflow}`));
    console.log(chalk.gray(`  Branch: ${branch}`));
    console.log(chalk.gray(`  Worktree: ${worktree}`));
    console.log();
  }

  const response = await prompt('Proceed? [Y/n]: ');
  return !response || response.toLowerCase() === 'y' || response.toLowerCase() === 'yes';
}

/**
 * Plan a single issue
 */
async function planSingleIssue(
  issue: Issue,
  config: FaberConfig,
  repoClient: RepoClient,
  anthropicClient: AnthropicClient,
  options: PlanOptions,
  outputFormat: string
): Promise<PlanResult> {
  const { organization, project } = getRepoInfoFromConfig(config);
  const branch = `feature/${issue.number}`;
  const worktree = `~/.claude-worktrees/${organization}-${project}-${issue.number}`;

  // Generate plan via Anthropic API
  if (outputFormat === 'text') {
    console.log(chalk.gray('  → Generating plan...'));
    process.stdout.write(''); // Force flush
  }

  const plan = await anthropicClient.generatePlan({
    workflow: issue.workflow!,
    issueTitle: issue.title,
    issueDescription: issue.description,
    issueNumber: issue.number,
  });

  const planId = plan.plan_id;

  // Create branch without checking it out (so it won't conflict with worktree creation)
  if (!options.noBranch) {
    if (outputFormat === 'text') {
      console.log(chalk.gray(`  → Creating branch: ${branch}...`));
      process.stdout.write(''); // Force flush
    }
    // Use git branch instead of checkout to avoid switching the main repo
    const { exec } = await import('child_process');
    const { promisify } = await import('util');
    const execAsync = promisify(exec);
    try {
      await execAsync(`git branch ${branch} 2>/dev/null || true`);
    } catch (error) {
      // Branch might already exist, that's ok
    }
  }

  // Create worktree
  let worktreePath = worktree;
  if (!options.noWorktree) {
    if (outputFormat === 'text') {
      console.log(chalk.gray(`  → Creating worktree: ${worktree}...`));
      process.stdout.write(''); // Force flush
    }

    try {
      const worktreeResult = await repoClient.createWorktree({
        workId: issue.number.toString(),
        path: worktree,
      });
      worktreePath = worktreeResult.absolute_path;
    } catch (error) {
      // If worktree already exists, try to use it
      // Check for both "already exists" and exit code 128 which indicates the path exists
      if (error instanceof Error &&
          (error.message.includes('already exists') ||
           error.message.includes('exit code 128') ||
           error.message.includes(`'${worktree}'`) ||
           error.message.includes(worktree.replace('~', (await import('os')).homedir())))) {
        if (outputFormat === 'text') {
          console.log(chalk.yellow(`  ⚠️  Worktree already exists, using existing worktree`));
        }
        const expandedPath = worktree.startsWith('~')
          ? worktree.replace('~', (await import('os')).homedir())
          : worktree;
        worktreePath = path.resolve(expandedPath);
      } else {
        throw error;
      }
    }
  }

  // Write plan to worktree
  if (!options.noWorktree) {
    // Validate plan ID format (prevent path traversal via malicious plan IDs)
    validatePlanId(planId);

    const planDir = path.join(worktreePath, '.fractary', 'plans');
    await fs.mkdir(planDir, { recursive: true });

    // Construct and validate path
    const planPath = path.join(planDir, `${planId}.json`);
    // Note: path.join automatically normalizes and prevents basic traversal,
    // but we validate the plan ID format as an additional layer of defense

    await fs.writeFile(planPath, JSON.stringify(plan, null, 2));

    if (outputFormat === 'text') {
      console.log(chalk.gray(`  → Plan written to ${planPath}`));
    }
  }

  // Generate detailed comment for GitHub issue
  const planSummary = generatePlanComment(plan, issue.workflow!, worktreePath, planId);

  // Update GitHub issue with plan_id
  if (outputFormat === 'text') {
    console.log(chalk.gray(`  → Updating GitHub issue...`));
  }
  try {
    await repoClient.updateIssue({
      id: issue.number.toString(),
      comment: planSummary,
      addLabel: 'faber:planned',
    });
  } catch (error) {
    // If label doesn't exist, just add comment without label
    if (error instanceof Error &&
        (error.message.includes('not found') ||
         error.message.includes('faber:planned') ||
         error.message.includes('--add-label'))) {
      if (outputFormat === 'text') {
        console.log(chalk.yellow(`  ⚠️  Label 'faber:planned' not found, adding comment only`));
      }
      await repoClient.updateIssue({
        id: issue.number.toString(),
        comment: planSummary,
      });
    } else {
      throw error;
    }
  }

  if (outputFormat === 'text') {
    console.log(chalk.green(`  ✓ Plan: ${planId}`));
  }

  return {
    issue,
    planId,
    branch,
    worktree: worktreePath,
  };
}

/**
 * Generate a detailed plan comment for GitHub issue
 */
function generatePlanComment(plan: any, workflow: string, worktreePath: string, planId: string): string {
  let comment = `🤖 **Workflow Plan Created**\n\n`;
  comment += `**Plan ID:** \`${planId}\`\n`;
  comment += `**Workflow:** \`${workflow}\`\n`;

  // Add workflow inheritance info if available
  if (plan.workflow_config?.inherits_from) {
    comment += `**Inherits from:** \`${plan.workflow_config.inherits_from}\`\n`;
  }

  comment += `\n---\n\n`;

  // Add plan summary by phase
  if (plan.phases && Array.isArray(plan.phases)) {
    comment += `### Workflow Phases\n\n`;
    plan.phases.forEach((phase: any, index: number) => {
      comment += `**${index + 1}. ${phase.name || phase.phase}**\n\n`;

      // Show phase description if available
      if (phase.description) {
        comment += `*${phase.description}*\n\n`;
      }

      // Show steps/tasks
      if (phase.steps && Array.isArray(phase.steps)) {
        phase.steps.forEach((step: any) => {
          const action = step.action || step.name || step.description || step;
          comment += `  - **${action}**`;
          if (step.details) {
            comment += `: ${step.details}`;
          }
          comment += `\n`;
        });
      } else if (phase.tasks && Array.isArray(phase.tasks)) {
        phase.tasks.forEach((task: any) => {
          const taskDesc = task.description || task.name || task;
          comment += `  - ${taskDesc}\n`;
        });
      }
      comment += `\n`;
    });
  }

  comment += `---\n\n`;
  comment += `### Plan Location\n\n`;
  comment += `\`\`\`\n${worktreePath}/.fractary/plans/${planId}.json\n\`\`\`\n\n`;
  comment += `### Next Steps\n\n`;
  comment += `Execute the workflow plan:\n\n`;
  comment += `\`\`\`bash\n`;
  comment += `cd ${worktreePath}\n`;
  comment += `claude\n`;
  comment += `# Then in Claude Code:\n`;
  comment += `/fractary-faber:workflow-run ${plan.issue_number || ''}\n`;
  comment += `\`\`\`\n`;

  return comment;
}

/**
 * Get repository info from config
 */
function getRepoInfoFromConfig(config: FaberConfig): { organization: string; project: string } {
  return {
    organization: config.github?.organization || 'unknown',
    project: config.github?.project || 'unknown',
  };
}

/**
 * Output text summary
 */
function outputTextSummary(results: PlanResult[]): void {
  console.log(chalk.cyan('\n' + '═'.repeat(50)));

  const successful = results.filter(r => !r.error);
  const failed = results.filter(r => r.error);

  if (successful.length > 0) {
    console.log(chalk.green(`\n✓ Planned ${successful.length} workflow(s) successfully:\n`));

    successful.forEach((result, index) => {
      console.log(chalk.bold(`[${index + 1}/${successful.length}] Issue #${result.issue.number}: ${result.issue.title}`));
      console.log(chalk.gray(`      Workflow: ${result.issue.workflow}`));
      console.log(chalk.gray(`      Plan: ${result.planId}`));
      console.log(chalk.gray(`      Branch: ${result.branch}`));
      console.log(chalk.gray(`      Worktree: ${result.worktree}`));
      console.log();
      console.log(chalk.cyan('      To execute:'));
      console.log(chalk.gray(`        cd ${result.worktree} && claude`));
      console.log(chalk.gray(`        /fractary-faber:workflow-run ${result.issue.number}`));
      console.log();
    });
  }

  if (failed.length > 0) {
    console.log(chalk.red(`\n✗ Failed to plan ${failed.length} workflow(s):\n`));

    failed.forEach((result, index) => {
      console.log(chalk.bold(`[${index + 1}/${failed.length}] Issue #${result.issue.number}: ${result.issue.title}`));
      console.log(chalk.red(`      Error: ${result.error}`));
      console.log();
    });
  }
}

/**
 * Error handling
 */
function handlePlanError(error: unknown, options: PlanOptions): void {
  const message = error instanceof Error ? error.message : String(error);
  const outputFormat = options.json ? 'json' : options.output || 'text';

  if (outputFormat === 'json') {
    console.error(JSON.stringify({
      status: 'error',
      error: { code: 'PLAN_ERROR', message },
    }));
  } else {
    console.error(chalk.red('Error:'), message);
  }
  process.exit(1);
}
