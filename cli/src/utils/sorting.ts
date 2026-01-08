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
 */
function extractPriority(labels: string[], prefix: string): number {
  const priorityLabels = labels.filter(l => l.startsWith(prefix));

  if (priorityLabels.length === 0) return 999;

  // Extract numeric part: "priority-1" → "1"
  const value = priorityLabels[0].replace(prefix, '').replace(/^-/, '');
  const numeric = parseInt(value, 10);

  return isNaN(numeric) ? 999 : numeric;
}

/**
 * Sort issues according to strategy
 */
export function sortIssues(issues: Issue[], options: SortOptions): Issue[] {
  const sorted = [...issues];

  sorted.sort((a, b) => {
    let comparison = 0;

    if (options.orderBy === 'priority') {
      const aPriority = extractPriority(a.labels, options.priorityConfig.labelPrefix);
      const bPriority = extractPriority(b.labels, options.priorityConfig.labelPrefix);
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
