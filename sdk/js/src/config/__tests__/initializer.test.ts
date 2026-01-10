/**
 * @fractary/faber - ConfigInitializer Tests
 *
 * Unit tests for the ConfigInitializer class
 */

import * as fs from 'fs';
import * as path from 'path';
import * as yaml from 'js-yaml';
import { ConfigInitializer } from '../initializer.js';
import { FaberConfig } from '../../types.js';

describe('ConfigInitializer', () => {
  const testDir = path.join(__dirname, '__test-configs__');
  const yamlConfigPath = path.join(testDir, 'config.yaml');
  const jsonConfigPath = path.join(testDir, 'config.json');

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

  describe('generateDefaultConfig', () => {
    it('should generate valid default config with all required sections', () => {
      const config = ConfigInitializer.generateDefaultConfig();

      expect(config).toBeDefined();
      expect(config.schema_version).toBe('1.0');
      expect(config.work).toBeDefined();
      expect(config.repo).toBeDefined();
      expect(config.artifacts).toBeDefined();
      expect(config.workflow).toBeDefined();
    });

    it('should set sensible defaults for work config', () => {
      const config = ConfigInitializer.generateDefaultConfig();

      expect(config.work.platform).toBe('github');
    });

    it('should set sensible defaults for repo config', () => {
      const config = ConfigInitializer.generateDefaultConfig();

      expect(config.repo.platform).toBe('github');
      expect(config.repo.owner).toBe('');
      expect(config.repo.repo).toBe('');
      expect(config.repo.defaultBranch).toBe('main');
    });

    it('should set sensible defaults for artifacts config', () => {
      const config = ConfigInitializer.generateDefaultConfig();

      expect(config.artifacts.specs).toEqual({
        use_codex: false,
        local_path: '/specs',
      });
      expect(config.artifacts.logs).toEqual({
        use_codex: false,
        local_path: '.fractary/logs',
      });
      expect(config.artifacts.state).toEqual({
        use_codex: false,
        local_path: '.fractary/faber',
      });
    });

    it('should set sensible defaults for workflow config', () => {
      const config = ConfigInitializer.generateDefaultConfig();

      expect(config.workflow.autonomy).toBe('guarded');
      expect(config.workflow.phases).toBeDefined();
      expect(config.workflow.phases.frame.enabled).toBe(true);
      expect(config.workflow.phases.architect.enabled).toBe(true);
      expect(config.workflow.phases.architect.refineSpec).toBe(true);
      expect(config.workflow.phases.build.enabled).toBe(true);
      expect(config.workflow.phases.evaluate.enabled).toBe(true);
      expect(config.workflow.phases.evaluate.maxRetries).toBe(3);
      expect(config.workflow.phases.release.enabled).toBe(true);
      expect(config.workflow.phases.release.requestReviews).toBe(false);
      expect(config.workflow.phases.release.reviewers).toEqual([]);
    });

    it('should generate config that matches FaberConfig type', () => {
      const config = ConfigInitializer.generateDefaultConfig();

      // Type assertion - if this compiles, the type is correct
      const typedConfig: FaberConfig = config;
      expect(typedConfig).toBeDefined();
    });
  });

  describe('writeConfig', () => {
    it('should write config file in YAML format', () => {
      const config = ConfigInitializer.generateDefaultConfig();
      ConfigInitializer.writeConfig(config, yamlConfigPath);

      expect(fs.existsSync(yamlConfigPath)).toBe(true);

      const content = fs.readFileSync(yamlConfigPath, 'utf-8');
      expect(content).toContain('schema_version:'); // YAML format
      expect(content).toContain('work:');
      expect(content).toContain('repo:');
      expect(content).toContain('artifacts:');
      expect(content).toContain('workflow:');
    });

    it('should create parent directories if they do not exist', () => {
      const nestedPath = path.join(testDir, 'nested', 'deep', 'config.yaml');
      const config = ConfigInitializer.generateDefaultConfig();

      ConfigInitializer.writeConfig(config, nestedPath);

      expect(fs.existsSync(nestedPath)).toBe(true);
    });

    it('should write valid YAML that can be parsed back', () => {
      const config = ConfigInitializer.generateDefaultConfig();
      ConfigInitializer.writeConfig(config, yamlConfigPath);

      const content = fs.readFileSync(yamlConfigPath, 'utf-8');
      const parsedConfig = yaml.load(content) as FaberConfig;

      expect(parsedConfig).toEqual(config);
    });

    it('should overwrite existing config file', () => {
      const config1 = ConfigInitializer.generateDefaultConfig();
      config1.repo.owner = 'owner1';
      ConfigInitializer.writeConfig(config1, yamlConfigPath);

      const config2 = ConfigInitializer.generateDefaultConfig();
      config2.repo.owner = 'owner2';
      ConfigInitializer.writeConfig(config2, yamlConfigPath);

      const content = fs.readFileSync(yamlConfigPath, 'utf-8');
      const parsedConfig = yaml.load(content) as FaberConfig;

      expect(parsedConfig.repo.owner).toBe('owner2');
    });

    it('should use default path when no path is provided', () => {
      // Mock process.cwd() to return testDir
      const originalCwd = process.cwd;
      process.cwd = jest.fn(() => testDir);

      const config = ConfigInitializer.generateDefaultConfig();
      ConfigInitializer.writeConfig(config);

      const expectedPath = path.join(testDir, '.fractary', 'faber', 'config.yaml');
      expect(fs.existsSync(expectedPath)).toBe(true);

      // Restore original cwd
      process.cwd = originalCwd;
    });
  });

  describe('configExists', () => {
    it('should return true when YAML config exists', () => {
      const config = ConfigInitializer.generateDefaultConfig();
      ConfigInitializer.writeConfig(config, yamlConfigPath);

      expect(ConfigInitializer.configExists(yamlConfigPath)).toBe(true);
    });

    it('should return true when JSON config exists (legacy)', () => {
      const config = ConfigInitializer.generateDefaultConfig();
      fs.writeFileSync(jsonConfigPath, JSON.stringify(config, null, 2), 'utf-8');

      expect(ConfigInitializer.configExists(yamlConfigPath)).toBe(true); // Checks both .yaml and .json
    });

    it('should return false when config does not exist', () => {
      expect(ConfigInitializer.configExists(yamlConfigPath)).toBe(false);
    });

    it('should check default path when no path is provided', () => {
      // Mock process.cwd() to return testDir
      const originalCwd = process.cwd;
      process.cwd = jest.fn(() => testDir);

      expect(ConfigInitializer.configExists()).toBe(false);

      const config = ConfigInitializer.generateDefaultConfig();
      ConfigInitializer.writeConfig(config);

      expect(ConfigInitializer.configExists()).toBe(true);

      // Restore original cwd
      process.cwd = originalCwd;
    });
  });

  describe('readConfig', () => {
    it('should read YAML config correctly', () => {
      const config = ConfigInitializer.generateDefaultConfig();
      config.repo.owner = 'test-owner';
      ConfigInitializer.writeConfig(config, yamlConfigPath);

      const readConfig = ConfigInitializer.readConfig(yamlConfigPath);

      expect(readConfig).toEqual(config);
    });

    it('should read JSON config correctly (legacy)', () => {
      const config = ConfigInitializer.generateDefaultConfig();
      config.repo.owner = 'test-owner';
      fs.writeFileSync(jsonConfigPath, JSON.stringify(config, null, 2), 'utf-8');

      const readConfig = ConfigInitializer.readConfig(yamlConfigPath); // Checks .yaml first, then .json

      expect(readConfig).toEqual(config);
    });

    it('should return null when config does not exist', () => {
      const readConfig = ConfigInitializer.readConfig(yamlConfigPath);

      expect(readConfig).toBeNull();
    });

    it('should prefer YAML over JSON when both exist', () => {
      const yamlConfig = ConfigInitializer.generateDefaultConfig();
      yamlConfig.repo.owner = 'yaml-owner';
      ConfigInitializer.writeConfig(yamlConfig, yamlConfigPath);

      const jsonConfig = ConfigInitializer.generateDefaultConfig();
      jsonConfig.repo.owner = 'json-owner';
      fs.writeFileSync(jsonConfigPath, JSON.stringify(jsonConfig, null, 2), 'utf-8');

      const readConfig = ConfigInitializer.readConfig(yamlConfigPath);

      expect(readConfig?.repo.owner).toBe('yaml-owner');
    });

    it('should throw error when YAML is malformed', () => {
      fs.writeFileSync(yamlConfigPath, 'invalid: yaml: content: [', 'utf-8');

      expect(() => ConfigInitializer.readConfig(yamlConfigPath)).toThrow(/Failed to parse YAML/);
    });

    it('should throw error when JSON is malformed', () => {
      fs.writeFileSync(jsonConfigPath, '{ invalid json }', 'utf-8');

      expect(() => ConfigInitializer.readConfig(yamlConfigPath)).toThrow(/Failed to parse JSON/);
    });
  });

  describe('initializeProject', () => {
    it('should create config file and return path', () => {
      // Mock process.cwd() to return testDir
      const originalCwd = process.cwd;
      process.cwd = jest.fn(() => testDir);

      const configPath = ConfigInitializer.initializeProject();

      expect(fs.existsSync(configPath)).toBe(true);
      expect(configPath).toBe(path.join(testDir, '.fractary', 'faber', 'config.yaml'));

      // Restore original cwd
      process.cwd = originalCwd;
    });

    it('should apply repoOwner override', () => {
      // Mock process.cwd() to return testDir
      const originalCwd = process.cwd;
      process.cwd = jest.fn(() => testDir);

      const configPath = ConfigInitializer.initializeProject(undefined, {
        repoOwner: 'custom-owner',
      });

      const config = ConfigInitializer.readConfig(configPath);
      expect(config?.repo.owner).toBe('custom-owner');

      // Restore original cwd
      process.cwd = originalCwd;
    });

    it('should apply repoName override', () => {
      // Mock process.cwd() to return testDir
      const originalCwd = process.cwd;
      process.cwd = jest.fn(() => testDir);

      const configPath = ConfigInitializer.initializeProject(undefined, {
        repoName: 'custom-repo',
      });

      const config = ConfigInitializer.readConfig(configPath);
      expect(config?.repo.repo).toBe('custom-repo');

      // Restore original cwd
      process.cwd = originalCwd;
    });

    it('should apply workPlatform override', () => {
      // Mock process.cwd() to return testDir
      const originalCwd = process.cwd;
      process.cwd = jest.fn(() => testDir);

      const configPath = ConfigInitializer.initializeProject(undefined, {
        workPlatform: 'jira',
      });

      const config = ConfigInitializer.readConfig(configPath);
      expect(config?.work.platform).toBe('jira');

      // Restore original cwd
      process.cwd = originalCwd;
    });

    it('should apply repoPlatform override', () => {
      // Mock process.cwd() to return testDir
      const originalCwd = process.cwd;
      process.cwd = jest.fn(() => testDir);

      const configPath = ConfigInitializer.initializeProject(undefined, {
        repoPlatform: 'gitlab',
      });

      const config = ConfigInitializer.readConfig(configPath);
      expect(config?.repo.platform).toBe('gitlab');

      // Restore original cwd
      process.cwd = originalCwd;
    });

    it('should apply multiple overrides simultaneously', () => {
      // Mock process.cwd() to return testDir
      const originalCwd = process.cwd;
      process.cwd = jest.fn(() => testDir);

      const configPath = ConfigInitializer.initializeProject(undefined, {
        repoOwner: 'test-org',
        repoName: 'test-repo',
        workPlatform: 'linear',
        repoPlatform: 'bitbucket',
      });

      const config = ConfigInitializer.readConfig(configPath);
      expect(config?.repo.owner).toBe('test-org');
      expect(config?.repo.repo).toBe('test-repo');
      expect(config?.work.platform).toBe('linear');
      expect(config?.repo.platform).toBe('bitbucket');

      // Restore original cwd
      process.cwd = originalCwd;
    });

    it('should use custom projectRoot when provided', () => {
      const customRoot = path.join(testDir, 'custom-project');
      fs.mkdirSync(customRoot, { recursive: true });

      const configPath = ConfigInitializer.initializeProject(customRoot);

      expect(fs.existsSync(configPath)).toBe(true);
      expect(configPath).toBe(path.join(customRoot, '.fractary', 'faber', 'config.yaml'));
    });
  });

  describe('Migration', () => {
    it('should migrate YAML config from old to new location', () => {
      const oldPath = path.join(testDir, '.fractary', 'plugins', 'faber', 'config.yaml');
      const config = ConfigInitializer.generateDefaultConfig();
      config.repo.owner = 'test-owner';
      ConfigInitializer.writeConfig(config, oldPath);

      const result = ConfigInitializer.migrateConfig(testDir);

      expect(result.migrated).toBe(true);
      expect(result.oldPath).toBe(oldPath);
      expect(result.newPath).toContain('.fractary/faber/config.yaml');
      expect(fs.existsSync(oldPath)).toBe(false);
      expect(fs.existsSync(result.newPath!)).toBe(true);

      const newConfig = ConfigInitializer.readConfig(result.newPath!);
      expect(newConfig?.repo.owner).toBe('test-owner');
    });

    it('should migrate JSON config to YAML format', () => {
      const oldPath = path.join(testDir, '.fractary', 'plugins', 'faber', 'config.json');
      fs.mkdirSync(path.dirname(oldPath), { recursive: true });
      const config = ConfigInitializer.generateDefaultConfig();
      fs.writeFileSync(oldPath, JSON.stringify(config, null, 2), 'utf-8');

      const result = ConfigInitializer.migrateConfig(testDir);

      expect(result.migrated).toBe(true);
      expect(result.newPath).toContain('.yaml');

      const content = fs.readFileSync(result.newPath!, 'utf-8');
      expect(content).toContain('schema_version:');
    });

    it('should not migrate if old config does not exist', () => {
      const result = ConfigInitializer.migrateConfig(testDir);
      expect(result.migrated).toBe(false);
      expect(result.error).toBeUndefined();
    });

    it('should error if both configs exist', () => {
      const oldPath = path.join(testDir, '.fractary', 'plugins', 'faber', 'config.yaml');
      const newPath = path.join(testDir, '.fractary', 'faber', 'config.yaml');
      const config = ConfigInitializer.generateDefaultConfig();
      ConfigInitializer.writeConfig(config, oldPath);
      ConfigInitializer.writeConfig(config, newPath);

      const result = ConfigInitializer.migrateConfig(testDir);

      expect(result.migrated).toBe(false);
      expect(result.error).toContain('both old and new locations');
    });
  });

  describe('initializeProject with migration', () => {
    it('should auto-migrate old config on init', () => {
      const oldPath = path.join(testDir, '.fractary', 'plugins', 'faber', 'config.yaml');
      const config = ConfigInitializer.generateDefaultConfig();
      config.repo.owner = 'migrated-owner';
      ConfigInitializer.writeConfig(config, oldPath);

      const resultPath = ConfigInitializer.initializeProject(testDir);

      expect(resultPath).toContain('.fractary/faber/config.yaml');
      expect(fs.existsSync(oldPath)).toBe(false);

      const newConfig = ConfigInitializer.readConfig(resultPath);
      expect(newConfig?.repo.owner).toBe('migrated-owner');
    });
  });
});
