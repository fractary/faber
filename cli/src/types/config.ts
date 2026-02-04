/**
 * FABER CLI Configuration Types
 *
 * Type definitions for configuration objects
 * Version 2.0: Unified configuration with shared authentication
 */

/**
 * Anthropic API configuration (shared across all tools)
 */
export interface AnthropicConfig {
  api_key?: string;
  model?: string;
  max_tokens?: number;
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

/**
 * GitHub authentication configuration (shared across all tools)
 */
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

export interface BacklogManagementConfig {
  default_limit?: number;
  default_order_by?: 'priority' | 'created' | 'updated' | 'none';
  priority_config?: {
    label_prefix?: string;
  };
}

/**
 * FABER-specific configuration (v2.0: only FABER-specific settings)
 * Note: anthropic and github are now at the top level of UnifiedConfig
 *
 * Supports both legacy format and new simplified format (v2.1)
 */
export interface FaberConfig {
  // Legacy format (deprecated)
  worktree?: WorktreeConfig;
  workflow?: WorkflowConfig;
  backlog_management?: BacklogManagementConfig;

  // New simplified format (v2.1)
  workflows?: {
    path?: string;
    default?: string;
    autonomy?: AutonomyLevel;
  };
  runs?: {
    path?: string;
  };
}

/**
 * Loaded FABER configuration including shared authentication
 * This is what ConfigManager.load() returns - combines FABER-specific
 * settings with shared anthropic/github configuration
 */
export type LoadedFaberConfig = FaberConfig & {
  anthropic?: AnthropicConfig;
  github?: GitHubConfig;
};

/**
 * Unified configuration structure (v2.0)
 * Single source of truth shared across FABER and fractary-core plugins
 */
export interface UnifiedConfig {
  version: string;                    // "2.0"
  anthropic?: AnthropicConfig;        // Shared API key
  github?: GitHubConfig;              // Shared GitHub auth
  faber?: FaberConfig;                // FABER-specific settings
  work?: any;                         // Pass-through for work plugin
  repo?: any;                         // Pass-through for repo plugin
  logs?: any;                         // Pass-through for logs plugin
  file?: any;                         // Pass-through for file plugin
  spec?: any;                         // Pass-through for spec plugin
  docs?: any;                         // Pass-through for docs plugin
}

/**
 * Legacy configuration structure (v1.x - deprecated)
 * Kept for backward compatibility during migration
 */
export interface LegacyFaberConfig {
  anthropic?: AnthropicConfig;
  github?: GitHubConfig;
  worktree?: WorktreeConfig;
  workflow?: WorkflowConfig;
  backlog_management?: BacklogManagementConfig;
}

export interface ClaudeConfig {
  worktree?: {
    directory?: string;
  };
}

/**
 * Options for loading YAML configuration
 */
export interface ConfigLoadOptions {
  /** Project root directory (auto-detected if not provided) */
  projectRoot?: string;
  /** Warn about missing environment variables (default: true) */
  warnMissingEnvVars?: boolean;
  /** Throw error if config file doesn't exist (default: false) */
  throwIfMissing?: boolean;
}

/**
 * Autonomy levels for FABER workflows
 */
export type AutonomyLevel = 'dry-run' | 'assisted' | 'guarded' | 'autonomous';
