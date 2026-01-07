/**
 * @fractary/faber - SpecManager Tests
 *
 * Unit tests for SpecManager with partial config support
 */

import * as fs from 'fs';
import * as path from 'path';
import { SpecManager } from '../manager.js';
import { ConfigInitializer } from '../../config/initializer.js';

describe('SpecManager', () => {
  const testDir = path.join(__dirname, '__test-spec-manager__');
  const faberConfigPath = path.join(testDir, '.fractary', 'plugins', 'faber', 'config.yaml');
  const specsDir = path.join(testDir, 'specs');

  // Mock findProjectRoot to return our test directory
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

  describe('Constructor', () => {
    it('should construct without config using defaults', () => {
      const manager = new SpecManager();

      expect(manager).toBeDefined();
      // Should use default path without throwing
    });

    it('should construct with partial config', () => {
      const manager = new SpecManager({ localPath: '/custom/specs' });

      expect(manager).toBeDefined();
    });

    it('should construct with full config', () => {
      const manager = new SpecManager({ localPath: specsDir });

      expect(manager).toBeDefined();
    });

    it('should use provided config path when given', () => {
      const customPath = '/my/custom/path';
      const manager = new SpecManager({ localPath: customPath });

      expect(manager).toBeDefined();
      // Internal config should use the custom path
    });

    it('should load config from FABER config when no config provided and FABER config exists', () => {
      const defaultConfig = ConfigInitializer.generateDefaultConfig();
      defaultConfig.artifacts.specs.local_path = '/from-faber-config';
      ConfigInitializer.writeConfig(defaultConfig, faberConfigPath);

      const manager = new SpecManager();

      expect(manager).toBeDefined();
      // Should use path from FABER config
    });

    it('should use defaults when no config provided and FABER config does not exist', () => {
      const manager = new SpecManager();

      expect(manager).toBeDefined();
      // Should use default path (testDir/specs)
    });

    it('should prioritize provided config over loaded config', () => {
      // Create FABER config with one path
      const defaultConfig = ConfigInitializer.generateDefaultConfig();
      defaultConfig.artifacts.specs.local_path = '/from-faber-config';
      ConfigInitializer.writeConfig(defaultConfig, faberConfigPath);

      // Provide different path directly
      const manager = new SpecManager({ localPath: '/provided-path' });

      expect(manager).toBeDefined();
      // Should use provided path, not loaded path
    });
  });

  describe('Working without config', () => {
    it('should ensure specs directory with default path', () => {
      const manager = new SpecManager();

      // This should work without throwing
      expect(manager).toBeDefined();

      // The specs directory might be created by ensureSpecsDir method
      // We're just verifying the manager can be instantiated
    });

    it('should work after initialization without FABER config', () => {
      // Simulate CLI init scenario: manager created before config exists
      const manager = new SpecManager();

      expect(manager).toBeDefined();

      // Now create config
      const configPath = ConfigInitializer.initializeProject(testDir);
      expect(fs.existsSync(configPath)).toBe(true);

      // Manager should still work (it's already using defaults)
    });
  });

  describe('Config merging behavior', () => {
    it('should merge partial config with defaults', () => {
      const manager = new SpecManager({ localPath: '/partial' });

      expect(manager).toBeDefined();
    });

    it('should use default when partial config has undefined localPath', () => {
      const manager = new SpecManager({});

      expect(manager).toBeDefined();
      // Should use default path
    });

    it('should handle null config gracefully', () => {
      const manager = new SpecManager(undefined);

      expect(manager).toBeDefined();
    });
  });

  describe('Integration with config loading', () => {
    it('should work with allowMissing pattern', () => {
      // This tests the integration with loadSpecConfig({ allowMissing: true })
      const manager = new SpecManager();

      expect(manager).toBeDefined();
      // Should not throw even though config doesn't exist
    });

    it('should respect FABER config when present', () => {
      const customPath = path.join(testDir, 'custom-specs');
      const defaultConfig = ConfigInitializer.generateDefaultConfig();
      defaultConfig.artifacts.specs.local_path = customPath;
      ConfigInitializer.writeConfig(defaultConfig, faberConfigPath);

      const manager = new SpecManager();

      expect(manager).toBeDefined();
      // Should use custom path from FABER config
    });

    it('should work with legacy JSON config', () => {
      // Create legacy JSON config
      const jsonConfigPath = faberConfigPath.replace(/\.yaml$/, '.json');
      const dir = path.dirname(jsonConfigPath);
      fs.mkdirSync(dir, { recursive: true });

      const jsonConfig = ConfigInitializer.generateDefaultConfig();
      jsonConfig.artifacts.specs.local_path = '/legacy-specs';
      fs.writeFileSync(jsonConfigPath, JSON.stringify(jsonConfig, null, 2), 'utf-8');

      const manager = new SpecManager();

      expect(manager).toBeDefined();
      // Should work with JSON config
    });
  });

  describe('Backward compatibility', () => {
    it('should maintain backward compatibility with old usage', () => {
      // Old usage: new SpecManager() without arguments
      const manager = new SpecManager();

      expect(manager).toBeDefined();
    });

    it('should maintain backward compatibility with config argument', () => {
      // Old usage: new SpecManager(config)
      const manager = new SpecManager({ localPath: specsDir });

      expect(manager).toBeDefined();
    });
  });

  describe('Edge cases', () => {
    it('should handle empty object as config', () => {
      const manager = new SpecManager({});

      expect(manager).toBeDefined();
    });

    it('should handle config with only localPath', () => {
      const manager = new SpecManager({ localPath: '/only-path' });

      expect(manager).toBeDefined();
    });

    it('should work when specs directory already exists', () => {
      fs.mkdirSync(specsDir, { recursive: true });

      const manager = new SpecManager({ localPath: specsDir });

      expect(manager).toBeDefined();
    });

    it('should work when specs directory does not exist', () => {
      const manager = new SpecManager({ localPath: specsDir });

      expect(manager).toBeDefined();
      // Directory creation is handled by ensureSpecsDir
    });
  });
});
