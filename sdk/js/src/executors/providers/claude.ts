/**
 * @fractary/faber - Claude Executor
 *
 * Executes workflow steps via the Anthropic Messages API.
 * Used in CLI-native mode where Claude Code is not available.
 *
 * Default env var: ANTHROPIC_API_KEY
 * Default model: claude-sonnet-4-6-20250514
 */

import type {
  Executor,
  ExecutorResult,
  ExecutionContext,
  StepExecutorConfig,
} from '../types.js';

const DEFAULT_MODEL = 'claude-sonnet-4-6-20250514';
const DEFAULT_MAX_TOKENS = 8192;
const DEFAULT_API_KEY_ENV = 'ANTHROPIC_API_KEY';
const API_BASE_URL = 'https://api.anthropic.com/v1';

export class ClaudeExecutor implements Executor {
  readonly provider = 'claude';

  async execute(
    prompt: string,
    context: ExecutionContext,
    config: StepExecutorConfig,
  ): Promise<ExecutorResult> {
    const startTime = Date.now();
    const model = config.model || DEFAULT_MODEL;
    const maxTokens = config.max_tokens || DEFAULT_MAX_TOKENS;
    const apiKeyEnv = config.api_key_env || DEFAULT_API_KEY_ENV;
    const apiKey = process.env[apiKeyEnv];

    if (!apiKey) {
      return {
        output: '',
        status: 'failure',
        error: `API key not found in environment variable: ${apiKeyEnv}`,
        metadata: { provider: this.provider, model, duration_ms: Date.now() - startTime },
      };
    }

    // Build messages
    const messages: Array<{ role: string; content: string }> = [];

    // Add context as user message prefix
    const contextPrefix = this.buildContextPrefix(context);
    const fullPrompt = contextPrefix ? `${contextPrefix}\n\n${prompt}` : prompt;

    messages.push({ role: 'user', content: fullPrompt });

    // Build request body
    const body: Record<string, unknown> = {
      model,
      max_tokens: maxTokens,
      messages,
    };

    if (config.system_prompt) {
      body.system = config.system_prompt;
    }

    if (config.temperature !== undefined) {
      body.temperature = config.temperature;
    }

    try {
      const response = await fetch(`${API_BASE_URL}/messages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const errorBody = await response.text();
        return {
          output: '',
          status: 'failure',
          error: `Anthropic API error (${response.status}): ${errorBody}`,
          metadata: { provider: this.provider, model, duration_ms: Date.now() - startTime },
        };
      }

      const data = await response.json() as {
        content: Array<{ type: string; text?: string }>;
        usage?: { input_tokens: number; output_tokens: number };
      };

      // Extract text from response content blocks
      const output = data.content
        .filter((block) => block.type === 'text' && block.text)
        .map((block) => block.text!)
        .join('\n');

      return {
        output,
        status: 'success',
        metadata: {
          provider: this.provider,
          model,
          duration_ms: Date.now() - startTime,
          tokens_used: data.usage
            ? { input: data.usage.input_tokens, output: data.usage.output_tokens }
            : undefined,
        },
      };
    } catch (error) {
      return {
        output: '',
        status: 'failure',
        error: `Claude executor error: ${error instanceof Error ? error.message : String(error)}`,
        metadata: { provider: this.provider, model, duration_ms: Date.now() - startTime },
      };
    }
  }

  async validate(config: StepExecutorConfig): Promise<{ valid: boolean; error?: string }> {
    const apiKeyEnv = config.api_key_env || DEFAULT_API_KEY_ENV;
    const apiKey = process.env[apiKeyEnv];

    if (!apiKey) {
      return {
        valid: false,
        error: `Environment variable '${apiKeyEnv}' is not set. Set it with your Anthropic API key.`,
      };
    }

    return { valid: true };
  }

  private buildContextPrefix(context: ExecutionContext): string {
    const parts: string[] = [];

    if (context.issue) {
      parts.push(`Issue #${context.issue.number}: ${context.issue.title}`);
      if (context.issue.body) {
        parts.push(`Issue description: ${context.issue.body.slice(0, 2000)}`);
      }
    }

    if (context.phase) {
      parts.push(`Workflow phase: ${context.phase}`);
    }

    if (context.stepName) {
      parts.push(`Step: ${context.stepName}`);
    }

    return parts.length > 0 ? parts.join('\n') : '';
  }
}
