/**
 * @fractary/faber - Claude Agent Executor
 *
 * Executes workflow steps via the Claude Agent SDK (@anthropic-ai/claude-agent-sdk).
 * Each step gets a fresh session with isolated context — no accumulated history
 * from prior steps.
 *
 * Also handles `!` command prefix: prompts starting with `!` (no space) are
 * executed as direct shell commands with zero LLM cost.
 *
 * Hierarchical system prompt composition:
 *   1. Claude Code preset (cached by Anthropic)
 *   2. Workflow-level prompt (sets overall mission)
 *   3. Phase-level prompt (adds phase guidance)
 *   4. Structured metadata (self-service context pointers)
 */

import { spawn } from 'child_process';
import type {
  Executor,
  ExecutorResult,
  ExecutionContext,
  StepExecutorConfig,
  StepRuntimeConfig,
  StepPromptContext,
} from '../types.js';
import { buildSystemPrompt, DEFAULT_PERMISSION_MODE } from '../types.js';

const DEFAULT_MODEL = 'claude-sonnet-5';
const DEFAULT_MAX_TURNS = 25;
const COMMAND_PREFIX = '!';

/**
 * Extended execution parameters for ClaudeAgentExecutor.
 *
 * The standard Executor.execute() signature is preserved for registry
 * compatibility. The WorkflowExecutor passes runtime config and prompt
 * context via the `runtimeConfig` and `promptContext` fields on the
 * ExecutionContext (which has an optional extension point).
 */
export interface ClaudeAgentExecuteOptions {
  runtimeConfig?: StepRuntimeConfig;
  promptContext?: StepPromptContext;
}

export class ClaudeAgentExecutor implements Executor {
  readonly provider = 'claude-agent';

  async execute(
    prompt: string,
    context: ExecutionContext,
    config: StepExecutorConfig,
  ): Promise<ExecutorResult> {
    const startTime = Date.now();
    const trimmedPrompt = prompt.trim();

    // Detect ! prefix — run as direct shell command
    if (trimmedPrompt.startsWith(COMMAND_PREFIX) && trimmedPrompt.length > 1 && trimmedPrompt[1] !== ' ') {
      const command = trimmedPrompt.slice(COMMAND_PREFIX.length);
      return this.executeCommand(command, context, startTime);
    }

    // Agentic execution via Claude Agent SDK
    return this.executeAgent(prompt, context, config, startTime);
  }

  async validate(config: StepExecutorConfig): Promise<{ valid: boolean; error?: string }> {
    // For agentic execution, we need ANTHROPIC_API_KEY
    const apiKeyEnv = config.api_key_env || 'ANTHROPIC_API_KEY';
    const apiKey = process.env[apiKeyEnv];

    if (!apiKey) {
      return {
        valid: false,
        error: `Environment variable '${apiKeyEnv}' is not set. Required for Claude Agent SDK.`,
      };
    }

    return { valid: true };
  }

  // ══════════════════════════════════════════════════════════════════════
  // Shell Command Execution (! prefix)
  // ══════════════════════════════════════════════════════════════════════

  private async executeCommand(
    command: string,
    context: ExecutionContext,
    startTime: number,
  ): Promise<ExecutorResult> {
    const resolvedCommand = this.substituteVariables(command, context);

    try {
      const { stdout, stderr, exitCode } = await this.spawnCommand(
        resolvedCommand,
        context.workingDirectory,
      );

      const output = stdout || stderr || '(no output)';
      const status = exitCode === 0 ? 'success' : 'failure';

      return {
        output,
        status,
        error: status === 'failure' ? `Command exited with code ${exitCode}: ${stderr || stdout}` : undefined,
        metadata: {
          provider: 'command',
          duration_ms: Date.now() - startTime,
        },
      };
    } catch (error) {
      return {
        output: '',
        status: 'failure',
        error: `Command execution error: ${error instanceof Error ? error.message : String(error)}`,
        metadata: {
          provider: 'command',
          duration_ms: Date.now() - startTime,
        },
      };
    }
  }

  private spawnCommand(
    command: string,
    cwd: string,
    timeoutMs = 120_000,
  ): Promise<{ stdout: string; stderr: string; exitCode: number }> {
    return new Promise((resolve, reject) => {
      const proc = spawn('bash', ['-c', command], {
        cwd,
        env: process.env,
        stdio: ['ignore', 'pipe', 'pipe'],
        timeout: timeoutMs,
      });

      let stdout = '';
      let stderr = '';

      proc.stdout.on('data', (data: Buffer) => { stdout += data.toString(); });
      proc.stderr.on('data', (data: Buffer) => { stderr += data.toString(); });

      proc.on('close', (code) => {
        resolve({ stdout: stdout.trim(), stderr: stderr.trim(), exitCode: code ?? 1 });
      });

      proc.on('error', (err) => {
        reject(err);
      });
    });
  }

  // ══════════════════════════════════════════════════════════════════════
  // Agentic Execution (Claude Agent SDK)
  // ══════════════════════════════════════════════════════════════════════

  private async executeAgent(
    prompt: string,
    context: ExecutionContext,
    config: StepExecutorConfig,
    startTime: number,
  ): Promise<ExecutorResult> {
    // Extract runtime config and prompt context from extended context
    const extendedContext = context as ExecutionContext & ClaudeAgentExecuteOptions;
    const runtimeConfig = extendedContext.runtimeConfig || {};
    const promptContext = extendedContext.promptContext;

    const model = runtimeConfig.model || config.model || DEFAULT_MODEL;
    const maxTurns = runtimeConfig.maxTurns || DEFAULT_MAX_TURNS;
    const permissionMode = runtimeConfig.permissionMode ?? DEFAULT_PERMISSION_MODE;

    // Build hierarchical system prompt
    const composedPrompt = promptContext ? buildSystemPrompt(promptContext) : undefined;

    try {
      const { query } = await this.loadAgentSdk();

      let resultOutput = '';
      let inputTokens = 0;
      let outputTokens = 0;

      for await (const message of query({
        prompt: this.substituteVariables(prompt, context),
        options: {
          cwd: context.workingDirectory,
          model,
          maxTurns,
          maxBudgetUsd: runtimeConfig.maxBudgetUsd,

          // Claude Code preset + composed workflow/phase/metadata context
          systemPrompt: composedPrompt
            ? { type: 'preset' as const, preset: 'claude_code' as const, append: composedPrompt }
            : undefined,

          // Load project skills and CLAUDE.md
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          settingSources: ['project'] as string[],

          // Full Claude Code tool preset
          tools: { type: 'preset' as const, preset: 'claude_code' as const },
          allowedTools: runtimeConfig.allowedTools,

          // MCP servers from step config
          mcpServers: runtimeConfig.mcp as Record<string, { command: string; args?: string[] }> | undefined,

          // A CLI run has no one to answer a permission prompt, so a tool call
          // that needs permission is denied unless allowedTools or the project's
          // settings allow it. bypassPermissions is an explicit opt-in that the
          // workflow executor warns about.
          permissionMode,
        },
      })) {
        if (message.type === 'result') {
          const resultMsg = message;
          if (resultMsg.subtype === 'success') {
            resultOutput = String(resultMsg['result'] ?? '');
            const usage = resultMsg['usage'] as { input_tokens?: number; output_tokens?: number } | undefined;
            if (usage) {
              inputTokens = usage.input_tokens || 0;
              outputTokens = usage.output_tokens || 0;
            }
          } else {
            // Error result (max_turns, max_budget, execution error)
            const errors = resultMsg['errors'] as string[] | undefined;
            return {
              output: '',
              status: 'failure',
              error: `Agent SDK error (${String(resultMsg.subtype)}): ${(errors || []).join('; ')}`,
              metadata: {
                provider: this.provider,
                model,
                duration_ms: Date.now() - startTime,
              },
            };
          }
        }
      }

      return {
        output: resultOutput,
        status: 'success',
        metadata: {
          provider: this.provider,
          model,
          duration_ms: Date.now() - startTime,
          tokens_used: inputTokens || outputTokens
            ? { input: inputTokens, output: outputTokens }
            : undefined,
        },
      };
    } catch (error) {
      // Handle case where Agent SDK is not installed
      if (
        error instanceof Error &&
        (error.message.includes('Cannot find module') || error.message.includes('ERR_MODULE_NOT_FOUND'))
      ) {
        return {
          output: '',
          status: 'failure',
          error: 'Claude Agent SDK (@anthropic-ai/claude-agent-sdk) is not installed. ' +
            'Install it with: npm install @anthropic-ai/claude-agent-sdk',
          metadata: {
            provider: this.provider,
            model,
            duration_ms: Date.now() - startTime,
          },
        };
      }

      return {
        output: '',
        status: 'failure',
        error: `Claude Agent executor error: ${error instanceof Error ? error.message : String(error)}`,
        metadata: {
          provider: this.provider,
          model,
          duration_ms: Date.now() - startTime,
        },
      };
    }
  }

  /**
   * Load the Agent SDK. It is an optional dependency, imported only when an
   * agent step runs in CLI-native mode (harness: 'claude-code').
   */
  protected loadAgentSdk(): Promise<Pick<typeof import('@anthropic-ai/claude-agent-sdk'), 'query'>> {
    return import('@anthropic-ai/claude-agent-sdk');
  }

  // ══════════════════════════════════════════════════════════════════════
  // Variable Substitution
  // ══════════════════════════════════════════════════════════════════════

  /**
   * Substitute {placeholder} variables in a string with values from the
   * execution context. Supports: {work_id}, {run_id}, {phase}, {step_id}.
   */
  private substituteVariables(text: string, context: ExecutionContext): string {
    return text
      .replace(/\{work_id\}/g, context.workId)
      .replace(/\{run_id\}/g, context.runId || '')
      .replace(/\{phase\}/g, context.phase)
      .replace(/\{step_id\}/g, context.stepId);
  }
}
