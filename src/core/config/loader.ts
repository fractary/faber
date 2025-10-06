/**
 * Configuration loader using cosmiconfig
 */

import { cosmiconfigSync } from 'cosmiconfig';
import * as yaml from 'js-yaml';
import * as fs from 'fs/promises';
import * as path from 'path';
import { Config, MCPServerConfig } from '../../types';

export class ConfigLoader {
  private moduleName = 'faber';
  private explorer = cosmiconfigSync(this.moduleName, {
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
      '.yml': (_filepath, content) => yaml.load(content) as Config,
      '.yaml': (_filepath, content) => yaml.load(content) as Config
    }
  });

  /**
   * Load configuration from project
   */
  load(startPath: string = process.cwd()): Config {
    const result = this.explorer.search(startPath);

    if (result && result.config) {
      return this.validateConfig(result.config as Config);
    }

    // Return default config if none found
    return this.getDefaultConfig();
  }

  /**
   * Load configuration from specific file
   */
  async loadFromFile(filePath: string): Promise<Config> {
    const content = await fs.readFile(filePath, 'utf-8');
    const ext = path.extname(filePath);

    let config: Config;

    if (ext === '.yml' || ext === '.yaml') {
      config = yaml.load(content) as Config;
    } else if (ext === '.json') {
      config = JSON.parse(content) as Config;
    } else {
      throw new Error(`Unsupported config file format: ${ext}`);
    }

    return this.validateConfig(config);
  }

  /**
   * Save configuration to file
   */
  async save(config: Config, filePath: string): Promise<void> {
    const ext = path.extname(filePath);
    let content: string;

    if (ext === '.yml' || ext === '.yaml') {
      content = yaml.dump(config, { indent: 2 });
    } else if (ext === '.json') {
      content = JSON.stringify(config, null, 2);
    } else {
      throw new Error(`Unsupported config file format: ${ext}`);
    }

    await fs.writeFile(filePath, content, 'utf-8');
  }

  /**
   * Get configuration value by key path
   */
  get(config: Config, keyPath: string): unknown {
    const keys = keyPath.split('.');
    let value: any = config;

    for (const key of keys) {
      if (value && typeof value === 'object' && key in value) {
        value = value[key];
      } else {
        return undefined;
      }
    }

    return value;
  }

  /**
   * Set configuration value by key path
   */
  set(config: Config, keyPath: string, value: unknown): Config {
    const keys = keyPath.split('.');
    const result = { ...config };
    let current: any = result;

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
  private validateConfig(config: Config): Config {
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
  private validateMCPServer(name: string, server: MCPServerConfig): void {
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
  private getDefaultConfig(): Config {
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
  merge(...configs: Partial<Config>[]): Config {
    let result = this.getDefaultConfig();

    for (const config of configs) {
      result = this.deepMerge(result as any, config as any) as Config;
    }

    return result;
  }

  /**
   * Deep merge two objects
   */
  private deepMerge(
    target: Record<string, unknown>,
    source: Record<string, unknown>
  ): Record<string, unknown> {
    const result = { ...target };

    for (const key in source) {
      if (source.hasOwnProperty(key)) {
        if (
          typeof source[key] === 'object' &&
          source[key] !== null &&
          !Array.isArray(source[key]) &&
          typeof target[key] === 'object' &&
          target[key] !== null &&
          !Array.isArray(target[key])
        ) {
          result[key] = this.deepMerge(
            target[key] as Record<string, unknown>,
            source[key] as Record<string, unknown>
          );
        } else {
          result[key] = source[key];
        }
      }
    }

    return result;
  }

  /**
   * Expand environment variables in config
   */
  expandEnvVars(config: Config): Config {
    const expanded = JSON.stringify(config, null, 2);
    const withEnv = expanded.replace(
      /\$\{([^}]+)\}/g,
      (match, varName) => process.env[varName] || match
    );
    return JSON.parse(withEnv) as Config;
  }
}