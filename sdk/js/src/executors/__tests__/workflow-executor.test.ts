/**
 * @fractary/faber - Workflow Executor Tests
 *
 * Run state and resume behavior of the CLI-native workflow executor.
 */

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { WorkflowExecutor } from '../workflow-executor.js';
import type { WorkflowExecuteOptions } from '../workflow-executor.js';
import { ExecutorRegistry } from '../registry.js';
import type { Executor, ExecutorResult, ExecutionContext } from '../types.js';
import type { ClaudeAgentExecuteOptions } from '../providers/claude-agent.js';
import type { ResolvedPhase } from '../../workflow/resolver.js';
import { RunStateStore } from '../../state/run-state.js';

type Outcome = ExecutorResult['status'] | 'throw';

/** Executor that records the steps it runs and returns scripted outcomes */
class FakeExecutor implements Executor {
  readonly provider = 'claude-agent';
  readonly calls: Array<ExecutionContext & ClaudeAgentExecuteOptions> = [];

  constructor(private readonly outcomes: Record<string, Outcome> = {}) {}

  execute(_prompt: string, context: ExecutionContext): Promise<ExecutorResult> {
    this.calls.push(context as ExecutionContext & ClaudeAgentExecuteOptions);
    const outcome = this.outcomes[context.stepId] ?? 'success';
    if (outcome === 'throw') {
      return Promise.reject(new Error(`executor crashed on ${context.stepId}`));
    }
    return Promise.resolve({
      output: `ran ${context.stepId}`,
      status: outcome,
      metadata: { provider: 'fake', duration_ms: 5 },
      ...(outcome === 'failure' && { error: `${context.stepId} failed` }),
    });
  }

  validate(): Promise<{ valid: boolean }> {
    return Promise.resolve({ valid: true });
  }

  get stepIds(): string[] {
    return this.calls.map((c) => c.stepId);
  }
}

function phase(enabled: boolean, stepIds: string[]): ResolvedPhase {
  return { enabled, steps: stepIds.map((id) => ({ id, name: id, prompt: `Do ${id}` })) };
}

function makeWorkflow(): Parameters<WorkflowExecutor['execute']>[0] {
  return {
    phases: {
      frame: phase(true, ['fetch-issue']),
      architect: phase(false, ['write-spec']),
      build: phase(true, ['implement', 'commit']),
      evaluate: phase(true, ['test']),
      release: phase(true, ['create-pr']),
    },
  };
}

function makeExecutor(fake: FakeExecutor): WorkflowExecutor {
  const registry = new ExecutorRegistry();
  registry.register('claude-agent', () => fake);
  return new WorkflowExecutor(registry);
}

describe('WorkflowExecutor run state', () => {
  let planDir: string;
  let workflow: ReturnType<typeof makeWorkflow>;
  let baseOptions: WorkflowExecuteOptions;

  const newRun = (): RunStateStore =>
    RunStateStore.create(planDir, {
      planId: 'acme-app-42',
      workId: '42',
      workflowId: 'default',
      phases: workflow.phases,
    });

  beforeEach(() => {
    planDir = fs.mkdtempSync(path.join(os.tmpdir(), 'faber-executor-test-'));
    workflow = makeWorkflow();
    baseOptions = { workId: '42', workingDirectory: planDir };
  });

  afterEach(() => {
    fs.rmSync(planDir, { recursive: true, force: true });
  });

  it('runs without run state as before', async () => {
    const fake = new FakeExecutor();
    const result = await makeExecutor(fake).execute(workflow, baseOptions);

    expect(result.status).toBe('completed');
    expect(result.steps_completed).toBe(5);
    expect(result.run_id).toBeUndefined();
    expect(fake.stepIds).toEqual(['fetch-issue', 'implement', 'commit', 'test', 'create-pr']);
    expect(fs.readdirSync(planDir)).toEqual([]);
  });

  it('saves every step and completes the run', async () => {
    const fake = new FakeExecutor();
    const runState = newRun();
    const result = await makeExecutor(fake).execute(workflow, { ...baseOptions, runState });

    expect(result).toMatchObject({
      status: 'completed',
      steps_completed: 5,
      steps_already_completed: 0,
      run_id: runState.runId,
      state_path: runState.statePath,
      run_status: 'completed',
    });

    const state = RunStateStore.load(planDir, runState.runId).state;
    expect(state.status).toBe('completed');
    expect(state.steps_completed).toEqual([
      'frame:fetch-issue',
      'build:implement',
      'build:commit',
      'evaluate:test',
      'release:create-pr',
    ]);
    expect(state.phases.architect.status).toBe('skipped');
    expect(state.phases.build).toMatchObject({
      status: 'completed',
      steps: { implement: { status: 'completed', result: 'success', attempts: 1, duration_ms: 5 } },
    });
  });

  it('gives each step the run ID and state path', async () => {
    const fake = new FakeExecutor();
    const runState = newRun();
    await makeExecutor(fake).execute(workflow, { ...baseOptions, runState });

    for (const call of fake.calls) {
      expect(call.runId).toBe(runState.runId);
      expect(call.promptContext?.metadata.run_id).toBe(runState.runId);
      expect(call.promptContext?.metadata.state_path).toBe(runState.statePath);
    }
  });

  it('resumes an interrupted run from the step that was running', async () => {
    // Simulate a run killed while `build:commit` was executing
    const interrupted = newRun();
    interrupted.begin();
    for (const [phaseName, stepId] of [['frame', 'fetch-issue'], ['build', 'implement']] as const) {
      interrupted.startPhase(phaseName);
      interrupted.startStep(phaseName, stepId);
      interrupted.finishStep(phaseName, stepId, { result: 'success' });
    }
    interrupted.startStep('build', 'commit');

    const fake = new FakeExecutor();
    const skipped: string[] = [];
    const runState = RunStateStore.load(planDir, interrupted.runId);
    const result = await makeExecutor(fake).execute(workflow, {
      ...baseOptions,
      runState,
      onStepSkipped: (phaseName, step) => skipped.push(`${phaseName}:${step.id}`),
    });

    expect(skipped).toEqual(['frame:fetch-issue', 'build:implement']);
    expect(fake.stepIds).toEqual(['commit', 'test', 'create-pr']);
    expect(result).toMatchObject({
      status: 'completed',
      steps_completed: 5,
      steps_already_completed: 2,
      run_status: 'completed',
    });

    const state = runState.state;
    expect(state.phases.build.steps.commit).toMatchObject({ status: 'completed', attempts: 2 });
    expect(state.phases.frame.status).toBe('completed');
  });

  it('fails the run at a stopping failure and re-runs the failed step on resume', async () => {
    const runState = newRun();
    const first = await makeExecutor(new FakeExecutor({ commit: 'failure' })).execute(workflow, {
      ...baseOptions,
      runState,
    });

    expect(first.status).toBe('failed');
    expect(first.run_status).toBe('failed');
    let state = RunStateStore.load(planDir, runState.runId).state;
    expect(state.status).toBe('failed');
    expect(state.error).toBe('Step build:commit failed: commit failed');
    expect(state.phases.build.status).toBe('failed');
    expect(state.phases.evaluate.steps.test.status).toBe('pending');

    const fake = new FakeExecutor();
    const resumed = await makeExecutor(fake).execute(workflow, {
      ...baseOptions,
      runState: RunStateStore.load(planDir, runState.runId),
    });

    expect(fake.stepIds).toEqual(['commit', 'test', 'create-pr']);
    expect(resumed.run_status).toBe('completed');
    state = RunStateStore.load(planDir, runState.runId).state;
    expect(state.status).toBe('completed');
    expect(state.error).toBeUndefined();
    expect(state.phases.build).toMatchObject({ status: 'completed' });
  });

  it('records a failed step that does not stop the workflow as a failed run', async () => {
    workflow.result_handling = { on_failure: 'continue' };
    const runState = newRun();
    const result = await makeExecutor(new FakeExecutor({ test: 'failure' })).execute(workflow, {
      ...baseOptions,
      runState,
    });

    expect(result.status).toBe('completed');
    expect(result.run_status).toBe('failed');
    expect(runState.state.error).toBe('1 step(s) failed');
    expect(runState.state.phases.release.status).toBe('completed');
  });

  it('pauses the run when a phase filter leaves steps unrun, and finishes it on resume', async () => {
    const runState = newRun();
    const partial = await makeExecutor(new FakeExecutor()).execute(workflow, {
      ...baseOptions,
      runState,
      phasesToRun: ['frame', 'build'],
    });

    expect(partial.status).toBe('completed');
    expect(partial.run_status).toBe('paused');

    const fake = new FakeExecutor();
    const resumed = await makeExecutor(fake).execute(workflow, {
      ...baseOptions,
      runState: RunStateStore.load(planDir, runState.runId),
    });

    expect(fake.stepIds).toEqual(['test', 'create-pr']);
    expect(resumed.run_status).toBe('completed');
  });

  it('completes a resumed run whose state records a disabled phase as pending', async () => {
    // The workflow-run skill records every phase as pending, disabled ones included
    const runState = RunStateStore.create(planDir, {
      planId: 'acme-app-42',
      phases: { ...workflow.phases, architect: { ...workflow.phases.architect, enabled: true } },
    });
    expect(runState.state.phases.architect.status).toBe('pending');

    const result = await makeExecutor(new FakeExecutor()).execute(workflow, { ...baseOptions, runState });

    expect(result.run_status).toBe('completed');
    expect(runState.state.phases.architect).toMatchObject({
      status: 'skipped',
      enabled: false,
      steps: { 'write-spec': { status: 'skipped' } },
    });
  });

  it('runs a phase that was disabled when the run started and is enabled on resume', async () => {
    const runState = newRun();
    await makeExecutor(new FakeExecutor()).execute(workflow, { ...baseOptions, runState, phasesToRun: ['frame'] });

    workflow.phases.architect.enabled = true;
    const fake = new FakeExecutor();
    const resumed = await makeExecutor(fake).execute(workflow, {
      ...baseOptions,
      runState: RunStateStore.load(planDir, runState.runId),
    });

    expect(fake.stepIds).toEqual(['write-spec', 'implement', 'commit', 'test', 'create-pr']);
    expect(resumed.run_status).toBe('completed');
  });

  it('marks the run failed when a step executor throws', async () => {
    const runState = newRun();
    await expect(
      makeExecutor(new FakeExecutor({ implement: 'throw' })).execute(workflow, { ...baseOptions, runState })
    ).rejects.toThrow('executor crashed on implement');

    const state = RunStateStore.load(planDir, runState.runId).state;
    expect(state.status).toBe('failed');
    expect(state.error).toBe('executor crashed on implement');
    expect(state.phases.build.steps.implement).toMatchObject({
      status: 'failed',
      error: 'executor crashed on implement',
    });
  });
});
