"use strict";
/**
 * @fractary/faber - Configuration Initializer
 *
 * Provides utilities for initializing FABER configuration with sensible defaults.
 * Replaces the old initFaberConfig() and writeConfig() functions with a cleaner API.
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
exports.ConfigInitializer = void 0;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const yaml = __importStar(require("js-yaml"));
/**
 * ConfigInitializer class for generating and managing FABER configuration
 */
class ConfigInitializer {
    /**
     * Default configuration file name (YAML format)
     */
    static CONFIG_FILENAME = 'config.yaml';
    /**
     * Default configuration path relative to project root
     */
    static DEFAULT_CONFIG_PATH = '.fractary/plugins/faber';
    /**
     * Generate a complete FaberConfig with sensible defaults
     *
     * @returns Complete FaberConfig object with all sections populated
     */
    static generateDefaultConfig() {
        return {
            schema_version: '1.0',
            work: {
                platform: 'github',
            },
            repo: {
                platform: 'github',
                owner: '',
                repo: '',
                defaultBranch: 'main',
            },
            artifacts: {
                specs: {
                    use_codex: false,
                    local_path: '/specs',
                },
                logs: {
                    use_codex: false,
                    local_path: '.fractary/logs',
                },
                state: {
                    use_codex: false,
                    local_path: '.fractary/plugins/faber',
                },
            },
            workflow: {
                autonomy: 'guarded',
                phases: {
                    frame: {
                        enabled: true,
                    },
                    architect: {
                        enabled: true,
                        refineSpec: true,
                    },
                    build: {
                        enabled: true,
                    },
                    evaluate: {
                        enabled: true,
                        maxRetries: 3,
                    },
                    release: {
                        enabled: true,
                        requestReviews: false,
                        reviewers: [],
                    },
                },
            },
        };
    }
    /**
     * Write configuration to a YAML file
     *
     * @param config - FaberConfig object to write
     * @param configPath - Optional custom path (defaults to .fractary/plugins/faber/config.yaml)
     */
    static writeConfig(config, configPath) {
        const fullPath = configPath || this.getDefaultConfigPath();
        // Ensure parent directory exists
        const dir = path.dirname(fullPath);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
        // Serialize to YAML
        const yamlContent = yaml.dump(config, {
            indent: 2,
            lineWidth: 120,
            noRefs: true,
            sortKeys: false,
        });
        // Write file
        fs.writeFileSync(fullPath, yamlContent, 'utf-8');
    }
    /**
     * Check if configuration file exists
     *
     * @param configPath - Optional custom path to check
     * @returns true if config exists, false otherwise
     */
    static configExists(configPath) {
        const fullPath = configPath || this.getDefaultConfigPath();
        // Check both YAML (preferred) and JSON (legacy) formats
        if (fs.existsSync(fullPath)) {
            return true;
        }
        // Check legacy JSON format
        const jsonPath = fullPath.replace(/\.yaml$/, '.json');
        if (fs.existsSync(jsonPath)) {
            return true;
        }
        return false;
    }
    /**
     * Read configuration from file (supports both YAML and JSON)
     *
     * @param configPath - Optional custom path to read from
     * @returns FaberConfig object or null if file doesn't exist
     */
    static readConfig(configPath) {
        const fullPath = configPath || this.getDefaultConfigPath();
        // Try YAML first (preferred format)
        if (fs.existsSync(fullPath)) {
            try {
                const content = fs.readFileSync(fullPath, 'utf-8');
                const config = yaml.load(content);
                return config;
            }
            catch (error) {
                throw new Error(`Failed to parse YAML config at ${fullPath}: ${error}`);
            }
        }
        // Try legacy JSON format
        const jsonPath = fullPath.replace(/\.yaml$/, '.json');
        if (fs.existsSync(jsonPath)) {
            try {
                const content = fs.readFileSync(jsonPath, 'utf-8');
                const config = JSON.parse(content);
                return config;
            }
            catch (error) {
                throw new Error(`Failed to parse JSON config at ${jsonPath}: ${error}`);
            }
        }
        return null;
    }
    /**
     * Get the default configuration file path
     *
     * @param projectRoot - Optional project root directory
     * @returns Full path to default config file
     */
    static getDefaultConfigPath(projectRoot) {
        const root = projectRoot || process.cwd();
        return path.join(root, this.DEFAULT_CONFIG_PATH, this.CONFIG_FILENAME);
    }
    /**
     * Initialize a new FABER project with default configuration
     *
     * @param projectRoot - Optional project root directory
     * @param options - Optional configuration overrides
     * @returns Path to the created configuration file
     */
    static initializeProject(projectRoot, options) {
        const config = this.generateDefaultConfig();
        // Apply optional overrides
        if (options) {
            if (options.repoOwner) {
                config.repo.owner = options.repoOwner;
            }
            if (options.repoName) {
                config.repo.repo = options.repoName;
            }
            if (options.workPlatform) {
                config.work.platform = options.workPlatform;
            }
            if (options.repoPlatform) {
                config.repo.platform = options.repoPlatform;
            }
        }
        const configPath = this.getDefaultConfigPath(projectRoot);
        this.writeConfig(config, configPath);
        return configPath;
    }
}
exports.ConfigInitializer = ConfigInitializer;
//# sourceMappingURL=initializer.js.map