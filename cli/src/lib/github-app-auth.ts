/**
 * GitHub App Authentication Module
 *
 * Provides JWT generation, installation token exchange, and token caching
 * for GitHub App authentication in FABER CLI.
 */

import jwt from 'jsonwebtoken';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';
import type { GitHubAppConfig } from '../types/config.js';

/**
 * Cached token with expiration tracking
 */
interface CachedToken {
  token: string;
  expires_at: Date;
  installation_id: string;
}

/**
 * Installation token response from GitHub API
 */
interface InstallationTokenResponse {
  token: string;
  expires_at: string;
  permissions: Record<string, string>;
  repository_selection: string;
}

/**
 * Private Key Loader
 *
 * Loads private keys from file path or environment variable
 */
export class PrivateKeyLoader {
  /**
   * Load private key from configured sources.
   * Priority: env var > file path
   *
   * @param config - GitHub App configuration
   * @returns The private key content
   * @throws Error if private key cannot be loaded
   */
  static async load(config: GitHubAppConfig): Promise<string> {
    // Try environment variable first (priority)
    if (config.private_key_env_var) {
      const envValue = process.env[config.private_key_env_var];
      if (envValue) {
        try {
          // Decode base64-encoded key
          const decoded = Buffer.from(envValue, 'base64').toString('utf-8');
          if (PrivateKeyLoader.validate(decoded)) {
            return decoded;
          }
        } catch {
          // Invalid base64, fall through to file path
        }
      }
    }

    // Try file path
    if (config.private_key_path) {
      try {
        // Expand ~ to home directory
        const expandedPath = config.private_key_path.startsWith('~')
          ? config.private_key_path.replace('~', os.homedir())
          : config.private_key_path;

        const resolvedPath = path.resolve(expandedPath);
        const key = await fs.readFile(resolvedPath, 'utf-8');

        if (PrivateKeyLoader.validate(key)) {
          return key;
        }
        throw new Error('Invalid private key format. Expected PEM-encoded RSA private key');
      } catch (error) {
        if (error instanceof Error && error.message.includes('ENOENT')) {
          throw new Error(
            `GitHub App private key not found at '${config.private_key_path}'. ` +
            `Check 'private_key_path' in config or set ${config.private_key_env_var || 'GITHUB_APP_PRIVATE_KEY'} env var`
          );
        }
        throw error;
      }
    }

    throw new Error(
      'GitHub App private key not found. ' +
      "Configure 'private_key_path' in .fractary/settings.json or set GITHUB_APP_PRIVATE_KEY env var"
    );
  }

  /**
   * Validate private key format.
   *
   * @param key - The private key content
   * @returns true if valid PEM format
   */
  static validate(key: string): boolean {
    // Check for PEM format (RSA or PKCS#8)
    const trimmed = key.trim();
    return (
      (trimmed.startsWith('-----BEGIN RSA PRIVATE KEY-----') &&
        trimmed.endsWith('-----END RSA PRIVATE KEY-----')) ||
      (trimmed.startsWith('-----BEGIN PRIVATE KEY-----') &&
        trimmed.endsWith('-----END PRIVATE KEY-----'))
    );
  }
}

/**
 * GitHub App Authentication
 *
 * Handles JWT generation, installation token exchange, and caching
 */
export class GitHubAppAuth {
  private cache: Map<string, CachedToken> = new Map();
  private config: GitHubAppConfig;
  private refreshPromise: Promise<string> | null = null;

  // Token refresh threshold (5 minutes before expiration)
  private static readonly REFRESH_THRESHOLD_MS = 5 * 60 * 1000;
  // JWT validity period (10 minutes max for GitHub)
  private static readonly JWT_EXPIRY_SECONDS = 600;
  // GitHub API base URL
  private static readonly GITHUB_API_URL = 'https://api.github.com';

  constructor(config: GitHubAppConfig) {
    this.config = config;
  }

  /**
   * Get a valid installation token.
   * Returns cached token if still valid, otherwise generates new one.
   *
   * @returns Installation access token
   */
  async getToken(): Promise<string> {
    const cacheKey = this.config.installation_id;
    const cached = this.cache.get(cacheKey);

    if (cached && !this.isExpired(cached) && !this.isExpiringSoon(cached)) {
      return cached.token;
    }

    // If token is expiring soon but still valid, trigger background refresh
    if (cached && !this.isExpired(cached) && this.isExpiringSoon(cached)) {
      this.triggerBackgroundRefresh();
      return cached.token;
    }

    // Token expired or missing, must refresh synchronously
    return this.refreshToken();
  }

  /**
   * Force refresh the token.
   *
   * @returns New installation access token
   */
  async refreshToken(): Promise<string> {
    // Deduplicate concurrent refresh requests
    if (this.refreshPromise) {
      return this.refreshPromise;
    }

    this.refreshPromise = this.doRefresh();

    try {
      return await this.refreshPromise;
    } finally {
      this.refreshPromise = null;
    }
  }

  /**
   * Check if token needs refresh (within 5 minutes of expiration).
   *
   * @returns true if token should be refreshed
   */
  isTokenExpiringSoon(): boolean {
    const cached = this.cache.get(this.config.installation_id);
    return cached ? this.isExpiringSoon(cached) : true;
  }

  /**
   * Validate the configuration and private key.
   *
   * @throws Error if configuration is invalid
   */
  async validate(): Promise<void> {
    // Validate required fields
    if (!this.config.id) {
      throw new Error("GitHub App ID is required. Configure 'app.id' in .fractary/settings.json");
    }
    if (!this.config.installation_id) {
      throw new Error(
        "GitHub App Installation ID is required. Configure 'app.installation_id' in .fractary/settings.json"
      );
    }

    // Validate private key can be loaded
    await PrivateKeyLoader.load(this.config);

    // Attempt to generate JWT to validate key
    await this.generateJWT();
  }

  /**
   * Perform the actual token refresh
   */
  private async doRefresh(): Promise<string> {
    const jwtToken = await this.generateJWT();
    const installationToken = await this.exchangeForInstallationToken(jwtToken);

    // Cache the token
    this.cache.set(this.config.installation_id, {
      token: installationToken.token,
      expires_at: new Date(installationToken.expires_at),
      installation_id: this.config.installation_id,
    });

    return installationToken.token;
  }

  /**
   * Generate a JWT for GitHub App authentication
   */
  private async generateJWT(): Promise<string> {
    const privateKey = await PrivateKeyLoader.load(this.config);

    const now = Math.floor(Date.now() / 1000);
    const payload = {
      iat: now - 60, // Issued 60 seconds ago to allow for clock drift
      exp: now + GitHubAppAuth.JWT_EXPIRY_SECONDS,
      iss: this.config.id,
    };

    try {
      return jwt.sign(payload, privateKey, { algorithm: 'RS256' });
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`Failed to generate JWT: ${error.message}`);
      }
      throw error;
    }
  }

  /**
   * Exchange JWT for installation access token
   */
  private async exchangeForInstallationToken(jwtToken: string): Promise<InstallationTokenResponse> {
    const url = `${GitHubAppAuth.GITHUB_API_URL}/app/installations/${this.config.installation_id}/access_tokens`;

    let response: Response;
    try {
      response = await fetch(url, {
        method: 'POST',
        headers: {
          Accept: 'application/vnd.github+json',
          Authorization: `Bearer ${jwtToken}`,
          'X-GitHub-Api-Version': '2022-11-28',
        },
      });
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`Failed to connect to GitHub API: ${error.message}`);
      }
      throw error;
    }

    if (!response.ok) {
      const errorBody = await response.text().catch(() => 'Unknown error');

      if (response.status === 401) {
        throw new Error(
          'Failed to authenticate with GitHub App. Verify App ID and private key are correct.'
        );
      }

      if (response.status === 404) {
        throw new Error(
          `GitHub App installation not found (ID: ${this.config.installation_id}). ` +
          'Verify the Installation ID is correct and the app is installed.'
        );
      }

      if (response.status === 403) {
        // Check for rate limiting
        const rateLimitRemaining = response.headers.get('x-ratelimit-remaining');
        const rateLimitReset = response.headers.get('x-ratelimit-reset');

        if (rateLimitRemaining === '0' && rateLimitReset) {
          const resetTime = new Date(parseInt(rateLimitReset) * 1000);
          const secondsUntilReset = Math.ceil((resetTime.getTime() - Date.now()) / 1000);
          throw new Error(
            `GitHub API rate limited. Retry after ${secondsUntilReset} seconds.`
          );
        }
      }

      throw new Error(`Failed to get installation token: ${response.status} ${errorBody}`);
    }

    return response.json() as Promise<InstallationTokenResponse>;
  }

  /**
   * Check if token is expired
   */
  private isExpired(cached: CachedToken): boolean {
    return cached.expires_at.getTime() <= Date.now();
  }

  /**
   * Check if token is expiring soon
   */
  private isExpiringSoon(cached: CachedToken): boolean {
    return cached.expires_at.getTime() - Date.now() < GitHubAppAuth.REFRESH_THRESHOLD_MS;
  }

  /**
   * Trigger background token refresh (non-blocking)
   */
  private triggerBackgroundRefresh(): void {
    if (this.refreshPromise) {
      return; // Already refreshing
    }

    // Fire and forget - errors logged but not thrown
    this.refreshToken().catch(error => {
      console.error('[GitHubAppAuth] Background token refresh failed:', error.message);
    });
  }
}

/**
 * Token Provider Interface
 *
 * Abstract interface for getting tokens, supporting both PAT and GitHub App
 */
export interface TokenProvider {
  getToken(): Promise<string>;
}

/**
 * Static Token Provider
 *
 * Simple provider for static PAT tokens
 */
export class StaticTokenProvider implements TokenProvider {
  constructor(private token: string) {}

  async getToken(): Promise<string> {
    return this.token;
  }
}

/**
 * GitHub App Token Provider
 *
 * Provider that uses GitHubAppAuth for dynamic token generation
 */
export class GitHubAppTokenProvider implements TokenProvider {
  constructor(private auth: GitHubAppAuth) {}

  async getToken(): Promise<string> {
    return this.auth.getToken();
  }
}
