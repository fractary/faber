/**
 * Helper utilities for GitHub App Manifest flow
 */

import { Git } from '@fractary/faber';

/**
 * Parse code parameter from GitHub redirect URL or direct code input
 *
 * @param input - Either a full GitHub URL or just the code
 * @returns The extracted code, or null if invalid
 */
export function parseCodeFromUrl(input: string): string | null {
  const trimmed = input.trim();

  // Try to parse as URL first
  try {
    const url = new URL(trimmed);
    const code = url.searchParams.get('code');
    if (code) {
      return code;
    }
  } catch {
    // Not a valid URL, check if it's just the code itself
  }

  // Check if input looks like a code (alphanumeric, underscores, hyphens)
  if (/^[a-zA-Z0-9_-]+$/.test(trimmed)) {
    return trimmed;
  }

  return null;
}

/**
 * Validate manifest code format
 *
 * GitHub manifest codes are typically long alphanumeric strings
 * with underscores and hyphens, at least 20 characters long.
 *
 * @param code - The code to validate
 * @returns true if code appears valid
 */
export function validateManifestCode(code: string): boolean {
  return /^[a-zA-Z0-9_-]{20,}$/.test(code);
}

/**
 * Detect GitHub context from git remote
 *
 * Parses the git remote URL to extract organization and repository names.
 * Supports both HTTPS and SSH URL formats.
 *
 * @returns Object with org and repo, or null if not detectable
 */
export function detectGitHubContext(): { org: string; repo: string } | null {
  try {
    const git = new Git();
    const remoteUrl = git.exec('remote get-url origin').trim();

    // Parse various GitHub URL formats
    // HTTPS: https://github.com/org/repo.git
    // SSH: git@github.com:org/repo.git
    const match = remoteUrl.match(/github\.com[/:]([^/]+)\/([^/]+?)(\.git)?$/);

    if (match) {
      const org = match[1];
      const repo = match[2].replace(/\.git$/, '');
      return { org, repo };
    }

    return null;
  } catch {
    // Not a git repository or no origin remote
    return null;
  }
}

/**
 * Validate if current directory is a git repository
 *
 * @returns true if current directory is a git repository
 */
export function isGitRepository(): boolean {
  try {
    const git = new Git();
    git.exec('rev-parse --git-dir');
    return true;
  } catch {
    return false;
  }
}
