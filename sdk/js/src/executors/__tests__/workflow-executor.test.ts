/**
 * @fractary/faber - Workflow Executor Tests
 *
 * Run state and resume behavior of the CLI-native workflow executor.
 */

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { WorkflowExecutor } from '../workflow-executor.js';
import type { WorkflowExecuteOptions, WorkflowExecuteResult } from '../workflow-executor.js';
import { ExecutorRegistry } from '../registry.js';
import type { Executor, ExecutorResult, ExecutionContext } from '../types.js';
import { ClaudeAgentExecutor } from '../providers/claude-agent.js';
import type { ClaudeAgentExecuteOptions } from '../providers/claude-agent.js';
import type { ResolvedPhase } from '../../workflow/resolver.js';
import { RunStateStore } from '../../state/run-state.js';
import { getPlanRoot, FABER_RUNS_DIR } from '../../paths.js';

/**
 * Scripted step outcomes:
 * - success: the session ends normally and reports success in a response block
 * - failure: the executor could not run the step
 * - reports_failure: the session ends normally and reports failure in a response block
 * - silent: the session ends normally without a response block
 * - throw: the executor throws
 */
type Outcome = 'success' | 'failure' | 'reports_failure' | 'silent' | 'throw';

/** The result an executor returns for a step with a scripted outcome */
function scriptedResult(id: string, outcome: Outcome): Promise<ExecutorResult> {
  if (outcome === 'throw') {
    return Promise.reject(new Error(`executor crashed on ${id}`));
  }
  const metadata = { provider: 'fake', duration_ms: 5 };
  if (outcome === 'failure') {
    return Promise.resolve({ output: '', status: 'failure', error: `${id} failed`, metadata });
  }
  const output =
    outcome === 'silent' ? `ran ${id}`
    : outcome === 'reports_failure'
      ? `Checked ${id}.\n\n${JSON.stringify({ status: 'failure', message: `${id} checks failed`, errors: [`${id}: 2 tests failed`] })}`
      : `Done.\n\n\`\`\`json\n${JSON.stringify({ status: 'success', message: `ran ${id}` })}\n\`\`\``;
  return Promise.resolve({ output, status: 'success', metadata });
}

/** Executor that records the steps it runs and returns scripted outcomes */
class FakeExecutor implements Executor {
  readonly provider = 'claude-agent';
  readonly calls: Array<ExecutionContext & ClaudeAgentExecuteOptions> = [];

  constructor(private readonly outcomes: Record<string, Outcome> = {}) {}

  execute(_prompt: string, context: ExecutionContext): Promise<ExecutorResult> {
    this.calls.push(context as ExecutionContext & ClaudeAgentExecuteOptions);
    return scriptedResult(context.stepId, this.outcomes[context.stepId] ?? 'success');
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

function makeExecutor(fake: Executor): WorkflowExecutor {
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

describe('WorkflowExecutor working directory', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'faber-cwd-test-')));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it.each([
    ['with a worktree', ['.claude-worktrees', 'acme-app-42']],
    ['without a worktree', ['project']],
  ])('runs steps in the root of a plan created %s', async (_label, rootParts) => {
    const root = path.join(tmpDir, ...rootParts);
    const planPath = path.join(root, FABER_RUNS_DIR, 'acme-app-42', 'plan.json');
    fs.mkdirSync(path.dirname(planPath), { recursive: true });
    fs.writeFileSync(planPath, '{}');

    const workflow = makeWorkflow();
    workflow.phases.frame.steps = [{ id: 'where', name: 'where', prompt: '!pwd' }];
    workflow.phases.build.enabled = false;
    workflow.phases.evaluate.enabled = false;
    workflow.phases.release.enabled = false;

    const registry = new ExecutorRegistry();
    registry.register('claude-agent', () => new ClaudeAgentExecutor());
    const result = await new WorkflowExecutor(registry).execute(workflow, {
      workId: '42',
      workingDirectory: getPlanRoot(planPath) ?? undefined,
    });

    const step = result.phases.find((p) => p.phase === 'frame')?.steps[0];
    expect(step?.result.status).toBe('success');
    expect(step?.result.output).toBe(root);
  });
});

describe('WorkflowExecutor step verdicts', () => {
  let planDir: string;
  let workflow: ReturnType<typeof makeWorkflow>;

  const newRun = (): RunStateStore =>
    RunStateStore.create(planDir, { planId: 'acme-app-42', phases: workflow.phases });

  beforeEach(() => {
    planDir = fs.mkdtempSync(path.join(os.tmpdir(), 'faber-verdict-test-'));
    workflow = makeWorkflow();
  });

  afterEach(() => {
    fs.rmSync(planDir, { recursive: true, force: true });
  });

  it('stops the phase when a step reports failure in its response block', async () => {
    const fake = new FakeExecutor({ implement: 'reports_failure' });
    const runState = newRun();
    const result = await makeExecutor(fake).execute(workflow, { workId: '42', workingDirectory: planDir, runState });

    expect(result.status).toBe('failed');
    expect(fake.stepIds).toEqual(['fetch-issue', 'implement']);
    const implement = result.phases.find((p) => p.phase === 'build')?.steps[0].result;
    expect(implement).toMatchObject({ status: 'failure', error: 'implement: 2 tests failed' });
    expect(implement?.response?.message).toBe('implement checks failed');
    expect(runState.state.phases.build.steps.implement).toMatchObject({
      status: 'failed',
      result: 'failure',
      error: 'implement: 2 tests failed',
    });
  });

  it('records a warning with the reason when a step returns no response block', async () => {
    const runState = newRun();
    const result = await makeExecutor(new FakeExecutor({ implement: 'silent' })).execute(workflow, {
      workId: '42',
      workingDirectory: planDir,
      runState,
    });

    expect(result.status).toBe('completed');
    const implement = result.phases.find((p) => p.phase === 'build')?.steps[0].result;
    expect(implement).toMatchObject({ status: 'warning', reason: 'no_response_block' });
    expect(runState.state.phases.build.steps.implement).toMatchObject({
      status: 'completed',
      result: 'warning',
      reason: 'no_response_block',
    });
    expect(result.run_status).toBe('completed');
  });

  it('fails a validator step that returns no response block', async () => {
    workflow.phases.build.steps[1].role = 'validator';
    const fake = new FakeExecutor({ commit: 'silent' });
    const result = await makeExecutor(fake).execute(workflow, { workId: '42', workingDirectory: planDir });

    expect(result.status).toBe('failed');
    expect(fake.stepIds).toEqual(['fetch-issue', 'implement', 'commit']);
    const commit = result.phases.find((p) => p.phase === 'build')?.steps[1].result;
    expect(commit).toMatchObject({
      status: 'failure',
      reason: 'no_response_block',
      error: 'Validator step returned no FABER response block',
    });
  });
});

describe('WorkflowExecutor approval gates', () => {
  let planDir: string;
  let workflow: ReturnType<typeof makeWorkflow>;

  const newRun = (): RunStateStore =>
    RunStateStore.create(planDir, {
      planId: 'acme-app-42',
      workId: '42',
      workflowId: 'default',
      phases: workflow.phases,
    });

  beforeEach(() => {
    planDir = fs.mkdtempSync(path.join(os.tmpdir(), 'faber-approval-test-'));
    workflow = makeWorkflow();
  });

  afterEach(() => {
    fs.rmSync(planDir, { recursive: true, force: true });
  });

  it('stops before a step listed in require_approval_for and saves the run as awaiting approval', async () => {
    workflow.autonomy = { require_approval_for: ['commit'] };
    const runState = newRun();
    const fake = new FakeExecutor();
    const required: string[] = [];
    const result = await makeExecutor(fake).execute(workflow, {
      workId: '42',
      workingDirectory: planDir,
      runState,
      onApprovalRequired: (phaseName, step) => required.push(`${phaseName}:${step.id}`),
    });

    expect(result.status).toBe('awaiting_approval');
    expect(result.awaiting_approval).toMatchObject({ phase: 'build', step_id: 'commit' });
    expect(result.awaiting_approval?.reason).toContain('require_approval_for');
    expect(fake.stepIds).toEqual(['fetch-issue', 'implement']);
    expect(required).toEqual(['build:commit']);
    expect(result.phases.find((p) => p.phase === 'build')?.status).toBe('awaiting_approval');

    const saved = RunStateStore.load(planDir, runState.runId).state;
    expect(saved.status).toBe('awaiting_approval');
    expect(saved.awaiting_approval).toMatchObject({ phase: 'build', step_id: 'commit' });
    expect(saved.phases.build.steps.commit.status).toBe('pending');
  });

  it('runs the gated step when it is approved, and continues the run', async () => {
    workflow.autonomy = { require_approval_for: ['commit'] };
    const runState = newRun();
    await makeExecutor(new FakeExecutor()).execute(workflow, { workId: '42', workingDirectory: planDir, runState });

    const resumed = RunStateStore.load(planDir, runState.runId);
    const fake = new FakeExecutor();
    const result = await makeExecutor(fake).execute(workflow, {
      workId: '42',
      workingDirectory: planDir,
      runState: resumed,
      approvedSteps: ['commit'],
    });

    expect(result.status).toBe('completed');
    expect(fake.stepIds).toEqual(['commit', 'test', 'create-pr']);
    expect(resumed.state.status).toBe('completed');
    expect(resumed.state.awaiting_approval).toBeUndefined();
    expect(resumed.state.phases.build.steps.commit.approved_at).toBeDefined();
  });

  it('does not run a gated step approved under another step ID', async () => {
    workflow.autonomy = { require_approval_for: ['commit'] };
    const fake = new FakeExecutor();
    const result = await makeExecutor(fake).execute(workflow, {
      workId: '42',
      workingDirectory: planDir,
      approvedSteps: ['implement'],
    });

    expect(result.status).toBe('awaiting_approval');
    expect(fake.stepIds).toEqual(['fetch-issue', 'implement']);
  });

  it('gates the first step of a phase that requires approval, once', async () => {
    workflow.phases.build.require_approval = true;
    const runState = newRun();
    const first = await makeExecutor(new FakeExecutor()).execute(workflow, {
      workId: '42',
      workingDirectory: planDir,
      runState,
    });

    expect(first.awaiting_approval).toMatchObject({ phase: 'build', step_id: 'implement' });
    expect(first.awaiting_approval?.reason).toContain('build phase requires approval');

    // Approved: the whole phase runs; commit then fails and stops the run
    const fake = new FakeExecutor({ commit: 'failure' });
    const second = await makeExecutor(fake).execute(workflow, {
      workId: '42',
      workingDirectory: planDir,
      runState: RunStateStore.load(planDir, runState.runId),
      approvedSteps: ['implement'],
    });
    expect(second.status).toBe('failed');
    expect(fake.stepIds).toEqual(['implement', 'commit']);

    // Resuming the failed run re-enters the phase without asking again
    const fake2 = new FakeExecutor();
    const third = await makeExecutor(fake2).execute(workflow, {
      workId: '42',
      workingDirectory: planDir,
      runState: RunStateStore.load(planDir, runState.runId),
    });
    expect(third.status).toBe('completed');
    expect(fake2.stepIds).toEqual(['commit', 'test', 'create-pr']);
  });

  it('pauses before release when pause_before_release is set', async () => {
    workflow.autonomy = { pause_before_release: true };
    const fake = new FakeExecutor();
    const result = await makeExecutor(fake).execute(workflow, { workId: '42', workingDirectory: planDir });

    expect(result.status).toBe('awaiting_approval');
    expect(result.awaiting_approval).toMatchObject({ phase: 'release', step_id: 'create-pr' });
    expect(result.awaiting_approval?.reason).toContain('pause_before_release');
    expect(fake.stepIds).toEqual(['fetch-issue', 'implement', 'commit', 'test']);
  });

  it('combines the reasons when several gates apply to one step', async () => {
    workflow.autonomy = { pause_before_release: true, require_approval_for: ['create-pr'] };
    workflow.phases.release.require_approval = true;
    const result = await makeExecutor(new FakeExecutor()).execute(workflow, { workId: '42', workingDirectory: planDir });

    expect(result.awaiting_approval?.step_id).toBe('create-pr');
    expect(result.awaiting_approval?.reason).toContain('require_approval_for');
    expect(result.awaiting_approval?.reason).toContain('release phase requires approval');
    expect(result.awaiting_approval?.reason).toContain('pause_before_release');
  });

  it('ignores the autonomy level: an autonomous workflow still stops at its gates', async () => {
    workflow.autonomy = { level: 'autonomous', require_approval_for: ['test'] };
    const fake = new FakeExecutor();
    const result = await makeExecutor(fake).execute(workflow, { workId: '42', workingDirectory: planDir });

    expect(result.status).toBe('awaiting_approval');
    expect(fake.stepIds).not.toContain('test');
  });
});

/**
 * Executor whose step outcomes change by attempt, and that answers on_failure
 * handlers (prompts starting with `/`) with a scripted response block
 */
class AttemptsExecutor implements Executor {
  readonly provider = 'claude-agent';
  readonly stepCalls: string[] = [];
  readonly handlerPrompts: string[] = [];

  constructor(
    private readonly attempts: Record<string, Outcome[]>,
    private readonly handler: Record<string, unknown> | 'throw' = {
      status: 'success',
      message: 'Diagnosed',
      recovery_plan: { action: 'stop', rationale: 'needs a person', requires_approval: true },
    },
  ) {}

  execute(prompt: string, context: ExecutionContext): Promise<ExecutorResult> {
    if (prompt.startsWith('/')) {
      this.handlerPrompts.push(prompt);
      if (this.handler === 'throw') return Promise.reject(new Error('handler crashed'));
      return Promise.resolve({
        output: `Diagnosis done.\n\n${JSON.stringify(this.handler)}`,
        status: 'success',
        metadata: { provider: 'fake', duration_ms: 5 },
      });
    }
    this.stepCalls.push(context.stepId);
    const script = this.attempts[context.stepId] ?? ['success'];
    const n = this.stepCalls.filter((id) => id === context.stepId).length;
    return scriptedResult(context.stepId, script[Math.min(n, script.length) - 1]);
  }

  validate(): Promise<{ valid: boolean }> {
    return Promise.resolve({ valid: true });
  }

  /** The context file passed to the handler with --step-context-file */
  contextFile(index = 0): Record<string, unknown> {
    const match = /--step-context-file "([^"]+)"/.exec(this.handlerPrompts[index] ?? '');
    if (!match) throw new Error('The handler prompt has no --step-context-file');
    return JSON.parse(fs.readFileSync(match[1], 'utf-8')) as Record<string, unknown>;
  }
}

/** An AttemptsExecutor whose sessions report a cost: 0.10 per step attempt, 0.05 per handler */
class PricedExecutor extends AttemptsExecutor {
  override async execute(prompt: string, context: ExecutionContext): Promise<ExecutorResult> {
    const result = await super.execute(prompt, context);
    const handler = prompt.startsWith('/');
    return {
      ...result,
      metadata: {
        ...result.metadata,
        cost_usd: handler ? 0.05 : 0.1,
        tokens_used: handler ? { input: 50, output: 5 } : { input: 100, output: 10 },
      },
    };
  }
}

describe('WorkflowExecutor retries and on_failure', () => {
  let planDir: string;
  let workflow: ReturnType<typeof makeWorkflow>;
  const debugHandler = '/fractary-faber-workflow-debug --work-id {work_id} --run-id {run_id} --problem "{error}"';

  const newRun = (): RunStateStore =>
    RunStateStore.create(planDir, {
      planId: 'acme-app-42',
      workId: '42',
      workflowId: 'default',
      phases: workflow.phases,
    });

  const run = (fake: AttemptsExecutor, runState?: RunStateStore): Promise<WorkflowExecuteResult> =>
    makeExecutor(fake).execute(workflow, {
      workId: '42',
      workingDirectory: planDir,
      runState,
    });

  beforeEach(() => {
    planDir = fs.mkdtempSync(path.join(os.tmpdir(), 'faber-retry-test-'));
    workflow = makeWorkflow();
  });

  afterEach(() => {
    fs.rmSync(planDir, { recursive: true, force: true });
  });

  it('completes a step that fails twice and then succeeds, with max_retries 3', async () => {
    workflow.phases.evaluate.max_retries = 3;
    workflow.phases.evaluate.result_handling = { on_failure: 'retry' };
    const runState = newRun();
    const fake = new AttemptsExecutor({ test: ['reports_failure', 'reports_failure', 'success'] });
    const retries: string[] = [];
    const result = await makeExecutor(fake).execute(workflow, {
      workId: '42',
      workingDirectory: planDir,
      runState,
      onStepRetry: (_phase, step, attempt) => retries.push(`${step.id}#${attempt}`),
    });

    expect(result.status).toBe('completed');
    expect(result.run_status).toBe('completed');
    expect(fake.stepCalls.filter((id) => id === 'test')).toHaveLength(3);
    expect(retries).toEqual(['test#2', 'test#3']);
    expect(result.phases.find((p) => p.phase === 'evaluate')?.steps[0].attempts).toBe(3);
    const state = runState.state;
    expect(state.phases.evaluate.steps.test).toMatchObject({ status: 'completed', attempts: 3 });
    expect(state.phases.evaluate.retry_count).toBe(2);
    expect(state.failure_recoveries?.map((r) => [r.step, r.attempt, r.action])).toEqual([
      ['evaluate:test', 1, 'retry'],
      ['evaluate:test', 2, 'retry'],
    ]);
  });

  it('fails a step that fails twice, with max_retries 1, and stops the run', async () => {
    workflow.phases.evaluate.max_retries = 1;
    workflow.phases.evaluate.result_handling = { on_failure: 'retry' };
    const runState = newRun();
    const fake = new AttemptsExecutor({ test: ['reports_failure', 'reports_failure', 'success'] });
    const result = await run(fake, runState);

    expect(result.status).toBe('failed');
    expect(fake.stepCalls.filter((id) => id === 'test')).toHaveLength(2);
    expect(fake.stepCalls).not.toContain('create-pr');
    const state = runState.state;
    expect(state.status).toBe('failed');
    expect(state.error).toBe(
      'Step evaluate:test failed after 2 attempts: test: 2 tests failed ' +
        '(on_failure is retry, but no retries left (max_retries 1))'
    );
    expect(state.phases.evaluate.steps.test).toMatchObject({ status: 'failed', attempts: 2 });
    expect(state.failure_recoveries?.map((r) => r.action)).toEqual(['retry', 'stop']);
  });

  it('does not retry under on_failure: retry when the phase allows no retries', async () => {
    workflow.phases.build.result_handling = { on_failure: 'retry' };
    const fake = new AttemptsExecutor({ implement: ['reports_failure', 'success'] });
    const runState = newRun();
    const result = await run(fake, runState);

    expect(result.status).toBe('failed');
    expect(fake.stepCalls).toEqual(['fetch-issue', 'implement']);
    expect(runState.state.error).toContain('the build phase allows no retries (max_retries 0)');
  });

  it('counts retries per phase, across resumes of the run', async () => {
    workflow.phases.evaluate = phase(true, ['test', 'smoke']);
    workflow.phases.evaluate.max_retries = 2;
    workflow.phases.evaluate.result_handling = { on_failure: 'retry' };
    const runState = newRun();
    const first = new AttemptsExecutor({ test: ['reports_failure', 'success'], smoke: ['reports_failure'] });
    expect((await run(first, runState)).status).toBe('failed');
    expect(first.stepCalls.filter((id) => id === 'smoke')).toHaveLength(2);
    expect(runState.state.phases.evaluate.retry_count).toBe(2);

    // The phase used its retries: a resumed run runs the failed step once more
    const resumed = new AttemptsExecutor({ smoke: ['reports_failure'] });
    const result = await run(resumed, RunStateStore.load(planDir, runState.runId));

    expect(result.status).toBe('failed');
    expect(resumed.stepCalls).toEqual(['smoke']);
    expect(RunStateStore.load(planDir, runState.runId).state.error).toContain('no retries left (max_retries 2)');
  });

  it('runs a slash-command on_failure handler once and stops the run, never continuing', async () => {
    workflow.result_handling = { on_failure: debugHandler };
    const runState = newRun();
    const fake = new AttemptsExecutor({ implement: ['reports_failure'] });
    const handled: string[] = [];
    const result = await makeExecutor(fake).execute(workflow, {
      workId: '42',
      workingDirectory: planDir,
      runState,
      onFailureHandler: (_phase, step, handler, handlerResult) =>
        handled.push(`${step.id}:${handler.split(' ')[0]}:${handlerResult.status}`),
    });

    expect(result.status).toBe('failed');
    expect(fake.stepCalls).toEqual(['fetch-issue', 'implement']);
    expect(handled).toEqual(['implement:/fractary-faber-workflow-debug:success']);
    expect(fake.handlerPrompts).toHaveLength(1);
    expect(fake.handlerPrompts[0]).toContain(`${debugHandler} --step-context-file "`);

    // The failed step's context reaches the handler as a file, not in its command
    expect(fake.contextFile()).toMatchObject({
      work_id: '42',
      run_id: runState.runId,
      phase: 'build',
      step_id: 'implement',
      attempt: 1,
      status: 'failure',
      error: 'implement: 2 tests failed',
      errors: ['implement: 2 tests failed'],
      retry_count: 0,
      max_retries: 0,
    });

    const state = runState.state;
    expect(state.error).toBe(
      "Step build:implement failed: implement: 2 tests failed (the on_failure handler's recovery plan is stop)"
    );
    expect(state.failure_recoveries).toEqual([
      expect.objectContaining({
        step: 'build:implement',
        attempt: 1,
        handler: debugHandler,
        handler_status: 'success',
        action: 'stop',
      }),
    ]);
  });

  it('records the cost of every session: each step attempt and the handler', async () => {
    workflow.result_handling = { on_failure: debugHandler };
    const runState = newRun();
    const result = await run(new PricedExecutor({ implement: ['reports_failure'] }), runState);

    // fetch-issue and implement cost 0.10 each, and the handler 0.05
    expect(result.cost_usd).toBe(0.25);
    const state = runState.state;
    expect(state.phases.build.steps.implement).toMatchObject({ cost_usd: 0.1, tokens_used: { input: 100, output: 10 } });
    expect(state.failure_recoveries?.[0]).toMatchObject({ handler_cost_usd: 0.05, handler_tokens_used: { input: 50, output: 5 } });
    expect(state.cost_usd).toBe(0.25);
    expect(state.tokens_used).toEqual({ input: 250, output: 25 });
  });

  it('retries when the handler asks for a retry without approval, within max_retries', async () => {
    workflow.phases.evaluate.max_retries = 3;
    workflow.result_handling = { on_failure: debugHandler };
    const fake = new AttemptsExecutor(
      { test: ['reports_failure', 'success'] },
      { status: 'success', message: 'Fixed', recovery_plan: { action: 'retry', requires_approval: false } },
    );
    const runState = newRun();
    const result = await run(fake, runState);

    expect(result.status).toBe('completed');
    expect(fake.handlerPrompts).toHaveLength(1);
    expect(fake.stepCalls.filter((id) => id === 'test')).toHaveLength(2);
    expect(runState.state.phases.evaluate.retry_count).toBe(1);
  });

  it('stops when the handler proposes a retry that needs approval', async () => {
    workflow.phases.evaluate.max_retries = 3;
    workflow.result_handling = { on_failure: debugHandler };
    const fake = new AttemptsExecutor(
      { test: ['reports_failure', 'success'] },
      { status: 'success', message: 'Fix proposed', recovery_plan: { action: 'retry' } },
    );
    const runState = newRun();
    const result = await run(fake, runState);

    expect(result.status).toBe('failed');
    expect(fake.stepCalls.filter((id) => id === 'test')).toHaveLength(1);
    expect(runState.state.error).toContain("proposes a retry that needs a person's approval");
  });

  it('stops when the handler cannot run', async () => {
    workflow.result_handling = { on_failure: debugHandler };
    const fake = new AttemptsExecutor({ implement: ['reports_failure'] }, 'throw');
    const runState = newRun();
    const result = await run(fake, runState);

    expect(result.status).toBe('failed');
    expect(fake.stepCalls).toEqual(['fetch-issue', 'implement']);
    expect(runState.state.status).toBe('failed');
    expect(runState.state.error).toContain('the on_failure handler failed: could not run: handler crashed');
    expect(runState.state.failure_recoveries?.[0]).toMatchObject({ handler_status: 'failure', action: 'stop' });
  });

  it('stops at an on_failure value it does not support', async () => {
    workflow.result_handling = { on_failure: 'skip' };
    const fake = new AttemptsExecutor({ implement: ['reports_failure'] });
    const runState = newRun();
    const result = await run(fake, runState);

    expect(result.status).toBe('failed');
    expect(fake.stepCalls).toEqual(['fetch-issue', 'implement']);
    expect(runState.state.error).toContain('on_failure "skip" is not supported');
  });
});

/** Executor whose sessions each cost $1, failing a step the given number of times first, and recording each session's budget */
class CostExecutor implements Executor {
  readonly provider = 'claude-agent';
  readonly calls: Array<{ stepName: string; maxBudgetUsd?: number }> = [];

  constructor(private readonly failures: Record<string, number> = {}) {}

  execute(_prompt: string, context: ExecutionContext): Promise<ExecutorResult> {
    const { runtimeConfig } = context as ExecutionContext & ClaudeAgentExecuteOptions;
    this.calls.push({ stepName: context.stepName, maxBudgetUsd: runtimeConfig?.maxBudgetUsd });
    const failing = (this.failures[context.stepId] ?? 0) > 0;
    if (failing) this.failures[context.stepId]--;
    const response = { status: failing ? 'failure' : 'success', message: `ran ${context.stepId}` };
    return Promise.resolve({
      output: `Done.\n\n${JSON.stringify(response)}`,
      status: 'success',
      metadata: { provider: 'fake', duration_ms: 5, cost_usd: 1 },
    });
  }

  validate(): Promise<{ valid: boolean }> {
    return Promise.resolve({ valid: true });
  }

  budgets(stepName: string): Array<number | undefined> {
    return this.calls.filter((c) => c.stepName === stepName).map((c) => c.maxBudgetUsd);
  }
}

describe('WorkflowExecutor spending cap', () => {
  let planDir: string;
  let workflow: ReturnType<typeof makeWorkflow>;

  const newRun = (): RunStateStore =>
    RunStateStore.create(planDir, {
      planId: 'acme-app-42',
      workId: '42',
      workflowId: 'default',
      phases: workflow.phases,
    });

  const run = (fake: CostExecutor, runState: RunStateStore, maxCostUsd: number): Promise<WorkflowExecuteResult> =>
    makeExecutor(fake).execute(workflow, { workId: '42', workingDirectory: planDir, runState, maxCostUsd });

  beforeEach(() => {
    planDir = fs.mkdtempSync(path.join(os.tmpdir(), 'faber-budget-test-'));
    workflow = makeWorkflow();
  });

  afterEach(() => {
    fs.rmSync(planDir, { recursive: true, force: true });
  });

  it('gives each session what is left of the budget, and starts no step once it is spent', async () => {
    const fake = new CostExecutor();
    const runState = newRun();
    const started: string[] = [];
    const result = await makeExecutor(fake).execute(workflow, {
      workId: '42',
      workingDirectory: planDir,
      runState,
      maxCostUsd: 2.5,
      onStepStart: (_phase, step) => started.push(step.id),
    });

    expect(result.status).toBe('failed');
    expect(started).toEqual(['fetch-issue', 'implement', 'commit']);
    expect(fake.calls).toEqual([
      { stepName: 'fetch-issue', maxBudgetUsd: 2.5 },
      { stepName: 'implement', maxBudgetUsd: 1.5 },
      { stepName: 'commit', maxBudgetUsd: 0.5 },
    ]);
    expect(runState.state.error).toBe('Run stopped before evaluate:test: its sessions have cost $3.00 of its $2.50 budget');
    // The step that could not start stays pending, for a resume with a larger budget
    expect(runState.state.phases.evaluate.steps.test).toMatchObject({ status: 'pending' });
  });

  it("keeps a step's own lower max_budget_usd", async () => {
    workflow.phases.build.steps[0].max_budget_usd = 0.25;
    const fake = new CostExecutor();
    await run(fake, newRun(), 10);

    expect(fake.budgets('implement')).toEqual([0.25]);
    expect(fake.budgets('commit')).toEqual([8]);
  });

  it('counts the cost a run recorded before it was resumed', async () => {
    const runState = newRun();
    await run(new CostExecutor(), runState, 2);

    const resumed = new CostExecutor();
    const result = await run(resumed, RunStateStore.load(planDir, runState.runId), 4);

    expect(result.status).toBe('failed');
    expect(resumed.calls).toEqual([
      { stepName: 'commit', maxBudgetUsd: 2 },
      { stepName: 'test', maxBudgetUsd: 1 },
    ]);
  });

  it("caps an on_failure handler's session, and runs none once the budget is spent", async () => {
    workflow.result_handling = { on_failure: '/fractary-faber-workflow-debug --work-id {work_id}' };
    const capped = new CostExecutor({ implement: 1 });
    await run(capped, newRun(), 3.5);
    expect(capped.budgets('implement (on_failure)')).toEqual([1.5]);

    const spent = new CostExecutor({ implement: 1 });
    const runState = newRun();
    const result = await run(spent, runState, 2);
    expect(result.status).toBe('failed');
    expect(spent.calls.map((c) => c.stepName)).toEqual(['fetch-issue', 'implement']);
    expect(runState.state.failure_recoveries?.[0]).toMatchObject({
      action: 'stop',
      reason: "the run's budget is spent, so the on_failure handler did not run",
    });
  });

  it('retries only while budget is left', async () => {
    workflow.phases.evaluate.max_retries = 3;
    workflow.phases.evaluate.result_handling = { on_failure: 'retry' };
    const fake = new CostExecutor({ test: 5 });
    const runState = newRun();
    const result = await run(fake, runState, 4.5);

    // The first three steps cost $3, and the first attempt at test $1: the retry gets the $0.50 left
    expect(result.status).toBe('failed');
    expect(fake.budgets('test')).toEqual([1.5, 0.5]);
    expect(runState.state.failure_recoveries?.map((r) => r.action)).toEqual(['retry', 'stop']);
    expect(runState.state.failure_recoveries?.[1].reason).toContain("but the run's budget is spent");
  });
});

describe('WorkflowExecutor permission modes', () => {
  let planDir: string;
  let workflow: ReturnType<typeof makeWorkflow>;

  beforeEach(() => {
    planDir = fs.mkdtempSync(path.join(os.tmpdir(), 'faber-permission-test-'));
    workflow = makeWorkflow();
  });

  afterEach(() => {
    fs.rmSync(planDir, { recursive: true, force: true });
  });

  const modes = (fake: FakeExecutor): Record<string, string | undefined> =>
    Object.fromEntries(fake.calls.map((c) => [c.stepId, c.runtimeConfig?.permissionMode]));

  it('passes the run\'s plugins and settings file to every step, whatever the workflow sets', async () => {
    workflow.defaults = { permission_mode: 'default' };
    const fake = new FakeExecutor();
    await makeExecutor(fake).execute(workflow, {
      workId: '42',
      workingDirectory: planDir,
      plugins: ['/packs/faber-code'],
      settings: '/suite/trial-settings.json',
    });

    expect(fake.calls.map((c) => c.runtimeConfig?.plugins)).toEqual(Array(fake.calls.length).fill(['/packs/faber-code']));
    expect(fake.calls.map((c) => c.runtimeConfig?.settings)).toEqual(Array(fake.calls.length).fill('/suite/trial-settings.json'));
    expect(fake.calls[0].runtimeConfig?.permissionMode).toBe('default');
  });

  it('leaves the permission mode to the executor default when nothing sets it', async () => {
    const fake = new FakeExecutor();
    const result = await makeExecutor(fake).execute(workflow, { workId: '42', workingDirectory: planDir });

    expect(result.status).toBe('completed');
    expect(Object.values(modes(fake)).every((m) => m === undefined)).toBe(true);
    expect(result.warnings).toBeUndefined();
  });

  it('passes each step the permission mode from step > phase_defaults > defaults', async () => {
    workflow.defaults = { permission_mode: 'default' };
    workflow.phase_defaults = { build: { permission_mode: 'plan' } };
    workflow.phases.build.steps[0].permission_mode = 'acceptEdits';
    const fake = new FakeExecutor();
    await makeExecutor(fake).execute(workflow, { workId: '42', workingDirectory: planDir });

    expect(modes(fake)).toEqual({
      'fetch-issue': 'default',
      implement: 'acceptEdits',
      commit: 'plan',
      test: 'default',
      'create-pr': 'default',
    });
  });

  it('warns once, before any step runs, about agent steps that bypass permission checks', async () => {
    workflow.phases.build.steps[0].permission_mode = 'bypassPermissions';
    workflow.phases.evaluate.steps[0].permission_mode = 'bypassPermissions';
    // A ! command step runs a shell command, not an agent session
    workflow.phases.release.steps[0] = { id: 'create-pr', name: 'create-pr', prompt: '!true', permission_mode: 'bypassPermissions' };
    const events: string[] = [];
    const fake = new FakeExecutor();
    const result = await makeExecutor(fake).execute(workflow, {
      workId: '42',
      workingDirectory: planDir,
      onWarning: (message) => events.push(`warning: ${message}`),
      onStepStart: (_phase, step) => events.push(`start: ${step.id}`),
    });

    expect(result.status).toBe('completed');
    expect(events[0]).toMatch(/^warning: 2 step\(s\) run with permission_mode bypassPermissions and no sandbox/);
    expect(events[0]).toContain('Steps: build:implement, evaluate:test');
    expect(events.filter((e) => e.startsWith('warning:'))).toHaveLength(1);
    expect(result.warnings).toEqual([events[0].replace('warning: ', '')]);
  });

  it('warns only about the steps this execution runs', async () => {
    workflow.phases.build.steps[0].permission_mode = 'bypassPermissions';
    const fake = new FakeExecutor();
    const result = await makeExecutor(fake).execute(workflow, {
      workId: '42',
      workingDirectory: planDir,
      phasesToRun: ['evaluate'],
    });

    expect(result.warnings).toBeUndefined();
  });

  it('stops before any step runs when a permission mode is unknown', async () => {
    workflow.defaults = { permission_mode: 'yolo' as unknown as 'default' };
    const runState = RunStateStore.create(planDir, {
      planId: 'acme-app-42',
      workId: '42',
      workflowId: 'default',
      phases: workflow.phases,
    });
    const fake = new FakeExecutor();

    await expect(
      makeExecutor(fake).execute(workflow, { workId: '42', workingDirectory: planDir, runState })
    ).rejects.toThrow('Step frame:fetch-issue has an unknown permission_mode "yolo"');
    expect(fake.calls).toHaveLength(0);
    expect(runState.state.status).toBe('failed');
  });
});
