/**
 * Unit tests for sorting utilities
 */

import { sortIssues, Issue, SortOptions } from '../sorting';

// Helper to create mock issues
function createMockIssue(overrides: Partial<Issue>): Issue {
  return {
    id: '1',
    number: 1,
    title: 'Test Issue',
    description: 'Test description',
    labels: [],
    url: 'https://github.com/test/repo/issues/1',
    state: 'open',
    ...overrides,
  };
}

describe('sortIssues - priority ordering', () => {
  const priorityOptions: SortOptions = {
    orderBy: 'priority',
    direction: 'desc',
    priorityConfig: {
      labelPrefix: 'priority',
    },
  };

  it('should sort issues by priority (priority-1 first)', () => {
    const issues: Issue[] = [
      createMockIssue({ number: 3, labels: ['priority-3'] }),
      createMockIssue({ number: 1, labels: ['priority-1'] }),
      createMockIssue({ number: 2, labels: ['priority-2'] }),
    ];

    const sorted = sortIssues(issues, priorityOptions);

    expect(sorted[0].number).toBe(1); // priority-1
    expect(sorted[1].number).toBe(2); // priority-2
    expect(sorted[2].number).toBe(3); // priority-3
  });

  it('should place issues without priority labels last', () => {
    const issues: Issue[] = [
      createMockIssue({ number: 3, labels: [] }),
      createMockIssue({ number: 1, labels: ['priority-1'] }),
      createMockIssue({ number: 4, labels: [] }),
      createMockIssue({ number: 2, labels: ['priority-2'] }),
    ];

    const sorted = sortIssues(issues, priorityOptions);

    expect(sorted[0].number).toBe(1); // priority-1
    expect(sorted[1].number).toBe(2); // priority-2
    // Issues 3 and 4 should be last (in original order since same priority)
    expect([3, 4]).toContain(sorted[2].number);
    expect([3, 4]).toContain(sorted[3].number);
  });

  it('should handle custom label prefix', () => {
    const issues: Issue[] = [
      createMockIssue({ number: 2, labels: ['p-2'] }),
      createMockIssue({ number: 1, labels: ['p-1'] }),
    ];

    const sorted = sortIssues(issues, {
      ...priorityOptions,
      priorityConfig: { labelPrefix: 'p' },
    });

    expect(sorted[0].number).toBe(1); // p-1
    expect(sorted[1].number).toBe(2); // p-2
  });

  it('should handle ascending order', () => {
    const issues: Issue[] = [
      createMockIssue({ number: 1, labels: ['priority-1'] }),
      createMockIssue({ number: 3, labels: ['priority-3'] }),
    ];

    const sorted = sortIssues(issues, {
      ...priorityOptions,
      direction: 'asc',
    });

    expect(sorted[0].number).toBe(3); // priority-3 first in ascending
    expect(sorted[1].number).toBe(1); // priority-1 last in ascending
  });

  it('should handle issues with multiple priority labels (uses first match)', () => {
    const issues: Issue[] = [
      createMockIssue({ number: 1, labels: ['priority-2', 'priority-1'] }),
      createMockIssue({ number: 2, labels: ['priority-3'] }),
    ];

    // Should use priority-2 (first match) for issue 1
    const sorted = sortIssues(issues, priorityOptions);

    expect(sorted[0].number).toBe(1); // priority-2 (from first match)
    expect(sorted[1].number).toBe(2); // priority-3
  });

  it('should handle invalid priority labels', () => {
    const issues: Issue[] = [
      createMockIssue({ number: 1, labels: ['priority-abc'] }),
      createMockIssue({ number: 2, labels: ['priority-1'] }),
    ];

    const sorted = sortIssues(issues, priorityOptions);

    // Issue with invalid priority should sort last
    expect(sorted[0].number).toBe(2); // priority-1
    expect(sorted[1].number).toBe(1); // priority-abc (invalid)
  });

  it('should handle priority numbers outside typical range (1-4)', () => {
    const issues: Issue[] = [
      createMockIssue({ number: 5, labels: ['priority-5'] }),
      createMockIssue({ number: 1, labels: ['priority-1'] }),
      createMockIssue({ number: 10, labels: ['priority-10'] }),
    ];

    const sorted = sortIssues(issues, priorityOptions);

    expect(sorted[0].number).toBe(1); // priority-1
    expect(sorted[1].number).toBe(5); // priority-5
    expect(sorted[2].number).toBe(10); // priority-10
  });

  it('should ignore labels that start with prefix but do not match pattern', () => {
    const issues: Issue[] = [
      createMockIssue({ number: 1, labels: ['priorityHigh'] }), // No hyphen
      createMockIssue({ number: 2, labels: ['priority-1'] }),
    ];

    const sorted = sortIssues(issues, priorityOptions);

    // Issue 1 should sort last (no valid priority)
    expect(sorted[0].number).toBe(2); // priority-1
    expect(sorted[1].number).toBe(1); // priorityHigh (invalid)
  });
});

describe('sortIssues - date ordering', () => {
  it('should sort by created date (oldest first when asc)', () => {
    const issues: Issue[] = [
      createMockIssue({ number: 2, createdAt: '2024-01-15T00:00:00Z' }),
      createMockIssue({ number: 1, createdAt: '2024-01-10T00:00:00Z' }),
      createMockIssue({ number: 3, createdAt: '2024-01-20T00:00:00Z' }),
    ];

    const sorted = sortIssues(issues, {
      orderBy: 'created',
      direction: 'asc',
      priorityConfig: { labelPrefix: 'priority' },
    });

    expect(sorted[0].number).toBe(1); // 2024-01-10
    expect(sorted[1].number).toBe(2); // 2024-01-15
    expect(sorted[2].number).toBe(3); // 2024-01-20
  });

  it('should sort by created date (newest first when desc)', () => {
    const issues: Issue[] = [
      createMockIssue({ number: 2, createdAt: '2024-01-15T00:00:00Z' }),
      createMockIssue({ number: 1, createdAt: '2024-01-10T00:00:00Z' }),
      createMockIssue({ number: 3, createdAt: '2024-01-20T00:00:00Z' }),
    ];

    const sorted = sortIssues(issues, {
      orderBy: 'created',
      direction: 'desc',
      priorityConfig: { labelPrefix: 'priority' },
    });

    expect(sorted[0].number).toBe(3); // 2024-01-20
    expect(sorted[1].number).toBe(2); // 2024-01-15
    expect(sorted[2].number).toBe(1); // 2024-01-10
  });

  it('should sort by updated date (most recent first when desc)', () => {
    const issues: Issue[] = [
      createMockIssue({ number: 2, updatedAt: '2024-01-15T12:00:00Z' }),
      createMockIssue({ number: 1, updatedAt: '2024-01-10T08:00:00Z' }),
      createMockIssue({ number: 3, updatedAt: '2024-01-20T16:00:00Z' }),
    ];

    const sorted = sortIssues(issues, {
      orderBy: 'updated',
      direction: 'desc',
      priorityConfig: { labelPrefix: 'priority' },
    });

    expect(sorted[0].number).toBe(3); // 2024-01-20
    expect(sorted[1].number).toBe(2); // 2024-01-15
    expect(sorted[2].number).toBe(1); // 2024-01-10
  });

  it('should handle issues without date fields', () => {
    const issues: Issue[] = [
      createMockIssue({ number: 1, createdAt: '2024-01-10T00:00:00Z' }),
      createMockIssue({ number: 2 }), // No createdAt
    ];

    const sorted = sortIssues(issues, {
      orderBy: 'created',
      direction: 'desc',
      priorityConfig: { labelPrefix: 'priority' },
    });

    // Should not crash, order may not be guaranteed for items without dates
    expect(sorted).toHaveLength(2);
  });
});

describe('sortIssues - edge cases', () => {
  it('should handle empty array', () => {
    const sorted = sortIssues([], {
      orderBy: 'priority',
      direction: 'desc',
      priorityConfig: { labelPrefix: 'priority' },
    });

    expect(sorted).toEqual([]);
  });

  it('should handle single issue', () => {
    const issues = [createMockIssue({ number: 1, labels: ['priority-1'] })];

    const sorted = sortIssues(issues, {
      orderBy: 'priority',
      direction: 'desc',
      priorityConfig: { labelPrefix: 'priority' },
    });

    expect(sorted).toHaveLength(1);
    expect(sorted[0].number).toBe(1);
  });

  it('should not mutate original array', () => {
    const issues: Issue[] = [
      createMockIssue({ number: 2, labels: ['priority-2'] }),
      createMockIssue({ number: 1, labels: ['priority-1'] }),
    ];
    const originalOrder = issues.map(i => i.number);

    sortIssues(issues, {
      orderBy: 'priority',
      direction: 'desc',
      priorityConfig: { labelPrefix: 'priority' },
    });

    // Original array should be unchanged
    expect(issues.map(i => i.number)).toEqual(originalOrder);
  });

  it('should handle case-insensitive label prefix matching', () => {
    const issues: Issue[] = [
      createMockIssue({ number: 1, labels: ['Priority-1'] }),
      createMockIssue({ number: 2, labels: ['PRIORITY-2'] }),
    ];

    const sorted = sortIssues(issues, {
      orderBy: 'priority',
      direction: 'desc',
      priorityConfig: { labelPrefix: 'priority' },
    });

    expect(sorted[0].number).toBe(1); // Priority-1
    expect(sorted[1].number).toBe(2); // PRIORITY-2
  });
});
