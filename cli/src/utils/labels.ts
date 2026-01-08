/**
 * GitHub Label Management Utilities
 *
 * Handles creation and management of priority labels for backlog management
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import chalk from 'chalk';

const execAsync = promisify(exec);

export interface PriorityLabel {
  name: string;
  description: string;
  color: string;
}

/**
 * Default priority labels (priority-1 through priority-4)
 */
export const DEFAULT_PRIORITY_LABELS: PriorityLabel[] = [
  {
    name: 'priority-1',
    description: 'Highest priority - Critical issues that need immediate attention',
    color: 'd73a4a', // Red
  },
  {
    name: 'priority-2',
    description: 'High priority - Important issues that should be addressed soon',
    color: 'e99695', // Light red
  },
  {
    name: 'priority-3',
    description: 'Medium priority - Standard priority issues',
    color: 'fbca04', // Yellow
  },
  {
    name: 'priority-4',
    description: 'Low priority - Nice to have, can be deferred',
    color: 'd4c5f9', // Light purple
  },
];

/**
 * Generate priority labels based on a custom prefix
 */
export function generatePriorityLabels(prefix: string): PriorityLabel[] {
  return DEFAULT_PRIORITY_LABELS.map((label, index) => ({
    ...label,
    name: `${prefix}-${index + 1}`,
  }));
}

/**
 * Check if a label exists in the repository
 */
export async function labelExists(labelName: string): Promise<boolean> {
  try {
    const { stdout } = await execAsync(`gh label list --json name --jq '.[].name'`);
    const labels = stdout.trim().split('\n');
    return labels.includes(labelName);
  } catch (error) {
    // If gh command fails, assume label doesn't exist
    return false;
  }
}

/**
 * Create a single label in the repository
 */
export async function createLabel(label: PriorityLabel): Promise<void> {
  const { name, description, color } = label;
  await execAsync(
    `gh label create "${name}" --description "${description}" --color "${color}" --force`
  );
}

/**
 * Create multiple priority labels
 */
export async function createPriorityLabels(
  prefix: string = 'priority',
  quiet: boolean = false
): Promise<{ created: string[]; skipped: string[]; errors: string[] }> {
  const labels = generatePriorityLabels(prefix);
  const created: string[] = [];
  const skipped: string[] = [];
  const errors: string[] = [];

  for (const label of labels) {
    try {
      // Check if label already exists
      const exists = await labelExists(label.name);
      if (exists) {
        skipped.push(label.name);
        if (!quiet) {
          console.log(chalk.gray(`  ⊳ Label already exists: ${label.name}`));
        }
        continue;
      }

      // Create the label
      await createLabel(label);
      created.push(label.name);
      if (!quiet) {
        console.log(chalk.green(`  ✓ Created label: ${label.name}`));
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      errors.push(`${label.name}: ${message}`);
      if (!quiet) {
        console.log(chalk.red(`  ✗ Failed to create ${label.name}: ${message}`));
      }
    }
  }

  return { created, skipped, errors };
}

/**
 * Check if GitHub CLI is available
 */
export async function isGitHubCLIAvailable(): Promise<boolean> {
  try {
    await execAsync('gh --version');
    return true;
  } catch (error) {
    return false;
  }
}

/**
 * Ensure priority labels exist, creating them if necessary
 * This is a convenience function for automatic label creation
 */
export async function ensurePriorityLabels(
  prefix: string = 'priority',
  quiet: boolean = true
): Promise<boolean> {
  // Check if gh CLI is available
  const ghAvailable = await isGitHubCLIAvailable();
  if (!ghAvailable) {
    if (!quiet) {
      console.log(chalk.yellow('  ⚠️  GitHub CLI (gh) not available, skipping label creation'));
    }
    return false;
  }

  try {
    const result = await createPriorityLabels(prefix, quiet);

    // Return true if we created any labels or all were already present
    return result.created.length > 0 || result.skipped.length > 0;
  } catch (error) {
    if (!quiet) {
      console.log(chalk.yellow(`  ⚠️  Could not create priority labels: ${error instanceof Error ? error.message : String(error)}`));
    }
    return false;
  }
}
