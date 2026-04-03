# Specification: @fractary/core Auth & .env Loading Enhancements

**Date:** 2026-01-20
**Target Package:** @fractary/core
**Status:** Proposed

## Overview

Faber CLI has its own auth code that should be consolidated in @fractary/core so all CLI tools benefit from a unified, robust authentication system.

---

## Enhancement 1: Auto-load .env files

### Purpose
Any project that imports @fractary/core should automatically get .env loading.

### Implementation

1. Add dependency to `package.json`:
   ```json
   "dotenv": "^16.4.5"
   ```

2. In main entry point (e.g., `src/index.ts`), add as first line:
   ```typescript
   import 'dotenv/config';
   ```

### Result
All consumers of @fractary/core automatically have environment variables loaded from `.env` files.

---

## Enhancement 2: Token Provider System

### Purpose
A unified authentication abstraction that supports multiple auth methods (PAT, GitHub App).

### New Types (`src/auth/types.ts`)

```typescript
export interface TokenProvider {
  getToken(): Promise<string>;
}

export interface GitHubAppConfig {
  id: string;
  installation_id: string;
  private_key_path?: string;
  private_key_env_var?: string;
}
```

### StaticTokenProvider (`src/auth/static-token-provider.ts`)

Simple provider for Personal Access Tokens:

```typescript
import { TokenProvider } from './types';

export class StaticTokenProvider implements TokenProvider {
  constructor(private token: string) {}

  async getToken(): Promise<string> {
    return this.token;
  }
}
```

### GitHubAppAuth (`src/auth/github-app-auth.ts`)

Full GitHub App authentication with:
- JWT generation from private key
- JWT exchange for installation access token
- Token caching with expiration tracking
- Auto-refresh when token expires (5-minute threshold before expiration)
- Private key loading from file path OR environment variable (base64 encoded)

```typescript
import * as jwt from 'jsonwebtoken';
import * as fs from 'fs';
import { GitHubAppConfig } from './types';

interface CachedToken {
  token: string;
  expiresAt: Date;
}

export class GitHubAppAuth {
  private cachedToken: CachedToken | null = null;
  private readonly REFRESH_THRESHOLD_MS = 5 * 60 * 1000; // 5 minutes

  constructor(private config: GitHubAppConfig) {}

  async getToken(): Promise<string> {
    if (this.isTokenValid()) {
      return this.cachedToken!.token;
    }

    const jwt = this.generateJWT();
    const installationToken = await this.exchangeForInstallationToken(jwt);

    this.cachedToken = {
      token: installationToken.token,
      expiresAt: new Date(installationToken.expires_at),
    };

    return this.cachedToken.token;
  }

  private isTokenValid(): boolean {
    if (!this.cachedToken) return false;
    const now = new Date();
    const expiresAt = this.cachedToken.expiresAt.getTime();
    return now.getTime() < expiresAt - this.REFRESH_THRESHOLD_MS;
  }

  private generateJWT(): string {
    const privateKey = this.loadPrivateKey();
    const now = Math.floor(Date.now() / 1000);

    return jwt.sign(
      {
        iat: now - 60, // Issued 60 seconds ago (clock drift)
        exp: now + 600, // Expires in 10 minutes
        iss: this.config.id,
      },
      privateKey,
      { algorithm: 'RS256' }
    );
  }

  private loadPrivateKey(): string {
    // Try file path first
    if (this.config.private_key_path) {
      return fs.readFileSync(this.config.private_key_path, 'utf8');
    }

    // Try environment variable (base64 encoded)
    const envVar = this.config.private_key_env_var || 'GITHUB_APP_PRIVATE_KEY';
    const base64Key = process.env[envVar];
    if (base64Key) {
      return Buffer.from(base64Key, 'base64').toString('utf8');
    }

    throw new Error(
      `GitHub App private key not found. Provide private_key_path or set ${envVar} env var.`
    );
  }

  private async exchangeForInstallationToken(
    jwtToken: string
  ): Promise<{ token: string; expires_at: string }> {
    const response = await fetch(
      `https://api.github.com/app/installations/${this.config.installation_id}/access_tokens`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${jwtToken}`,
          Accept: 'application/vnd.github+json',
          'X-GitHub-Api-Version': '2022-11-28',
        },
      }
    );

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to get installation token: ${response.status} ${error}`);
    }

    return response.json();
  }
}
```

### GitHubAppTokenProvider (`src/auth/github-app-token-provider.ts`)

Wraps GitHubAppAuth to implement the TokenProvider interface:

```typescript
import { TokenProvider } from './types';
import { GitHubAppAuth } from './github-app-auth';

export class GitHubAppTokenProvider implements TokenProvider {
  constructor(private auth: GitHubAppAuth) {}

  async getToken(): Promise<string> {
    return this.auth.getToken();
  }
}
```

### Factory Function (`src/auth/index.ts`)

```typescript
import { TokenProvider, GitHubAppConfig } from './types';
import { StaticTokenProvider } from './static-token-provider';
import { GitHubAppTokenProvider } from './github-app-token-provider';
import { GitHubAppAuth } from './github-app-auth';

export * from './types';
export * from './static-token-provider';
export * from './github-app-auth';
export * from './github-app-token-provider';

export interface GitHubConfig {
  token?: string;
  app?: GitHubAppConfig;
}

export function createTokenProvider(config: GitHubConfig): TokenProvider {
  // If GitHub App configured, use GitHubAppTokenProvider
  if (config.app?.id && config.app?.installation_id) {
    return new GitHubAppTokenProvider(new GitHubAppAuth(config.app));
  }

  // If PAT available, use StaticTokenProvider
  const token = process.env.GITHUB_TOKEN || config.token;
  if (token) {
    return new StaticTokenProvider(token);
  }

  throw new Error('No GitHub authentication configured');
}
```

---

## Enhancement 3: Config Loading with Auth

### Purpose
A config loader that reads `.fractary/config.yaml` AND automatically sets up authentication.

### Implementation (`src/config/loader.ts`)

```typescript
import * as fs from 'fs';
import * as path from 'path';
import * as yaml from 'yaml';
import { TokenProvider, GitHubAppConfig, createTokenProvider } from '../auth';

export interface LoadedConfig {
  github?: {
    token?: string;
    organization?: string;
    project?: string;
    app?: GitHubAppConfig;
  };
  tokenProvider?: TokenProvider;
  // ... other sections as needed
}

export async function loadConfig(configPath?: string): Promise<LoadedConfig> {
  // 1. dotenv already loaded at entry point

  // 2. Find and load .fractary/config.yaml
  const configFile = configPath || findConfigFile();
  if (!configFile || !fs.existsSync(configFile)) {
    return {};
  }

  const raw = fs.readFileSync(configFile, 'utf8');

  // 3. Apply env var substitution (${VAR_NAME})
  const substituted = substituteEnvVars(raw);
  const config: LoadedConfig = yaml.parse(substituted);

  // 4. Create tokenProvider from config
  if (config.github) {
    try {
      config.tokenProvider = createTokenProvider(config.github);
    } catch {
      // Auth not configured - that's okay for some use cases
    }
  }

  // 5. Return unified config with auth ready
  return config;
}

function findConfigFile(): string | null {
  // Walk up from cwd looking for .fractary/config.yaml
  let dir = process.cwd();
  while (dir !== path.dirname(dir)) {
    const candidate = path.join(dir, '.fractary', 'config.yaml');
    if (fs.existsSync(candidate)) {
      return candidate;
    }
    dir = path.dirname(dir);
  }
  return null;
}

function substituteEnvVars(content: string): string {
  return content.replace(/\$\{([^}]+)\}/g, (_, varName) => {
    return process.env[varName] || '';
  });
}
```

---

## Enhancement 4: Manager Factory with Auth

### Purpose
Factory functions that create authenticated managers, simplifying consumer code.

### Implementation (`src/factories.ts`)

```typescript
import { LoadedConfig, loadConfig } from './config/loader';
import { WorkManager } from './managers/work-manager';
import { RepoManager } from './managers/repo-manager';

export async function createWorkManager(config?: LoadedConfig): Promise<WorkManager> {
  const cfg = config || await loadConfig();
  const token = await cfg.tokenProvider?.getToken();

  if (!cfg.github?.organization || !cfg.github?.project) {
    throw new Error('GitHub organization and project must be configured');
  }

  return new WorkManager({
    platform: 'github',
    owner: cfg.github.organization,
    repo: cfg.github.project,
    token,
  });
}

export async function createRepoManager(config?: LoadedConfig): Promise<RepoManager> {
  const cfg = config || await loadConfig();
  const token = await cfg.tokenProvider?.getToken();

  if (!cfg.github?.organization || !cfg.github?.project) {
    throw new Error('GitHub organization and project must be configured');
  }

  return new RepoManager({
    owner: cfg.github.organization,
    repo: cfg.github.project,
    token,
  });
}
```

---

## Exports (`src/index.ts`)

Update the main entry point to export all new functionality:

```typescript
import 'dotenv/config';

// Existing exports...

// Auth
export * from './auth';

// Config
export * from './config/loader';

// Factories
export * from './factories';
```

---

## Dependencies to Add

```json
{
  "dependencies": {
    "dotenv": "^16.4.5",
    "jsonwebtoken": "^9.0.2",
    "yaml": "^2.3.4"
  },
  "devDependencies": {
    "@types/jsonwebtoken": "^9.0.5"
  }
}
```

---

## What Faber Can Remove After Implementation

Once @fractary/core has these enhancements, faber CLI can delete:

| File | Lines | Notes |
|------|-------|-------|
| `cli/src/lib/github-app-auth.ts` | ~300 | Full GitHub App auth implementation |
| `cli/src/lib/sdk-config-adapter.ts` | ~200 | Config loading and auth setup |
| Auth code in `cli/src/lib/config.ts` | ~100 | Token handling logic |
| `cli/src/lib/repo-client.ts` | ~150 | Replaced by core's factory |

Faber would simply do:

```typescript
import { createWorkManager, createRepoManager, loadConfig } from '@fractary/core';

const config = await loadConfig();
const workManager = await createWorkManager(config);
const repoManager = await createRepoManager(config);
```

---

## Summary

| Enhancement | Purpose |
|-------------|---------|
| dotenv loading | Auto-load .env for all consumers |
| TokenProvider interface | Abstraction for different auth methods |
| StaticTokenProvider | Simple PAT authentication |
| GitHubAppAuth | Full GitHub App auth with JWT, caching, refresh |
| loadConfig() | Unified config + auth loading |
| createWorkManager() | Factory that returns authenticated manager |
| createRepoManager() | Factory that returns authenticated manager |

This consolidates auth in one place so all CLI tools (faber, and future ones) share the same robust implementation.
