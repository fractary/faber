---
title: SPEC - Phase 3 - OpenAI, OpenAI-Compatible, and HTTP Providers
description: External model providers for OpenAI, any OpenAI-compatible endpoint (Ollama, vLLM, Together, Groq), and generic HTTP APIs (Banana, Replicate)
tags: [spec, faber, multi-model, executors, openai, ollama, http]
created: 2026-03-25
updated: 2026-03-25
fractary_doc_type: specification
visibility: internal
status: implemented
---

# Phase 3: OpenAI, OpenAI-Compatible, and HTTP Providers

**Status**: Implemented (2026-03-25)
**Verified**: SDK compiles clean, 135 existing tests pass

---

## Goal

Add the most-requested external providers: OpenAI (GPT-4o, o3), any OpenAI-compatible API (self-hosted models, third-party hosts), and a generic HTTP executor for non-LLM services.

## What Was Built

### 3a. OpenAI Executor (`sdk/js/src/executors/providers/openai.ts`)

Executes steps via the OpenAI Chat Completions API:

- Default model: `gpt-4o`
- Default env var: `OPENAI_API_KEY`
- Default max tokens: 4096
- Supports `system_prompt` as a system message, or builds context from issue/phase metadata
- Reports token usage (`prompt_tokens`, `completion_tokens`)
- Validates API key presence

### 3b. OpenAI-Compatible Executor (`sdk/js/src/executors/providers/openai-compatible.ts`)

Same Chat Completions API format but with configurable `base_url`. Covers:

- **Self-hosted**: Ollama (`http://localhost:11434/v1`), vLLM, llama.cpp
- **Third-party**: Together AI, Groq, Fireworks, Anyscale
- **Any OpenAI-compatible endpoint**

Key differences from OpenAI executor:
- `base_url` is required (validated)
- `model` is required (validated)
- API key is optional (many local services don't require auth)
- URL normalization (strips trailing slashes)

### 3c. HTTP Executor (`sdk/js/src/executors/providers/http.ts`)

Generic HTTP POST executor for non-LLM APIs:

- Sends a JSON payload with `prompt`, `context`, and `model` fields
- Parses JSON responses trying common patterns (`output`, `result`, `text`, `content`, `message`)
- Falls back to raw text for non-JSON responses
- `base_url` is the full endpoint URL (required, validated as valid URL)
- API key optional via `api_key_env`

Designed for services like Banana (image generation), Replicate, custom webhooks, and any REST API.

## Workflow YAML Examples

```yaml
# OpenAI
executor:
  provider: openai
  model: gpt-4o

# Self-hosted Ollama
executor:
  provider: openai-compatible
  base_url: http://localhost:11434/v1
  model: llama3

# Together AI
executor:
  provider: openai-compatible
  base_url: https://api.together.xyz/v1
  model: meta-llama/Llama-3-70b-chat-hf
  api_key_env: TOGETHER_API_KEY

# Banana image generation
executor:
  provider: http
  base_url: https://api.banana.dev/v1/generate
  api_key_env: BANANA_API_KEY
```

## Files

| File | Action |
|------|--------|
| `sdk/js/src/executors/providers/openai.ts` | Created |
| `sdk/js/src/executors/providers/openai-compatible.ts` | Created |
| `sdk/js/src/executors/providers/http.ts` | Created |
