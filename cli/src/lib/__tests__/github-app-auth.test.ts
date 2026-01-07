/**
 * GitHub App Authentication Module Tests
 */

import { jest, describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { PrivateKeyLoader, GitHubAppAuth } from '../github-app-auth.js';
import type { GitHubAppConfig } from '../../types/config.js';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';

// Mock fetch for API calls
const mockFetch = jest.fn() as jest.MockedFunction<typeof fetch>;
global.fetch = mockFetch;

// Sample test private key (RSA)
const TEST_PRIVATE_KEY = `-----BEGIN RSA PRIVATE KEY-----
MIIEowIBAAKCAQEA0Z3VS5JJcds3xfn/ygWyF8PbnGy0AHB7MhkLPKJ+BpsD5K6H
IJR8dO8H8h2gGSqY5F/S6+kfPqLYB3Yb7T3L3Z/OklqJqX8nG2Rd8HzYSPO5FFMU
6m1kd/kOxMKp4E3bOtzi0G+1OByQ3qMcxYkCKNpQ8Ee0sPQOo3b+3F1tq5FNjF2S
1VPkNaYL3T/bOx4ydCnN7fvnIZu0P8z0YQ7YJYL3/qXY1EHVn+g0R5jVk0WfYGHU
2sGKYz8PFW3JZPNzN/u1vPjBJN1X3vGARL8RBTKnLxPPkLwhROqKFAlTN3UU+QZP
gKWCkKPi4LqH8LrSqMTr2Ip1M8W6qj0RcvNXqwIDAQABAoIBAFy2oXdM8tQk0Jgj
GKQbLfOWHJDW3OK3F0f8z/a0jqW3P8bKjvb6qfqH7E2GZwJYNP2lVd3cGqHLRVgO
fjViPPp5fV3V7E8PSHIeWLZA+0Rj8TQ/R8T8YhOY5X5fQSHCFJbKqM8QGCZqlB+w
V5FBklUB7J3HhwBKx9C7C3ljMFB6KgDKvJAn5F1+PqSV8xVz5eKJPJkFMM3nLVy3
RvOxqY8dgFRy5IPJNH3wNUvZjHRD4cD0JVd3pRGdKVOPt3X5r1D0kYOudGfE5QVV
9j2Q6H3rxJv3mC8cEJ3HJwm3vKBY3T8MXB7VEPkMJZFYgqBuAwBPo1wKGXvN0zHO
KxlI7hECgYEA7K5l1p+TyhdgjAE9wLTR0xBqLP6yd0RdGJLVwI4yF+hUB1J8PBWF
QGF6kEBOWTRLkDLPK3fMvnJvkJCZ7C1ZbMpR1gQG2ksJqJQIBgVH3bGnm6wI3RqM
B5L6S1ej0V8mLnPJ0XY3MQqQPQBj6p/Q1T2vdB8W9hJKKVWVhqmPPisCgYEA4uMm
lBPYs1R0pLfwIa5kd0M1xB7TqBG1YJy8F3cQB8sNbH9M3P3mKt6n0vVF6FE5SXCD
SFxCdHwBL1vM0DKLlB7VPBXB8gDwFIQpofJ1F7F9K7sjD1C3XHJKHYu7V7ggb0vE
gYFGxPCcRvqI4kB3e0KTDJL3xMvJPCDIfMmB/gECgYBJxbXUZR3WQOMD1gZJKFiU
fL7xKLpC0wvQTJqsdg7FVWQ3j7Y3b4L2V9R7LwC8X9u3Y0VJhKvf3j1j1mQVU6b8
0IW8RJPi7iCj0HPzPKEVY5Xm1ZvRh0JL7o3mV2e5k8ILI0l3x8Oj0oQHx0CqV2Ub
vQKO3v2hF7qU2EgYc7l3CwKBgFP5Nm5xPBxHzJn0pJmBBFD8k3T9lZ0ZVvWrP5BJ
wGF6kJCE3gJHJKbN+EvP7qPp3mLZGfDR6jf8z0LWALsU1r4HvBBVF9o0o5k1uf+w
9J0yJhHM0w6L7Y5Z1WGVhF8IwGCPK0fOxq1j0L5WJFH8H5XgBCm4FAhJBvzP5vJN
UvABAoGBAL3Q3Y3J0z9uP8Y7L3Kj3r2LgMBARHYbUCyLRrKF1bO+p0kGKPbBVhSD
V8xDvXvCvPdaJtOZ3T3rp3bpWJgOH3dJR5NU7CfJbVc0y6vN7xFVkQ3P1xQxZjFE
B0ljN8Q7L8tcVQfWJ5LFW4y8bPB2bGDJzF3J8CPLJ0JV1D9xGxB5
-----END RSA PRIVATE KEY-----`;

// Base64 encoded version
const TEST_PRIVATE_KEY_BASE64 = Buffer.from(TEST_PRIVATE_KEY).toString('base64');

describe('PrivateKeyLoader', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe('validate', () => {
    it('validates RSA private key format', () => {
      expect(PrivateKeyLoader.validate(TEST_PRIVATE_KEY)).toBe(true);
    });

    it('validates PKCS#8 private key format', () => {
      const pkcs8Key = `-----BEGIN PRIVATE KEY-----
MIIEvgIBADANBgkqhkiG9w0BAQEFAASCBKgwggSkAgEAAoIBAQC...
-----END PRIVATE KEY-----`;
      expect(PrivateKeyLoader.validate(pkcs8Key)).toBe(true);
    });

    it('rejects invalid key format', () => {
      expect(PrivateKeyLoader.validate('not a valid key')).toBe(false);
      expect(PrivateKeyLoader.validate('')).toBe(false);
      expect(PrivateKeyLoader.validate('-----BEGIN PUBLIC KEY-----')).toBe(false);
    });
  });

  describe('load', () => {
    it('loads key from environment variable', async () => {
      process.env.TEST_GITHUB_APP_KEY = TEST_PRIVATE_KEY_BASE64;

      const config: GitHubAppConfig = {
        id: '123456',
        installation_id: '789',
        private_key_env_var: 'TEST_GITHUB_APP_KEY',
      };

      const key = await PrivateKeyLoader.load(config);
      expect(key).toBe(TEST_PRIVATE_KEY);
    });

    it('prefers environment variable over file path', async () => {
      process.env.TEST_GITHUB_APP_KEY = TEST_PRIVATE_KEY_BASE64;

      const config: GitHubAppConfig = {
        id: '123456',
        installation_id: '789',
        private_key_path: '/nonexistent/path.pem',
        private_key_env_var: 'TEST_GITHUB_APP_KEY',
      };

      const key = await PrivateKeyLoader.load(config);
      expect(key).toBe(TEST_PRIVATE_KEY);
    });

    it('throws error when no key source is configured', async () => {
      const config: GitHubAppConfig = {
        id: '123456',
        installation_id: '789',
      };

      await expect(PrivateKeyLoader.load(config)).rejects.toThrow(
        /GitHub App private key not found/
      );
    });

    it('throws error when env var is empty', async () => {
      process.env.EMPTY_KEY = '';

      const config: GitHubAppConfig = {
        id: '123456',
        installation_id: '789',
        private_key_env_var: 'EMPTY_KEY',
      };

      await expect(PrivateKeyLoader.load(config)).rejects.toThrow(
        /GitHub App private key not found/
      );
    });
  });
});

describe('GitHubAppAuth', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...originalEnv };
    mockFetch.mockReset();
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe('validate', () => {
    it('throws error when App ID is missing', async () => {
      const config: GitHubAppConfig = {
        id: '',
        installation_id: '789',
        private_key_env_var: 'TEST_KEY',
      };

      const auth = new GitHubAppAuth(config);
      await expect(auth.validate()).rejects.toThrow(/App ID is required/);
    });

    it('throws error when Installation ID is missing', async () => {
      const config: GitHubAppConfig = {
        id: '123456',
        installation_id: '',
        private_key_env_var: 'TEST_KEY',
      };

      const auth = new GitHubAppAuth(config);
      await expect(auth.validate()).rejects.toThrow(/Installation ID is required/);
    });
  });

  describe('getToken', () => {
    it('exchanges JWT for installation token', async () => {
      process.env.TEST_GITHUB_APP_KEY = TEST_PRIVATE_KEY_BASE64;

      const config: GitHubAppConfig = {
        id: '123456',
        installation_id: '789',
        private_key_env_var: 'TEST_GITHUB_APP_KEY',
      };

      const mockTokenResponse = {
        token: 'ghs_test_installation_token',
        expires_at: new Date(Date.now() + 3600000).toISOString(),
        permissions: { contents: 'write' },
        repository_selection: 'selected',
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockTokenResponse,
      } as Response);

      const auth = new GitHubAppAuth(config);
      const token = await auth.getToken();

      expect(token).toBe('ghs_test_installation_token');
      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.github.com/app/installations/789/access_tokens',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            Accept: 'application/vnd.github+json',
          }),
        })
      );
    });

    it('caches token and returns cached value', async () => {
      process.env.TEST_GITHUB_APP_KEY = TEST_PRIVATE_KEY_BASE64;

      const config: GitHubAppConfig = {
        id: '123456',
        installation_id: '789',
        private_key_env_var: 'TEST_GITHUB_APP_KEY',
      };

      const mockTokenResponse = {
        token: 'ghs_cached_token',
        expires_at: new Date(Date.now() + 3600000).toISOString(),
        permissions: {},
        repository_selection: 'all',
      };

      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => mockTokenResponse,
      } as Response);

      const auth = new GitHubAppAuth(config);

      // First call
      const token1 = await auth.getToken();
      // Second call (should use cache)
      const token2 = await auth.getToken();

      expect(token1).toBe('ghs_cached_token');
      expect(token2).toBe('ghs_cached_token');
      // Should only call API once due to caching
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it('handles 401 authentication error', async () => {
      process.env.TEST_GITHUB_APP_KEY = TEST_PRIVATE_KEY_BASE64;

      const config: GitHubAppConfig = {
        id: '123456',
        installation_id: '789',
        private_key_env_var: 'TEST_GITHUB_APP_KEY',
      };

      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        text: async () => 'Unauthorized',
      } as Response);

      const auth = new GitHubAppAuth(config);

      await expect(auth.getToken()).rejects.toThrow(
        /Failed to authenticate with GitHub App/
      );
    });

    it('handles 404 installation not found error', async () => {
      process.env.TEST_GITHUB_APP_KEY = TEST_PRIVATE_KEY_BASE64;

      const config: GitHubAppConfig = {
        id: '123456',
        installation_id: '789',
        private_key_env_var: 'TEST_GITHUB_APP_KEY',
      };

      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
        text: async () => 'Not Found',
      } as Response);

      const auth = new GitHubAppAuth(config);

      await expect(auth.getToken()).rejects.toThrow(
        /installation not found/
      );
    });

    it('handles rate limiting error', async () => {
      process.env.TEST_GITHUB_APP_KEY = TEST_PRIVATE_KEY_BASE64;

      const config: GitHubAppConfig = {
        id: '123456',
        installation_id: '789',
        private_key_env_var: 'TEST_GITHUB_APP_KEY',
      };

      const resetTime = Math.floor(Date.now() / 1000) + 60;

      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 403,
        headers: {
          get: (name: string) => {
            if (name === 'x-ratelimit-remaining') return '0';
            if (name === 'x-ratelimit-reset') return String(resetTime);
            return null;
          },
        } as Headers,
        text: async () => 'Rate limited',
      } as Response);

      const auth = new GitHubAppAuth(config);

      await expect(auth.getToken()).rejects.toThrow(/rate limited/i);
    });
  });

  describe('isTokenExpiringSoon', () => {
    it('returns true when no token is cached', () => {
      const config: GitHubAppConfig = {
        id: '123456',
        installation_id: '789',
      };

      const auth = new GitHubAppAuth(config);
      expect(auth.isTokenExpiringSoon()).toBe(true);
    });
  });

  describe('refreshToken', () => {
    it('forces token refresh even when cached', async () => {
      process.env.TEST_GITHUB_APP_KEY = TEST_PRIVATE_KEY_BASE64;

      const config: GitHubAppConfig = {
        id: '123456',
        installation_id: '789',
        private_key_env_var: 'TEST_GITHUB_APP_KEY',
      };

      let callCount = 0;
      mockFetch.mockImplementation(async () => {
        callCount++;
        return {
          ok: true,
          json: async () => ({
            token: `ghs_token_${callCount}`,
            expires_at: new Date(Date.now() + 3600000).toISOString(),
            permissions: {},
            repository_selection: 'all',
          }),
        } as Response;
      });

      const auth = new GitHubAppAuth(config);

      // First call
      const token1 = await auth.getToken();
      expect(token1).toBe('ghs_token_1');

      // Force refresh
      const token2 = await auth.refreshToken();
      expect(token2).toBe('ghs_token_2');

      expect(mockFetch).toHaveBeenCalledTimes(2);
    });
  });
});
