/**
 * Unit tests for existing-plan detection in workflow-plan
 */

import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import { hasExistingPlan } from '../existing-plan.js';

const RUNS_DIR = path.join('.fractary', 'faber', 'runs');

function planFor(workId: string): object {
  return {
    id: `acme-widgets-${workId}`,
    source: { input: `--work-id ${workId}`, work_id: workId, planning_mode: 'work_id' },
    items: [{ target: `issue-${workId}`, work_id: workId, planning_mode: 'work_id' }],
  };
}

describe('hasExistingPlan', () => {
  let root: string;

  beforeEach(async () => {
    root = await fs.mkdtemp(path.join(os.tmpdir(), 'faber-existing-plan-'));
  });

  afterEach(async () => {
    await fs.rm(root, { recursive: true, force: true });
  });

  function planPath(planId: string): string {
    return path.join(root, RUNS_DIR, planId, 'plan.json');
  }

  async function writePlan(planId: string, content: object | string): Promise<void> {
    await fs.mkdir(path.dirname(planPath(planId)), { recursive: true });
    const text = typeof content === 'string' ? content : JSON.stringify(content);
    await fs.writeFile(planPath(planId), text);
  }

  it('does not treat another work item\'s plan in the runs directory as this one\'s (#278)', async () => {
    await writePlan('acme-widgets-119', planFor('119'));
    await writePlan('acme-widgets-200', planFor('200'));

    await expect(hasExistingPlan(planPath('acme-widgets-280'), '280')).resolves.toBe(false);
  });

  it('finds the work item\'s own plan among other work items\' plans', async () => {
    await writePlan('acme-widgets-119', planFor('119'));
    await writePlan('acme-widgets-280', planFor('280'));

    await expect(hasExistingPlan(planPath('acme-widgets-280'), '280')).resolves.toBe(true);
  });

  it('returns false when there is no runs directory', async () => {
    await expect(hasExistingPlan(planPath('acme-widgets-280'), '280')).resolves.toBe(false);
  });

  it('returns false when the plan directory exists without a plan', async () => {
    await fs.mkdir(path.dirname(planPath('acme-widgets-280')), { recursive: true });

    await expect(hasExistingPlan(planPath('acme-widgets-280'), '280')).resolves.toBe(false);
  });

  it('matches a plan that names the work item only in its items', async () => {
    await writePlan('acme-widgets-280', { items: [{ work_id: '280' }] });

    await expect(hasExistingPlan(planPath('acme-widgets-280'), '280')).resolves.toBe(true);
  });

  it('matches a numeric work ID', async () => {
    await writePlan('acme-widgets-280', { source: { work_id: 280 } });

    await expect(hasExistingPlan(planPath('acme-widgets-280'), '280')).resolves.toBe(true);
  });

  it('refuses to overwrite a plan at the work item\'s path that belongs to another work item', async () => {
    await writePlan('acme-widgets-280', planFor('119'));

    await expect(hasExistingPlan(planPath('acme-widgets-280'), '280')).rejects.toThrow(
      /is for work item 119, not 280\. Use --force-new to replace it/
    );
  });

  it('refuses to overwrite a plan that names no work item', async () => {
    await writePlan('acme-widgets-280', { id: 'acme-widgets-280' });

    await expect(hasExistingPlan(planPath('acme-widgets-280'), '280')).rejects.toThrow(
      /is for no work item, not 280/
    );
  });

  it('refuses to overwrite a plan that is not valid JSON', async () => {
    await writePlan('acme-widgets-280', '{ not json');

    await expect(hasExistingPlan(planPath('acme-widgets-280'), '280')).rejects.toThrow(
      /is not valid JSON\. Use --force-new to replace it/
    );
  });

  it('reports a plan path that cannot be read', async () => {
    await fs.mkdir(planPath('acme-widgets-280'), { recursive: true });

    await expect(hasExistingPlan(planPath('acme-widgets-280'), '280')).rejects.toThrow(
      /Could not read the existing plan/
    );
  });
});
