/**
 * @fractary/faber - OpenAI Executor
 *
 * Executes workflow steps via the OpenAI Chat Completions API.
 * Supports GPT-4o, o3, and other OpenAI models.
 *
 * Default env var: OPENAI_API_KEY
 * Default model: gpt-4o
 */

import type {
  Executor,
  ExecutorResult,
  ExecutionContext,
  StepExecutorConfig,
} from '../types.js';

const DEFAULT_MODEL = 'gpt-4o';
const DEFAULT_MAX_TOKENS = 4096;
const DEFAULT_API_KEY_ENV = 'OPENAI_API_KEY';
const API_BASE_URL = 'https://api.openai.com/v1';

export class OpenAIExecutor implements Executor {
  readonly provider = 'openai';

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

    if (config.system_prompt) {
      messages.push({ role: 'system', content: config.system_prompt });
    }

    // Add context as system message if no custom system prompt
    if (!config.system_prompt) {
      const contextPrefix = this.buildContextPrefix(context);
      if (contextPrefix) {
        messages.push({ role: 'system', content: contextPrefix });
      }
    }

    messages.push({ role: 'user', content: prompt });

    const body: Record<string, unknown> = {
      model,
      max_tokens: maxTokens,
      messages,
    };

    if (config.temperature !== undefined) {
      body.temperature = config.temperature;
    }

    try {
      const response = await fetch(`${API_BASE_URL}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const errorBody = await response.text();
        return {
          output: '',
          status: 'failure',
          error: `OpenAI API error (${response.status}): ${errorBody}`,
          metadata: { provider: this.provider, model, duration_ms: Date.now() - startTime },
        };
      }

      const data = await response.json() as {
        choices: Array<{ message: { content: string | null } }>;
        usage?: { prompt_tokens: number; completion_tokens: number };
      };

      const output = data.choices?.[0]?.message?.content || '';

      return {
        output,
        status: 'success',
        metadata: {
          provider: this.provider,
          model,
          duration_ms: Date.now() - startTime,
          tokens_used: data.usage
            ? { input: data.usage.prompt_tokens, output: data.usage.completion_tokens }
            : undefined,
        },
      };
    } catch (error) {
      return {
        output: '',
        status: 'failure',
        error: `OpenAI executor error: ${error instanceof Error ? error.message : String(error)}`,
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
        error: `Environment variable '${apiKeyEnv}' is not set. Set it with your OpenAI API key.`,
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
