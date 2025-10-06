/**
 * Configuration loader using cosmiconfig
 */
import { Config } from '../../types';
export declare class ConfigLoader {
    private moduleName;
    private explorer;
    /**
     * Load configuration from project
     */
    load(startPath?: string): Config;
    /**
     * Load configuration from specific file
     */
    loadFromFile(filePath: string): Promise<Config>;
    /**
     * Save configuration to file
     */
    save(config: Config, filePath: string): Promise<void>;
    /**
     * Get configuration value by key path
     */
    get(config: Config, keyPath: string): unknown;
    /**
     * Set configuration value by key path
     */
    set(config: Config, keyPath: string, value: unknown): Config;
    /**
     * Validate configuration
     */
    private validateConfig;
    /**
     * Validate MCP server configuration
     */
    private validateMCPServer;
    /**
     * Get default configuration
     */
    private getDefaultConfig;
    /**
     * Merge multiple configurations
     */
    merge(...configs: Partial<Config>[]): Config;
    /**
     * Deep merge two objects
     */
    private deepMerge;
    /**
     * Expand environment variables in config
     */
    expandEnvVars(config: Config): Config;
}
//# sourceMappingURL=loader.d.ts.map