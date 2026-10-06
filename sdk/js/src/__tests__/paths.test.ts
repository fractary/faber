/**
 * @fractary/faber - Run Path Tests
 */

import * as path from 'path';
import { parseRunId, getRunDir, getPlanPath, getStatePath, FABER_RUNS_DIR } from '../paths.js';

const ROOT = path.join(path.sep, 'project');
const RUNS = path.join(ROOT, FABER_RUNS_DIR);

describe('parseRunId', () => {
  it('splits a plan-scoped run ID into plan ID and suffix', () => {
    expect(parseRunId('acme-app-42-run-2026-10-06T18-04-05Z')).toEqual({
      planId: 'acme-app-42',
      suffix: '2026-10-06T18-04-05Z',
    });
  });

  it('accepts the collision suffix of runs started in the same second', () => {
    expect(parseRunId('acme-app-42-run-2026-10-06T18-04-05Z-2')).toEqual({
      planId: 'acme-app-42',
      suffix: '2026-10-06T18-04-05Z-2',
    });
  });

  it('uses the last marker when the plan ID contains "-run-"', () => {
    expect(parseRunId('acme-dry-run-tool-7-run-2026-10-06T18-04-05Z')).toEqual({
      planId: 'acme-dry-run-tool-7',
      suffix: '2026-10-06T18-04-05Z',
    });
  });

  it('returns null for IDs that are not plan-scoped', () => {
    expect(parseRunId('acme-app-42')).toBeNull();
    expect(parseRunId('fractary/my-project/a1b2c3d4')).toBeNull();
    expect(parseRunId('acme-app-42-run-latest')).toBeNull();
    expect(parseRunId('-run-2026-10-06T18-04-05Z')).toBeNull();
  });
});

describe('run paths', () => {
  const runId = 'acme-app-42-run-2026-10-06T18-04-05Z';

  it('resolves a plan-scoped run ID to its plan directory', () => {
    expect(getRunDir(runId, ROOT)).toBe(path.join(RUNS, 'acme-app-42'));
    expect(getPlanPath(runId, ROOT)).toBe(path.join(RUNS, 'acme-app-42', 'plan.json'));
    expect(getStatePath(runId, ROOT)).toBe(path.join(RUNS, 'acme-app-42', 'state-2026-10-06T18-04-05Z.json'));
  });

  it('keeps the run-directory layout for other IDs', () => {
    expect(getRunDir('acme-app-42', ROOT)).toBe(path.join(RUNS, 'acme-app-42'));
    expect(getPlanPath('acme-app-42', ROOT)).toBe(path.join(RUNS, 'acme-app-42', 'plan.json'));
    expect(getStatePath('acme-app-42', ROOT)).toBe(path.join(RUNS, 'acme-app-42', 'state.json'));
  });
});
