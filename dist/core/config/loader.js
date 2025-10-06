"use strict";
/**
 * Configuration loader using cosmiconfig
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
exports.ConfigLoader = void 0;
const cosmiconfig_1 = require("cosmiconfig");
const yaml = __importStar(require("js-yaml"));
const fs = __importStar(require("fs/promises"));
const path = __importStar(require("path"));
class ConfigLoader {
    constructor() {
        this.moduleName = 'faber';
        this.explorer = (0, cosmiconfig_1.cosmiconfigSync)(this.moduleName, {
            searchPlaces: [
                '.faber/config.yml',
                '.faber/config.yaml',
                '.faber/config.json',
                '.faberrc',
                '.faberrc.yml',
                '.faberrc.yaml',
                '.faberrc.json',
                'faber.config.js',
                'package.json'
            ],
            loaders: {
                '.yml': (_filepath, content) => yaml.load(content),
                '.yaml': (_filepath, content) => yaml.load(content)
            }
        });
    }
    /**
     * Load configuration from project
     */
    load(startPath = process.cwd()) {
        const result = this.explorer.search(startPath);
        if (result && result.config) {
            return this.validateConfig(result.config);
        }
        // Return default config if none found
        return this.getDefaultConfig();
    }
    /**
     * Load configuration from specific file
     */
    async loadFromFile(filePath) {
        const content = await fs.readFile(filePath, 'utf-8');
        const ext = path.extname(filePath);
        let config;
        if (ext === '.yml' || ext === '.yaml') {
            config = yaml.load(content);
        }
        else if (ext === '.json') {
            config = JSON.parse(content);
        }
        else {
            throw new Error(`Unsupported config file format: ${ext}`);
        }
        return this.validateConfig(config);
    }
    /**
     * Save configuration to file
     */
    async save(config, filePath) {
        const ext = path.extname(filePath);
        let content;
        if (ext === '.yml' || ext === '.yaml') {
            content = yaml.dump(config, { indent: 2 });
        }
        else if (ext === '.json') {
            content = JSON.stringify(config, null, 2);
        }
        else {
            throw new Error(`Unsupported config file format: ${ext}`);
        }
        await fs.writeFile(filePath, content, 'utf-8');
    }
    /**
     * Get configuration value by key path
     */
    get(config, keyPath) {
        const keys = keyPath.split('.');
        let value = config;
        for (const key of keys) {
            if (value && typeof value === 'object' && key in value) {
                value = value[key];
            }
            else {
                return undefined;
            }
        }
        return value;
    }
    /**
     * Set configuration value by key path
     */
    set(config, keyPath, value) {
        const keys = keyPath.split('.');
        const result = { ...config };
        let current = result;
        for (let i = 0; i < keys.length - 1; i++) {
            const key = keys[i];
            if (!(key in current) || typeof current[key] !== 'object') {
                current[key] = {};
            }
            current = current[key];
        }
        current[keys[keys.length - 1]] = value;
        return result;
    }
    /**
     * Validate configuration
     */
    validateConfig(config) {
        // Ensure required fields have proper structure
        if (!config.platforms) {
            config.platforms = {};
        }
        if (!config.mcp_servers) {
            config.mcp_servers = {};
        }
        if (!config.overlays) {
            config.overlays = { enabled: true };
        }
        if (!config.bindings) {
            config.bindings = {};
        }
        // Validate MCP server configs
        for (const [name, server] of Object.entries(config.mcp_servers || {})) {
            this.validateMCPServer(name, server);
        }
        return config;
    }
    /**
     * Validate MCP server configuration
     */
    validateMCPServer(name, server) {
        if (!server.command && !server.url) {
            throw new Error(`MCP server '${name}' must have either 'command' or 'url'`);
        }
        if (server.command && server.url) {
            throw new Error(`MCP server '${name}' cannot have both 'command' and 'url'`);
        }
    }
    /**
     * Get default configuration
     */
    getDefaultConfig() {
        return {
            platforms: {},
            mcp_servers: {},
            overlays: {
                enabled: true,
                paths: ['.faber/overlays']
            },
            bindings: {}
        };
    }
    /**
     * Merge multiple configurations
     */
    merge(...configs) {
        let result = this.getDefaultConfig();
        for (const config of configs) {
            result = this.deepMerge(result, config);
        }
        return result;
    }
    /**
     * Deep merge two objects
     */
    deepMerge(target, source) {
        const result = { ...target };
        for (const key in source) {
            if (source.hasOwnProperty(key)) {
                if (typeof source[key] === 'object' &&
                    source[key] !== null &&
                    !Array.isArray(source[key]) &&
                    typeof target[key] === 'object' &&
                    target[key] !== null &&
                    !Array.isArray(target[key])) {
                    result[key] = this.deepMerge(target[key], source[key]);
                }
                else {
                    result[key] = source[key];
                }
            }
        }
        return result;
    }
    /**
     * Expand environment variables in config
     */
    expandEnvVars(config) {
        const expanded = JSON.stringify(config, null, 2);
        const withEnv = expanded.replace(/\$\{([^}]+)\}/g, (match, varName) => process.env[varName] || match);
        return JSON.parse(withEnv);
    }
}
exports.ConfigLoader = ConfigLoader;
//# sourceMappingURL=loader.js.map