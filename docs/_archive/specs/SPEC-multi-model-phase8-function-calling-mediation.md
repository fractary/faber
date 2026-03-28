---
title: SPEC - Phase 8 - Multi-Model Function Calling Mediation (Tier 3 Tool Access)
description: Enable external models (OpenAI, Gemini, self-hosted) to use file/shell tools via function-calling mediation in FABER workflow steps
tags: [spec, faber, multi-model, executors, function-calling, tools]
created: 2026-03-25
updated: 2026-03-25
fractary_doc_type: specification
visibility: internal
status: proposed
---

# Phase 8: Multi-Model Function Calling Mediation (Tier 3 Tool Access)

**Status**: Proposed (deferred from initial multi-model executor implementation)
**Depends on**: Multi-model executor framework (implemented in `sdk/js/src/executors/`)
**Priority**: Medium — most use cases work with Tier 1 (prompt in → text out)

---

## Background

The multi-model executor framework (implemented 2026-03-25) supports three tiers of capability:

- **Tier 1 (implemented)**: Prompt in → text out. External model receives the prompt, returns text. No tool access.
- **Tier 2 (already possible)**: Claude agent wrapper. Step uses Claude with a system prompt that instructs it to call an external service. Full tool access via Claude.
- **Tier 3 (this spec)**: Function-calling mediation. External model gets tool definitions via its native function-calling API, and the SDK mediates tool execution locally.

## Problem

When an external model (GPT-4o, Gemini, Llama, etc.) executes a workflow step, it currently cannot interact with the filesystem, run commands, or use any tools. It can only receive a prompt and return text. This limits external models to analysis, generation, and review tasks — they cannot implement code changes, run tests, or interact with external systems.

## Proposed Solution

### Step Config Extension

Add a `tools` field to `StepExecutorConfig` (already defined in `sdk/js/src/executors/types.ts` but not yet implemented):

```typescript
export interface StepToolConfig {
  /** Enable file read/write tools via function calling */
  file_access?: boolean;
  /** Enable shell command execution via function calling */
  shell_access?: boolean;
  /** Custom tool definitions (OpenAI function-calling format) */
  custom?: ToolDefinition[];
}
```

### Workflow YAML Example

```yaml
steps:
  - id: implement-feature
    name: Implement feature with GPT-4o
    prompt: "Implement the authentication middleware..."
    executor:
      provider: openai
      model: gpt-4o
      tools:
        file_access: true
        shell_access: false
```

### Mediation Loop

When a step has `tools` configured, the executor enters a mediation loop:

1. Send the prompt + tool definitions to the external model
2. If the model responds with a tool call (e.g., `read_file("src/auth.ts")`):
   a. Execute the tool call locally (read the file from disk)
   b. Send the tool result back to the model
   c. Repeat until the model produces a final text response
3. Return the final response as the `ExecutorResult`

### Tool Definitions

Provide standard tool definitions in each model's native function-calling format:

| Tool | Description | Parameters |
|------|-------------|------------|
| `read_file` | Read file contents | `path: string, offset?: number, limit?: number` |
| `write_file` | Write file contents | `path: string, content: string` |
| `edit_file` | Replace text in file | `path: string, old_string: string, new_string: string` |
| `list_files` | Glob file search | `pattern: string, path?: string` |
| `search_files` | Grep content search | `pattern: string, path?: string` |
| `run_command` | Execute shell command | `command: string` (requires `shell_access: true`) |

### Implementation Location

- `sdk/js/src/executors/tools/` — Tool definitions and local execution
- `sdk/js/src/executors/tools/definitions.ts` — Standard tool schemas in OpenAI format
- `sdk/js/src/executors/tools/executor.ts` — Local tool execution (sandboxed)
- `sdk/js/src/executors/providers/openai.ts` — Update to support function-calling loop
- `sdk/js/src/executors/providers/openai-compatible.ts` — Same
- `sdk/js/src/executors/providers/claude.ts` — Update to support tool_use blocks

### Security Considerations

- File access should be scoped to the working directory (no path traversal)
- Shell access should be opt-in and configurable (default: disabled)
- Command execution should use the same sandboxing as Claude Code
- Tool calls should be logged for audit trail

### Acceptance Criteria

- [ ] External model can read/write files via function calling
- [ ] External model can search files via function calling
- [ ] Shell access is opt-in and sandboxed
- [ ] Mediation loop handles multi-turn tool use
- [ ] Works with OpenAI, OpenAI-compatible, and Claude API providers
- [ ] Tool calls are logged in workflow events
