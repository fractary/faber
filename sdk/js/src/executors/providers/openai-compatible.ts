/**
 * @fractary/faber - OpenAI-Compatible Executor
 *
 * Executes workflow steps via any OpenAI-compatible Chat Completions API.
 * Supports: Ollama, vLLM, Together AI, Groq, Fireworks, and any other
 * service implementing the OpenAI Chat Completions interface.
 *
 * Requires `base_url` in config (e.g., 'http://localhost:11434/v1' for Ollama).
 * Default env var: none (many local services don't require auth)
 */

import type {
  Executor,
  ExecutorResult,
  ExecutionContext,
  StepExecutorConfig,
} from '../types.js';

const DEFAULT_MAX_TOKENS = 4096;

export class OpenAICompatibleExecutor implements Executor {
  readonly provider = 'openai-compatible';

  async execute(
    prompt: string,
    context: ExecutionContext,
    config: StepExecutorConfig,
  ): Promise<ExecutorResult> {
    const startTime = Date.now();
    const model = config.model || 'default';
    const maxTokens = config.max_tokens || DEFAULT_MAX_TOKENS;
    const baseUrl = config.base_url;

    if (!baseUrl) {
      return {
        output: '',
        status: 'failure',
        error: 'base_url is required for openai-compatible provider',
        metadata: { provider: this.provider, model, duration_ms: Date.now() - startTime },
      };
    }

    // API key is optional for local services (Ollama, etc.)
    const apiKey = config.api_key_env ? process.env[config.api_key_env] : undefined;

    // Build messages
    const messages: Array<{ role: string; content: string }> = [];

    if (config.system_prompt) {
      messages.push({ role: 'system', content: config.system_prompt });
    }

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

    // Normalize base URL (strip trailing slash)
    const normalizedBaseUrl = baseUrl.replace(/\/+$/, '');
    const url = `${normalizedBaseUrl}/chat/completions`;

    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };

      if (apiKey) {
        headers['Authorization'] = `Bearer ${apiKey}`;
      }

      const response = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const errorBody = await response.text();
        return {
          output: '',
          status: 'failure',
          error: `API error (${response.status}) from ${normalizedBaseUrl}: ${errorBody}`,
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
        error: `OpenAI-compatible executor error: ${error instanceof Error ? error.message : String(error)}`,
        metadata: { provider: this.provider, model, duration_ms: Date.now() - startTime },
      };
    }
  }

  async validate(config: StepExecutorConfig): Promise<{ valid: boolean; error?: string }> {
    if (!config.base_url) {
      return {
        valid: false,
        error: "base_url is required for 'openai-compatible' provider (e.g., 'http://localhost:11434/v1')",
      };
    }

    if (!config.model) {
      return {
        valid: false,
        error: "model is required for 'openai-compatible' provider (e.g., 'llama3', 'mixtral')",
      };
    }

    // Check API key if specified
    if (config.api_key_env && !process.env[config.api_key_env]) {
      return {
        valid: false,
        error: `Environment variable '${config.api_key_env}' is not set`,
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
