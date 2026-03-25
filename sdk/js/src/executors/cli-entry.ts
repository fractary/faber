/**
 * @fractary/faber - Executor CLI Entry Point
 *
 * Entry point for executing a single workflow step via an external executor.
 * Designed to be invoked from Claude Code's Bash tool when the workflow-run
 * skill encounters a step with a non-default executor.
 *
 * Usage (from Claude Code Bash tool):
 *   echo '{"stepId":"review","prompt":"...","executor":{"provider":"openai","model":"gpt-4o"},"context":{...}}' | \
 *     node -e "require('@fractary/faber').executeStepCli()"
 *
 * Input: JSON on stdin with fields:
 *   - stepId: string
 *   - prompt: string
 *   - executor: StepExecutorConfig
 *   - context: Partial<ExecutionContext>
 *
 * Output: JSON on stdout with ExecutorResult
 */

import { ExecutorRegistry } from './registry.js';
import type { ExecutionContext, StepExecutorConfig, ExecutorResult } from './types.js';

interface StepCliInput {
  stepId: string;
  stepName?: string;
  prompt: string;
  executor: StepExecutorConfig;
  context?: Partial<ExecutionContext>;
}

/**
 * Execute a single step via the executor framework.
 * Reads JSON from stdin, writes JSON result to stdout.
 */
export async function executeStepCli(): Promise<void> {
  try {
    // Read input from stdin
    const input = await readStdin();
    const parsed: StepCliInput = JSON.parse(input);

    // Validate required fields
    if (!parsed.prompt) {
      throw new Error('Missing required field: prompt');
    }
    if (!parsed.executor?.provider) {
      throw new Error('Missing required field: executor.provider');
    }

    // Create registry and resolve executor
    const registry = ExecutorRegistry.createDefault();
    const executor = registry.get(parsed.executor.provider);

    // Build execution context
    const context: ExecutionContext = {
      workId: parsed.context?.workId || 'unknown',
      phase: parsed.context?.phase || 'unknown',
      stepId: parsed.stepId || 'unknown',
      stepName: parsed.stepName || parsed.stepId || 'unknown',
      previousOutputs: parsed.context?.previousOutputs || {},
      issue: parsed.context?.issue,
      workingDirectory: parsed.context?.workingDirectory || process.cwd(),
    };

    // Execute
    const result = await executor.execute(parsed.prompt, context, parsed.executor);

    // Output result as JSON
    process.stdout.write(JSON.stringify(result) + '\n');
  } catch (error) {
    const errorResult: ExecutorResult = {
      output: '',
      status: 'failure',
      error: error instanceof Error ? error.message : String(error),
      metadata: {
        provider: 'cli-entry',
        duration_ms: 0,
      },
    };
    process.stdout.write(JSON.stringify(errorResult) + '\n');
    process.exit(1);
  }
}

function readStdin(): Promise<string> {
  return new Promise((resolve, reject) => {
    let data = '';
    process.stdin.setEncoding('utf-8');
    process.stdin.on('data', (chunk) => { data += chunk; });
    process.stdin.on('end', () => resolve(data));
    process.stdin.on('error', reject);

    // Handle case where stdin is already closed (piped input)
    if (process.stdin.readableEnded) {
      resolve(data);
    }
  });
}

// Auto-execute when loaded directly
if (typeof require !== 'undefined' && require.main === module) {
  executeStepCli();
}
