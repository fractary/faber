/**
 * @fractary/faber - Run State Tests
 */

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { RunStateStore } from '../run-state.js';
import type { RunPlanInfo, RunState } from '../run-state.js';

const PLAN: RunPlanInfo = {
  planId: 'acme-app-42',
  workId: '42',
  workflowId: 'default',
  phases: {
    frame: { enabled: true, steps: [{ id: 'fetch-issue' }] },
    build: { enabled: true, steps: [{ id: 'implement' }, { id: 'commit' }] },
    release: { enabled: false, steps: [{ id: 'create-pr' }] },
  },
};

/** A clock that starts at a fixed time and advances one second per call */
function steppingClock(start = '2026-10-06T18:04:05.000Z'): () => Date {
  let t = new Date(start).getTime();
  return () => {
    const d = new Date(t);
    t += 1000;
    return d;
  };
}

function readState(store: RunStateStore): RunState {
  return JSON.parse(fs.readFileSync(store.statePath, 'utf-8')) as RunState;
}

describe('RunStateStore', () => {
  let planDir: string;

  beforeEach(() => {
    planDir = fs.mkdtempSync(path.join(os.tmpdir(), 'faber-run-state-test-'));
  });

  afterEach(() => {
    fs.rmSync(planDir, { recursive: true, force: true });
  });

  describe('create', () => {
    it('writes the initial state next to the plan, named after the run', () => {
      const store = RunStateStore.create(planDir, PLAN, { now: () => new Date('2026-10-06T18:04:05.123Z') });

      expect(store.runId).toBe('acme-app-42-run-2026-10-06T18-04-05Z');
      expect(store.statePath).toBe(path.join(planDir, 'state-2026-10-06T18-04-05Z.json'));

      const state = readState(store);
      expect(state).toMatchObject({
        run_id: 'acme-app-42-run-2026-10-06T18-04-05Z',
        plan_id: 'acme-app-42',
        work_id: '42',
        workflow_id: 'default',
        status: 'in_progress',
        current_phase: null,
        current_step_id: null,
        steps_completed: [],
        artifacts: {},
        started_at: '2026-10-06T18:04:05.123Z',
      });
      expect(state.phases.frame).toEqual({
        status: 'pending',
        steps: { 'fetch-issue': { status: 'pending' } },
        retry_count: 0,
      });
      expect(state.phases.release).toEqual({
        status: 'skipped',
        enabled: false,
        steps: { 'create-pr': { status: 'skipped' } },
        retry_count: 0,
      });
    });

    it('records a phase without enabled: true as skipped', () => {
      const store = RunStateStore.create(planDir, {
        planId: 'p',
        phases: { frame: { steps: [{ id: 'a' }] } },
      });
      expect(store.state.phases.frame.status).toBe('skipped');
      expect(store.state.phases.frame.enabled).toBe(false);
    });

    it('gives runs started in the same second distinct IDs', () => {
      const now = (): Date => new Date('2026-10-06T18:04:05.000Z');
      const first = RunStateStore.create(planDir, PLAN, { now });
      const second = RunStateStore.create(planDir, PLAN, { now });
      const third = RunStateStore.create(planDir, PLAN, { now });

      expect(first.runId).toBe('acme-app-42-run-2026-10-06T18-04-05Z');
      expect(second.runId).toBe('acme-app-42-run-2026-10-06T18-04-05Z-2');
      expect(third.runId).toBe('acme-app-42-run-2026-10-06T18-04-05Z-3');
      expect(second.statePath).toBe(path.join(planDir, 'state-2026-10-06T18-04-05Z-2.json'));
    });

    it('leaves no temporary files behind', () => {
      const store = RunStateStore.create(planDir, PLAN);
      store.startStep('frame', 'fetch-issue');
      expect(fs.readdirSync(planDir)).toEqual([path.basename(store.statePath)]);
    });
  });

  describe('load', () => {
    it('loads a run saved earlier', () => {
      const created = RunStateStore.create(planDir, PLAN);
      created.startStep('frame', 'fetch-issue');
      created.finishStep('frame', 'fetch-issue', { result: 'success' });

      const loaded = RunStateStore.load(planDir, created.runId);
      expect(loaded.isStepDone('frame', 'fetch-issue')).toBe(true);
      expect(loaded.state).toEqual(created.state);
    });

    it('throws when the run has no state file', () => {
      expect(() => RunStateStore.load(planDir, 'acme-app-42-run-2026-10-06T18-04-05Z')).toThrow(
        /Run state not found/
      );
    });

    it('throws when the state file belongs to another run', () => {
      const store = RunStateStore.create(planDir, PLAN);
      const other = { ...readState(store), run_id: 'someone-else-run-2026-10-06T18-04-05Z' };
      fs.writeFileSync(store.statePath, JSON.stringify(other));
      expect(() => RunStateStore.load(planDir, store.runId)).toThrow(/belongs to run/);
    });

    it('rejects run IDs that are not plan-scoped', () => {
      expect(() => RunStateStore.load(planDir, 'acme-app-42')).toThrow(/Invalid run ID/);
    });
  });

  describe('step and phase transitions', () => {
    it('records step progress, attempts and current position', () => {
      const store = RunStateStore.create(planDir, PLAN, { now: steppingClock() });
      store.begin();
      store.startPhase('build');
      store.startStep('build', 'implement');

      let state = readState(store);
      expect(state.current_phase).toBe('build');
      expect(state.current_step_id).toBe('build:implement');
      expect(state.phases.build.status).toBe('in_progress');
      expect(state.phases.build.steps.implement).toMatchObject({ status: 'in_progress', attempts: 1 });

      store.finishStep('build', 'implement', { result: 'failure', error: 'tests failed', duration_ms: 12 });
      state = readState(store);
      expect(state.phases.build.steps.implement).toMatchObject({
        status: 'failed',
        result: 'failure',
        error: 'tests failed',
        duration_ms: 12,
      });
      expect(state.steps_completed).toEqual([]);

      // Retrying the step clears the previous outcome and counts the attempt
      store.startStep('build', 'implement');
      state = readState(store);
      expect(state.phases.build.steps.implement).toEqual(
        expect.objectContaining({ status: 'in_progress', attempts: 2 })
      );
      expect(state.phases.build.steps.implement.error).toBeUndefined();

      store.finishStep('build', 'implement', { result: 'warning' });
      state = readState(store);
      expect(state.phases.build.steps.implement.status).toBe('completed');
      expect(state.steps_completed).toEqual(['build:implement']);
    });

    it('fails a phase with a failed step', () => {
      const store = RunStateStore.create(planDir, PLAN);
      store.startPhase('build');
      store.startStep('build', 'implement');
      store.finishStep('build', 'implement', { result: 'failure', error: 'boom' });
      store.finishPhase('build');
      expect(store.state.phases.build).toMatchObject({ status: 'failed', error: 'boom' });
    });

    it('completes a phase once every step is done, and keeps it completed on resume', () => {
      const store = RunStateStore.create(planDir, PLAN);
      store.startPhase('frame');
      store.startStep('frame', 'fetch-issue');
      store.finishStep('frame', 'fetch-issue', { result: 'success' });
      store.finishPhase('frame');
      const completedAt = store.state.phases.frame.completed_at;
      expect(store.state.phases.frame.status).toBe('completed');

      store.startPhase('frame');
      store.finishPhase('frame');
      expect(store.state.phases.frame.status).toBe('completed');
      expect(store.state.phases.frame.completed_at).toBe(completedAt);
    });

    it('skips a disabled phase and its unfinished steps', () => {
      const store = RunStateStore.create(planDir, PLAN);
      store.startStep('build', 'implement');
      store.finishStep('build', 'implement', { result: 'success' });
      store.skipPhase('build');

      expect(store.state.phases.build).toMatchObject({
        status: 'skipped',
        enabled: false,
        steps: { implement: { status: 'completed' }, commit: { status: 'skipped' } },
      });
    });

    it('runs the skipped steps of a phase that is enabled again', () => {
      const store = RunStateStore.create(planDir, PLAN);
      store.startPhase('release');

      const release = store.state.phases.release;
      expect(release.status).toBe('in_progress');
      expect(release.enabled).toBeUndefined();
      expect(release.steps['create-pr'].status).toBe('pending');
      expect(store.isStepDone('release', 'create-pr')).toBe(false);
    });

    it('leaves a phase in progress while some of its steps have not run', () => {
      const store = RunStateStore.create(planDir, PLAN);
      store.startPhase('build');
      store.startStep('build', 'implement');
      store.finishStep('build', 'implement', { result: 'success' });
      store.finishPhase('build');
      expect(store.state.phases.build.status).toBe('in_progress');
    });
  });

  describe('finish', () => {
    function completeAll(store: RunStateStore): void {
      for (const [phase, steps] of [['frame', ['fetch-issue']], ['build', ['implement', 'commit']]] as const) {
        store.startPhase(phase);
        for (const step of steps) {
          store.startStep(phase, step);
          store.finishStep(phase, step, { result: 'success' });
        }
        store.finishPhase(phase);
      }
    }

    it('completes the run when every step of every enabled phase is done', () => {
      const store = RunStateStore.create(planDir, PLAN);
      completeAll(store);
      expect(store.finish()).toBe('completed');
      expect(readState(store)).toMatchObject({ status: 'completed' });
      expect(readState(store).completed_at).toBeDefined();
    });

    it('fails the run when a step failed', () => {
      const store = RunStateStore.create(planDir, PLAN);
      completeAll(store);
      store.startStep('build', 'commit');
      store.finishStep('build', 'commit', { result: 'failure' });
      expect(store.finish()).toBe('failed');
      expect(store.state.error).toBe('1 step(s) failed');
    });

    it('fails the run with the given message', () => {
      const store = RunStateStore.create(planDir, PLAN);
      expect(store.finish('Step build:implement failed')).toBe('failed');
      expect(store.state.error).toBe('Step build:implement failed');
    });

    it('pauses the run when some steps have not run', () => {
      const store = RunStateStore.create(planDir, PLAN);
      store.startStep('frame', 'fetch-issue');
      store.finishStep('frame', 'fetch-issue', { result: 'success' });
      expect(store.finish()).toBe('paused');
      expect(store.state.pause_reason).toMatch(/Not every step has run/);
    });

    it('clears the previous outcome when the run begins again', () => {
      const store = RunStateStore.create(planDir, PLAN);
      store.finish('interrupted');
      store.begin();
      const state = store.state;
      expect(state.status).toBe('in_progress');
      expect(state.error).toBeUndefined();
      expect(state.completed_at).toBeUndefined();
      expect(state.pause_reason).toBeUndefined();
    });
  });

  describe('listing', () => {
    it('lists the runs of a plan newest first and skips unreadable files', () => {
      const clock = steppingClock();
      const older = RunStateStore.create(planDir, PLAN, { now: clock });
      const newer = RunStateStore.create(planDir, PLAN, { now: clock });
      fs.writeFileSync(path.join(planDir, 'state-corrupt.json'), '{ not json');
      fs.writeFileSync(path.join(planDir, 'plan.json'), '{}');

      const runs = RunStateStore.listForPlan(planDir);
      expect(runs.map((r) => r.run_id)).toEqual([newer.runId, older.runId]);
    });

    it('returns no runs for a missing directory', () => {
      expect(RunStateStore.listForPlan(path.join(planDir, 'missing'))).toEqual([]);
      expect(RunStateStore.listAll(path.join(planDir, 'missing'))).toEqual([]);
    });

    it('lists runs across plans and filters by work ID', () => {
      const runsDir = planDir;
      const clock = steppingClock();
      const a = RunStateStore.create(path.join(runsDir, 'acme-app-42'), PLAN, { now: clock });
      const b = RunStateStore.create(
        path.join(runsDir, 'acme-app-43'),
        { ...PLAN, planId: 'acme-app-43', workId: '43' },
        { now: clock }
      );
      fs.writeFileSync(path.join(runsDir, '.active-run-id'), a.runId);

      expect(RunStateStore.listAll(runsDir).map((r) => r.run_id)).toEqual([b.runId, a.runId]);
      expect(RunStateStore.listAll(runsDir, { workId: '42' }).map((r) => r.run_id)).toEqual([a.runId]);
    });
  });
});
