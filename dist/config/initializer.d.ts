/**
 * @fractary/faber - Configuration Initializer
 *
 * Provides utilities for initializing FABER configuration with sensible defaults.
 * Replaces the old initFaberConfig() and writeConfig() functions with a cleaner API.
 */
import { FaberConfig } from '../types';
/**
 * ConfigInitializer class for generating and managing FABER configuration
 */
export declare class ConfigInitializer {
    /**
     * Default configuration file name (YAML format)
     */
    private static readonly CONFIG_FILENAME;
    /**
     * Default configuration path relative to project root
     */
    private static readonly DEFAULT_CONFIG_PATH;
    /**
     * Generate a complete FaberConfig with sensible defaults
     *
     * @returns Complete FaberConfig object with all sections populated
     */
    static generateDefaultConfig(): FaberConfig;
    /**
     * Write configuration to a YAML file
     *
     * @param config - FaberConfig object to write
     * @param configPath - Optional custom path (defaults to .fractary/plugins/faber/config.yaml)
     */
    static writeConfig(config: FaberConfig, configPath?: string): void;
    /**
     * Check if configuration file exists
     *
     * @param configPath - Optional custom path to check
     * @returns true if config exists, false otherwise
     */
    static configExists(configPath?: string): boolean;
    /**
     * Read configuration from file (supports both YAML and JSON)
     *
     * @param configPath - Optional custom path to read from
     * @returns FaberConfig object or null if file doesn't exist
     */
    static readConfig(configPath?: string): FaberConfig | null;
    /**
     * Get the default configuration file path
     *
     * @param projectRoot - Optional project root directory
     * @returns Full path to default config file
     */
    private static getDefaultConfigPath;
    /**
     * Initialize a new FABER project with default configuration
     *
     * @param projectRoot - Optional project root directory
     * @param options - Optional configuration overrides
     * @returns Path to the created configuration file
     */
    static initializeProject(projectRoot?: string, options?: {
        repoOwner?: string;
        repoName?: string;
        workPlatform?: 'github' | 'jira' | 'linear';
        repoPlatform?: 'github' | 'gitlab' | 'bitbucket';
    }): string;
}
//# sourceMappingURL=initializer.d.ts.map