/**
 * Unit tests for ConfigManager
 */

import { ConfigManager } from '../config.js';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';

// Mock fs and os modules
jest.mock('fs/promises');
jest.mock('os');

const mockFs = fs as jest.Mocked<typeof fs>;
const mockOs = os as jest.Mocked<typeof os>;

describe('ConfigManager', () => {
  beforeEach(() => {
    // Clear all mocks before each test
    jest.clearAllMocks();

    // Setup default mocks
    mockOs.homedir.mockReturnValue('/home/testuser');
    mockOs.platform.mockReturnValue('linux');

    // Mock process.cwd()
    jest.spyOn(process, 'cwd').mockReturnValue('/project');

    // Clear environment variables
    delete process.env.ANTHROPIC_API_KEY;
    delete process.env.GITHUB_TOKEN;
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('load', () => {
    it('should load config from environment variables', async () => {
      process.env.ANTHROPIC_API_KEY = 'test-anthropic-key';
      process.env.GITHUB_TOKEN = 'test-github-token';

      // Mock no config files
      mockFs.readFile.mockRejectedValue(new Error('File not found'));

      const config = await ConfigManager.load();

      expect(config.anthropic?.api_key).toBe('test-anthropic-key');
      expect(config.github?.token).toBe('test-github-token');
    });

    it('should load config from FABER config file', async () => {
      const faberConfig = {
        anthropic: {
          api_key: 'file-anthropic-key',
        },
        github: {
          token: 'file-github-token',
          organization: 'test-org',
          project: 'test-project',
        },
      };

      mockFs.readFile.mockImplementation(async (filePath: any) => {
        if (filePath.includes('.fractary/settings.json')) {
          return JSON.stringify(faberConfig);
        }
        throw new Error('File not found');
      });

      const config = await ConfigManager.load();

      expect(config.anthropic?.api_key).toBe('file-anthropic-key');
      expect(config.github?.token).toBe('file-github-token');
      expect(config.github?.organization).toBe('test-org');
      expect(config.github?.project).toBe('test-project');
    });

    it('should merge environment variables with config file', async () => {
      process.env.ANTHROPIC_API_KEY = 'env-anthropic-key';

      const faberConfig = {
        github: {
          token: 'file-github-token',
          organization: 'test-org',
        },
      };

      mockFs.readFile.mockImplementation(async (filePath: any) => {
        if (filePath.includes('.fractary/settings.json')) {
          return JSON.stringify(faberConfig);
        }
        throw new Error('File not found');
      });

      const config = await ConfigManager.load();

      // Env var should take precedence for anthropic
      expect(config.anthropic?.api_key).toBe('env-anthropic-key');
      // File config should be used for github
      expect(config.github?.token).toBe('file-github-token');
      expect(config.github?.organization).toBe('test-org');
    });

    it('should read Claude Code config for worktree location (Linux)', async () => {
      mockOs.platform.mockReturnValue('linux');

      const claudeConfig = {
        worktree: {
          directory: '/custom/worktree/path',
        },
      };

      mockFs.readFile.mockImplementation(async (filePath: any) => {
        if (filePath.includes('.config/claude/config.json')) {
          return JSON.stringify(claudeConfig);
        }
        throw new Error('File not found');
      });

      const config = await ConfigManager.load();

      expect(config.worktree?.location).toBe('/custom/worktree/path');
    });

    it('should read Claude Code config for worktree location (macOS)', async () => {
      mockOs.platform.mockReturnValue('darwin');
      mockOs.homedir.mockReturnValue('/Users/testuser');

      const claudeConfig = {
        worktree: {
          directory: '/Users/testuser/claude-worktrees',
        },
      };

      mockFs.readFile.mockImplementation(async (filePath: any) => {
        if (filePath.includes('Library/Application Support/Claude/config.json')) {
          return JSON.stringify(claudeConfig);
        }
        throw new Error('File not found');
      });

      const config = await ConfigManager.load();

      expect(config.worktree?.location).toBe('/Users/testuser/claude-worktrees');
    });

    it('should read Claude Code config for worktree location (Windows)', async () => {
      mockOs.platform.mockReturnValue('win32');
      mockOs.homedir.mockReturnValue('C:\\Users\\testuser');
      process.env.APPDATA = 'C:\\Users\\testuser\\AppData\\Roaming';

      const claudeConfig = {
        worktree: {
          directory: 'C:\\Users\\testuser\\.claude-worktrees',
        },
      };

      mockFs.readFile.mockImplementation(async (filePath: any) => {
        if (filePath.includes('Claude') && filePath.includes('config.json')) {
          return JSON.stringify(claudeConfig);
        }
        throw new Error('File not found');
      });

      const config = await ConfigManager.load();

      // Note: The value is copied directly from Claude config, preserving original separators
      expect(config.worktree?.location).toBe('C:\\Users\\testuser\\.claude-worktrees');
    });

    it('should try fallback Claude config paths', async () => {
      mockOs.platform.mockReturnValue('linux');

      const claudeConfig = {
        worktree: {
          directory: '/fallback/worktree/path',
        },
      };

      mockFs.readFile.mockImplementation(async (filePath: any) => {
        // First path fails
        if (filePath.includes('.config/claude/config.json')) {
          throw new Error('File not found');
        }
        // Second path succeeds
        if (filePath.includes('.claude/config.json')) {
          return JSON.stringify(claudeConfig);
        }
        throw new Error('File not found');
      });

      const config = await ConfigManager.load();

      expect(config.worktree?.location).toBe('/fallback/worktree/path');
    });

    it('should use default worktree location when Claude config not found', async () => {
      mockFs.readFile.mockRejectedValue(new Error('File not found'));

      const config = await ConfigManager.load();

      expect(config.worktree?.location).toBe('/home/testuser/.claude-worktrees');
    });

    it('should not inherit from Claude config when inherit_from_claude is false', async () => {
      const faberConfig = {
        worktree: {
          location: '/custom/faber/worktree',
          inherit_from_claude: false,
        },
      };

      const claudeConfig = {
        worktree: {
          directory: '/claude/worktree',
        },
      };

      mockFs.readFile.mockImplementation(async (filePath: any) => {
        if (filePath.includes('.fractary/settings.json')) {
          return JSON.stringify(faberConfig);
        }
        if (filePath.includes('claude/config.json')) {
          return JSON.stringify(claudeConfig);
        }
        throw new Error('File not found');
      });

      const config = await ConfigManager.load();

      // Should use FABER config, not Claude config
      expect(config.worktree?.location).toBe('/custom/faber/worktree');
    });

    it('should set default workflow config path', async () => {
      mockFs.readFile.mockRejectedValue(new Error('File not found'));

      const config = await ConfigManager.load();

      expect(config.workflow?.config_path).toBe('/project/plugins/faber/config/workflows');
    });

    it('should use workflow config from FABER config file', async () => {
      const faberConfig = {
        workflow: {
          default: 'custom-workflow',
          config_path: '/custom/workflows',
        },
      };

      mockFs.readFile.mockImplementation(async (filePath: any) => {
        if (filePath.includes('.fractary/settings.json')) {
          return JSON.stringify(faberConfig);
        }
        throw new Error('File not found');
      });

      const config = await ConfigManager.load();

      expect(config.workflow?.default).toBe('custom-workflow');
      expect(config.workflow?.config_path).toBe('/custom/workflows');
    });

    it('should handle malformed JSON in config files gracefully', async () => {
      mockFs.readFile.mockImplementation(async (filePath: any) => {
        if (filePath.includes('.fractary/settings.json')) {
          return 'invalid json {{{';
        }
        throw new Error('File not found');
      });

      // Should not throw, should use defaults
      const config = await ConfigManager.load();

      expect(config.worktree?.location).toBe('/home/testuser/.claude-worktrees');
    });

    it('should handle empty config files', async () => {
      mockFs.readFile.mockImplementation(async (filePath: any) => {
        if (filePath.includes('.fractary/settings.json')) {
          return '{}';
        }
        throw new Error('File not found');
      });

      const config = await ConfigManager.load();

      expect(config.worktree?.location).toBe('/home/testuser/.claude-worktrees');
      expect(config.workflow?.config_path).toBe('/project/plugins/faber/config/workflows');
    });

    it('should merge partial configs correctly', async () => {
      process.env.ANTHROPIC_API_KEY = 'env-key';

      const faberConfig = {
        anthropic: {
          // Override env key with file key
          api_key: 'file-key',
        },
        github: {
          organization: 'test-org',
        },
        worktree: {
          location: '/file/worktree',
          // Note: Without inherit_from_claude: false, Claude config will override
        },
      };

      const claudeConfig = {
        worktree: {
          // Will override FABER config unless inherit_from_claude is explicitly false
          directory: '/claude/worktree',
        },
      };

      mockFs.readFile.mockImplementation(async (filePath: any) => {
        if (filePath.includes('.fractary/settings.json')) {
          return JSON.stringify(faberConfig);
        }
        if (filePath.includes('claude/config.json')) {
          return JSON.stringify(claudeConfig);
        }
        throw new Error('File not found');
      });

      const config = await ConfigManager.load();

      expect(config.anthropic?.api_key).toBe('file-key');
      expect(config.github?.organization).toBe('test-org');
      // Claude config overrides FABER config when inherit_from_claude is not explicitly false
      expect(config.worktree?.location).toBe('/claude/worktree');
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
