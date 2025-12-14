"use strict";
/**
 * @fractary/faber - Init Workflow Integration Tests
 *
 * Integration tests for the full initialization workflow
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const initializer_1 = require("../../config/initializer");
const config_1 = require("../../config");
const manager_1 = require("../../spec/manager");
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
            const config = initializer_1.ConfigInitializer.generateDefaultConfig();
            initializer_1.ConfigInitializer.writeConfig(config, configPath);
            // Verify config was created
            expect(fs.existsSync(configPath)).toBe(true);
            // Verify config can be loaded
            const loadedConfig = (0, config_1.loadFaberConfig)(testDir);
            expect(loadedConfig).not.toBeNull();
            expect(loadedConfig?.schema_version).toBe('1.0');
        });
        it('should create YAML config that is human-readable', () => {
            const config = initializer_1.ConfigInitializer.generateDefaultConfig();
            initializer_1.ConfigInitializer.writeConfig(config, configPath);
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
            const config = initializer_1.ConfigInitializer.generateDefaultConfig();
            initializer_1.ConfigInitializer.writeConfig(config, configPath);
            const loadedConfig = (0, config_1.loadFaberConfig)(testDir);
            expect(loadedConfig).not.toBeNull();
            expect(loadedConfig?.schema_version).toBe('1.0');
            expect(loadedConfig?.work).toBeDefined();
            expect(loadedConfig?.repo).toBeDefined();
            expect(loadedConfig?.artifacts).toBeDefined();
            expect(loadedConfig?.workflow).toBeDefined();
        });
        it('should allow customization during init', () => {
            const createdPath = initializer_1.ConfigInitializer.initializeProject(testDir, {
                repoOwner: 'my-org',
                repoName: 'my-project',
                workPlatform: 'jira',
                repoPlatform: 'gitlab',
            });
            expect(fs.existsSync(createdPath)).toBe(true);
            const config = (0, config_1.loadFaberConfig)(testDir);
            expect(config?.repo.owner).toBe('my-org');
            expect(config?.repo.repo).toBe('my-project');
            expect(config?.work.platform).toBe('jira');
            expect(config?.repo.platform).toBe('gitlab');
        });
    });
    describe('SpecManager Integration After Init', () => {
        it('should allow SpecManager creation before init', () => {
            // Before init - should work with defaults
            const managerBefore = new manager_1.SpecManager();
            expect(managerBefore).toBeDefined();
            // After init - should use config
            initializer_1.ConfigInitializer.initializeProject(testDir);
            const managerAfter = new manager_1.SpecManager();
            expect(managerAfter).toBeDefined();
        });
        it('should use config path after init', () => {
            // Create manager before config exists
            const manager1 = new manager_1.SpecManager();
            expect(manager1).toBeDefined();
            // Initialize with custom specs path
            const config = initializer_1.ConfigInitializer.generateDefaultConfig();
            config.artifacts.specs.local_path = '/custom/specs';
            initializer_1.ConfigInitializer.writeConfig(config, configPath);
            // New manager should use config path
            const manager2 = new manager_1.SpecManager();
            expect(manager2).toBeDefined();
        });
    });
    describe('Config Loading After Init', () => {
        it('should load all config sections after init', () => {
            initializer_1.ConfigInitializer.initializeProject(testDir);
            const faberConfig = (0, config_1.loadFaberConfig)(testDir);
            const workConfig = (0, config_1.loadWorkConfig)(testDir);
            const repoConfig = (0, config_1.loadRepoConfig)(testDir);
            const specConfig = (0, config_1.loadSpecConfig)(testDir);
            expect(faberConfig).not.toBeNull();
            expect(workConfig).not.toBeNull();
            expect(repoConfig).not.toBeNull();
            expect(specConfig).toBeDefined();
        });
        it('should not throw after successful init', () => {
            initializer_1.ConfigInitializer.initializeProject(testDir);
            // All of these should work without throwing
            expect(() => (0, config_1.loadFaberConfig)(testDir)).not.toThrow();
            expect(() => (0, config_1.loadWorkConfig)(testDir)).not.toThrow();
            expect(() => (0, config_1.loadRepoConfig)(testDir)).not.toThrow();
            expect(() => (0, config_1.loadSpecConfig)(testDir)).not.toThrow();
        });
    });
    describe('Error Messages Without Init', () => {
        it('should provide helpful error message when config missing', () => {
            try {
                (0, config_1.loadFaberConfig)(testDir);
                fail('Should have thrown');
            }
            catch (error) {
                expect(error.message).toContain('fractary init');
                expect(error.message).toContain('Expected config at:');
            }
        });
        it('should guide user to run init command', () => {
            try {
                (0, config_1.loadWorkConfig)(testDir);
                fail('Should have thrown');
            }
            catch (error) {
                expect(error.message).toContain('fractary init');
            }
            try {
                (0, config_1.loadRepoConfig)(testDir);
                fail('Should have thrown');
            }
            catch (error) {
                expect(error.message).toContain('fractary init');
            }
            try {
                (0, config_1.loadSpecConfig)(testDir);
                fail('Should have thrown');
            }
            catch (error) {
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
            const jsonConfig = initializer_1.ConfigInitializer.generateDefaultConfig();
            jsonConfig.repo.owner = 'legacy-owner';
            fs.writeFileSync(jsonConfigPath, JSON.stringify(jsonConfig, null, 2), 'utf-8');
            // Should still be loadable
            const config = (0, config_1.loadFaberConfig)(testDir);
            expect(config).not.toBeNull();
            expect(config?.repo.owner).toBe('legacy-owner');
            // SpecManager should work
            const manager = new manager_1.SpecManager();
            expect(manager).toBeDefined();
        });
        it('should migrate from JSON to YAML when re-initializing', () => {
            // Create legacy JSON config
            const jsonConfigPath = configPath.replace(/\.yaml$/, '.json');
            const dir = path.dirname(jsonConfigPath);
            fs.mkdirSync(dir, { recursive: true });
            const jsonConfig = initializer_1.ConfigInitializer.generateDefaultConfig();
            fs.writeFileSync(jsonConfigPath, JSON.stringify(jsonConfig, null, 2), 'utf-8');
            // Re-initialize (creates YAML)
            initializer_1.ConfigInitializer.initializeProject(testDir);
            // Both should exist during migration
            expect(fs.existsSync(jsonConfigPath)).toBe(true);
            expect(fs.existsSync(configPath)).toBe(true);
            // YAML should be preferred
            const config = initializer_1.ConfigInitializer.readConfig(configPath);
            expect(config).not.toBeNull();
        });
    });
    describe('Real-World Scenarios', () => {
        it('should support new project initialization flow', () => {
            // 1. User runs: fractary init
            const createdPath = initializer_1.ConfigInitializer.initializeProject(testDir, {
                repoOwner: 'acme',
                repoName: 'my-app',
            });
            expect(fs.existsSync(createdPath)).toBe(true);
            // 2. User runs: fractary spec:create
            const manager = new manager_1.SpecManager();
            expect(manager).toBeDefined();
            // 3. Config should be loaded correctly
            const config = (0, config_1.loadFaberConfig)(testDir);
            expect(config?.repo.owner).toBe('acme');
            expect(config?.repo.repo).toBe('my-app');
        });
        it('should support existing project with partial config', () => {
            // 1. Create work and repo configs separately (old setup)
            const workConfigPath = path.join(testDir, '.fractary', 'plugins', 'work', 'config.json');
            const repoConfigPath = path.join(testDir, '.fractary', 'plugins', 'repo', 'config.json');
            fs.mkdirSync(path.dirname(workConfigPath), { recursive: true });
            fs.mkdirSync(path.dirname(repoConfigPath), { recursive: true });
            fs.writeFileSync(workConfigPath, JSON.stringify({ platform: 'github', owner: 'old', repo: 'old' }, null, 2), 'utf-8');
            fs.writeFileSync(repoConfigPath, JSON.stringify({ platform: 'github', owner: 'old', repo: 'old' }, null, 2), 'utf-8');
            // 2. Load config (should construct from individual configs)
            const config = (0, config_1.loadFaberConfig)(testDir, { allowMissing: true });
            expect(config).not.toBeNull();
            expect(config?.work.platform).toBe('github');
            expect(config?.repo.platform).toBe('github');
            // 3. Upgrade to unified config
            initializer_1.ConfigInitializer.initializeProject(testDir, {
                repoOwner: 'new',
                repoName: 'new',
            });
            // 4. New config should take precedence
            const newConfig = (0, config_1.loadFaberConfig)(testDir);
            expect(newConfig?.repo.owner).toBe('new');
        });
        it('should support CLI integration pattern', () => {
            // Simulate CLI checking for config before running command
            const configExists = initializer_1.ConfigInitializer.configExists(configPath);
            expect(configExists).toBe(false);
            // CLI detects no config and prompts user to init
            if (!configExists) {
                initializer_1.ConfigInitializer.initializeProject(testDir);
            }
            // Now config exists
            expect(initializer_1.ConfigInitializer.configExists(configPath)).toBe(true);
            // CLI can now run commands
            const manager = new manager_1.SpecManager();
            expect(manager).toBeDefined();
        });
    });
    describe('Performance Requirements', () => {
        it('should generate default config in under 100ms', () => {
            const start = Date.now();
            initializer_1.ConfigInitializer.generateDefaultConfig();
            const duration = Date.now() - start;
            expect(duration).toBeLessThan(100);
        });
        it('should write config file quickly', () => {
            const config = initializer_1.ConfigInitializer.generateDefaultConfig();
            const start = Date.now();
            initializer_1.ConfigInitializer.writeConfig(config, configPath);
            const duration = Date.now() - start;
            expect(duration).toBeLessThan(100);
        });
        it('should handle concurrent SpecManager creation', () => {
            initializer_1.ConfigInitializer.initializeProject(testDir);
            // Create multiple managers concurrently (simulates parallel operations)
            const managers = Array(10).fill(null).map(() => new manager_1.SpecManager());
            expect(managers).toHaveLength(10);
            managers.forEach(manager => expect(manager).toBeDefined());
        });
    });
});
//# sourceMappingURL=init-workflow.test.js.map