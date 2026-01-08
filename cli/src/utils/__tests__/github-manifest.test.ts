/**
 * GitHub Manifest Utilities Tests
 */

import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import {
  parseCodeFromUrl,
  validateManifestCode,
  detectGitHubContext,
  isGitRepository,
} from '../github-manifest.js';
import { Git } from '@fractary/faber';

// Mock the Git class
jest.mock('@fractary/faber', () => ({
  Git: jest.fn().mockImplementation(() => ({
    exec: jest.fn(),
  })),
}));

describe('parseCodeFromUrl', () => {
  it('extracts code from full GitHub URL', () => {
    const url =
      'https://github.com/settings/apps/test-app?code=abc123xyz789_test-code';
    const code = parseCodeFromUrl(url);

    expect(code).toBe('abc123xyz789_test-code');
  });

  it('extracts code from URL with multiple parameters', () => {
    const url =
      'https://github.com/settings/apps/test-app?state=test&code=abc123xyz789';
    const code = parseCodeFromUrl(url);

    expect(code).toBe('abc123xyz789');
  });

  it('handles code-only input', () => {
    const code = parseCodeFromUrl('abc123xyz789_test-code');

    expect(code).toBe('abc123xyz789_test-code');
  });

  it('handles code with underscores and hyphens', () => {
    const code = parseCodeFromUrl('abc-123_xyz-789');

    expect(code).toBe('abc-123_xyz-789');
  });

  it('returns null for invalid input', () => {
    expect(parseCodeFromUrl('not a valid code!')).toBeNull();
    expect(parseCodeFromUrl('code with spaces')).toBeNull();
    expect(parseCodeFromUrl('')).toBeNull();
  });

  it('returns null for URL without code parameter', () => {
    const url = 'https://github.com/settings/apps/test-app';
    const code = parseCodeFromUrl(url);

    expect(code).toBeNull();
  });

  it('handles malformed URLs gracefully', () => {
    const code = parseCodeFromUrl('http:///invalid-url');

    expect(code).toBeNull();
  });
});

describe('validateManifestCode', () => {
  it('validates correctly formatted codes', () => {
    expect(validateManifestCode('abc123xyz789_test-code')).toBe(true);
    expect(
      validateManifestCode('a'.repeat(20))
    ).toBe(true); // Minimum length
    expect(
      validateManifestCode('a'.repeat(100))
    ).toBe(true); // Long code
  });

  it('validates code with only alphanumeric characters', () => {
    expect(validateManifestCode('abcdefghijklmnopqrstuvwxyz012345')).toBe(true);
    expect(validateManifestCode('ABCDEFGHIJKLMNOPQRSTUVWXYZ012345')).toBe(true);
  });

  it('validates code with underscores', () => {
    expect(validateManifestCode('abc_def_ghi_jkl_mno_pqr')).toBe(true);
  });

  it('validates code with hyphens', () => {
    expect(validateManifestCode('abc-def-ghi-jkl-mno-pqr')).toBe(true);
  });

  it('validates code with mixed characters', () => {
    expect(validateManifestCode('a1-B2_c3-D4_e5-F6_g7-H8')).toBe(true);
  });

  it('rejects codes that are too short', () => {
    expect(validateManifestCode('abc')).toBe(false);
    expect(validateManifestCode('a'.repeat(19))).toBe(false); // Just under minimum
  });

  it('rejects codes with invalid characters', () => {
    expect(validateManifestCode('abc def')).toBe(false); // Space
    expect(validateManifestCode('abc.def.ghi.jkl.mno.pqr')).toBe(false); // Dot
    expect(validateManifestCode('abc!def@ghi#jkl$mno%pqr')).toBe(false); // Special chars
    expect(validateManifestCode('code with spaces and more')).toBe(false);
  });

  it('rejects empty string', () => {
    expect(validateManifestCode('')).toBe(false);
  });
});

describe('detectGitHubContext', () => {
  let mockGitExec: jest.Mock;

  beforeEach(() => {
    mockGitExec = jest.fn();
    (Git as jest.MockedClass<typeof Git>).mockImplementation(
      () =>
        ({
          exec: mockGitExec,
        } as any)
    );
  });

  it('detects org and repo from HTTPS URL', () => {
    mockGitExec.mockReturnValue('https://github.com/test-org/test-repo.git');

    const context = detectGitHubContext();

    expect(context).toEqual({
      org: 'test-org',
      repo: 'test-repo',
    });
  });

  it('detects org and repo from HTTPS URL without .git', () => {
    mockGitExec.mockReturnValue('https://github.com/test-org/test-repo');

    const context = detectGitHubContext();

    expect(context).toEqual({
      org: 'test-org',
      repo: 'test-repo',
    });
  });

  it('detects org and repo from SSH URL', () => {
    mockGitExec.mockReturnValue('git@github.com:test-org/test-repo.git');

    const context = detectGitHubContext();

    expect(context).toEqual({
      org: 'test-org',
      repo: 'test-repo',
    });
  });

  it('detects org and repo from SSH URL without .git', () => {
    mockGitExec.mockReturnValue('git@github.com:test-org/test-repo');

    const context = detectGitHubContext();

    expect(context).toEqual({
      org: 'test-org',
      repo: 'test-repo',
    });
  });

  it('handles org and repo names with hyphens', () => {
    mockGitExec.mockReturnValue(
      'https://github.com/my-test-org/my-test-repo.git'
    );

    const context = detectGitHubContext();

    expect(context).toEqual({
      org: 'my-test-org',
      repo: 'my-test-repo',
    });
  });

  it('handles org and repo names with underscores', () => {
    mockGitExec.mockReturnValue(
      'https://github.com/my_test_org/my_test_repo.git'
    );

    const context = detectGitHubContext();

    expect(context).toEqual({
      org: 'my_test_org',
      repo: 'my_test_repo',
    });
  });

  it('handles org and repo names with dots', () => {
    mockGitExec.mockReturnValue(
      'https://github.com/my.test.org/my.test.repo.git'
    );

    const context = detectGitHubContext();

    expect(context).toEqual({
      org: 'my.test.org',
      repo: 'my.test.repo',
    });
  });

  it('returns null for non-GitHub URL', () => {
    mockGitExec.mockReturnValue('https://gitlab.com/test-org/test-repo.git');

    const context = detectGitHubContext();

    expect(context).toBeNull();
  });

  it('returns null when git command fails', () => {
    mockGitExec.mockImplementation(() => {
      throw new Error('Not a git repository');
    });

    const context = detectGitHubContext();

    expect(context).toBeNull();
  });

  it('returns null for invalid URL format', () => {
    mockGitExec.mockReturnValue('invalid-url');

    const context = detectGitHubContext();

    expect(context).toBeNull();
  });

  it('calls git remote get-url origin', () => {
    mockGitExec.mockReturnValue('https://github.com/test-org/test-repo.git');

    detectGitHubContext();

    expect(mockGitExec).toHaveBeenCalledWith('remote get-url origin');
  });
});

describe('isGitRepository', () => {
  let mockGitExec: jest.Mock;

  beforeEach(() => {
    mockGitExec = jest.fn();
    (Git as jest.MockedClass<typeof Git>).mockImplementation(
      () =>
        ({
          exec: mockGitExec,
        } as any)
    );
  });

  it('returns true when in a git repository', () => {
    mockGitExec.mockReturnValue('.git');

    const result = isGitRepository();

    expect(result).toBe(true);
    expect(mockGitExec).toHaveBeenCalledWith('rev-parse --git-dir');
  });

  it('returns false when not in a git repository', () => {
    mockGitExec.mockImplementation(() => {
      throw new Error('Not a git repository');
    });

    const result = isGitRepository();

    expect(result).toBe(false);
  });

  it('returns false when git command fails for any reason', () => {
    mockGitExec.mockImplementation(() => {
      throw new Error('Command failed');
    });

    const result = isGitRepository();

    expect(result).toBe(false);
  });

  it('returns true for git worktree', () => {
    mockGitExec.mockReturnValue('../main-repo/.git/worktrees/feature-branch');

    const result = isGitRepository();

    expect(result).toBe(true);
  });
});
