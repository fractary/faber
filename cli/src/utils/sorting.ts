/**
 * Issue Sorting Utilities
 *
 * Provides sorting and priority extraction for backlog management
 */

export interface SortOptions {
  orderBy: 'priority' | 'created' | 'updated';
  direction: 'asc' | 'desc';
  priorityConfig: {
    labelPrefix: string;
  };
}

export interface Issue {
  id: string;
  number: number;
  title: string;
  description: string;
  labels: string[];
  url: string;
  state: string;
  createdAt?: string;
  updatedAt?: string;
}

/**
 * Extract numeric priority from issue labels
 * Examples: priority-1 → 1, priority-2 → 2, p-1 → 1
 * Returns 999 if no priority found (sorts last)
 *
 * @param labels - Array of label strings
 * @param prefix - Label prefix to match (e.g., "priority")
 * @param issueNumber - Optional issue number for warning messages
 * @returns Priority number (1-4 for valid priorities, 999 for no/invalid priority)
 */
function extractPriority(labels: string[], prefix: string, issueNumber?: number): number {
  // Use stricter pattern matching: prefix must be followed by hyphen and digits
  const pattern = new RegExp(`^${prefix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}-\\d+$`, 'i');
  const priorityLabels = labels.filter(l => pattern.test(l));

  if (priorityLabels.length === 0) {
    return 999; // No priority label found
  }

  // Warn if multiple priority labels found
  if (priorityLabels.length > 1) {
    const issueRef = issueNumber ? `Issue #${issueNumber}` : 'An issue';
    console.warn(`⚠️  ${issueRef} has multiple priority labels: ${priorityLabels.join(', ')}. Using first match: ${priorityLabels[0]}`);
  }

  // Extract numeric part: "priority-1" → "1"
  const match = priorityLabels[0].match(/-(\d+)$/);
  if (!match) {
    return 999; // Shouldn't happen with regex, but be safe
  }

  const numeric = parseInt(match[1], 10);

  // Validate priority is in reasonable range (1-10)
  // We allow up to 10 to be flexible, but typical range is 1-4
  if (isNaN(numeric) || numeric < 1 || numeric > 10) {
    const issueRef = issueNumber ? `Issue #${issueNumber}` : 'An issue';
    console.warn(`⚠️  ${issueRef} has invalid priority value: ${priorityLabels[0]}. Priority should be between 1-10.`);
    return 999;
  }

  return numeric;
}

/**
 * Sort issues according to strategy
 * @param issues - Array of issues to sort
 * @param options - Sort options including orderBy, direction, and priority config
 * @returns Sorted array of issues
 */
export function sortIssues(issues: Issue[], options: SortOptions): Issue[] {
  const sorted = [...issues];

  sorted.sort((a, b) => {
    let comparison = 0;

    if (options.orderBy === 'priority') {
      // Pass issue numbers for better warning messages
      const aPriority = extractPriority(a.labels, options.priorityConfig.labelPrefix, a.number);
      const bPriority = extractPriority(b.labels, options.priorityConfig.labelPrefix, b.number);
      comparison = aPriority - bPriority; // Lower number = higher priority
    } else if (options.orderBy === 'created' && a.createdAt && b.createdAt) {
      comparison = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
    } else if (options.orderBy === 'updated' && a.updatedAt && b.updatedAt) {
      comparison = new Date(a.updatedAt).getTime() - new Date(b.updatedAt).getTime();
    }

    // Apply direction
    return options.direction === 'asc' ? comparison : -comparison;
  });

  return sorted;
}
