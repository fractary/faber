/**
 * Unit tests for migrate command
 *
 * Tests the migration from .fractary/settings.json to .fractary/config.yaml
 */

import { createMigrateCommand } from '../migrate.js';
import * as fs from 'fs/promises';
import * as fsSync from 'fs';
import * as yaml from 'js-yaml';
import * as yamlConfig from '../../lib/yaml-config.js';

// Mock modules
jest.mock('fs/promises');
jest.mock('fs', () => ({
  existsSync: jest.fn(),
  readFileSync: jest.fn(),
  writeFileSync: jest.fn(),
  mkdirSync: jest.fn(),
}));
jest.mock('../../lib/yaml-config.js', () => ({
  findProjectRoot: jest.fn(),
  oldSettingsExists: jest.fn(),
  configExists: jest.fn(),
  loadYamlConfig: jest.fn(),
  writeYamlConfig: jest.fn(),
  getOldSettingsPath: jest.fn(),
  getConfigPath: jest.fn(),
}));

const mockFs = fs as jest.Mocked<typeof fs>;
const mockFsSync = fsSync as jest.Mocked<typeof fsSync>;
const mockYamlConfig = yamlConfig as jest.Mocked<typeof yamlConfig>;

describe('migrate command', () => {
  let consoleLogSpy: jest.SpyInstance;
  let consoleErrorSpy: jest.SpyInstance;
  let processExitSpy: jest.SpyInstance;

  const projectRoot = '/test/project';
  const settingsPath = '/test/project/.fractary/settings.json';
  const configPath = '/test/project/.fractary/config.yaml';

  beforeEach(() => {
    jest.clearAllMocks();

    // Setup default mocks
    mockYamlConfig.findProjectRoot.mockReturnValue(projectRoot);
    mockYamlConfig.getOldSettingsPath.mockReturnValue(settingsPath);
    mockYamlConfig.getConfigPath.mockReturnValue(configPath);

    // Mock console methods
    consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();

    // Mock process.exit to throw instead of actually exiting
    processExitSpy = jest.spyOn(process, 'exit').mockImplementation((code) => {
      throw new Error(`Process exited with code ${code}`);
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('createMigrateCommand', () => {
    it('should create command with correct name and options', () => {
      const command = createMigrateCommand();

      expect(command.name()).toBe('migrate');
      expect(command.description()).toContain('settings.json');
      expect(command.description()).toContain('config.yaml');

      const options = command.options.map(opt => opt.long);
      expect(options).toContain('--dry-run');
      expect(options).toContain('--no-backup');
      expect(options).toContain('--json');
    });
  });

  describe('when settings.json does not exist', () => {
    beforeEach(() => {
      mockYamlConfig.oldSettingsExists.mockReturnValue(false);
    });

    it('should exit with error message', async () => {
      const command = createMigrateCommand();

      await expect(command.parseAsync(['node', 'test', 'migrate'])).rejects.toThrow(
        'Process exited with code 1'
      );

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('No .fractary/settings.json found')
      );
    });

    it('should output JSON error when --json flag is set', async () => {
      const command = createMigrateCommand();

      await expect(command.parseAsync(['node', 'test', 'migrate', '--json'])).rejects.toThrow(
        'Process exited with code 1'
      );

      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('"status":"error"')
      );
    });
  });

  describe('when settings.json exists', () => {
    const validSettings = {
      anthropic: {
        api_key: 'sk-ant-test',
        model: 'claude-sonnet-4-5',
      },
      github: {
        token: 'ghp_test',
        organization: 'test-org',
        project: 'test-project',
      },
      worktree: {
        location: '~/.claude-worktrees',
        inherit_from_claude: true,
      },
      workflow: {
        config_path: '.fractary/faber/workflows',
      },
    };

    beforeEach(() => {
      mockYamlConfig.oldSettingsExists.mockReturnValue(true);
      mockYamlConfig.configExists.mockReturnValue(false);
      mockFs.readFile.mockResolvedValue(JSON.stringify(validSettings));
      mockYamlConfig.writeYamlConfig.mockImplementation(() => {});
      mockFs.rename.mockResolvedValue(undefined);
    });

    it('should migrate settings to config.yaml', async () => {
      const command = createMigrateCommand();

      await command.parseAsync(['node', 'test', 'migrate']);

      expect(mockYamlConfig.writeYamlConfig).toHaveBeenCalledWith(
        expect.objectContaining({
          version: '2.0',
          anthropic: expect.objectContaining({
            api_key: 'sk-ant-test',
          }),
          github: expect.objectContaining({
            organization: 'test-org',
          }),
          faber: expect.objectContaining({
            worktree: expect.objectContaining({
              location: '~/.claude-worktrees',
            }),
          }),
        }),
        projectRoot
      );
    });

    it('should create backup by default', async () => {
      const command = createMigrateCommand();

      await command.parseAsync(['node', 'test', 'migrate']);

      expect(mockFs.rename).toHaveBeenCalledWith(
        settingsPath,
        `${settingsPath}.backup`
      );
    });

    it('should skip backup with --no-backup flag', async () => {
      mockFs.unlink.mockResolvedValue(undefined);
      const command = createMigrateCommand();

      await command.parseAsync(['node', 'test', 'migrate', '--no-backup']);

      expect(mockFs.rename).not.toHaveBeenCalled();
      expect(mockFs.unlink).toHaveBeenCalledWith(settingsPath);
    });

    it('should warn about hardcoded API keys', async () => {
      const command = createMigrateCommand();

      await command.parseAsync(['node', 'test', 'migrate']);

      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('hardcoded Anthropic API key')
      );
    });

    it('should warn about hardcoded GitHub tokens', async () => {
      const command = createMigrateCommand();

      await command.parseAsync(['node', 'test', 'migrate']);

      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('hardcoded GitHub token')
      );
    });

    it('should not warn about env var references', async () => {
      const settingsWithEnvVars = {
        ...validSettings,
        anthropic: { api_key: '${ANTHROPIC_API_KEY}' },
        github: { ...validSettings.github, token: '${GITHUB_TOKEN}' },
      };
      mockFs.readFile.mockResolvedValue(JSON.stringify(settingsWithEnvVars));

      const command = createMigrateCommand();
      await command.parseAsync(['node', 'test', 'migrate']);

      // Should not include hardcoded warnings
      const logCalls = consoleLogSpy.mock.calls.map(call => call.join(' '));
      const hasApiKeyWarning = logCalls.some(call => call.includes('hardcoded Anthropic'));
      const hasTokenWarning = logCalls.some(call => call.includes('hardcoded GitHub'));

      expect(hasApiKeyWarning).toBe(false);
      expect(hasTokenWarning).toBe(false);
    });

    it('should output JSON on success with --json flag', async () => {
      const command = createMigrateCommand();

      await command.parseAsync(['node', 'test', 'migrate', '--json']);

      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('"status":"success"')
      );
    });
  });

  describe('dry-run mode', () => {
    const validSettings = {
      github: { organization: 'test-org' },
    };

    beforeEach(() => {
      mockYamlConfig.oldSettingsExists.mockReturnValue(true);
      mockYamlConfig.configExists.mockReturnValue(false);
      mockFs.readFile.mockResolvedValue(JSON.stringify(validSettings));
    });

    it('should not write config with --dry-run flag', async () => {
      const command = createMigrateCommand();

      await command.parseAsync(['node', 'test', 'migrate', '--dry-run']);

      expect(mockYamlConfig.writeYamlConfig).not.toHaveBeenCalled();
      expect(mockFs.rename).not.toHaveBeenCalled();
    });

    it('should output YAML preview in dry-run mode', async () => {
      const command = createMigrateCommand();

      await command.parseAsync(['node', 'test', 'migrate', '--dry-run']);

      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('Dry run')
      );
    });

    it('should output JSON preview with --dry-run --json', async () => {
      const command = createMigrateCommand();

      await command.parseAsync(['node', 'test', 'migrate', '--dry-run', '--json']);

      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('"status": "dry-run"')  // This one has spaces due to JSON.stringify(..., null, 2)
      );
    });
  });

  describe('merging with existing config', () => {
    const oldSettings = {
      github: { token: 'new-token', organization: 'new-org' },
    };

    const existingConfig = {
      version: '2.0',
      github: { organization: 'existing-org', project: 'existing-project' },
      anthropic: { api_key: '${ANTHROPIC_API_KEY}' },
    };

    beforeEach(() => {
      mockYamlConfig.oldSettingsExists.mockReturnValue(true);
      mockYamlConfig.configExists.mockReturnValue(true);
      mockYamlConfig.loadYamlConfig.mockReturnValue(existingConfig);
      mockFs.readFile.mockResolvedValue(JSON.stringify(oldSettings));
      mockYamlConfig.writeYamlConfig.mockImplementation(() => {});
      mockFs.rename.mockResolvedValue(undefined);
    });

    it('should merge new settings with existing config', async () => {
      const command = createMigrateCommand();

      await command.parseAsync(['node', 'test', 'migrate']);

      expect(mockYamlConfig.writeYamlConfig).toHaveBeenCalledWith(
        expect.objectContaining({
          version: '2.0',
          github: expect.objectContaining({
            token: 'new-token',
            organization: 'new-org',
            project: 'existing-project', // preserved from existing
          }),
          anthropic: expect.objectContaining({
            api_key: '${ANTHROPIC_API_KEY}', // preserved from existing
          }),
        }),
        projectRoot
      );
    });

    it('should log merge warning', async () => {
      const command = createMigrateCommand();

      await command.parseAsync(['node', 'test', 'migrate']);

      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('Existing config.yaml found')
      );
    });
  });

  describe('error handling', () => {
    beforeEach(() => {
      mockYamlConfig.oldSettingsExists.mockReturnValue(true);
    });

    it('should handle invalid JSON in settings.json', async () => {
      mockFs.readFile.mockResolvedValue('invalid json {{{');

      const command = createMigrateCommand();

      await expect(command.parseAsync(['node', 'test', 'migrate'])).rejects.toThrow(
        'Process exited with code 1'
      );

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('Failed to parse settings.json')
      );
    });

    it('should handle file read errors', async () => {
      mockFs.readFile.mockRejectedValue(new Error('ENOENT: file not found'));

      const command = createMigrateCommand();

      await expect(command.parseAsync(['node', 'test', 'migrate'])).rejects.toThrow(
        'Process exited with code 1'
      );
    });

    it('should output JSON error format with --json flag', async () => {
      mockFs.readFile.mockResolvedValue('invalid json');

      const command = createMigrateCommand();

      await expect(command.parseAsync(['node', 'test', 'migrate', '--json'])).rejects.toThrow(
        'Process exited with code 1'
      );

      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('"status":"error"')
      );
    });
  });

  describe('backlog_management validation', () => {
    beforeEach(() => {
      mockYamlConfig.oldSettingsExists.mockReturnValue(true);
      mockYamlConfig.configExists.mockReturnValue(false);
      mockYamlConfig.writeYamlConfig.mockImplementation(() => {});
      mockFs.rename.mockResolvedValue(undefined);
    });

    it('should preserve valid default_order_by values', async () => {
      const settings = {
        backlog_management: {
          default_limit: 10,
          default_order_by: 'priority',
        },
      };
      mockFs.readFile.mockResolvedValue(JSON.stringify(settings));

      const command = createMigrateCommand();
      await command.parseAsync(['node', 'test', 'migrate']);

      expect(mockYamlConfig.writeYamlConfig).toHaveBeenCalledWith(
        expect.objectContaining({
          faber: expect.objectContaining({
            backlog_management: expect.objectContaining({
              default_order_by: 'priority',
            }),
          }),
        }),
        projectRoot
      );
    });

    it('should remove invalid default_order_by values', async () => {
      const settings = {
        backlog_management: {
          default_limit: 10,
          default_order_by: 'invalid_value',
        },
      };
      mockFs.readFile.mockResolvedValue(JSON.stringify(settings));

      const command = createMigrateCommand();
      await command.parseAsync(['node', 'test', 'migrate']);

      expect(mockYamlConfig.writeYamlConfig).toHaveBeenCalledWith(
        expect.objectContaining({
          faber: expect.objectContaining({
            backlog_management: expect.objectContaining({
              default_limit: 10,
              default_order_by: undefined,
            }),
          }),
        }),
        projectRoot
      );
    });

    it('should accept all valid order_by values', async () => {
      const validValues = ['priority', 'created', 'updated', 'none'];

      for (const value of validValues) {
        jest.clearAllMocks();
        mockYamlConfig.oldSettingsExists.mockReturnValue(true);
        mockYamlConfig.configExists.mockReturnValue(false);
        mockYamlConfig.writeYamlConfig.mockImplementation(() => {});
        mockFs.rename.mockResolvedValue(undefined);

        const settings = {
          backlog_management: { default_order_by: value },
        };
        mockFs.readFile.mockResolvedValue(JSON.stringify(settings));

        const command = createMigrateCommand();
        await command.parseAsync(['node', 'test', 'migrate']);

        expect(mockYamlConfig.writeYamlConfig).toHaveBeenCalledWith(
          expect.objectContaining({
            faber: expect.objectContaining({
              backlog_management: expect.objectContaining({
                default_order_by: value,
              }),
            }),
          }),
          projectRoot
        );
      }
    });
  });

  describe('GitHub App configuration migration', () => {
    beforeEach(() => {
      mockYamlConfig.oldSettingsExists.mockReturnValue(true);
      mockYamlConfig.configExists.mockReturnValue(false);
      mockYamlConfig.writeYamlConfig.mockImplementation(() => {});
      mockFs.rename.mockResolvedValue(undefined);
    });

    it('should migrate GitHub App configuration', async () => {
      const settings = {
        github: {
          organization: 'test-org',
          project: 'test-project',
          app: {
            id: '123456',
            installation_id: '789012',
            private_key_path: '~/.github/app.pem',
            created_via: 'manifest-flow',
          },
        },
      };
      mockFs.readFile.mockResolvedValue(JSON.stringify(settings));

      const command = createMigrateCommand();
      await command.parseAsync(['node', 'test', 'migrate']);

      expect(mockYamlConfig.writeYamlConfig).toHaveBeenCalledWith(
        expect.objectContaining({
          github: expect.objectContaining({
            organization: 'test-org',
            project: 'test-project',
            app: expect.objectContaining({
              id: '123456',
              installation_id: '789012',
              private_key_path: '~/.github/app.pem',
            }),
          }),
        }),
        projectRoot
      );
    });
  });
});
