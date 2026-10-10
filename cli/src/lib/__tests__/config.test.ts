/**
 * Unit tests for ConfigManager
 *
 * load() reads the unified .fractary/config.yaml from a temporary project on
 * disk. Claude Code's config (fs/promises) and the home directory and platform
 * (os) are mocked.
 */

import { ConfigManager } from '../config.js';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';

// Mock fs/promises (Claude Code config) and os (home directory, platform)
jest.mock('fs/promises');
jest.mock('os');

// Real modules for creating the project on disk
const realFs = jest.requireActual<typeof import('fs')>('fs');
const realOs = jest.requireActual<typeof import('os')>('os');

const mockFs = fs as jest.Mocked<typeof fs>;
const mockOs = os as jest.Mocked<typeof os>;

let projectDir: string;

/** Write the project's .fractary/config.yaml */
function writeConfig(yaml: string): void {
  realFs.mkdirSync(path.join(projectDir, '.fractary'), { recursive: true });
  realFs.writeFileSync(path.join(projectDir, '.fractary', 'config.yaml'), yaml);
}

/** Return the given Claude Code config for paths containing `match`; every other read fails */
function claudeConfigAt(match: string, directory: string): void {
  mockFs.readFile.mockImplementation(async (filePath: any) => {
    if (String(filePath).includes(match)) {
      return JSON.stringify({ worktree: { directory } });
    }
    throw new Error('File not found');
  });
}

describe('ConfigManager', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    mockOs.homedir.mockReturnValue('/home/testuser');
    mockOs.platform.mockReturnValue('linux');

    projectDir = realFs.mkdtempSync(path.join(realOs.tmpdir(), 'faber-config-'));
    jest.spyOn(process, 'cwd').mockReturnValue(projectDir);

    delete process.env.ANTHROPIC_API_KEY;
    delete process.env.GITHUB_TOKEN;

    // No Claude Code config unless a test provides one
    mockFs.readFile.mockRejectedValue(new Error('File not found'));
  });

  afterEach(() => {
    jest.restoreAllMocks();
    realFs.rmSync(projectDir, { recursive: true, force: true });
  });

  describe('load', () => {
    it('should fail when .fractary/config.yaml is missing', async () => {
      await expect(ConfigManager.load()).rejects.toThrow('No .fractary/config.yaml found');
    });

    it('should ask to migrate when only the old settings.json exists', async () => {
      realFs.mkdirSync(path.join(projectDir, '.fractary'), { recursive: true });
      realFs.writeFileSync(path.join(projectDir, '.fractary', 'settings.json'), '{}');

      await expect(ConfigManager.load()).rejects.toThrow('fractary-faber migrate');
    });

    it('should load anthropic and github settings from config.yaml', async () => {
      writeConfig(`version: "2.0"
anthropic:
  api_key: file-anthropic-key
github:
  token: file-github-token
  organization: test-org
  project: test-project
`);

      const config = await ConfigManager.load();

      expect(config.anthropic?.api_key).toBe('file-anthropic-key');
      expect(config.github?.token).toBe('file-github-token');
      expect(config.github?.organization).toBe('test-org');
      expect(config.github?.project).toBe('test-project');
    });

    it('should prefer environment variables over config.yaml', async () => {
      process.env.ANTHROPIC_API_KEY = 'env-anthropic-key';
      process.env.GITHUB_TOKEN = 'env-github-token';
      writeConfig(`version: "2.0"
anthropic:
  api_key: file-anthropic-key
github:
  token: file-github-token
  organization: test-org
`);

      const config = await ConfigManager.load();

      expect(config.anthropic?.api_key).toBe('env-anthropic-key');
      expect(config.github?.token).toBe('env-github-token');
      expect(config.github?.organization).toBe('test-org');
    });

    it('should fall back to the work section for the GitHub organization, project and token', async () => {
      writeConfig(`version: "2.0"
work:
  handlers:
    github:
      owner: work-org
      repo: work-repo
      token: work-token
`);

      const config = await ConfigManager.load();

      expect(config.github?.organization).toBe('work-org');
      expect(config.github?.project).toBe('work-repo');
      expect(config.github?.token).toBe('work-token');
    });

    it('should parse the organization and project from an owner/repo string', async () => {
      writeConfig(`version: "2.0"
github:
  repo: acme/widgets
`);

      const config = await ConfigManager.load();

      expect(config.github?.organization).toBe('acme');
      expect(config.github?.project).toBe('widgets');
    });

    it('should read Claude Code config for worktree location (Linux)', async () => {
      writeConfig('version: "2.0"\n');
      claudeConfigAt('.config/claude/config.json', '/custom/worktree/path');

      const config = await ConfigManager.load();

      expect(config.worktree?.location).toBe('/custom/worktree/path');
    });

    it('should read Claude Code config for worktree location (macOS)', async () => {
      mockOs.platform.mockReturnValue('darwin');
      mockOs.homedir.mockReturnValue('/Users/testuser');
      writeConfig('version: "2.0"\n');
      claudeConfigAt('Library/Application Support/Claude/config.json', '/Users/testuser/claude-worktrees');

      const config = await ConfigManager.load();

      expect(config.worktree?.location).toBe('/Users/testuser/claude-worktrees');
    });

    it('should read Claude Code config for worktree location (Windows)', async () => {
      mockOs.platform.mockReturnValue('win32');
      mockOs.homedir.mockReturnValue('C:\\Users\\testuser');
      process.env.APPDATA = 'C:\\Users\\testuser\\AppData\\Roaming';
      writeConfig('version: "2.0"\n');
      claudeConfigAt('Claude', 'C:\\Users\\testuser\\.claude-worktrees');

      const config = await ConfigManager.load();

      // The value is copied from Claude config, keeping its separators
      expect(config.worktree?.location).toBe('C:\\Users\\testuser\\.claude-worktrees');
    });

    it('should try fallback Claude config paths', async () => {
      writeConfig('version: "2.0"\n');
      mockFs.readFile.mockImplementation(async (filePath: any) => {
        // First path fails, second succeeds
        if (String(filePath).includes('.config/claude/config.json')) {
          throw new Error('File not found');
        }
        if (String(filePath).includes('.claude/config.json')) {
          return JSON.stringify({ worktree: { directory: '/fallback/worktree/path' } });
        }
        throw new Error('File not found');
      });

      const config = await ConfigManager.load();

      expect(config.worktree?.location).toBe('/fallback/worktree/path');
    });

    it('should use default worktree location when Claude config not found', async () => {
      writeConfig('version: "2.0"\n');

      const config = await ConfigManager.load();

      expect(config.worktree?.location).toBe('/home/testuser/.claude-worktrees');
    });

    it('should not inherit from Claude config when inherit_from_claude is false', async () => {
      writeConfig(`version: "2.0"
faber:
  worktree:
    location: /custom/faber/worktree
    inherit_from_claude: false
`);
      claudeConfigAt('claude/config.json', '/claude/worktree');

      const config = await ConfigManager.load();

      expect(config.worktree?.location).toBe('/custom/faber/worktree');
    });

    it('should let Claude config override the worktree location unless inherit_from_claude is false', async () => {
      writeConfig(`version: "2.0"
faber:
  worktree:
    location: /file/worktree
`);
      claudeConfigAt('claude/config.json', '/claude/worktree');

      const config = await ConfigManager.load();

      expect(config.worktree?.location).toBe('/claude/worktree');
    });

    it('should set default workflow config path', async () => {
      writeConfig('version: "2.0"\n');

      const config = await ConfigManager.load();

      expect(config.workflow?.config_path).toBe(path.join(projectDir, '.fractary', 'faber', 'workflows'));
    });

    it('should use the legacy workflow section', async () => {
      writeConfig(`version: "2.0"
faber:
  workflow:
    default: custom-workflow
    config_path: /custom/workflows
`);

      const config = await ConfigManager.load();

      expect(config.workflow?.default).toBe('custom-workflow');
      expect(config.workflow?.config_path).toBe('/custom/workflows');
    });

    it('should map the workflows section (v2.1) to the workflow default and path', async () => {
      writeConfig(`version: "2.0"
faber:
  workflows:
    default: v21-workflow
    path: /v21/workflows
`);

      const config = await ConfigManager.load();

      expect(config.workflow?.default).toBe('v21-workflow');
      expect(config.workflow?.config_path).toBe('/v21/workflows');
    });

    it('should reject a config.yaml that fails validation', async () => {
      writeConfig(`version: "2.0"
anthropic:
  max_tokens: 0
`);

      await expect(ConfigManager.load()).rejects.toThrow('Configuration validation failed');
    });

    it('should reject a malformed config.yaml', async () => {
      writeConfig('version: "2.0"\nanthropic: [unclosed\n');

      await expect(ConfigManager.load()).rejects.toThrow('Failed to load config');
    });

    it('should apply defaults for an empty faber section', async () => {
      writeConfig('version: "2.0"\nfaber: {}\n');

      const config = await ConfigManager.load();

      expect(config.worktree?.location).toBe('/home/testuser/.claude-worktrees');
      expect(config.workflow?.config_path).toBe(path.join(projectDir, '.fractary', 'faber', 'workflows'));
    });
  });

  describe('getClaudeConfigPaths', () => {
    it('should return correct paths for Linux', () => {
      mockOs.platform.mockReturnValue('linux');
      mockOs.homedir.mockReturnValue('/home/testuser');

      const paths = (ConfigManager as any).getClaudeConfigPaths();

      expect(paths).toEqual([
        '/home/testuser/.config/claude/config.json',
        '/home/testuser/.claude/config.json',
      ]);
    });

    it('should return correct paths for macOS', () => {
      mockOs.platform.mockReturnValue('darwin');
      mockOs.homedir.mockReturnValue('/Users/testuser');

      const paths = (ConfigManager as any).getClaudeConfigPaths();

      expect(paths).toEqual([
        '/Users/testuser/Library/Application Support/Claude/config.json',
        '/Users/testuser/.config/claude/config.json',
      ]);
    });

    it('should return correct paths for Windows', () => {
      mockOs.platform.mockReturnValue('win32');
      mockOs.homedir.mockReturnValue('C:\\Users\\testuser');
      process.env.APPDATA = 'C:\\Users\\testuser\\AppData\\Roaming';

      const paths = (ConfigManager as any).getClaudeConfigPaths();

      // Note: path.join normalizes separators, so paths may have forward slashes
      expect(paths).toContain('C:\\Users\\testuser\\AppData\\Roaming/Claude/config.json');
      expect(paths).toContain('C:\\Users\\testuser/.claude/config.json');
    });

    it('should handle Windows without APPDATA', () => {
      mockOs.platform.mockReturnValue('win32');
      mockOs.homedir.mockReturnValue('C:\\Users\\testuser');
      delete process.env.APPDATA;

      const paths = (ConfigManager as any).getClaudeConfigPaths();

      // Note: path.join normalizes separators, so paths may have forward slashes
      expect(paths).toContain('C:\\Users\\testuser/AppData/Roaming/Claude/config.json');
    });

    it('should return fallback path for unknown platforms', () => {
      mockOs.platform.mockReturnValue('freebsd' as any);
      mockOs.homedir.mockReturnValue('/home/testuser');

      const paths = (ConfigManager as any).getClaudeConfigPaths();

      expect(paths).toEqual(['/home/testuser/.claude/config.json']);
    });
  });
});
