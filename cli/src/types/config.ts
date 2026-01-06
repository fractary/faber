/**
 * FABER CLI Configuration Types
 *
 * Type definitions for configuration objects
 */

export interface AnthropicConfig {
  api_key?: string;
}

export interface GitHubConfig {
  token?: string;
  organization?: string;
  project?: string;
  repo?: string; // Full repo name (owner/repo)
}

export interface WorktreeConfig {
  location?: string;
  inherit_from_claude?: boolean;
}

export interface WorkflowConfig {
  default?: string;
  config_path?: string;
}

export interface FaberConfig {
  anthropic?: AnthropicConfig;
  github?: GitHubConfig;
  worktree?: WorktreeConfig;
  workflow?: WorkflowConfig;
}

export interface ClaudeConfig {
  worktree?: {
    directory?: string;
  };
}
