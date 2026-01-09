/**
 * GitHub Label Management Utilities
 *
 * Handles creation and management of priority labels for backlog management
 */

import { execFile } from 'child_process';
import { promisify } from 'util';
import chalk from 'chalk';

const execFileAsync = promisify(execFile);

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
 * @param labelName - Name of the label to check
 * @returns Promise resolving to true if label exists, false otherwise
 */
export async function labelExists(labelName: string): Promise<boolean> {
  try {
    const { stdout } = await execFileAsync('gh', ['label', 'list', '--json', 'name', '--jq', '.[].name']);
    const labels = stdout.trim().split('\n').map(l => l.trim()).filter(l => l.length > 0);
    return labels.includes(labelName);
  } catch (error) {
    // If gh command fails, assume label doesn't exist
    return false;
  }
}

/**
 * Create a single label in the repository
 * @param label - Label to create with name, description, and color
 */
export async function createLabel(label: PriorityLabel): Promise<void> {
  const { name, description, color } = label;
  // Use execFileAsync with array arguments to prevent command injection
  await execFileAsync('gh', [
    'label',
    'create',
    name,
    '--description',
    description,
    '--color',
    color,
    '--force'
  ]);
}

/**
 * Create multiple priority labels
 * @param prefix - Label prefix (e.g., "priority" for priority-1, priority-2, etc.)
 * @param quiet - If true, suppress console output
 * @returns Object with arrays of created, skipped, and error labels
 */
export async function createPriorityLabels(
  prefix: string = 'priority',
  quiet: boolean = false
): Promise<{ created: string[]; skipped: string[]; errors: string[] }> {
  // Validate prefix format
  if (!isValidLabelPrefix(prefix)) {
    return {
      created: [],
      skipped: [],
      errors: [`Invalid label prefix: ${prefix}. Must contain only letters, numbers, and hyphens.`]
    };
  }

  const labels = generatePriorityLabels(prefix);
  const created: string[] = [];
  const skipped: string[] = [];
  const errors: string[] = [];

  // Fetch all existing labels once to optimize API calls
  let existingLabels: string[] = [];
  try {
    const { stdout } = await execFileAsync('gh', ['label', 'list', '--json', 'name', '--jq', '.[].name']);
    existingLabels = stdout.trim().split('\n').map(l => l.trim()).filter(l => l.length > 0);
  } catch (error) {
    // If we can't fetch labels, proceed cautiously
    if (!quiet) {
      console.log(chalk.yellow('  ⚠️  Could not fetch existing labels, will attempt creation'));
    }
  }

  for (const label of labels) {
    try {
      // Check if label already exists (using cached list)
      if (existingLabels.includes(label.name)) {
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
    await execFileAsync('gh', ['--version']);
    return true;
  } catch (error) {
    return false;
  }
}

/**
 * Validate label prefix format
 * @param prefix - Label prefix to validate
 * @returns True if valid, false otherwise
 */
function isValidLabelPrefix(prefix: string): boolean {
  // Label prefix should only contain lowercase letters, numbers, and hyphens
  // and should not be empty
  return /^[a-z0-9-]+$/i.test(prefix) && prefix.length > 0 && prefix.length <= 50;
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
