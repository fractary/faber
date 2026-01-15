# Specification: Shared Anthropic API Key in Unified Config

**Status:** Draft (for fractary/core implementation)
**Related Issue:** [#55](https://github.com/fractary/faber/issues/55)
**Author:** Claude
**Date:** 2026-01-15

## Overview

This specification defines how the Anthropic API key should be shared across all Fractary tools via the unified `.fractary/config.yaml`.

## Problem Statement

FABER CLI needs an Anthropic API key for AI-powered workflows. Currently, this is configured in FABER's settings.json. If other tools or plugins need access to the Anthropic API, they would have to duplicate this configuration.

## Solution

Add top-level `anthropic:` section in unified config:

```yaml
version: "2.0"

anthropic:
  api_key: ${ANTHROPIC_API_KEY}
  model: claude-sonnet-4-5       # Optional: default model
  max_tokens: 8096               # Optional: default max tokens
```

## Implementation Details

### 1. Config Schema

```typescript
interface AnthropicConfig {
  api_key?: string;
  model?: string;
  max_tokens?: number;
}
```

### 2. Environment Variable Precedence

The `ANTHROPIC_API_KEY` environment variable should always take precedence:

```typescript
function getAnthropicApiKey(config: CoreYamlConfig): string | undefined {
  return process.env.ANTHROPIC_API_KEY || config.anthropic?.api_key;
}
```

### 3. Usage in FABER CLI

FABER CLI reads from `config.anthropic.api_key`:

```typescript
const config = loadYamlConfig();
const apiKey = process.env.ANTHROPIC_API_KEY || config?.anthropic?.api_key;
```

### 4. Usage in Other Tools

Any tool needing Anthropic API can use the shared configuration:

```typescript
// In any fractary tool
import { loadYamlConfig } from '@fractary/core';

const config = loadYamlConfig();
const anthropicConfig = config.anthropic;

// Use with Anthropic SDK
const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY || anthropicConfig?.api_key,
});
```

## Security Considerations

1. **No hardcoded keys**: Config should use `${ANTHROPIC_API_KEY}` reference
2. **Environment variable precedence**: Runtime env vars override file config
3. **File permissions**: Config file should be in `.gitignore`
4. **CI/CD**: Use secrets management for API keys

## Configuration Examples

### Development (Local)

```yaml
anthropic:
  api_key: ${ANTHROPIC_API_KEY}
```

```bash
# In ~/.bashrc or ~/.zshrc
export ANTHROPIC_API_KEY="sk-ant-xxxxx"
```

### CI/CD

```yaml
# .fractary/config.yaml (committed)
anthropic:
  api_key: ${ANTHROPIC_API_KEY}
  model: claude-sonnet-4-5
```

```yaml
# GitHub Actions workflow
env:
  ANTHROPIC_API_KEY: ${{ secrets.ANTHROPIC_API_KEY }}
```

### With Default Model

```yaml
anthropic:
  api_key: ${ANTHROPIC_API_KEY}
  model: ${ANTHROPIC_MODEL:-claude-sonnet-4-5}
  max_tokens: ${ANTHROPIC_MAX_TOKENS:-8096}
```

## Migration Path

1. **FABER users**: Run `fractary-faber migrate` to move API key to unified config
2. **New users**: Run `fractary-core:init` which prompts for API key setup
3. **Existing fractary-core users**: Add `anthropic:` section manually or via `fractary-core:init --update`

## Testing Requirements

### Unit Tests

- Load config with anthropic section
- Environment variable takes precedence over file config
- Handle missing api_key gracefully
- Validate model and max_tokens options

### Integration Tests

- FABER CLI uses shared anthropic config
- API key substitution works correctly
- Error handling for missing API key

## Documentation Updates

Add to `fractary/core/docs/guides/configuration.md`:

```markdown
## Anthropic API Configuration

Configure the Anthropic API key once for all Fractary tools:

```yaml
anthropic:
  api_key: ${ANTHROPIC_API_KEY}
  model: claude-sonnet-4-5    # Optional default model
  max_tokens: 8096            # Optional default max tokens
```

### Setting the API Key

**Environment Variable (Recommended):**
```bash
export ANTHROPIC_API_KEY="sk-ant-xxxxx"
```

**In CI/CD:**
```yaml
# GitHub Actions
env:
  ANTHROPIC_API_KEY: ${{ secrets.ANTHROPIC_API_KEY }}
```

Never commit actual API keys to version control. Always use environment
variable references in config files.
```

## Acceptance Criteria

- [ ] `anthropic:` section at top level is recognized
- [ ] `ANTHROPIC_API_KEY` env var takes precedence
- [ ] FABER CLI reads from shared config
- [ ] Optional `model` and `max_tokens` are supported
- [ ] Documentation explains shared API key pattern
- [ ] Migration from old FABER settings works
- [ ] Unit tests cover all scenarios
