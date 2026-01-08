/**
 * GitHub App Setup Module Tests
 */

import { jest, describe, it, expect, beforeEach } from '@jest/globals';
import {
  generateAppManifest,
  getManifestCreationUrl,
  exchangeCodeForCredentials,
  validateAppCredentials,
  getInstallationId,
  savePrivateKey,
  formatPermissionsDisplay,
  type ManifestConfig,
  type ManifestConversionResponse,
} from '../github-app-setup.js';
import * as fs from 'fs/promises';
import * as os from 'os';
import * as path from 'path';

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

describe('generateAppManifest', () => {
  it('generates manifest with correct default name', () => {
    const config: ManifestConfig = {
      organization: 'test-org',
      repository: 'test-repo',
    };

    const manifest = generateAppManifest(config);

    expect(manifest.name).toBe('FABER CLI - test-org');
    expect(manifest.url).toBe('https://github.com/fractary/faber');
    expect(manifest.public).toBe(false);
  });

  it('generates manifest with custom app name', () => {
    const config: ManifestConfig = {
      organization: 'test-org',
      repository: 'test-repo',
      appName: 'Custom FABER App',
    };

    const manifest = generateAppManifest(config);

    expect(manifest.name).toBe('Custom FABER App');
  });

  it('generates manifest with correct permissions', () => {
    const config: ManifestConfig = {
      organization: 'test-org',
      repository: 'test-repo',
    };

    const manifest = generateAppManifest(config);

    expect(manifest.default_permissions).toEqual({
      contents: 'write',
      issues: 'write',
      pull_requests: 'write',
      metadata: 'read',
    });
  });

  it('generates manifest with empty events array', () => {
    const config: ManifestConfig = {
      organization: 'test-org',
      repository: 'test-repo',
    };

    const manifest = generateAppManifest(config);

    expect(manifest.default_events).toEqual([]);
  });

  it('includes required webhook URL', () => {
    const config: ManifestConfig = {
      organization: 'test-org',
      repository: 'test-repo',
    };

    const manifest = generateAppManifest(config);

    expect(manifest.hook_attributes).toBeDefined();
    expect(manifest.hook_attributes.url).toBeDefined();
  });
});

describe('getManifestCreationUrl', () => {
  it('returns GitHub app creation URL', () => {
    const manifest = generateAppManifest({
      organization: 'test-org',
      repository: 'test-repo',
    });

    const url = getManifestCreationUrl(manifest);

    expect(url).toBe('https://github.com/settings/apps/new');
  });
});

describe('exchangeCodeForCredentials', () => {
  beforeEach(() => {
    mockFetch.mockReset();
  });

  it('successfully exchanges valid code for credentials', async () => {
    const mockResponse: ManifestConversionResponse = {
      id: 123456,
      slug: 'faber-cli-test',
      node_id: 'test_node_id',
      owner: {
        login: 'test-org',
        id: 789,
      },
      name: 'FABER CLI - test-org',
      description: 'Test app',
      external_url: 'https://github.com/fractary/faber',
      html_url: 'https://github.com/apps/faber-cli-test',
      created_at: '2026-01-07T00:00:00Z',
      updated_at: '2026-01-07T00:00:00Z',
      permissions: {
        contents: 'write',
        issues: 'write',
        metadata: 'read',
        pull_requests: 'write',
      },
      events: [],
      installations_count: 1,
      client_id: 'test_client_id',
      client_secret: 'test_client_secret',
      webhook_secret: null,
      pem: TEST_PRIVATE_KEY,
    };

    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => mockResponse,
    } as Response);

    const result = await exchangeCodeForCredentials('valid_code_12345');

    expect(mockFetch).toHaveBeenCalledWith(
      'https://api.github.com/app-manifests/valid_code_12345/conversions',
      {
        method: 'POST',
        headers: {
          Accept: 'application/vnd.github+json',
          'X-GitHub-Api-Version': '2022-11-28',
        },
      }
    );

    expect(result).toEqual(mockResponse);
  });

  it('throws error for 404 response (invalid code)', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 404,
      text: async () => 'Not found',
    } as Response);

    await expect(exchangeCodeForCredentials('invalid_code')).rejects.toThrow(
      'Invalid or expired code'
    );
  });

  it('throws error for 422 response (validation error)', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 422,
      text: async () => 'Unprocessable entity',
    } as Response);

    await expect(exchangeCodeForCredentials('malformed_code')).rejects.toThrow(
      'Invalid code format'
    );
  });

  it('handles network errors', async () => {
    mockFetch.mockRejectedValueOnce(new Error('Network error'));

    await expect(exchangeCodeForCredentials('test_code')).rejects.toThrow(
      'Failed to connect to GitHub API'
    );
  });
});

describe('validateAppCredentials', () => {
  it('validates correct response', () => {
    const response: ManifestConversionResponse = {
      id: 123456,
      slug: 'test-app',
      node_id: 'test_node',
      owner: { login: 'test', id: 1 },
      name: 'Test App',
      description: 'Test',
      external_url: 'https://test.com',
      html_url: 'https://github.com/apps/test',
      created_at: '2026-01-07T00:00:00Z',
      updated_at: '2026-01-07T00:00:00Z',
      permissions: {},
      events: [],
      installations_count: 1,
      client_id: 'test',
      client_secret: 'test',
      webhook_secret: null,
      pem: TEST_PRIVATE_KEY,
    };

    expect(() => validateAppCredentials(response)).not.toThrow();
  });

  it('throws error when app ID is missing', () => {
    const response = {
      pem: TEST_PRIVATE_KEY,
    } as any;

    expect(() => validateAppCredentials(response)).toThrow('missing app ID');
  });

  it('throws error when PEM is missing', () => {
    const response = {
      id: 123456,
    } as any;

    expect(() => validateAppCredentials(response)).toThrow(
      'missing private key'
    );
  });

  it('throws error for invalid PEM format', () => {
    const response = {
      id: 123456,
      pem: 'not a valid PEM key',
    } as any;

    expect(() => validateAppCredentials(response)).toThrow(
      'not in PEM format'
    );
  });

  it('accepts PKCS#8 format', () => {
    const pkcs8Key = `-----BEGIN PRIVATE KEY-----
MIIEvgIBADANBgkqhkiG9w0BAQEFAASCBKgwggSkAgEAAoIBAQC...
-----END PRIVATE KEY-----`;

    const response = {
      id: 123456,
      pem: pkcs8Key,
    } as any;

    expect(() => validateAppCredentials(response)).not.toThrow();
  });
});

describe('getInstallationId', () => {
  beforeEach(() => {
    mockFetch.mockReset();
  });

  it('successfully fetches installation ID', async () => {
    const mockInstallation = {
      id: 12345678,
      account: {
        login: 'test-org',
        id: 789,
      },
      app_id: 123456,
      app_slug: 'test-app',
      target_id: 789,
      target_type: 'Organization',
      permissions: {},
      events: [],
      created_at: '2026-01-07T00:00:00Z',
      updated_at: '2026-01-07T00:00:00Z',
    };

    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => mockInstallation,
    } as Response);

    const installationId = await getInstallationId(
      '123456',
      TEST_PRIVATE_KEY,
      'test-org'
    );

    expect(installationId).toBe('12345678');
    expect(mockFetch).toHaveBeenCalledWith(
      'https://api.github.com/orgs/test-org/installation',
      expect.objectContaining({
        method: 'GET',
        headers: expect.objectContaining({
          Accept: 'application/vnd.github+json',
          Authorization: expect.stringMatching(/^Bearer /),
          'X-GitHub-Api-Version': '2022-11-28',
        }),
      })
    );
  });

  it('throws error when installation not found', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 404,
      text: async () => 'Not found',
    } as Response);

    await expect(
      getInstallationId('123456', TEST_PRIVATE_KEY, 'test-org')
    ).rejects.toThrow('GitHub App not installed on organization "test-org"');
  });

  it('throws error for authentication failure', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 401,
      text: async () => 'Unauthorized',
    } as Response);

    await expect(
      getInstallationId('123456', TEST_PRIVATE_KEY, 'test-org')
    ).rejects.toThrow('Failed to authenticate with GitHub App');
  });
});

describe('savePrivateKey', () => {
  const testDir = path.join(os.tmpdir(), 'faber-test-keys');

  beforeEach(async () => {
    // Clean up test directory
    try {
      await fs.rm(testDir, { recursive: true, force: true });
    } catch {
      // Ignore errors
    }
  });

  afterEach(async () => {
    // Clean up after tests
    try {
      await fs.rm(testDir, { recursive: true, force: true });
    } catch {
      // Ignore errors
    }
  });

  it('saves private key to correct location', async () => {
    // Mock os.homedir to use test directory
    const homedirSpy = jest.spyOn(os, 'homedir').mockReturnValue(testDir);

    try {
      const keyPath = await savePrivateKey(TEST_PRIVATE_KEY, 'test-org');

      expect(keyPath).toBe(path.join(testDir, '.github', 'faber-test-org.pem'));

      // Verify file exists and has correct content
      const savedKey = await fs.readFile(keyPath, 'utf-8');
      expect(savedKey).toBe(TEST_PRIVATE_KEY);
    } finally {
      homedirSpy.mockRestore();
    }
  });

  it('creates .github directory if it does not exist', async () => {
    const originalHomedir = os.homedir;
    (os as any).homedir = () => testDir;

    try {
      await savePrivateKey(TEST_PRIVATE_KEY, 'test-org');

      const githubDir = path.join(testDir, '.github');
      const stats = await fs.stat(githubDir);
      expect(stats.isDirectory()).toBe(true);
    } finally {
      (os as any).homedir = originalHomedir;
    }
  });

  it('overwrites existing key file', async () => {
    const originalHomedir = os.homedir;
    (os as any).homedir = () => testDir;

    try {
      // Save first key
      await savePrivateKey('old key content', 'test-org');

      // Save new key
      const keyPath = await savePrivateKey(TEST_PRIVATE_KEY, 'test-org');

      // Verify new content
      const savedKey = await fs.readFile(keyPath, 'utf-8');
      expect(savedKey).toBe(TEST_PRIVATE_KEY);
    } finally {
      (os as any).homedir = originalHomedir;
    }
  });
});

describe('formatPermissionsDisplay', () => {
  it('formats permissions correctly', () => {
    const manifest = generateAppManifest({
      organization: 'test-org',
      repository: 'test-repo',
    });

    const formatted = formatPermissionsDisplay(manifest);

    expect(formatted).toContain('Contents: Write');
    expect(formatted).toContain('Issues: Write');
    expect(formatted).toContain('Pull Requests: Write');
    expect(formatted).toContain('Metadata: Read');
  });

  it('includes bullet points', () => {
    const manifest = generateAppManifest({
      organization: 'test-org',
      repository: 'test-repo',
    });

    const formatted = formatPermissionsDisplay(manifest);

    expect(formatted).toMatch(/•/);
  });

  it('formats each permission on separate line', () => {
    const manifest = generateAppManifest({
      organization: 'test-org',
      repository: 'test-repo',
    });

    const formatted = formatPermissionsDisplay(manifest);
    const lines = formatted.split('\n');

    expect(lines.length).toBe(4); // 4 permissions
  });
});
