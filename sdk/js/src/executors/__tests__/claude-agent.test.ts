/**
 * @fractary/faber - Claude Agent Executor Tests
 *
 * The options an agent step's session gets from its runtime config.
 */

import { ClaudeAgentExecutor } from '../providers/claude-agent.js';
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
  });
});
