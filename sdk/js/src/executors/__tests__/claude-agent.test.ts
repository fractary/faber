/**
 * @fractary/faber - Claude Agent Executor Tests
 *
 * The options an agent step's session gets from its runtime config.
 */

import { ClaudeAgentExecutor, setAgentSdkLoader } from '../providers/claude-agent.js';
import type { ClaudeAgentExecuteOptions } from '../providers/claude-agent.js';
import type { ExecutionContext } from '../types.js';

/** Executor with a fake Agent SDK that records the options of each session */
class RecordingAgentExecutor extends ClaudeAgentExecutor {
  readonly sessions: Array<Record<string, unknown>> = [];

  protected override loadAgentSdk(): ReturnType<ClaudeAgentExecutor['loadAgentSdk']> {
    const sessions = this.sessions;
    return Promise.resolve({
      query: ({ options }: { prompt: string; options?: Record<string, unknown> }) => {
        sessions.push(options ?? {});
        return (async function* (): AsyncGenerator<Record<string, unknown>> {
          yield { type: 'result', subtype: 'success', result: 'done' };
        })();
      },
    } as unknown as Awaited<ReturnType<ClaudeAgentExecutor['loadAgentSdk']>>);
  }
}

function context(runtimeConfig: ClaudeAgentExecuteOptions['runtimeConfig']): ExecutionContext & ClaudeAgentExecuteOptions {
  return {
    workId: '42',
    phase: 'build',
    stepId: 'implement',
    stepName: 'Implement',
    previousOutputs: {},
    workingDirectory: process.cwd(),
    runtimeConfig,
  };
}

describe('ClaudeAgentExecutor permission mode', () => {
  it('runs a step that sets no permission mode with acceptEdits', async () => {
    const executor = new RecordingAgentExecutor();
    const result = await executor.execute('Do it', context({}), { provider: 'claude-agent' });

    expect(result.error).toBeUndefined();
    expect(result.status).toBe('success');
    expect(executor.sessions[0].permissionMode).toBe('acceptEdits');
  });

  it('runs a step with its configured permission mode', async () => {
    const executor = new RecordingAgentExecutor();
    await executor.execute('Do it', context({ permissionMode: 'plan' }), { provider: 'claude-agent' });

    expect(executor.sessions[0].permissionMode).toBe('plan');
    expect(executor.sessions[0].allowDangerouslySkipPermissions).toBeUndefined();
  });

  it('sets the flag the SDK requires for bypassPermissions only when a step opts in', async () => {
    const executor = new RecordingAgentExecutor();
    await executor.execute('Do it', context({ permissionMode: 'bypassPermissions' }), { provider: 'claude-agent' });
    await executor.execute('Do it', context({}), { provider: 'claude-agent' });

    expect(executor.sessions[0]).toMatchObject({ permissionMode: 'bypassPermissions', allowDangerouslySkipPermissions: true });
    expect(executor.sessions[1].allowDangerouslySkipPermissions).toBeUndefined();
  });
});

/** Executor whose Agent SDK cannot be loaded, as when the package is not installed */
class MissingSdkExecutor extends ClaudeAgentExecutor {
  protected override loadAgentSdk(): ReturnType<ClaudeAgentExecutor['loadAgentSdk']> {
    const error = new Error(
      "Cannot find package '@anthropic-ai/claude-agent-sdk' imported from /opt/faber/dist/executors/providers/claude-agent.js"
    ) as NodeJS.ErrnoException;
    error.code = 'ERR_MODULE_NOT_FOUND';
    return Promise.reject(error);
  }
}

describe('ClaudeAgentExecutor Agent SDK loader', () => {
  afterEach(() => setAgentSdkLoader(undefined));

  it('loads the Agent SDK with the loader an application sets', async () => {
    const prompts: string[] = [];
    setAgentSdkLoader(() => Promise.resolve({
      query: ({ prompt }: { prompt: string }) => {
        prompts.push(prompt);
        return (async function* (): AsyncGenerator<Record<string, unknown>> {
          yield { type: 'result', subtype: 'success', result: 'done' };
        })();
      },
    }));
    const result = await new ClaudeAgentExecutor().execute('Do it', context({}), { provider: 'claude-agent' });

    expect(result).toMatchObject({ status: 'success', output: 'done' });
    expect(prompts).toEqual(['Do it']);
  });
});

describe('ClaudeAgentExecutor without the Agent SDK', () => {
  it('fails the step and names the package to install', async () => {
    const result = await new MissingSdkExecutor().execute('Do it', context({}), { provider: 'claude-agent' });

    expect(result.status).toBe('failure');
    expect(result.error).toContain('Claude Agent SDK (@anthropic-ai/claude-agent-sdk) is not installed');
    expect(result.error).toContain('npm install @anthropic-ai/claude-agent-sdk');
  });
});

describe('ClaudeAgentExecutor plugins', () => {
  it('loads the run\'s plugins into the session as local plugins', async () => {
    const executor = new RecordingAgentExecutor();
    await executor.execute('Do it', context({ plugins: ['/packs/faber-code', '/packs/extra'] }), { provider: 'claude-agent' });

    expect(executor.sessions[0].plugins).toEqual([
      { type: 'local', path: '/packs/faber-code' },
      { type: 'local', path: '/packs/extra' },
    ]);
  });

  it('leaves plugins to the project\'s settings when the run sets none', async () => {
    const executor = new RecordingAgentExecutor();
    await executor.execute('Do it', context({}), { provider: 'claude-agent' });
    await executor.execute('Do it', context({ plugins: [] }), { provider: 'claude-agent' });

    expect('plugins' in executor.sessions[0]).toBe(false);
    expect('plugins' in executor.sessions[1]).toBe(false);
  });

  it('applies the run\'s settings file to the session, and none when the run sets none', async () => {
    const executor = new RecordingAgentExecutor();
    await executor.execute('Do it', context({ settings: '/suite/trial-settings.json' }), { provider: 'claude-agent' });
    await executor.execute('Do it', context({}), { provider: 'claude-agent' });

    expect(executor.sessions[0].settings).toBe('/suite/trial-settings.json');
    expect('settings' in executor.sessions[1]).toBe(false);
  });
});

/** Executor with a fake Agent SDK whose session ends with the given result message */
class ResultAgentExecutor extends ClaudeAgentExecutor {
  constructor(private readonly resultMessage: Record<string, unknown>) {
    super();
  }

  protected override loadAgentSdk(): ReturnType<ClaudeAgentExecutor['loadAgentSdk']> {
    const resultMessage = this.resultMessage;
    return Promise.resolve({
      query: () =>
        (async function* (): AsyncGenerator<Record<string, unknown>> {
          yield { type: 'result', ...resultMessage };
        })(),
    } as unknown as Awaited<ReturnType<ClaudeAgentExecutor['loadAgentSdk']>>);
  }
}

describe('ClaudeAgentExecutor cost and tokens', () => {
  it('reports the cost and tokens of a session that succeeds', async () => {
    const executor = new ResultAgentExecutor({
      subtype: 'success',
      result: 'done',
      total_cost_usd: 0.0123,
      usage: { input_tokens: 1200, output_tokens: 300 },
    });
    const result = await executor.execute('Do it', context({}), { provider: 'claude-agent' });

    expect(result.status).toBe('success');
    expect(result.metadata).toMatchObject({ cost_usd: 0.0123, tokens_used: { input: 1200, output: 300 } });
  });

  it('reports the cost of a session that fails, since it was still spent', async () => {
    const executor = new ResultAgentExecutor({
      subtype: 'error_max_turns',
      errors: ['Reached maximum number of turns'],
      total_cost_usd: 0.5,
      usage: { input_tokens: 9000, output_tokens: 800 },
    });
    const result = await executor.execute('Do it', context({}), { provider: 'claude-agent' });

    expect(result.status).toBe('failure');
    expect(result.metadata).toMatchObject({ cost_usd: 0.5, tokens_used: { input: 9000, output: 800 } });
  });

  it('reports no cost when the session result has none', async () => {
    const executor = new ResultAgentExecutor({ subtype: 'success', result: 'done' });
    const result = await executor.execute('Do it', context({}), { provider: 'claude-agent' });

    expect(result.metadata.cost_usd).toBeUndefined();
    expect(result.metadata.tokens_used).toBeUndefined();
  });
});
