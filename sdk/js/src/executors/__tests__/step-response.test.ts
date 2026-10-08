/**
 * @fractary/faber - Step Response Tests
 */

import { applyStepResponse, findResponseBlock } from '../step-response.js';
import type { ExecutorResult } from '../types.js';

function agentResult(output: string, overrides: Partial<ExecutorResult> = {}): ExecutorResult {
  return {
    output,
    status: 'success',
    metadata: { provider: 'claude-agent', duration_ms: 1 },
    ...overrides,
  };
}

const json = (value: unknown): string => JSON.stringify(value);

describe('findResponseBlock', () => {
  it('finds a bare response block after prose', () => {
    expect(findResponseBlock(`All done.\n${json({ status: 'success', message: 'ok' })}`)).toEqual({
      status: 'success',
      message: 'ok',
    });
  });

  it('finds a block inside a code fence', () => {
    const output = `Summary\n\n\`\`\`json\n${JSON.stringify({ status: 'warning', message: 'm', warnings: ['w'] }, null, 2)}\n\`\`\`\n`;
    expect(findResponseBlock(output)).toMatchObject({ status: 'warning', warnings: ['w'] });
  });

  it('takes the last block when there are several', () => {
    const output = `${json({ status: 'success', message: 'first' })}\nthen\n${json({ status: 'failure', message: 'last', errors: ['e'] })}`;
    expect(findResponseBlock(output)).toMatchObject({ message: 'last' });
  });

  it('ignores objects without a string status, including nested ones', () => {
    const output = [
      json({ status: 'failure', message: 'real', errors: ['e'] }),
      json({ details: { status: 'success' } }),
      json({ status: 200, body: 'http response' }),
    ].join('\n');
    expect(findResponseBlock(output)).toMatchObject({ message: 'real' });
  });

  it('skips braces in prose and braces inside strings', () => {
    const output =
      'Used {work_id} and an unbalanced { brace.\n' +
      json({ status: 'success', message: 'escaped \\" quote and {braces} in a string' });
    expect(findResponseBlock(output)).toMatchObject({ status: 'success' });
  });

  it('returns null when the output has no block', () => {
    expect(findResponseBlock('Implemented the change and pushed the branch.')).toBeNull();
    expect(findResponseBlock(`truncated ${json({ status: 'success', message: 'x' }).slice(0, -1)}`)).toBeNull();
    expect(findResponseBlock('')).toBeNull();
  });
});

describe('applyStepResponse', () => {
  it('keeps a success block as success', () => {
    const result = applyStepResponse(agentResult(json({ status: 'success', message: 'ok' })));
    expect(result).toMatchObject({ status: 'success', response: { status: 'success', message: 'ok' } });
    expect(result.reason).toBeUndefined();
    expect(result.error).toBeUndefined();
  });

  it('turns a failure block into a step failure with its errors', () => {
    const result = applyStepResponse(
      agentResult(json({ status: 'failure', message: 'Validation failed', errors: ['no tests', 'lint errors'] }))
    );
    expect(result).toMatchObject({ status: 'failure', error: 'no tests; lint errors' });
    expect(result.response?.errors).toEqual(['no tests', 'lint errors']);
  });

  it('reads the status case-insensitively', () => {
    const result = applyStepResponse(agentResult(json({ status: 'FAILURE', message: 'm', errors: ['e'] })));
    expect(result.status).toBe('failure');
  });

  it('turns a warning block into a step warning', () => {
    const result = applyStepResponse(agentResult(json({ status: 'warning', message: 'm', warnings: ['slow'] })));
    expect(result).toMatchObject({ status: 'warning', response: { warnings: ['slow'] } });
  });

  it('keeps the status of a block that breaks the schema and lists the problems', () => {
    const result = applyStepResponse(agentResult(json({ status: 'failure', message: 'Checks failed', extra: 1 })));
    expect(result.status).toBe('failure');
    expect(result.error).toBe('Checks failed');
    expect(result.response).toBeUndefined();
    expect(result.response_issues).toEqual(
      expect.arrayContaining([expect.stringContaining('errors'), expect.stringContaining('extra')])
    );
  });

  it('fails a step that is waiting for input', () => {
    const result = applyStepResponse(agentResult(json({ status: 'pending_input', message: 'Approve the plan?' })));
    expect(result).toMatchObject({
      status: 'failure',
      reason: 'pending_input',
      error: 'Step is waiting for input, which a CLI run cannot provide: Approve the plan?',
    });
  });

  it('warns when the output has no response block', () => {
    const result = applyStepResponse(agentResult('Implemented the change.'));
    expect(result).toMatchObject({ status: 'warning', reason: 'no_response_block' });
  });

  it('warns when the block has an unknown status', () => {
    const result = applyStepResponse(agentResult(json({ status: 'done', message: 'm' })));
    expect(result).toMatchObject({ status: 'warning', reason: 'invalid_response_block' });
  });

  it('fails a validator without a valid response block', () => {
    expect(applyStepResponse(agentResult('Looks fine to me.'), { requireResponse: true })).toMatchObject({
      status: 'failure',
      reason: 'no_response_block',
      error: 'Validator step returned no FABER response block',
    });
    expect(
      applyStepResponse(agentResult(json({ status: 'pass', message: 'm' })), { requireResponse: true })
    ).toMatchObject({ status: 'failure', reason: 'invalid_response_block' });
  });

  it('keeps a step that could not run failed', () => {
    const failed = agentResult('', { status: 'failure', error: 'Agent SDK error (error_max_turns)' });
    expect(applyStepResponse(failed)).toBe(failed);
  });

  it('leaves shell command steps to their exit code', () => {
    const command = agentResult(json({ status: 'failure', message: 'm', errors: ['e'] }), {
      metadata: { provider: 'command', duration_ms: 1 },
    });
    expect(applyStepResponse(command, { requireResponse: true })).toBe(command);
  });
});
