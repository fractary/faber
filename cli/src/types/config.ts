/**
 * FABER CLI Configuration Types
 *
 * Type definitions for configuration objects
 */

export interface AnthropicConfig {
  api_key?: string;
}

/**
 * GitHub App authentication configuration
 */
export interface GitHubAppConfig {
  id: string;                    // GitHub App ID
  installation_id: string;       // Installation ID for the target org/repo
  private_key_path?: string;     // Path to PEM file (optional if env var used)
  private_key_env_var?: string;  // Env var name containing base64-encoded key
  created_via?: 'manifest-flow' | 'manual';  // How the app was created
  created_at?: string;           // ISO 8601 timestamp of creation
}

export interface GitHubConfig {
  token?: string;                // PAT (legacy, still supported)
  organization?: string;
  project?: string;
  repo?: string;                 // Full repo name (owner/repo)
  app?: GitHubAppConfig;         // GitHub App configuration (new)
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
