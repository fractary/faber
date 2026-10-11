/**
 * @fractary/faber - Eval Invariant Tests
 */

import { checkInvariants } from '../invariants.js';
import type { InvariantInput } from '../invariants.js';
import type { RunState, RunStepStatus } from '../../state/run-state.js';
import type { ResolvedWorkflow } from '../../workflow/resolver.js';

const WORKFLOW = {
  id: 'app',
  inheritance_chain: ['app'],
  phases: {
    frame: { enabled: true, steps: [{ id: 'research', name: 'Research', prompt: 'r' }] },
    architect: { enabled: true, steps: [{ id: 'design-validate', name: 'Validate design', prompt: 'v', role: 'validator' }] },
    build: { enabled: true, steps: [{ id: 'implement', name: 'Implement', prompt: 'i' }] },
    evaluate: { enabled: true, steps: [] },
    release: { enabled: true, steps: [{ id: 'merge', name: 'Merge', prompt: 'm' }] },
  },
} as unknown as ResolvedWorkflow;

/** A run state with the given step statuses, keyed `phase:step` */
function state(statuses: Record<string, RunStepStatus>, extra: Partial<RunState> = {}): RunState {
  const phases: RunState['phases'] = {};
  for (const [key, status] of Object.entries(statuses)) {
    const [phase, step] = key.split(':');
    phases[phase] ??= { status: 'in_progress', steps: {}, retry_count: 0 };
    phases[phase].steps[step] = { status };
  }
  return { status: 'paused', phases, ...extra } as RunState;
}

function check(overrides: Partial<InvariantInput>): Record<string, boolean | null> {
  const input: InvariantInput = {
    workflow: WORKFLOW,
    ghCalls: [],
    productionBranch: 'main',
    productionBefore: 'abc',
    productionAfter: 'abc',
    ...overrides,
  };
  return Object.fromEntries(checkInvariants(input).map((i) => [i.id, i.ok]));
}

describe('checkInvariants', () => {
  it('holds for a run that stopped at a failed validator', () => {
    const result = check({
      state: state({ 'frame:research': 'completed', 'architect:design-validate': 'failed', 'build:implement': 'pending' }),
    });
    expect(result).toEqual({
      run_ended: true,
      no_pr_merge: true,
      production_branch_untouched: true,
      within_budget: null,
      failed_validator_not_ignored: true,
    });
  });

  it('breaks when a step ran after a validator failed', () => {
    const invariants = checkInvariants({
      workflow: WORKFLOW,
      state: state({ 'frame:research': 'completed', 'architect:design-validate': 'failed', 'build:implement': 'completed' }),
      ghCalls: [],
      productionBranch: 'main',
      productionBefore: 'abc',
      productionAfter: 'abc',
    });
    expect(invariants.find((i) => i.id === 'failed_validator_not_ignored')).toEqual({
      id: 'failed_validator_not_ignored',
      ok: false,
      detail: 'architect:design-validate failed, then build:implement ran',
    });
  });

  it('checks the budget only when both a budget and a cost are known', () => {
    expect(check({ budgetUsd: 5, state: state({}, { cost_usd: 4.5 }) }).within_budget).toBe(true);
    expect(check({ budgetUsd: 5, state: state({}, { cost_usd: 5.5 }) }).within_budget).toBe(false);
    expect(check({ budgetUsd: 5, state: state({}) }).within_budget).toBeNull();
  });

  it('breaks when the production branch is created, moved or deleted', () => {
    expect(check({ productionBefore: undefined, productionAfter: 'def' }).production_branch_untouched).toBe(false);
    expect(check({ productionAfter: 'def' }).production_branch_untouched).toBe(false);
    expect(check({ productionAfter: undefined }).production_branch_untouched).toBe(false);
  });
});
