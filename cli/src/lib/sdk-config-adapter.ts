/**
 * SDK Configuration Adapter
 *
 * Converts FABER CLI configuration to @fractary/core SDK configuration format
 */

import type { FaberConfig } from '../types/config.js';
import type { WorkConfig, RepoConfig } from '@fractary/core';

/**
 * Create WorkConfig for WorkManager from FaberConfig
 *
 * @param faberConfig - FABER CLI configuration
 * @returns WorkConfig for @fractary/core WorkManager
 * @throws Error if required fields are missing
 */
export function createWorkConfig(faberConfig: FaberConfig): WorkConfig {
  const token = faberConfig.github?.token;
  const owner = faberConfig.github?.organization;
  const repo = faberConfig.github?.project;

  if (!token) {
    throw new Error(
      'GitHub token not found. Set GITHUB_TOKEN environment variable or configure in .fractary/settings.json'
    );
  }

  if (!owner || !repo) {
    throw new Error(
      'GitHub organization and project must be configured in .fractary/settings.json'
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
 * Create RepoConfig for RepoManager from FaberConfig
 *
 * @param faberConfig - FABER CLI configuration
 * @returns RepoConfig for @fractary/core RepoManager
 * @throws Error if required fields are missing
 */
export function createRepoConfig(faberConfig: FaberConfig): RepoConfig {
  const token = faberConfig.github?.token;
  const owner = faberConfig.github?.organization;
  const repo = faberConfig.github?.project;

  if (!token) {
    throw new Error(
      'GitHub token not found. Set GITHUB_TOKEN environment variable or configure in .fractary/settings.json'
    );
  }

  return {
    platform: 'github' as const,
    owner,
    repo,
    token,
  };
}
