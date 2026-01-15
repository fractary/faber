/**
 * Unit tests for yaml-config.ts
 *
 * Tests environment variable substitution, project root finding,
 * config loading/writing, and security measures.
 */

import * as fs from 'fs';
import * as path from 'path';
import * as yaml from 'js-yaml';
import {
  substituteEnvVars,
  findProjectRoot,
  loadYamlConfig,
  writeYamlConfig,
  configExists,
  getConfigPath,
  oldSettingsExists,
  getOldSettingsPath,
  UnifiedConfig,
} from '../yaml-config.js';

// Mock fs module
jest.mock('fs');
const mockFs = fs as jest.Mocked<typeof fs>;

describe('yaml-config', () => {
  const originalEnv = process.env;
  const originalCwd = process.cwd;

  beforeEach(() => {
    jest.clearAllMocks();
    // Reset environment
    process.env = { ...originalEnv };
    // Clear specific env vars used in tests
    delete process.env.TEST_VAR;
    delete process.env.ANTHROPIC_API_KEY;
    delete process.env.GITHUB_TOKEN;
    delete process.env.MISSING_VAR;
  });

  afterEach(() => {
    process.env = originalEnv;
    jest.restoreAllMocks();
  });

  describe('substituteEnvVars', () => {
    it('should substitute environment variable with value', () => {
      process.env.TEST_VAR = 'test-value';
      const result = substituteEnvVars('key: ${TEST_VAR}', false);
      expect(result).toBe('key: test-value');
    });

    it('should substitute multiple environment variables', () => {
      process.env.VAR_ONE = 'first';
      process.env.VAR_TWO = 'second';
      const result = substituteEnvVars('a: ${VAR_ONE}, b: ${VAR_TWO}', false);
      expect(result).toBe('a: first, b: second');
    });

    it('should use default value when env var not set', () => {
      const result = substituteEnvVars('key: ${MISSING_VAR:-default-value}', false);
      expect(result).toBe('key: default-value');
    });

    it('should prefer env var over default value', () => {
      process.env.TEST_VAR = 'env-value';
      const result = substituteEnvVars('key: ${TEST_VAR:-default-value}', false);
      expect(result).toBe('key: env-value');
    });

    it('should keep placeholder when env var not set and no default', () => {
      const result = substituteEnvVars('key: ${MISSING_VAR}', false);
      expect(result).toBe('key: ${MISSING_VAR}');
    });

    it('should warn when env var not set and warnMissing is true', () => {
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();
      substituteEnvVars('key: ${MISSING_VAR}', true);
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('MISSING_VAR not set')
      );
    });

    it('should not warn when warnMissing is false', () => {
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();
      substituteEnvVars('key: ${MISSING_VAR}', false);
      expect(consoleSpy).not.toHaveBeenCalled();
    });

    it('should truncate overly long default values', () => {
      const longDefault = 'x'.repeat(1500);
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();
      const result = substituteEnvVars(`key: \${MISSING_VAR:-${longDefault}}`, false);
      expect(result).toBe(`key: ${'x'.repeat(1000)}`);
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('exceeds maximum length')
      );
    });

    it('should only match valid variable names (uppercase and underscore)', () => {
      process.env.VALID_VAR = 'valid';
      // lowercase variables should not be matched by the regex
      const result = substituteEnvVars('a: ${VALID_VAR}, b: ${invalid_var}', false);
      expect(result).toBe('a: valid, b: ${invalid_var}');
    });

    it('should handle empty string content', () => {
      const result = substituteEnvVars('', false);
      expect(result).toBe('');
    });

    it('should handle content with no variables', () => {
      const content = 'key: value\nother: data';
      const result = substituteEnvVars(content, false);
      expect(result).toBe(content);
    });

    it('should throw TypeError for non-string input', () => {
      expect(() => substituteEnvVars(null as any, false)).toThrow(TypeError);
      expect(() => substituteEnvVars(undefined as any, false)).toThrow(TypeError);
      expect(() => substituteEnvVars(123 as any, false)).toThrow(TypeError);
    });

    it('should handle nested braces correctly', () => {
      process.env.OUTER = 'outer-value';
      // Only the valid pattern should be matched
      const result = substituteEnvVars('key: ${OUTER}', false);
      expect(result).toBe('key: outer-value');
    });

    it('should handle special characters in env var values', () => {
      process.env.SPECIAL = 'value with spaces & special!@#$%^&*()';
      const result = substituteEnvVars('key: ${SPECIAL}', false);
      expect(result).toBe('key: value with spaces & special!@#$%^&*()');
    });

    it('should handle variable at start of string', () => {
      process.env.START_VAR = 'start';
      const result = substituteEnvVars('${START_VAR}: value', false);
      expect(result).toBe('start: value');
    });

    it('should handle variable at end of string', () => {
      process.env.END_VAR = 'end';
      const result = substituteEnvVars('key: ${END_VAR}', false);
      expect(result).toBe('key: end');
    });

    it('should handle empty default value', () => {
      // Empty default value is kept as-is since the regex requires at least one char after :-
      const result = substituteEnvVars('key: ${MISSING_VAR:-}', false);
      // The regex doesn't match empty defaults, so it keeps the placeholder
      expect(result).toBe('key: ${MISSING_VAR:-}');
    });
  });

  describe('findProjectRoot', () => {
    beforeEach(() => {
      // Reset mocks for each test
      mockFs.existsSync.mockReset();
    });

    it('should find project root with .fractary directory', () => {
      mockFs.existsSync.mockImplementation((p: any) => {
        return p === '/home/user/project/.fractary';
      });

      const result = findProjectRoot('/home/user/project/src/lib');
      expect(result).toBe('/home/user/project');
    });

    it('should find project root with .git directory', () => {
      mockFs.existsSync.mockImplementation((p: any) => {
        return p === '/home/user/project/.git';
      });

      const result = findProjectRoot('/home/user/project/src/lib');
      expect(result).toBe('/home/user/project');
    });

    it('should prefer .fractary over .git', () => {
      mockFs.existsSync.mockImplementation((p: any) => {
        if (p === '/home/user/project/.fractary') return true;
        if (p === '/home/user/project/.git') return true;
        return false;
      });

      const result = findProjectRoot('/home/user/project/src');
      expect(result).toBe('/home/user/project');
    });

    it('should return startDir when no marker found', () => {
      mockFs.existsSync.mockReturnValue(false);

      const result = findProjectRoot('/home/user/project/src');
      expect(result).toBe('/home/user/project/src');
    });

    it('should throw TypeError for non-string startDir', () => {
      expect(() => findProjectRoot(null as any)).toThrow(TypeError);
      expect(() => findProjectRoot(123 as any)).toThrow(TypeError);
    });

    it('should normalize path with traversal attempts', () => {
      mockFs.existsSync.mockImplementation((p: any) => {
        return p === '/home/user/project/.fractary';
      });

      const result = findProjectRoot('/home/user/project/src/../src/lib');
      expect(result).toBe('/home/user/project');
    });

    it('should handle reaching filesystem root', () => {
      mockFs.existsSync.mockReturnValue(false);

      // This should not hang - it should stop at root
      const result = findProjectRoot('/tmp');
      expect(result).toBe('/tmp');
    });

    it('should respect MAX_LEVELS limit', () => {
      // Always return false to force traversal up
      mockFs.existsSync.mockReturnValue(false);
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();

      // Create a very deep path (this is artificial but tests the limit)
      const deepPath = '/a/b/c/d/e/f/g/h/i/j';
      findProjectRoot(deepPath);

      // The function should handle this without infinite loop
      // It either finds root or returns the original path
      expect(consoleSpy).not.toHaveBeenCalledWith(
        expect.stringContaining('Exceeded maximum directory depth')
      );
    });

    it('should use process.cwd() as default', () => {
      const cwdSpy = jest.spyOn(process, 'cwd').mockReturnValue('/current/dir');
      mockFs.existsSync.mockReturnValue(false);

      const result = findProjectRoot();
      expect(cwdSpy).toHaveBeenCalled();
      expect(result).toBe('/current/dir');
    });
  });

  describe('loadYamlConfig', () => {
    const testProjectRoot = '/test/project';
    const configPath = '/test/project/.fractary/config.yaml';

    beforeEach(() => {
      // Mock findProjectRoot indirectly through existsSync
      mockFs.existsSync.mockImplementation((p: any) => {
        if (p === `${testProjectRoot}/.fractary`) return true;
        if (p === configPath) return true;
        return false;
      });
    });

    it('should load and parse valid YAML config', () => {
      const yamlContent = `
version: "2.0"
github:
  organization: test-org
  project: test-project
`;
      mockFs.readFileSync.mockReturnValue(yamlContent);

      const config = loadYamlConfig({ projectRoot: testProjectRoot });

      expect(config).not.toBeNull();
      expect(config?.version).toBe('2.0');
      expect(config?.github?.organization).toBe('test-org');
      expect(config?.github?.project).toBe('test-project');
    });

    it('should substitute environment variables in config', () => {
      process.env.GITHUB_TOKEN = 'secret-token';
      const yamlContent = `
version: "2.0"
github:
  token: \${GITHUB_TOKEN}
`;
      mockFs.readFileSync.mockReturnValue(yamlContent);

      const config = loadYamlConfig({ projectRoot: testProjectRoot, warnMissingEnvVars: false });

      expect(config?.github?.token).toBe('secret-token');
    });

    it('should return null when config does not exist', () => {
      mockFs.existsSync.mockReturnValue(false);

      const config = loadYamlConfig({ projectRoot: testProjectRoot });

      expect(config).toBeNull();
    });

    it('should throw when throwIfMissing is true and config does not exist', () => {
      mockFs.existsSync.mockReturnValue(false);

      expect(() => {
        loadYamlConfig({ projectRoot: testProjectRoot, throwIfMissing: true });
      }).toThrow('Configuration file not found');
    });

    it('should throw on invalid YAML syntax', () => {
      mockFs.readFileSync.mockReturnValue('invalid: yaml: content: [');

      expect(() => {
        loadYamlConfig({ projectRoot: testProjectRoot });
      }).toThrow('Failed to load config');
    });

    it('should throw when parsed result is not an object', () => {
      mockFs.readFileSync.mockReturnValue('"just a string"');

      expect(() => {
        loadYamlConfig({ projectRoot: testProjectRoot });
      }).toThrow('Invalid configuration: must be a YAML object');
    });

    it('should warn when version field is missing', () => {
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();
      mockFs.readFileSync.mockReturnValue('github:\n  organization: test');

      loadYamlConfig({ projectRoot: testProjectRoot });

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('missing version field')
      );
    });

    it('should handle empty config file', () => {
      mockFs.readFileSync.mockReturnValue('');

      expect(() => {
        loadYamlConfig({ projectRoot: testProjectRoot });
      }).toThrow('Invalid configuration: must be a YAML object');
    });

    it('should handle config with only comments', () => {
      mockFs.readFileSync.mockReturnValue('# Just a comment\n# Another comment');

      expect(() => {
        loadYamlConfig({ projectRoot: testProjectRoot });
      }).toThrow('Invalid configuration: must be a YAML object');
    });
  });

  describe('writeYamlConfig', () => {
    const testProjectRoot = '/test/project';
    const fractaryDir = '/test/project/.fractary';
    const configPath = '/test/project/.fractary/config.yaml';

    beforeEach(() => {
      mockFs.existsSync.mockImplementation((p: any) => {
        if (p === `${testProjectRoot}/.fractary`) return true;
        return false;
      });
      mockFs.mkdirSync.mockImplementation(() => undefined);
      mockFs.writeFileSync.mockImplementation(() => undefined);
    });

    it('should write config as YAML', () => {
      const config: UnifiedConfig = {
        version: '2.0',
        github: {
          organization: 'test-org',
          project: 'test-project',
        },
      };

      writeYamlConfig(config, testProjectRoot);

      expect(mockFs.writeFileSync).toHaveBeenCalledWith(
        configPath,
        expect.stringContaining('version:'),
        'utf-8'
      );
      expect(mockFs.writeFileSync).toHaveBeenCalledWith(
        configPath,
        expect.stringContaining('github:'),
        'utf-8'
      );
    });

    it('should create .fractary directory if it does not exist', () => {
      mockFs.existsSync.mockReturnValue(false);

      const config: UnifiedConfig = { version: '2.0' };
      writeYamlConfig(config, testProjectRoot);

      expect(mockFs.mkdirSync).toHaveBeenCalledWith(fractaryDir, { recursive: true });
    });

    it('should safely call mkdirSync even if directory exists (race-condition fix)', () => {
      // We intentionally always call mkdirSync with recursive:true
      // to avoid race conditions. This is safe even if directory exists.
      mockFs.existsSync.mockImplementation((p: any) => {
        if (p === `${testProjectRoot}/.fractary`) return true;
        if (p === fractaryDir) return true;
        return false;
      });

      const config: UnifiedConfig = { version: '2.0' };
      writeYamlConfig(config, testProjectRoot);

      // mkdirSync is always called with recursive:true, which is safe
      expect(mockFs.mkdirSync).toHaveBeenCalledWith(fractaryDir, { recursive: true });
    });

    it('should preserve nested structure in YAML output', () => {
      const config: UnifiedConfig = {
        version: '2.0',
        faber: {
          worktree: {
            location: '/custom/path',
            inherit_from_claude: true,
          },
        },
      };

      writeYamlConfig(config, testProjectRoot);

      const writeCall = mockFs.writeFileSync.mock.calls[0];
      const writtenContent = writeCall[1] as string;

      expect(writtenContent).toContain('faber:');
      expect(writtenContent).toContain('worktree:');
      expect(writtenContent).toContain('location:');
    });
  });

  describe('configExists', () => {
    it('should return true when config file exists', () => {
      mockFs.existsSync.mockImplementation((p: any) => {
        if (p.includes('.fractary/config.yaml')) return true;
        if (p.includes('.fractary')) return true;
        return false;
      });

      expect(configExists('/test/project')).toBe(true);
    });

    it('should return false when config file does not exist', () => {
      mockFs.existsSync.mockReturnValue(false);

      expect(configExists('/test/project')).toBe(false);
    });
  });

  describe('getConfigPath', () => {
    it('should return correct config path', () => {
      mockFs.existsSync.mockImplementation((p: any) => {
        return p.includes('.fractary');
      });

      const result = getConfigPath('/test/project');
      expect(result).toBe('/test/project/.fractary/config.yaml');
    });
  });

  describe('oldSettingsExists', () => {
    it('should return true when old settings.json exists', () => {
      mockFs.existsSync.mockImplementation((p: any) => {
        if (p.includes('.fractary/settings.json')) return true;
        if (p.includes('.fractary')) return true;
        return false;
      });

      expect(oldSettingsExists('/test/project')).toBe(true);
    });

    it('should return false when old settings.json does not exist', () => {
      mockFs.existsSync.mockReturnValue(false);

      expect(oldSettingsExists('/test/project')).toBe(false);
    });
  });

  describe('getOldSettingsPath', () => {
    it('should return correct old settings path', () => {
      mockFs.existsSync.mockImplementation((p: any) => {
        return p.includes('.fractary');
      });

      const result = getOldSettingsPath('/test/project');
      expect(result).toBe('/test/project/.fractary/settings.json');
    });
  });

  describe('integration scenarios', () => {
    it('should handle full config with all sections', () => {
      const fullConfig = `
version: "2.0"
anthropic:
  api_key: \${ANTHROPIC_API_KEY}
  model: claude-sonnet-4-5
github:
  organization: myorg
  project: myrepo
  token: \${GITHUB_TOKEN}
faber:
  worktree:
    location: ~/.claude-worktrees
    inherit_from_claude: true
  workflow:
    config_path: .fractary/faber/workflows
`;

      process.env.ANTHROPIC_API_KEY = 'sk-ant-test';
      process.env.GITHUB_TOKEN = 'ghp_test';

      mockFs.existsSync.mockReturnValue(true);
      mockFs.readFileSync.mockReturnValue(fullConfig);

      const config = loadYamlConfig({ projectRoot: '/test', warnMissingEnvVars: false });

      expect(config?.version).toBe('2.0');
      expect(config?.anthropic?.api_key).toBe('sk-ant-test');
      expect(config?.anthropic?.model).toBe('claude-sonnet-4-5');
      expect(config?.github?.organization).toBe('myorg');
      expect(config?.github?.token).toBe('ghp_test');
      expect(config?.faber?.worktree?.location).toBe('~/.claude-worktrees');
      expect(config?.faber?.workflow?.config_path).toBe('.fractary/faber/workflows');
    });

    it('should handle config with defaults for missing env vars', () => {
      const configWithDefaults = `
version: "2.0"
github:
  organization: \${GITHUB_ORG:-default-org}
  project: \${GITHUB_PROJECT:-default-project}
`;

      mockFs.existsSync.mockReturnValue(true);
      mockFs.readFileSync.mockReturnValue(configWithDefaults);

      const config = loadYamlConfig({ projectRoot: '/test', warnMissingEnvVars: false });

      expect(config?.github?.organization).toBe('default-org');
      expect(config?.github?.project).toBe('default-project');
    });
  });
});
