/**
 * @fractary/faber - Configuration Loading Tests
 *
 * Unit tests for config loading functions with allowMissing option
 */

import * as fs from 'fs';
import * as path from 'path';
import {
  loadFaberConfig,
  loadWorkConfig,
  loadRepoConfig,
  loadSpecConfig,
  loadLogConfig,
  loadStateConfig,
  findProjectRoot,
} from '../config.js';
import { ConfigInitializer } from '../config/initializer.js';
import { ConfigValidationError } from '../errors.js';

describe('Config Loading Functions', () => {
  const testDir = path.join(__dirname, '__test-config-loading__');
  const faberConfigPath = path.join(testDir, '.fractary', 'faber', 'config.yaml');
  const workConfigPath = path.join(testDir, '.fractary', 'plugins', 'work', 'config.json');
  const repoConfigPath = path.join(testDir, '.fractary', 'plugins', 'repo', 'config.json');

  beforeEach(() => {
    // Clean up test directory before each test
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true, force: true });
    }
    fs.mkdirSync(testDir, { recursive: true });
  });

  afterEach(() => {
    // Clean up test directory after each test
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true, force: true });
    }
  });

  describe('loadFaberConfig', () => {
    it('should throw when config is missing and allowMissing is not set', () => {
      expect(() => loadFaberConfig(testDir)).toThrow(ConfigValidationError);
      expect(() => loadFaberConfig(testDir)).toThrow(/fractary init/);
    });

    it('should throw when config is missing and allowMissing is false', () => {
      expect(() => loadFaberConfig(testDir, { allowMissing: false })).toThrow(ConfigValidationError);
    });

    it('should return null when config is missing and allowMissing is true', () => {
      const config = loadFaberConfig(testDir, { allowMissing: true });

      expect(config).toBeNull();
    });

    it('should return config when it exists', () => {
      const defaultConfig = ConfigInitializer.generateDefaultConfig();
      ConfigInitializer.writeConfig(defaultConfig, faberConfigPath);

      const config = loadFaberConfig(testDir);

      expect(config).not.toBeNull();
      expect(config?.schema_version).toBe('1.0');
    });

    it('should return config when allowMissing is true and config exists', () => {
      const defaultConfig = ConfigInitializer.generateDefaultConfig();
      ConfigInitializer.writeConfig(defaultConfig, faberConfigPath);

      const config = loadFaberConfig(testDir, { allowMissing: true });

      expect(config).not.toBeNull();
      expect(config?.schema_version).toBe('1.0');
    });

    it('should construct config from individual plugin configs when FABER config missing', () => {
      // Create work and repo configs separately
      const workDir = path.dirname(workConfigPath);
      const repoDir = path.dirname(repoConfigPath);
      fs.mkdirSync(workDir, { recursive: true });
      fs.mkdirSync(repoDir, { recursive: true });

      fs.writeFileSync(
        workConfigPath,
        JSON.stringify({ platform: 'github' }, null, 2),
        'utf-8'
      );
      fs.writeFileSync(
        repoConfigPath,
        JSON.stringify({ platform: 'github', owner: 'test', repo: 'test' }, null, 2),
        'utf-8'
      );

      const config = loadFaberConfig(testDir, { allowMissing: true });

      expect(config).not.toBeNull();
      expect(config?.work.platform).toBe('github');
      expect(config?.repo.platform).toBe('github');
    });

    it('should include helpful error message with expected path', () => {
      try {
        loadFaberConfig(testDir);
        fail('Should have thrown');
      } catch (error) {
        if (error instanceof ConfigValidationError) {
          expect(error.message).toContain('Expected config at:');
          expect(error.message).toContain('.fractary/faber');
        } else {
          fail('Wrong error type');
        }
      }
    });
  });

  describe('loadWorkConfig', () => {
    it('should throw when config is missing and allowMissing is not set', () => {
      expect(() => loadWorkConfig(testDir)).toThrow(ConfigValidationError);
      expect(() => loadWorkConfig(testDir)).toThrow(/fractary init/);
    });

    it('should throw when config is missing and allowMissing is false', () => {
      expect(() => loadWorkConfig(testDir, { allowMissing: false })).toThrow(ConfigValidationError);
    });

    it('should return null when config is missing and allowMissing is true', () => {
      const config = loadWorkConfig(testDir, { allowMissing: true });

      expect(config).toBeNull();
    });

    it('should return config when it exists', () => {
      const workDir = path.dirname(workConfigPath);
      fs.mkdirSync(workDir, { recursive: true });
      fs.writeFileSync(
        workConfigPath,
        JSON.stringify({ platform: 'github', owner: 'test', repo: 'test' }, null, 2),
        'utf-8'
      );

      const config = loadWorkConfig(testDir);

      expect(config).not.toBeNull();
      expect(config?.platform).toBe('github');
    });

    it('should handle handlers structure from plugins', () => {
      const workDir = path.dirname(workConfigPath);
      fs.mkdirSync(workDir, { recursive: true });
      fs.writeFileSync(
        workConfigPath,
        JSON.stringify({
          handlers: {
            github: {
              platform: 'github',
              owner: 'test',
              repo: 'test',
            },
          },
        }, null, 2),
        'utf-8'
      );

      const config = loadWorkConfig(testDir);

      expect(config).not.toBeNull();
      expect(config?.platform).toBe('github');
      expect(config?.owner).toBe('test');
    });
  });

  describe('loadRepoConfig', () => {
    it('should throw when config is missing and allowMissing is not set', () => {
      expect(() => loadRepoConfig(testDir)).toThrow(ConfigValidationError);
      expect(() => loadRepoConfig(testDir)).toThrow(/fractary init/);
    });

    it('should throw when config is missing and allowMissing is false', () => {
      expect(() => loadRepoConfig(testDir, { allowMissing: false })).toThrow(ConfigValidationError);
    });

    it('should return null when config is missing and allowMissing is true', () => {
      const config = loadRepoConfig(testDir, { allowMissing: true });

      expect(config).toBeNull();
    });

    it('should return config when it exists', () => {
      const repoDir = path.dirname(repoConfigPath);
      fs.mkdirSync(repoDir, { recursive: true });
      fs.writeFileSync(
        repoConfigPath,
        JSON.stringify({
          platform: 'github',
          owner: 'test',
          repo: 'test',
          defaultBranch: 'main',
        }, null, 2),
        'utf-8'
      );

      const config = loadRepoConfig(testDir);

      expect(config).not.toBeNull();
      expect(config?.platform).toBe('github');
      expect(config?.defaultBranch).toBe('main');
    });

    it('should handle handlers structure from plugins', () => {
      const repoDir = path.dirname(repoConfigPath);
      fs.mkdirSync(repoDir, { recursive: true });
      fs.writeFileSync(
        repoConfigPath,
        JSON.stringify({
          handlers: {
            github: {
              platform: 'github',
              owner: 'test',
              repo: 'test',
            },
          },
        }, null, 2),
        'utf-8'
      );

      const config = loadRepoConfig(testDir);

      expect(config).not.toBeNull();
      expect(config?.platform).toBe('github');
      expect(config?.owner).toBe('test');
    });
  });

  describe('loadSpecConfig', () => {
    it('should throw when config is missing and allowMissing is not set', () => {
      expect(() => loadSpecConfig(testDir)).toThrow(ConfigValidationError);
      expect(() => loadSpecConfig(testDir)).toThrow(/fractary init/);
    });

    it('should throw when config is missing and allowMissing is false', () => {
      expect(() => loadSpecConfig(testDir, { allowMissing: false })).toThrow(ConfigValidationError);
    });

    it('should return default config when FABER config is missing and allowMissing is true', () => {
      const config = loadSpecConfig(testDir, { allowMissing: true });

      expect(config).not.toBeNull();
      expect(config.localPath).toBe(path.join(testDir, 'specs'));
    });

    it('should return spec config from FABER config when it exists', () => {
      const defaultConfig = ConfigInitializer.generateDefaultConfig();
      defaultConfig.artifacts.specs.local_path = '/custom/specs';
      ConfigInitializer.writeConfig(defaultConfig, faberConfigPath);

      const config = loadSpecConfig(testDir);

      expect(config.localPath).toBe('/custom/specs');
    });

    it('should return default config when allowMissing is true and FABER config exists but has no specs config', () => {
      const defaultConfig = ConfigInitializer.generateDefaultConfig();
      delete (defaultConfig.artifacts as any).specs;
      ConfigInitializer.writeConfig(defaultConfig, faberConfigPath);

      const config = loadSpecConfig(testDir, { allowMissing: true });

      expect(config.localPath).toBe(path.join(testDir, 'specs'));
    });
  });

  describe('loadLogConfig', () => {
    it('should return default config when FABER config is missing', () => {
      const config = loadLogConfig(testDir);

      expect(config).not.toBeNull();
      expect(config.localPath).toBe(path.join(testDir, '.fractary', 'logs'));
    });

    it('should return log config from FABER config when it exists', () => {
      const defaultConfig = ConfigInitializer.generateDefaultConfig();
      defaultConfig.artifacts.logs.local_path = '/custom/logs';
      ConfigInitializer.writeConfig(defaultConfig, faberConfigPath);

      const config = loadLogConfig(testDir);

      expect(config.localPath).toBe('/custom/logs');
    });

    it('should return default config when FABER config exists but has no logs config', () => {
      const defaultConfig = ConfigInitializer.generateDefaultConfig();
      delete (defaultConfig.artifacts as any).logs;
      ConfigInitializer.writeConfig(defaultConfig, faberConfigPath);

      const config = loadLogConfig(testDir);

      expect(config.localPath).toBe(path.join(testDir, '.fractary', 'logs'));
    });
  });

  describe('loadStateConfig', () => {
    it('should return default config when FABER config is missing', () => {
      const config = loadStateConfig(testDir);

      expect(config).not.toBeNull();
      expect(config.localPath).toBe(path.join(testDir, '.fractary', 'faber'));
    });

    it('should return state config from FABER config when it exists', () => {
      const defaultConfig = ConfigInitializer.generateDefaultConfig();
      defaultConfig.artifacts.state.local_path = '/custom/state';
      ConfigInitializer.writeConfig(defaultConfig, faberConfigPath);

      const config = loadStateConfig(testDir);

      expect(config.localPath).toBe('/custom/state');
    });

    it('should return default config when FABER config exists but has no state config', () => {
      const defaultConfig = ConfigInitializer.generateDefaultConfig();
      delete (defaultConfig.artifacts as any).state;
      ConfigInitializer.writeConfig(defaultConfig, faberConfigPath);

      const config = loadStateConfig(testDir);

      expect(config.localPath).toBe(path.join(testDir, '.fractary', 'faber'));
    });
  });

  describe('Backward Compatibility', () => {
    it('should read existing JSON configs during migration period', () => {
      // Create legacy JSON config
      const jsonConfigPath = faberConfigPath.replace(/\.yaml$/, '.json');
      const dir = path.dirname(jsonConfigPath);
      fs.mkdirSync(dir, { recursive: true });

      const jsonConfig = ConfigInitializer.generateDefaultConfig();
      jsonConfig.repo.owner = 'json-owner';
      fs.writeFileSync(jsonConfigPath, JSON.stringify(jsonConfig, null, 2), 'utf-8');

      const config = loadFaberConfig(testDir);

      expect(config).not.toBeNull();
      expect(config?.repo.owner).toBe('json-owner');
    });

    it('should prefer YAML over JSON when both exist', () => {
      const yamlConfig = ConfigInitializer.generateDefaultConfig();
      yamlConfig.repo.owner = 'yaml-owner';
      ConfigInitializer.writeConfig(yamlConfig, faberConfigPath);

      const jsonConfigPath = faberConfigPath.replace(/\.yaml$/, '.json');
      const jsonConfig = ConfigInitializer.generateDefaultConfig();
      jsonConfig.repo.owner = 'json-owner';
      fs.writeFileSync(jsonConfigPath, JSON.stringify(jsonConfig, null, 2), 'utf-8');

      const config = loadFaberConfig(testDir);

      expect(config?.repo.owner).toBe('yaml-owner');
    });
  });

  describe('findProjectRoot', () => {
    it('should prioritize .fractary directory in current path over CLAUDE_WORK_CWD', () => {
      // Create a test directory with .fractary
      const worktreeDir = path.join(testDir, 'worktree');
      const fractaryDir = path.join(worktreeDir, '.fractary');
      fs.mkdirSync(fractaryDir, { recursive: true });

      // Set CLAUDE_WORK_CWD to a different directory
      const originalCwd = process.env['CLAUDE_WORK_CWD'];
      process.env['CLAUDE_WORK_CWD'] = testDir;

      try {
        // findProjectRoot should find the worktree directory, not CLAUDE_WORK_CWD
        const result = findProjectRoot(worktreeDir);
        expect(result).toBe(worktreeDir);
      } finally {
        // Restore original CLAUDE_WORK_CWD
        if (originalCwd === undefined) {
          delete process.env['CLAUDE_WORK_CWD'];
        } else {
          process.env['CLAUDE_WORK_CWD'] = originalCwd;
        }
      }
    });

    it('should prioritize .git directory in current path over CLAUDE_WORK_CWD', () => {
      // Create a test directory with .git
      const worktreeDir = path.join(testDir, 'worktree');
      const gitDir = path.join(worktreeDir, '.git');
      fs.mkdirSync(gitDir, { recursive: true });

      // Set CLAUDE_WORK_CWD to a different directory
      const originalCwd = process.env['CLAUDE_WORK_CWD'];
      process.env['CLAUDE_WORK_CWD'] = testDir;

      try {
        // findProjectRoot should find the worktree directory, not CLAUDE_WORK_CWD
        const result = findProjectRoot(worktreeDir);
        expect(result).toBe(worktreeDir);
      } finally {
        // Restore original CLAUDE_WORK_CWD
        if (originalCwd === undefined) {
          delete process.env['CLAUDE_WORK_CWD'];
        } else {
          process.env['CLAUDE_WORK_CWD'] = originalCwd;
        }
      }
    });

    it('should traverse up to find .git even from subdirectories', () => {
      // Create a deeply nested directory without its own .fractary or .git
      const emptyDir = path.join(testDir, 'empty', 'nested', 'deep');
      fs.mkdirSync(emptyDir, { recursive: true });

      // findProjectRoot should traverse up and find the faber repo's .git
      const result = findProjectRoot(emptyDir);

      // Should find a .git directory somewhere in the parent path
      // (In test environment, this will be the faber repo's root)
      expect(fs.existsSync(path.join(result, '.git'))).toBe(true);
      expect(result).not.toBe(emptyDir); // Should have traversed up
    });
  });

  describe('Backward Compatibility', () => {
    it('should load config from legacy location', () => {
      const oldPath = path.join(testDir, '.fractary', 'plugins', 'faber', 'config.yaml');
      const config = ConfigInitializer.generateDefaultConfig();
      config.repo.owner = 'legacy-owner';
      ConfigInitializer.writeConfig(config, oldPath);

      const loaded = loadFaberConfig(testDir);

      expect(loaded).not.toBeNull();
      expect(loaded?.repo.owner).toBe('legacy-owner');
    });

    it('should prefer new location over legacy', () => {
      const oldPath = path.join(testDir, '.fractary', 'plugins', 'faber', 'config.yaml');
      const newPath = path.join(testDir, '.fractary', 'faber', 'config.yaml');

      const oldConfig = ConfigInitializer.generateDefaultConfig();
      oldConfig.repo.owner = 'old-owner';
      ConfigInitializer.writeConfig(oldConfig, oldPath);

      const newConfig = ConfigInitializer.generateDefaultConfig();
      newConfig.repo.owner = 'new-owner';
      ConfigInitializer.writeConfig(newConfig, newPath);

      const loaded = loadFaberConfig(testDir);
      expect(loaded?.repo.owner).toBe('new-owner');
    });
  });
});
