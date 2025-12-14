"use strict";
/**
 * @fractary/faber - Configuration Loading Tests
 *
 * Unit tests for config loading functions with allowMissing option
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
const config_1 = require("../config");
const initializer_1 = require("../config/initializer");
const errors_1 = require("../errors");
describe('Config Loading Functions', () => {
    const testDir = path.join(__dirname, '__test-config-loading__');
    const faberConfigPath = path.join(testDir, '.fractary', 'plugins', 'faber', 'config.yaml');
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
            expect(() => (0, config_1.loadFaberConfig)(testDir)).toThrow(errors_1.ConfigValidationError);
            expect(() => (0, config_1.loadFaberConfig)(testDir)).toThrow(/fractary init/);
        });
        it('should throw when config is missing and allowMissing is false', () => {
            expect(() => (0, config_1.loadFaberConfig)(testDir, { allowMissing: false })).toThrow(errors_1.ConfigValidationError);
        });
        it('should return null when config is missing and allowMissing is true', () => {
            const config = (0, config_1.loadFaberConfig)(testDir, { allowMissing: true });
            expect(config).toBeNull();
        });
        it('should return config when it exists', () => {
            const defaultConfig = initializer_1.ConfigInitializer.generateDefaultConfig();
            initializer_1.ConfigInitializer.writeConfig(defaultConfig, faberConfigPath);
            const config = (0, config_1.loadFaberConfig)(testDir);
            expect(config).not.toBeNull();
            expect(config?.schema_version).toBe('1.0');
        });
        it('should return config when allowMissing is true and config exists', () => {
            const defaultConfig = initializer_1.ConfigInitializer.generateDefaultConfig();
            initializer_1.ConfigInitializer.writeConfig(defaultConfig, faberConfigPath);
            const config = (0, config_1.loadFaberConfig)(testDir, { allowMissing: true });
            expect(config).not.toBeNull();
            expect(config?.schema_version).toBe('1.0');
        });
        it('should construct config from individual plugin configs when FABER config missing', () => {
            // Create work and repo configs separately
            const workDir = path.dirname(workConfigPath);
            const repoDir = path.dirname(repoConfigPath);
            fs.mkdirSync(workDir, { recursive: true });
            fs.mkdirSync(repoDir, { recursive: true });
            fs.writeFileSync(workConfigPath, JSON.stringify({ platform: 'github' }, null, 2), 'utf-8');
            fs.writeFileSync(repoConfigPath, JSON.stringify({ platform: 'github', owner: 'test', repo: 'test' }, null, 2), 'utf-8');
            const config = (0, config_1.loadFaberConfig)(testDir, { allowMissing: true });
            expect(config).not.toBeNull();
            expect(config?.work.platform).toBe('github');
            expect(config?.repo.platform).toBe('github');
        });
        it('should include helpful error message with expected path', () => {
            try {
                (0, config_1.loadFaberConfig)(testDir);
                fail('Should have thrown');
            }
            catch (error) {
                if (error instanceof errors_1.ConfigValidationError) {
                    expect(error.message).toContain('Expected config at:');
                    expect(error.message).toContain('.fractary/plugins/faber');
                }
                else {
                    fail('Wrong error type');
                }
            }
        });
    });
    describe('loadWorkConfig', () => {
        it('should throw when config is missing and allowMissing is not set', () => {
            expect(() => (0, config_1.loadWorkConfig)(testDir)).toThrow(errors_1.ConfigValidationError);
            expect(() => (0, config_1.loadWorkConfig)(testDir)).toThrow(/fractary init/);
        });
        it('should throw when config is missing and allowMissing is false', () => {
            expect(() => (0, config_1.loadWorkConfig)(testDir, { allowMissing: false })).toThrow(errors_1.ConfigValidationError);
        });
        it('should return null when config is missing and allowMissing is true', () => {
            const config = (0, config_1.loadWorkConfig)(testDir, { allowMissing: true });
            expect(config).toBeNull();
        });
        it('should return config when it exists', () => {
            const workDir = path.dirname(workConfigPath);
            fs.mkdirSync(workDir, { recursive: true });
            fs.writeFileSync(workConfigPath, JSON.stringify({ platform: 'github', owner: 'test', repo: 'test' }, null, 2), 'utf-8');
            const config = (0, config_1.loadWorkConfig)(testDir);
            expect(config).not.toBeNull();
            expect(config?.platform).toBe('github');
        });
        it('should handle handlers structure from plugins', () => {
            const workDir = path.dirname(workConfigPath);
            fs.mkdirSync(workDir, { recursive: true });
            fs.writeFileSync(workConfigPath, JSON.stringify({
                handlers: {
                    github: {
                        platform: 'github',
                        owner: 'test',
                        repo: 'test',
                    },
                },
            }, null, 2), 'utf-8');
            const config = (0, config_1.loadWorkConfig)(testDir);
            expect(config).not.toBeNull();
            expect(config?.platform).toBe('github');
            expect(config?.owner).toBe('test');
        });
    });
    describe('loadRepoConfig', () => {
        it('should throw when config is missing and allowMissing is not set', () => {
            expect(() => (0, config_1.loadRepoConfig)(testDir)).toThrow(errors_1.ConfigValidationError);
            expect(() => (0, config_1.loadRepoConfig)(testDir)).toThrow(/fractary init/);
        });
        it('should throw when config is missing and allowMissing is false', () => {
            expect(() => (0, config_1.loadRepoConfig)(testDir, { allowMissing: false })).toThrow(errors_1.ConfigValidationError);
        });
        it('should return null when config is missing and allowMissing is true', () => {
            const config = (0, config_1.loadRepoConfig)(testDir, { allowMissing: true });
            expect(config).toBeNull();
        });
        it('should return config when it exists', () => {
            const repoDir = path.dirname(repoConfigPath);
            fs.mkdirSync(repoDir, { recursive: true });
            fs.writeFileSync(repoConfigPath, JSON.stringify({
                platform: 'github',
                owner: 'test',
                repo: 'test',
                defaultBranch: 'main',
            }, null, 2), 'utf-8');
            const config = (0, config_1.loadRepoConfig)(testDir);
            expect(config).not.toBeNull();
            expect(config?.platform).toBe('github');
            expect(config?.defaultBranch).toBe('main');
        });
        it('should handle handlers structure from plugins', () => {
            const repoDir = path.dirname(repoConfigPath);
            fs.mkdirSync(repoDir, { recursive: true });
            fs.writeFileSync(repoConfigPath, JSON.stringify({
                handlers: {
                    github: {
                        platform: 'github',
                        owner: 'test',
                        repo: 'test',
                    },
                },
            }, null, 2), 'utf-8');
            const config = (0, config_1.loadRepoConfig)(testDir);
            expect(config).not.toBeNull();
            expect(config?.platform).toBe('github');
            expect(config?.owner).toBe('test');
        });
    });
    describe('loadSpecConfig', () => {
        it('should throw when config is missing and allowMissing is not set', () => {
            expect(() => (0, config_1.loadSpecConfig)(testDir)).toThrow(errors_1.ConfigValidationError);
            expect(() => (0, config_1.loadSpecConfig)(testDir)).toThrow(/fractary init/);
        });
        it('should throw when config is missing and allowMissing is false', () => {
            expect(() => (0, config_1.loadSpecConfig)(testDir, { allowMissing: false })).toThrow(errors_1.ConfigValidationError);
        });
        it('should return default config when FABER config is missing and allowMissing is true', () => {
            const config = (0, config_1.loadSpecConfig)(testDir, { allowMissing: true });
            expect(config).not.toBeNull();
            expect(config.localPath).toBe(path.join(testDir, 'specs'));
        });
        it('should return spec config from FABER config when it exists', () => {
            const defaultConfig = initializer_1.ConfigInitializer.generateDefaultConfig();
            defaultConfig.artifacts.specs.local_path = '/custom/specs';
            initializer_1.ConfigInitializer.writeConfig(defaultConfig, faberConfigPath);
            const config = (0, config_1.loadSpecConfig)(testDir);
            expect(config.localPath).toBe('/custom/specs');
        });
        it('should return default config when allowMissing is true and FABER config exists but has no specs config', () => {
            const defaultConfig = initializer_1.ConfigInitializer.generateDefaultConfig();
            delete defaultConfig.artifacts.specs;
            initializer_1.ConfigInitializer.writeConfig(defaultConfig, faberConfigPath);
            const config = (0, config_1.loadSpecConfig)(testDir, { allowMissing: true });
            expect(config.localPath).toBe(path.join(testDir, 'specs'));
        });
    });
    describe('loadLogConfig', () => {
        it('should return default config when FABER config is missing', () => {
            const config = (0, config_1.loadLogConfig)(testDir);
            expect(config).not.toBeNull();
            expect(config.localPath).toBe(path.join(testDir, '.fractary', 'logs'));
        });
        it('should return log config from FABER config when it exists', () => {
            const defaultConfig = initializer_1.ConfigInitializer.generateDefaultConfig();
            defaultConfig.artifacts.logs.local_path = '/custom/logs';
            initializer_1.ConfigInitializer.writeConfig(defaultConfig, faberConfigPath);
            const config = (0, config_1.loadLogConfig)(testDir);
            expect(config.localPath).toBe('/custom/logs');
        });
        it('should return default config when FABER config exists but has no logs config', () => {
            const defaultConfig = initializer_1.ConfigInitializer.generateDefaultConfig();
            delete defaultConfig.artifacts.logs;
            initializer_1.ConfigInitializer.writeConfig(defaultConfig, faberConfigPath);
            const config = (0, config_1.loadLogConfig)(testDir);
            expect(config.localPath).toBe(path.join(testDir, '.fractary', 'logs'));
        });
    });
    describe('loadStateConfig', () => {
        it('should return default config when FABER config is missing', () => {
            const config = (0, config_1.loadStateConfig)(testDir);
            expect(config).not.toBeNull();
            expect(config.localPath).toBe(path.join(testDir, '.faber', 'state'));
        });
        it('should return state config from FABER config when it exists', () => {
            const defaultConfig = initializer_1.ConfigInitializer.generateDefaultConfig();
            defaultConfig.artifacts.state.local_path = '/custom/state';
            initializer_1.ConfigInitializer.writeConfig(defaultConfig, faberConfigPath);
            const config = (0, config_1.loadStateConfig)(testDir);
            expect(config.localPath).toBe('/custom/state');
        });
        it('should return default config when FABER config exists but has no state config', () => {
            const defaultConfig = initializer_1.ConfigInitializer.generateDefaultConfig();
            delete defaultConfig.artifacts.state;
            initializer_1.ConfigInitializer.writeConfig(defaultConfig, faberConfigPath);
            const config = (0, config_1.loadStateConfig)(testDir);
            expect(config.localPath).toBe(path.join(testDir, '.faber', 'state'));
        });
    });
    describe('Backward Compatibility', () => {
        it('should read existing JSON configs during migration period', () => {
            // Create legacy JSON config
            const jsonConfigPath = faberConfigPath.replace(/\.yaml$/, '.json');
            const dir = path.dirname(jsonConfigPath);
            fs.mkdirSync(dir, { recursive: true });
            const jsonConfig = initializer_1.ConfigInitializer.generateDefaultConfig();
            jsonConfig.repo.owner = 'json-owner';
            fs.writeFileSync(jsonConfigPath, JSON.stringify(jsonConfig, null, 2), 'utf-8');
            const config = (0, config_1.loadFaberConfig)(testDir);
            expect(config).not.toBeNull();
            expect(config?.repo.owner).toBe('json-owner');
        });
        it('should prefer YAML over JSON when both exist', () => {
            const yamlConfig = initializer_1.ConfigInitializer.generateDefaultConfig();
            yamlConfig.repo.owner = 'yaml-owner';
            initializer_1.ConfigInitializer.writeConfig(yamlConfig, faberConfigPath);
            const jsonConfigPath = faberConfigPath.replace(/\.yaml$/, '.json');
            const jsonConfig = initializer_1.ConfigInitializer.generateDefaultConfig();
            jsonConfig.repo.owner = 'json-owner';
            fs.writeFileSync(jsonConfigPath, JSON.stringify(jsonConfig, null, 2), 'utf-8');
            const config = (0, config_1.loadFaberConfig)(testDir);
            expect(config?.repo.owner).toBe('yaml-owner');
        });
    });
});
//# sourceMappingURL=config.test.js.map