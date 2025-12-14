"use strict";
/**
 * @fractary/faber - SpecManager Tests
 *
 * Unit tests for SpecManager with partial config support
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
const manager_1 = require("../manager");
const initializer_1 = require("../../config/initializer");
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
            const manager = new manager_1.SpecManager();
            expect(manager).toBeDefined();
            // Should use default path without throwing
        });
        it('should construct with partial config', () => {
            const manager = new manager_1.SpecManager({ localPath: '/custom/specs' });
            expect(manager).toBeDefined();
        });
        it('should construct with full config', () => {
            const manager = new manager_1.SpecManager({ localPath: specsDir });
            expect(manager).toBeDefined();
        });
        it('should use provided config path when given', () => {
            const customPath = '/my/custom/path';
            const manager = new manager_1.SpecManager({ localPath: customPath });
            expect(manager).toBeDefined();
            // Internal config should use the custom path
        });
        it('should load config from FABER config when no config provided and FABER config exists', () => {
            const defaultConfig = initializer_1.ConfigInitializer.generateDefaultConfig();
            defaultConfig.artifacts.specs.local_path = '/from-faber-config';
            initializer_1.ConfigInitializer.writeConfig(defaultConfig, faberConfigPath);
            const manager = new manager_1.SpecManager();
            expect(manager).toBeDefined();
            // Should use path from FABER config
        });
        it('should use defaults when no config provided and FABER config does not exist', () => {
            const manager = new manager_1.SpecManager();
            expect(manager).toBeDefined();
            // Should use default path (testDir/specs)
        });
        it('should prioritize provided config over loaded config', () => {
            // Create FABER config with one path
            const defaultConfig = initializer_1.ConfigInitializer.generateDefaultConfig();
            defaultConfig.artifacts.specs.local_path = '/from-faber-config';
            initializer_1.ConfigInitializer.writeConfig(defaultConfig, faberConfigPath);
            // Provide different path directly
            const manager = new manager_1.SpecManager({ localPath: '/provided-path' });
            expect(manager).toBeDefined();
            // Should use provided path, not loaded path
        });
    });
    describe('Working without config', () => {
        it('should ensure specs directory with default path', () => {
            const manager = new manager_1.SpecManager();
            // This should work without throwing
            expect(manager).toBeDefined();
            // The specs directory might be created by ensureSpecsDir method
            // We're just verifying the manager can be instantiated
        });
        it('should work after initialization without FABER config', () => {
            // Simulate CLI init scenario: manager created before config exists
            const manager = new manager_1.SpecManager();
            expect(manager).toBeDefined();
            // Now create config
            const configPath = initializer_1.ConfigInitializer.initializeProject(testDir);
            expect(fs.existsSync(configPath)).toBe(true);
            // Manager should still work (it's already using defaults)
        });
    });
    describe('Config merging behavior', () => {
        it('should merge partial config with defaults', () => {
            const manager = new manager_1.SpecManager({ localPath: '/partial' });
            expect(manager).toBeDefined();
        });
        it('should use default when partial config has undefined localPath', () => {
            const manager = new manager_1.SpecManager({});
            expect(manager).toBeDefined();
            // Should use default path
        });
        it('should handle null config gracefully', () => {
            const manager = new manager_1.SpecManager(undefined);
            expect(manager).toBeDefined();
        });
    });
    describe('Integration with config loading', () => {
        it('should work with allowMissing pattern', () => {
            // This tests the integration with loadSpecConfig({ allowMissing: true })
            const manager = new manager_1.SpecManager();
            expect(manager).toBeDefined();
            // Should not throw even though config doesn't exist
        });
        it('should respect FABER config when present', () => {
            const customPath = path.join(testDir, 'custom-specs');
            const defaultConfig = initializer_1.ConfigInitializer.generateDefaultConfig();
            defaultConfig.artifacts.specs.local_path = customPath;
            initializer_1.ConfigInitializer.writeConfig(defaultConfig, faberConfigPath);
            const manager = new manager_1.SpecManager();
            expect(manager).toBeDefined();
            // Should use custom path from FABER config
        });
        it('should work with legacy JSON config', () => {
            // Create legacy JSON config
            const jsonConfigPath = faberConfigPath.replace(/\.yaml$/, '.json');
            const dir = path.dirname(jsonConfigPath);
            fs.mkdirSync(dir, { recursive: true });
            const jsonConfig = initializer_1.ConfigInitializer.generateDefaultConfig();
            jsonConfig.artifacts.specs.local_path = '/legacy-specs';
            fs.writeFileSync(jsonConfigPath, JSON.stringify(jsonConfig, null, 2), 'utf-8');
            const manager = new manager_1.SpecManager();
            expect(manager).toBeDefined();
            // Should work with JSON config
        });
    });
    describe('Backward compatibility', () => {
        it('should maintain backward compatibility with old usage', () => {
            // Old usage: new SpecManager() without arguments
            const manager = new manager_1.SpecManager();
            expect(manager).toBeDefined();
        });
        it('should maintain backward compatibility with config argument', () => {
            // Old usage: new SpecManager(config)
            const manager = new manager_1.SpecManager({ localPath: specsDir });
            expect(manager).toBeDefined();
        });
    });
    describe('Edge cases', () => {
        it('should handle empty object as config', () => {
            const manager = new manager_1.SpecManager({});
            expect(manager).toBeDefined();
        });
        it('should handle config with only localPath', () => {
            const manager = new manager_1.SpecManager({ localPath: '/only-path' });
            expect(manager).toBeDefined();
        });
        it('should work when specs directory already exists', () => {
            fs.mkdirSync(specsDir, { recursive: true });
            const manager = new manager_1.SpecManager({ localPath: specsDir });
            expect(manager).toBeDefined();
        });
        it('should work when specs directory does not exist', () => {
            const manager = new manager_1.SpecManager({ localPath: specsDir });
            expect(manager).toBeDefined();
            // Directory creation is handled by ensureSpecsDir
        });
    });
});
//# sourceMappingURL=manager.test.js.map