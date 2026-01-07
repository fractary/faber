/**
 * SDK Configuration Adapter
 *
 * Converts FABER CLI configuration to @fractary/core SDK configuration format
 * Supports both PAT and GitHub App authentication methods.
 */

import type { FaberConfig, GitHubAppConfig } from '../types/config.js';
import type { WorkConfig, RepoConfig } from '@fractary/core';
import {
  GitHubAppAuth,
  TokenProvider,
  StaticTokenProvider,
  GitHubAppTokenProvider,
} from './github-app-auth.js';

// Singleton token provider for reuse across SDK instances
let tokenProvider: TokenProvider | null = null;
let tokenProviderConfig: GitHubAppConfig | string | null = null;

/**
 * Get or create a token provider based on configuration
 *
 * @param faberConfig - FABER CLI configuration
 * @returns TokenProvider instance
 */
function getTokenProvider(faberConfig: FaberConfig): TokenProvider {
  const appConfig = faberConfig.github?.app;
  const patToken = faberConfig.github?.token;

  // Determine which auth method to use
  // GitHub App takes precedence over PAT if configured
  if (appConfig?.id && appConfig?.installation_id) {
    // Check if we can reuse existing provider
    if (tokenProvider && tokenProviderConfig === appConfig) {
      return tokenProvider;
    }

    // Create new GitHub App token provider
    const auth = new GitHubAppAuth(appConfig);
    tokenProvider = new GitHubAppTokenProvider(auth);
    tokenProviderConfig = appConfig;
    return tokenProvider;
  }

  // Fall back to PAT
  if (patToken) {
    // Check if we can reuse existing provider
    if (tokenProvider && tokenProviderConfig === patToken) {
      return tokenProvider;
    }

    tokenProvider = new StaticTokenProvider(patToken);
    tokenProviderConfig = patToken;
    return tokenProvider;
  }

  throw new Error(
    'GitHub authentication not configured. Either:\n' +
    '  1. Set GITHUB_TOKEN environment variable, or\n' +
    '  2. Configure GitHub App in .fractary/settings.json:\n' +
    '     {\n' +
    '       "github": {\n' +
    '         "app": {\n' +
    '           "id": "<app-id>",\n' +
    '           "installation_id": "<installation-id>",\n' +
    '           "private_key_path": "~/.github/your-app.pem"\n' +
    '         }\n' +
    '       }\n' +
    '     }'
  );
}

/**
 * Get the current token from the provider
 * Used internally and for SDK configuration
 *
 * @param faberConfig - FABER CLI configuration
 * @returns Promise resolving to the current token
 */
export async function getToken(faberConfig: FaberConfig): Promise<string> {
  const provider = getTokenProvider(faberConfig);
  return provider.getToken();
}

/**
 * Get the token provider for dynamic token refresh
 * Useful for long-running operations that need fresh tokens
 *
 * @param faberConfig - FABER CLI configuration
 * @returns TokenProvider instance
 */
export function getTokenProviderInstance(faberConfig: FaberConfig): TokenProvider {
  return getTokenProvider(faberConfig);
}

/**
 * Validate GitHub authentication configuration
 *
 * @param faberConfig - FABER CLI configuration
 * @throws Error if configuration is invalid
 */
export async function validateGitHubAuth(faberConfig: FaberConfig): Promise<void> {
  const appConfig = faberConfig.github?.app;

  if (appConfig?.id && appConfig?.installation_id) {
    // Validate GitHub App configuration
    const auth = new GitHubAppAuth(appConfig);
    await auth.validate();
    return;
  }

  // Validate PAT
  if (!faberConfig.github?.token) {
    throw new Error(
      'GitHub token not found. Set GITHUB_TOKEN environment variable or configure in .fractary/settings.json'
    );
  }
}

/**
 * Check if GitHub App authentication is configured
 *
 * @param faberConfig - FABER CLI configuration
 * @returns true if GitHub App is configured
 */
export function isGitHubAppConfigured(faberConfig: FaberConfig): boolean {
  const appConfig = faberConfig.github?.app;
  return !!(appConfig?.id && appConfig?.installation_id);
}

/**
 * Create WorkConfig for WorkManager from FaberConfig
 *
 * @param faberConfig - FABER CLI configuration
 * @returns WorkConfig for @fractary/core WorkManager
 * @throws Error if required fields are missing
 */
export function createWorkConfig(faberConfig: FaberConfig): WorkConfig {
  const owner = faberConfig.github?.organization;
  const repo = faberConfig.github?.project;

  if (!owner || !repo) {
    throw new Error(
      'GitHub organization and project must be configured in .fractary/settings.json'
    );
  }

  // Get token provider (validates auth config)
  const provider = getTokenProvider(faberConfig);

  // For SDK config, we need a synchronous token
  // The SDK will use this initially; for long-running operations,
  // use createWorkConfigAsync or the token provider directly
  let token: string;

  if (provider instanceof StaticTokenProvider) {
    // For PAT, we can get token synchronously via internal access
    token = faberConfig.github?.token || '';
  } else {
    // For GitHub App, throw helpful error - use async version
    throw new Error(
      'GitHub App authentication requires async initialization. ' +
      'Use createWorkConfigAsync() instead of createWorkConfig().'
    );
  }

  return {
    platform: 'github' as const,
    owner,
    repo,
    token,
  };
}

/**
 * Create WorkConfig for WorkManager from FaberConfig (async version)
 *
 * This version supports both PAT and GitHub App authentication.
 *
 * @param faberConfig - FABER CLI configuration
 * @returns Promise resolving to WorkConfig for @fractary/core WorkManager
 * @throws Error if required fields are missing
 */
export async function createWorkConfigAsync(faberConfig: FaberConfig): Promise<WorkConfig> {
  const owner = faberConfig.github?.organization;
  const repo = faberConfig.github?.project;

  if (!owner || !repo) {
    throw new Error(
      'GitHub organization and project must be configured in .fractary/settings.json'
    );
  }

  const token = await getToken(faberConfig);

  return {
    platform: 'github' as const,
    owner,
    repo,
    token,
  };
}

/**
 * Create RepoConfig for RepoManager from FaberConfig
 *
 * @param faberConfig - FABER CLI configuration
 * @returns RepoConfig for @fractary/core RepoManager
 * @throws Error if required fields are missing
 */
export function createRepoConfig(faberConfig: FaberConfig): RepoConfig {
  const owner = faberConfig.github?.organization;
  const repo = faberConfig.github?.project;

  // Get token provider (validates auth config)
  const provider = getTokenProvider(faberConfig);

  // For SDK config, we need a synchronous token
  let token: string;

  if (provider instanceof StaticTokenProvider) {
    token = faberConfig.github?.token || '';
  } else {
    throw new Error(
      'GitHub App authentication requires async initialization. ' +
      'Use createRepoConfigAsync() instead of createRepoConfig().'
    );
  }

  return {
    platform: 'github' as const,
    owner,
    repo,
    token,
  };
}

/**
 * Create RepoConfig for RepoManager from FaberConfig (async version)
 *
 * This version supports both PAT and GitHub App authentication.
 *
 * @param faberConfig - FABER CLI configuration
 * @returns Promise resolving to RepoConfig for @fractary/core RepoManager
 * @throws Error if required fields are missing
 */
export async function createRepoConfigAsync(faberConfig: FaberConfig): Promise<RepoConfig> {
  const owner = faberConfig.github?.organization;
  const repo = faberConfig.github?.project;

  const token = await getToken(faberConfig);

  return {
    platform: 'github' as const,
    owner,
    repo,
    token,
  };
}
