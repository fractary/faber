/**
 * Configuration Manager
 *
 * Loads FABER CLI configuration and respects Claude Code settings
 */

import fs from 'fs/promises';
import path from 'path';
import os from 'os';
import type { FaberConfig, ClaudeConfig } from '../types/config.js';

/**
 * Configuration Manager
 */
export class ConfigManager {
  private config: FaberConfig;

  private constructor(config: FaberConfig) {
    this.config = config;
  }

  /**
   * Load configuration
   */
  static async load(): Promise<FaberConfig> {
    const config: FaberConfig = {};

    // Load from environment variables
    config.anthropic = {
      api_key: process.env.ANTHROPIC_API_KEY,
    };

    config.github = {
      token: process.env.GITHUB_TOKEN,
    };

    // Load from FABER config file
    try {
      const faberConfigPath = path.join(process.cwd(), '.fractary', 'settings.json');
      const faberConfigContent = await fs.readFile(faberConfigPath, 'utf-8');
      const faberConfig = JSON.parse(faberConfigContent);

      // Merge with config
      if (faberConfig.anthropic) {
        config.anthropic = { ...config.anthropic, ...faberConfig.anthropic };
      }
      if (faberConfig.github) {
        config.github = { ...config.github, ...faberConfig.github };
      }
      if (faberConfig.worktree) {
        config.worktree = { ...config.worktree, ...faberConfig.worktree };
      }
      if (faberConfig.workflow) {
        config.workflow = { ...config.workflow, ...faberConfig.workflow };
      }
    } catch (error) {
      // FABER config not found, use defaults
    }

    // Read Claude Code configuration for worktree location
    if (!config.worktree?.location || config.worktree?.inherit_from_claude !== false) {
      const claudeWorktreeLocation = await ConfigManager.readClaudeCodeWorktreeLocation();
      if (claudeWorktreeLocation) {
        if (!config.worktree) {
          config.worktree = {};
        }
        config.worktree.location = claudeWorktreeLocation;
      }
    }

    // Set defaults
    if (!config.worktree?.location) {
      config.worktree = {
        ...config.worktree,
        location: path.join(os.homedir(), '.claude-worktrees'),
      };
    }

    if (!config.workflow?.config_path) {
      config.workflow = {
        ...config.workflow,
        config_path: path.join(process.cwd(), 'plugins', 'faber', 'config', 'workflows'),
      };
    }

    return config;
  }

  /**
   * Read Claude Code configuration for worktree location
   */
  private static async readClaudeCodeWorktreeLocation(): Promise<string | null> {
    const configPaths = ConfigManager.getClaudeConfigPaths();

    for (const configPath of configPaths) {
      try {
        const content = await fs.readFile(configPath, 'utf-8');
        const config = JSON.parse(content);

        if (config.worktree?.directory) {
          return config.worktree.directory;
        }
      } catch (error) {
        // Config file not found or not readable, try next
        continue;
      }
    }

    return null;
  }

  /**
   * Get Claude Code configuration paths by platform
   */
  private static getClaudeConfigPaths(): string[] {
    const homeDir = os.homedir();
    const platform = os.platform();

    switch (platform) {
      case 'linux':
        return [
          path.join(homeDir, '.config', 'claude', 'config.json'),
          path.join(homeDir, '.claude', 'config.json'),
        ];
      case 'darwin': // macOS
        return [
          path.join(homeDir, 'Library', 'Application Support', 'Claude', 'config.json'),
          path.join(homeDir, '.config', 'claude', 'config.json'),
        ];
      case 'win32': // Windows
        return [
          path.join(process.env.APPDATA || path.join(homeDir, 'AppData', 'Roaming'), 'Claude', 'config.json'),
          path.join(homeDir, '.claude', 'config.json'),
        ];
      default:
        return [path.join(homeDir, '.claude', 'config.json')];
    }
  }

  /**
   * Get configuration value
   */
  get(key: keyof FaberConfig): any {
    return this.config[key];
  }
}
