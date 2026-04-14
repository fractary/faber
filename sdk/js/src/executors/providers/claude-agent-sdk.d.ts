/**
 * Minimal type declarations for @anthropic-ai/claude-agent-sdk.
 *
 * The Agent SDK is an optional dependency — only needed when running
 * in CLI-native mode with harness: 'claude-code'. It is dynamically
 * imported at runtime. These declarations provide compile-time type
 * safety without requiring the package to be installed.
 */
declare module '@anthropic-ai/claude-agent-sdk' {
  interface QueryOptions {
    cwd?: string;
    model?: string;
    maxTurns?: number;
    maxBudgetUsd?: number;
    systemPrompt?: string | {
      type: 'preset';
      preset: 'claude_code';
      append?: string;
    };
    settingSources?: string[];
    tools?: string[] | { type: 'preset'; preset: 'claude_code' };
    allowedTools?: string[];
    disallowedTools?: string[];
    mcpServers?: Record<string, { command: string; args?: string[] }>;
    permissionMode?: string;
    hooks?: Record<string, unknown>;
    agents?: Record<string, unknown>;
    env?: Record<string, string | undefined>;
    debug?: boolean;
    resume?: string;
    sessionId?: string;
    persistSession?: boolean;
    effort?: string;
    thinking?: { type: string; budgetTokens?: number };
    outputFormat?: { type: string; schema?: unknown };
  }

  interface SDKMessage {
    type: string;
    subtype?: string;
    [key: string]: unknown;
  }

  function query(params: {
    prompt: string;
    options?: QueryOptions;
  }): AsyncIterable<SDKMessage>;

  export { query, QueryOptions, SDKMessage };
}
