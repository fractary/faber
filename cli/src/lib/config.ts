/**
 * Configuration Manager
 *
 * Loads FABER CLI configuration from unified .fractary/config.yaml
 * and respects Claude Code settings
 */

import fs from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';
import os from 'os';
import type { FaberConfig, UnifiedConfig, AnthropicConfig, GitHubConfig } from '../types/config.js';
import { loadYamlConfig, oldSettingsExists, getOldSettingsPath } from './yaml-config.js';

/**
 * Configuration Manager
 */
export class ConfigManager {
  private config: FaberConfig;

  private constructor(config: FaberConfig) {
    this.config = config;
  }

  /**
   * Load configuration from unified .fractary/config.yaml
   * Returns a FaberConfig structure with all necessary settings
   */
  static async load(): Promise<FaberConfig & { anthropic?: AnthropicConfig; github?: GitHubConfig }> {
    // Check if old settings.json exists and show error
    if (oldSettingsExists()) {
      const oldPath = getOldSettingsPath();
      throw new Error(
        `Found old configuration at ${oldPath}\n\n` +
        `This version requires .fractary/config.yaml format.\n` +
        `Run: fractary-faber migrate\n\n` +
        `This will convert your settings to the new unified config format.`
      );
    }

    // Load unified config from YAML
    const unifiedConfig = loadYamlConfig({ warnMissingEnvVars: true });

    if (!unifiedConfig) {
      throw new Error(
        'No .fractary/config.yaml found.\n' +
        'Run `fractary-core:init` first to initialize shared configuration.'
      );
    }

    // Extract anthropic config (from top level)
    let anthropic: AnthropicConfig = {
      api_key: process.env.ANTHROPIC_API_KEY || unifiedConfig.anthropic?.api_key,
      model: unifiedConfig.anthropic?.model,
      max_tokens: unifiedConfig.anthropic?.max_tokens,
    };

    // Extract github config (from top level, with fallbacks to work/repo sections)
    // Priority: github section > work.handlers.github > repo section > codex > parse from repo string
    const anyConfig = unifiedConfig as any; // Allow access to plugin-specific sections
    let organization = unifiedConfig.github?.organization
      || anyConfig.work?.handlers?.github?.owner
      || anyConfig.work?.github?.organization
      || anyConfig.repo?.organization
      || anyConfig.codex?.organization;
    let project = unifiedConfig.github?.project
      || anyConfig.work?.handlers?.github?.repo
      || anyConfig.work?.github?.project
      || anyConfig.repo?.project
      || anyConfig.codex?.project;

    // If still not found, try to parse from repo string (owner/repo format)
    const repoString = unifiedConfig.github?.repo || anyConfig.repo?.repo;
    if ((!organization || !project) && repoString) {
      const repoParts = repoString.split('/');
      if (repoParts.length === 2) {
        organization = organization || repoParts[0];
        project = project || repoParts[1];
      }
    }

    // Token fallback: env var > github section > work.handlers.github
    const token = process.env.GITHUB_TOKEN
      || unifiedConfig.github?.token
      || anyConfig.work?.handlers?.github?.token;

    let github: GitHubConfig = {
      token,
      organization,
      project,
      repo: unifiedConfig.github?.repo,
      app: unifiedConfig.github?.app,
    };

    // Extract FABER-specific config
    const faberConfig = unifiedConfig.faber || {};

    // Build the result config (keeping anthropic and github for backward compatibility)
    const config: FaberConfig & { anthropic?: AnthropicConfig; github?: GitHubConfig } = {
      anthropic,
      github,
      worktree: faberConfig.worktree,
      workflow: faberConfig.workflow,
      backlog_management: faberConfig.backlog_management,
    };

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
      // Always use the canonical workflow path - no legacy fallback
      const workflowPath = path.join(process.cwd(), '.fractary', 'faber', 'workflows');

      config.workflow = {
        ...config.workflow,
        config_path: workflowPath,
      };
    }

    return config;
  }

  /**
   * Find config file by searching upwards from current directory
   * Similar to how git finds .git directory
   */
  private static async findConfigFile(dirName: string, fileName: string): Promise<string | null> {
    let currentDir = process.cwd();
    const root = path.parse(currentDir).root;

    while (true) {
      const configPath = path.join(currentDir, dirName, fileName);

      try {
        await fs.access(configPath);
        return configPath;
      } catch (error) {
        // File doesn't exist, try parent directory
      }

      // Check if we've reached the root
      if (currentDir === root) {
        return null;
      }

      // Move to parent directory
      currentDir = path.dirname(currentDir);
    }
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
