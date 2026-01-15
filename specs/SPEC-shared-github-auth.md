# Specification: Shared GitHub Authentication in Unified Config

**Status:** Draft (for fractary/core implementation)
**Related Issue:** [#55](https://github.com/fractary/faber/issues/55)
**Author:** Claude
**Date:** 2026-01-15

## Overview

This specification defines how fractary-core plugins (work, repo) should read GitHub authentication from the shared `github:` section of the unified `.fractary/config.yaml`, eliminating duplication across tools.

## Problem Statement

Currently, each plugin configures GitHub authentication separately:

```yaml
# Current: Duplicated GitHub config
work:
  active_handler: github
  handlers:
    github:
      owner: myorg
      repo: myrepo
      token: ${GITHUB_TOKEN}

repo:
  active_handler: github
  handlers:
    github:
      token: ${GITHUB_TOKEN}
```

**Issues:**
- Token specified twice
- Organization/repo specified twice
- Changes must be made in multiple places
- Inconsistent with FABER CLI which uses top-level `github:` section

## Solution

Add top-level `github:` section for shared authentication:

```yaml
version: "2.0"

# Shared GitHub authentication (used by all plugins)
github:
  organization: myorg
  project: myrepo
  token: ${GITHUB_TOKEN}           # PAT (legacy)
  app:                             # GitHub App (preferred)
    id: "123456"
    installation_id: "12345678"
    private_key_path: ~/.github/faber-app.pem
    private_key_env_var: GITHUB_APP_PRIVATE_KEY

# Plugin-specific settings (no duplication)
work:
  active_handler: github
  handlers:
    github:
      # Falls back to top-level github.organization/project
      # Can override if needed: owner: different-org

repo:
  active_handler: github
  handlers:
    github:
      # Falls back to top-level github.token or github.app
```

## Implementation Details

### 1. Config Schema Update

Update `fractary/core/sdk/js/src/common/yaml-config.ts`:

```typescript
interface CoreYamlConfig {
  version: string;
  github?: GitHubSharedConfig;    // NEW: Shared auth
  anthropic?: AnthropicConfig;    // NEW: Shared API key
  work?: WorkConfig;
  repo?: RepoConfig;
  logs?: LogsConfig;
  // ... other plugins
}

interface GitHubSharedConfig {
  organization?: string;
  project?: string;
  token?: string;                  // PAT
  app?: {                          // GitHub App
    id: string;
    installation_id: string;
    private_key_path?: string;
    private_key_env_var?: string;
    created_via?: 'manifest-flow' | 'manual';
    created_at?: string;
  };
}

interface AnthropicConfig {
  api_key?: string;
  model?: string;
  max_tokens?: number;
}
```

### 2. Work Plugin Updates

Update work handler to fall back to shared config:

```typescript
// In work plugin GitHub handler initialization
function getGitHubConfig(config: CoreYamlConfig): GitHubHandlerConfig {
  const workConfig = config.work?.handlers?.github || {};
  const sharedConfig = config.github || {};

  return {
    owner: workConfig.owner || sharedConfig.organization,
    repo: workConfig.repo || sharedConfig.project,
    token: workConfig.token || sharedConfig.token,
    app: workConfig.app || sharedConfig.app,
  };
}
```

### 3. Repo Plugin Updates

Similar fallback logic for repo plugin handlers.

### 4. Authentication Priority

When resolving GitHub authentication:

1. **Highest**: Environment variables (`GITHUB_TOKEN`, `GITHUB_APP_PRIVATE_KEY`)
2. **High**: Plugin-specific handler config (`work.handlers.github.token`)
3. **Medium**: Shared GitHub config (`github.token` or `github.app.*`)
4. **Low**: gh CLI authentication (`gh auth status`)
5. **Lowest**: Error if none available

### 5. Validation Rules

- At least one authentication method must be configured
- If `github.app` is specified, it must have `id` and `installation_id`
- Warn if both `github.token` and `github.app` are configured (app takes precedence)
- Validate that `github.organization` and `github.project` are set if used by plugins

## Migration Path

1. Users run `fractary-core:init` which creates unified config with shared sections
2. Existing work/repo configs continue to work (handler-specific config takes precedence)
3. Users can gradually remove duplicated config from handlers
4. Documentation guides users toward shared config pattern

## Testing Requirements

### Unit Tests

- Load config with shared GitHub section
- Extract work config with fallback to shared GitHub
- Extract repo config with fallback to shared GitHub
- Override shared config with plugin-specific config
- Validate GitHub App configuration
- Handle missing shared config gracefully

### Integration Tests

- Work plugin uses shared GitHub auth
- Repo plugin uses shared GitHub auth
- Both plugins work with same shared config
- Override behavior works correctly

## Documentation Updates

Update `fractary/core/docs/guides/configuration.md`:

```markdown
## Shared Authentication Configuration

### GitHub Authentication (Shared)

Configure GitHub authentication once at the top level:

```yaml
version: "2.0"

github:
  organization: myorg
  project: myrepo

  # Option 1: Personal Access Token (PAT)
  token: ${GITHUB_TOKEN}

  # Option 2: GitHub App (recommended)
  app:
    id: "123456"
    installation_id: "12345678"
    private_key_path: ${GITHUB_APP_PRIVATE_KEY_PATH:-~/.github/app.pem}
```

Plugins that use GitHub (work, repo) will automatically use these settings
unless overridden in their handler configs.

### Override Behavior

Plugin-specific configs override shared configs:

```yaml
github:
  organization: default-org
  project: default-project

work:
  handlers:
    github:
      owner: special-org      # Overrides github.organization
      repo: special-project   # Overrides github.project
```
```

## Acceptance Criteria

- [ ] `github:` section at top level of config.yaml is recognized
- [ ] Work plugin falls back to shared GitHub config
- [ ] Repo plugin falls back to shared GitHub config
- [ ] Handler-specific config overrides shared config
- [ ] GitHub App authentication works from shared config
- [ ] PAT authentication works from shared config
- [ ] Documentation updated with shared auth pattern
- [ ] Unit tests cover fallback behavior
- [ ] Integration tests verify cross-plugin shared auth
