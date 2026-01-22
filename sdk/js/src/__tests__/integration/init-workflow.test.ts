/**
 * @fractary/faber - Init Workflow Integration Tests
 *
 * Integration tests for the full initialization workflow
 */

import * as fs from 'fs';
import * as path from 'path';
import { ConfigInitializer } from '../../config/initializer.js';
import {
  loadFaberConfig,
  loadWorkConfig,
  loadRepoConfig,
} from '../../config.js';

describe('Init Workflow Integration', () => {
  const testDir = path.join(__dirname, '__test-init-workflow__');
  const configPath = path.join(testDir, '.fractary', 'plugins', 'faber', 'config.yaml');

  beforeEach(() => {
    // Clean up test directory before each test
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true, force: true });
    }
    fs.mkdirSync(testDir, { recursive: true });

    // Mock process.cwd() to return testDir
    jest.spyOn(process, 'cwd').mockReturnValue(testDir);
  });

  afterEach(() => {
    // Clean up test directory after each test
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true, force: true });
    }

    // Restore mocks
    jest.restoreAllMocks();
  });

  describe('CLI Init Command Simulation', () => {
    it('should allow init without existing config', () => {
      // Simulate CLI init command
      const config = ConfigInitializer.generateDefaultConfig();
      ConfigInitializer.writeConfig(config, configPath);

      // Verify config was created
      expect(fs.existsSync(configPath)).toBe(true);

      // Verify config can be loaded
      const loadedConfig = loadFaberConfig(testDir);
      expect(loadedConfig).not.toBeNull();
      expect(loadedConfig?.schema_version).toBe('1.0');
    });

    it('should create YAML config that is human-readable', () => {
      const config = ConfigInitializer.generateDefaultConfig();
      ConfigInitializer.writeConfig(config, configPath);

      const content = fs.readFileSync(configPath, 'utf-8');

      // Verify YAML format
      expect(content).toContain('schema_version:');
      expect(content).toContain('work:');
      expect(content).toContain('platform: github');
      expect(content).toContain('repo:');
      expect(content).toContain('artifacts:');
      expect(content).toContain('workflow:');
      expect(content).toContain('autonomy: guarded');

      // Should not contain JSON-specific syntax
      expect(content).not.toContain('{');
      expect(content).not.toContain('"schema_version"');
    });

    it('should create config with all required fields populated', () => {
      const config = ConfigInitializer.generateDefaultConfig();
      ConfigInitializer.writeConfig(config, configPath);

      const loadedConfig = loadFaberConfig(testDir);

      expect(loadedConfig).not.toBeNull();
      expect(loadedConfig?.schema_version).toBe('1.0');
      expect(loadedConfig?.work).toBeDefined();
      expect(loadedConfig?.repo).toBeDefined();
      expect(loadedConfig?.artifacts).toBeDefined();
      expect(loadedConfig?.workflow).toBeDefined();
    });

    it('should allow customization during init', () => {
      const createdPath = ConfigInitializer.initializeProject(testDir, {
        repoOwner: 'my-org',
        repoName: 'my-project',
        workPlatform: 'jira',
        repoPlatform: 'gitlab',
      });

      expect(fs.existsSync(createdPath)).toBe(true);

      const config = loadFaberConfig(testDir);
      expect(config?.repo.owner).toBe('my-org');
      expect(config?.repo.repo).toBe('my-project');
      expect(config?.work.platform).toBe('jira');
      expect(config?.repo.platform).toBe('gitlab');
    });
  });

  describe('Config Loading After Init', () => {
    it('should load all config sections after init', () => {
      ConfigInitializer.initializeProject(testDir);

      const faberConfig = loadFaberConfig(testDir);
      const workConfig = loadWorkConfig(testDir);
      const repoConfig = loadRepoConfig(testDir);

      expect(faberConfig).not.toBeNull();
      expect(workConfig).not.toBeNull();
      expect(repoConfig).not.toBeNull();
    });

    it('should not throw after successful init', () => {
      ConfigInitializer.initializeProject(testDir);

      // All of these should work without throwing
      expect(() => loadFaberConfig(testDir)).not.toThrow();
      expect(() => loadWorkConfig(testDir)).not.toThrow();
      expect(() => loadRepoConfig(testDir)).not.toThrow();
    });
  });

  describe('Error Messages Without Init', () => {
    it('should provide helpful error message when config missing', () => {
      try {
        loadFaberConfig(testDir);
        fail('Should have thrown');
      } catch (error: any) {
        expect(error.message).toContain('fractary init');
        expect(error.message).toContain('Expected config at:');
      }
    });

    it('should guide user to run init command', () => {
      try {
        loadWorkConfig(testDir);
        fail('Should have thrown');
      } catch (error: any) {
        expect(error.message).toContain('fractary init');
      }

      try {
        loadRepoConfig(testDir);
        fail('Should have thrown');
      } catch (error: any) {
        expect(error.message).toContain('fractary init');
      }
    });
  });

  describe('Backward Compatibility', () => {
    it('should work with existing JSON configs during migration', () => {
      // Create legacy JSON config
      const jsonConfigPath = configPath.replace(/\.yaml$/, '.json');
      const dir = path.dirname(jsonConfigPath);
      fs.mkdirSync(dir, { recursive: true });

      const jsonConfig = ConfigInitializer.generateDefaultConfig();
      jsonConfig.repo.owner = 'legacy-owner';
      fs.writeFileSync(jsonConfigPath, JSON.stringify(jsonConfig, null, 2), 'utf-8');

      // Should still be loadable
      const config = loadFaberConfig(testDir);
      expect(config).not.toBeNull();
      expect(config?.repo.owner).toBe('legacy-owner');
    });

    it('should migrate from JSON to YAML when re-initializing', () => {
      // Create legacy JSON config
      const jsonConfigPath = configPath.replace(/\.yaml$/, '.json');
      const dir = path.dirname(jsonConfigPath);
      fs.mkdirSync(dir, { recursive: true });

      const jsonConfig = ConfigInitializer.generateDefaultConfig();
      fs.writeFileSync(jsonConfigPath, JSON.stringify(jsonConfig, null, 2), 'utf-8');

      // Re-initialize (creates YAML)
      ConfigInitializer.initializeProject(testDir);

      // Both should exist during migration
      expect(fs.existsSync(jsonConfigPath)).toBe(true);
      expect(fs.existsSync(configPath)).toBe(true);

      // YAML should be preferred
      const config = ConfigInitializer.readConfig(configPath);
      expect(config).not.toBeNull();
    });
  });

  describe('Real-World Scenarios', () => {
    it('should support new project initialization flow', () => {
      // 1. User runs: fractary init
      const createdPath = ConfigInitializer.initializeProject(testDir, {
        repoOwner: 'acme',
        repoName: 'my-app',
      });

      expect(fs.existsSync(createdPath)).toBe(true);

      // 2. Config should be loaded correctly
      const config = loadFaberConfig(testDir);
      expect(config?.repo.owner).toBe('acme');
      expect(config?.repo.repo).toBe('my-app');
    });

    it('should support existing project with partial config', () => {
      // 1. Create work and repo configs separately (old setup)
      const workConfigPath = path.join(testDir, '.fractary', 'plugins', 'work', 'config.json');
      const repoConfigPath = path.join(testDir, '.fractary', 'plugins', 'repo', 'config.json');

      fs.mkdirSync(path.dirname(workConfigPath), { recursive: true });
      fs.mkdirSync(path.dirname(repoConfigPath), { recursive: true });

      fs.writeFileSync(
        workConfigPath,
        JSON.stringify({ platform: 'github', owner: 'old', repo: 'old' }, null, 2),
        'utf-8'
      );
      fs.writeFileSync(
        repoConfigPath,
        JSON.stringify({ platform: 'github', owner: 'old', repo: 'old' }, null, 2),
        'utf-8'
      );

      // 2. Load config (should construct from individual configs)
      const config = loadFaberConfig(testDir, { allowMissing: true });
      expect(config).not.toBeNull();
      expect(config?.work.platform).toBe('github');
      expect(config?.repo.platform).toBe('github');

      // 3. Upgrade to unified config
      ConfigInitializer.initializeProject(testDir, {
        repoOwner: 'new',
        repoName: 'new',
      });

      // 4. New config should take precedence
      const newConfig = loadFaberConfig(testDir);
      expect(newConfig?.repo.owner).toBe('new');
    });

    it('should support CLI integration pattern', () => {
      // Simulate CLI checking for config before running command
      const configExists = ConfigInitializer.configExists(configPath);
      expect(configExists).toBe(false);

      // CLI detects no config and prompts user to init
      if (!configExists) {
        ConfigInitializer.initializeProject(testDir);
      }

      // Now config exists
      expect(ConfigInitializer.configExists(configPath)).toBe(true);
    });
  });

  describe('Performance Requirements', () => {
    it('should generate default config in under 100ms', () => {
      const start = Date.now();
      ConfigInitializer.generateDefaultConfig();
      const duration = Date.now() - start;

      expect(duration).toBeLessThan(100);
    });

    it('should write config file quickly', () => {
      const config = ConfigInitializer.generateDefaultConfig();

      const start = Date.now();
      ConfigInitializer.writeConfig(config, configPath);
      const duration = Date.now() - start;

      expect(duration).toBeLessThan(100);
    });
  });
});
