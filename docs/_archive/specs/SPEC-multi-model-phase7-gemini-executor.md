---
title: SPEC - Phase 7 - Google Gemini Executor Provider
description: Add native Google Gemini API executor for FABER workflow steps
tags: [spec, faber, multi-model, executors, gemini, google]
created: 2026-03-25
updated: 2026-03-25
fractary_doc_type: specification
visibility: internal
status: proposed
---

# Phase 7: Google Gemini Executor Provider

**Status**: Proposed (deferred from initial multi-model executor implementation)
**Depends on**: Multi-model executor framework (implemented in `sdk/js/src/executors/`)
**Priority**: Low — Gemini can be used today via the `openai-compatible` provider since Gemini supports the OpenAI-compatible API format

---

## Background

The initial multi-model executor implementation includes providers for Claude, OpenAI, OpenAI-compatible (any endpoint), and HTTP. Google Gemini was deferred because:

1. Gemini supports the OpenAI-compatible Chat Completions format, so it works via `openai-compatible` provider today
2. A native provider would add Gemini-specific features (grounding, safety settings, multimodal input)

## Current Workaround

Gemini works today via the `openai-compatible` provider:

```yaml
executor:
  provider: openai-compatible
  base_url: https://generativelanguage.googleapis.com/v1beta/openai
  model: gemini-2.0-flash
  api_key_env: GOOGLE_API_KEY
```

## When to Implement

Build a native Gemini executor when any of these are needed:
- Gemini-specific safety settings or generation config
- Multimodal input (images, audio in step prompts)
- Grounding with Google Search
- Vertex AI authentication (service accounts instead of API keys)
- Usage of Gemini features not exposed via the OpenAI-compatible API

## Proposed Implementation

### New file: `sdk/js/src/executors/providers/gemini.ts`

```typescript
export class GeminiExecutor implements Executor {
  readonly provider = 'gemini';

  async execute(prompt, context, config): Promise<ExecutorResult> {
    // Uses GOOGLE_API_KEY or GEMINI_API_KEY env var
    // Calls Gemini generateContent API
    // Supports Gemini-specific parameters (safety_settings, generation_config)
  }
}
```

### Config Extension

```typescript
export interface StepExecutorConfig {
  // ... existing fields ...
  /** Gemini-specific safety settings */
  safety_settings?: Array<{ category: string; threshold: string }>;
  /** Gemini-specific generation config */
  generation_config?: Record<string, unknown>;
}
```

### Acceptance Criteria

- [ ] Native Gemini API calls (not via OpenAI-compatible shim)
- [ ] Support for `GOOGLE_API_KEY` and `GEMINI_API_KEY` env vars
- [ ] Support for Vertex AI authentication (optional)
- [ ] Safety settings configurable per step
- [ ] Token usage reporting
- [ ] Registered in `ExecutorRegistry.createDefault()`
