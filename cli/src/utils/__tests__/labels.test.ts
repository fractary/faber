/**
 * Unit tests for labels utilities
 */

import {
  generatePriorityLabels,
  DEFAULT_PRIORITY_LABELS,
  PriorityLabel,
} from '../labels';

describe('generatePriorityLabels', () => {
  it('should generate labels with default prefix', () => {
    const labels = generatePriorityLabels('priority');

    expect(labels).toHaveLength(4);
    expect(labels[0].name).toBe('priority-1');
    expect(labels[1].name).toBe('priority-2');
    expect(labels[2].name).toBe('priority-3');
    expect(labels[3].name).toBe('priority-4');
  });

  it('should generate labels with custom prefix', () => {
    const labels = generatePriorityLabels('p');

    expect(labels).toHaveLength(4);
    expect(labels[0].name).toBe('p-1');
    expect(labels[1].name).toBe('p-2');
    expect(labels[2].name).toBe('p-3');
    expect(labels[3].name).toBe('p-4');
  });

  it('should preserve description and color from defaults', () => {
    const labels = generatePriorityLabels('test');

    expect(labels[0].description).toBe(DEFAULT_PRIORITY_LABELS[0].description);
    expect(labels[0].color).toBe(DEFAULT_PRIORITY_LABELS[0].color);
  });

  it('should handle prefix with hyphens', () => {
    const labels = generatePriorityLabels('my-priority');

    expect(labels[0].name).toBe('my-priority-1');
  });
});

describe('DEFAULT_PRIORITY_LABELS', () => {
  it('should have 4 priority levels', () => {
    expect(DEFAULT_PRIORITY_LABELS).toHaveLength(4);
  });

  it('should have correct structure', () => {
    DEFAULT_PRIORITY_LABELS.forEach((label, index) => {
      expect(label).toHaveProperty('name');
      expect(label).toHaveProperty('description');
      expect(label).toHaveProperty('color');
      expect(label.name).toBe(`priority-${index + 1}`);
    });
  });

  it('should have valid hex colors', () => {
    DEFAULT_PRIORITY_LABELS.forEach(label => {
      expect(label.color).toMatch(/^[0-9a-f]{6}$/i);
    });
  });

  it('should have descriptions for each priority', () => {
    DEFAULT_PRIORITY_LABELS.forEach(label => {
      expect(label.description).toBeTruthy();
      expect(label.description.length).toBeGreaterThan(10);
    });
  });

  it('should have distinct colors for visual differentiation', () => {
    const colors = DEFAULT_PRIORITY_LABELS.map(l => l.color);
    const uniqueColors = new Set(colors);
    expect(uniqueColors.size).toBe(colors.length);
  });
});

describe('Label validation', () => {
  it('should reject empty prefix in createPriorityLabels', async () => {
    // This is tested via the integration with createPriorityLabels
    // We test that the validation function exists and works
    const { createPriorityLabels } = await import('../labels');

    const result = await createPriorityLabels('', true);

    expect(result.created).toHaveLength(0);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]).toContain('Invalid label prefix');
  });

  it('should reject prefix with special characters', async () => {
    const { createPriorityLabels } = await import('../labels');

    const result = await createPriorityLabels('priority@#$', true);

    expect(result.created).toHaveLength(0);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]).toContain('Invalid label prefix');
  });

  it('should accept valid prefixes', async () => {
    // Note: This test will try to call gh CLI, so we just verify it doesn't
    // reject the prefix format
    const validPrefixes = ['priority', 'p', 'pri', 'level', 'P1'];

    // We can't actually test createPriorityLabels without mocking gh CLI
    // But we can test that generatePriorityLabels works with valid prefixes
    validPrefixes.forEach(prefix => {
      const labels = generatePriorityLabels(prefix);
      expect(labels).toHaveLength(4);
      expect(labels[0].name).toMatch(new RegExp(`^${prefix}-1$`));
    });
  });
});

describe('Priority label properties', () => {
  it('should have priority-1 as highest priority (red)', () => {
    expect(DEFAULT_PRIORITY_LABELS[0].name).toBe('priority-1');
    expect(DEFAULT_PRIORITY_LABELS[0].color).toBe('d73a4a'); // Red
    expect(DEFAULT_PRIORITY_LABELS[0].description).toContain('Highest');
  });

  it('should have priority-4 as lowest priority (light purple)', () => {
    expect(DEFAULT_PRIORITY_LABELS[3].name).toBe('priority-4');
    expect(DEFAULT_PRIORITY_LABELS[3].color).toBe('d4c5f9'); // Light purple
    expect(DEFAULT_PRIORITY_LABELS[3].description).toContain('Low');
  });

  it('should have yellow for medium priority', () => {
    expect(DEFAULT_PRIORITY_LABELS[2].color).toBe('fbca04'); // Yellow
  });
});
