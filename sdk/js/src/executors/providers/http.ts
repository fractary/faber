/**
 * @fractary/faber - HTTP Executor
 *
 * Executes workflow steps via generic HTTP POST requests.
 * Designed for non-LLM APIs (Banana, Replicate, custom services).
 *
 * The step prompt is sent as the request body (or within a JSON payload).
 * The response body is returned as the executor output.
 *
 * Requires `base_url` in config.
 */

import type {
  Executor,
  ExecutorResult,
  ExecutionContext,
  StepExecutorConfig,
} from '../types.js';

export class HttpExecutor implements Executor {
  readonly provider = 'http';

  async execute(
    prompt: string,
    context: ExecutionContext,
    config: StepExecutorConfig,
  ): Promise<ExecutorResult> {
    const startTime = Date.now();
    const baseUrl = config.base_url;

    if (!baseUrl) {
      return {
        output: '',
        status: 'failure',
        error: 'base_url is required for http provider',
        metadata: { provider: this.provider, duration_ms: Date.now() - startTime },
      };
    }

    const apiKey = config.api_key_env ? process.env[config.api_key_env] : undefined;

    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };

      if (apiKey) {
        headers['Authorization'] = `Bearer ${apiKey}`;
      }

      // Build request body — wrap prompt in a JSON payload with context
      const body = JSON.stringify({
        prompt,
        context: {
          work_id: context.workId,
          phase: context.phase,
          step_id: context.stepId,
          step_name: context.stepName,
        },
        model: config.model,
      });

      const response = await fetch(baseUrl, {
        method: 'POST',
        headers,
        body,
      });

      if (!response.ok) {
        const errorBody = await response.text();
        return {
          output: '',
          status: 'failure',
          error: `HTTP error (${response.status}) from ${baseUrl}: ${errorBody}`,
          metadata: { provider: this.provider, duration_ms: Date.now() - startTime },
        };
      }

      // Try to parse as JSON, fall back to text
      const contentType = response.headers.get('content-type') || '';
      let output: string;

      if (contentType.includes('application/json')) {
        const data = await response.json() as Record<string, unknown>;
        // Try common response patterns
        output =
          typeof data === 'string' ? data :
          (data.output ?? data.result ?? data.text ?? data.content ?? data.message ??
          JSON.stringify(data, null, 2)) as string;
      } else {
        output = await response.text();
      }

      return {
        output: String(output),
        status: 'success',
        metadata: {
          provider: this.provider,
          model: config.model,
          duration_ms: Date.now() - startTime,
        },
      };
    } catch (error) {
      return {
        output: '',
        status: 'failure',
        error: `HTTP executor error: ${error instanceof Error ? error.message : String(error)}`,
        metadata: { provider: this.provider, duration_ms: Date.now() - startTime },
      };
    }
  }

  async validate(config: StepExecutorConfig): Promise<{ valid: boolean; error?: string }> {
    if (!config.base_url) {
      return {
        valid: false,
        error: "base_url is required for 'http' provider",
      };
    }

    // Validate URL format
    try {
      new URL(config.base_url);
    } catch {
      return {
        valid: false,
        error: `Invalid URL: ${config.base_url}`,
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
}
