/**
 * @fractary/faber - Configuration Management
 *
 * Handles loading and validating FABER configuration from project files.
 */

import * as fs from 'fs';
import * as path from 'path';
import * as yaml from 'js-yaml';
import { z } from 'zod';
import {
  FaberConfig,
  WorkConfig,
  RepoConfig,
  WorkflowConfig,
  SpecConfig,
  LogConfig,
  StateConfig,
} from './types.js';
import { ConfigValidationError } from './errors.js';

// ============================================================================
// Configuration Loading Options
// ============================================================================

/**
 * Options for configuration loading functions
 */
export interface LoadConfigOptions {
  /**
   * If true, return null instead of throwing when config is missing
   * @default false
   */
  allowMissing?: boolean;
}

// ============================================================================
// Configuration Schemas
// ============================================================================

const WorkConfigSchema = z.object({
  platform: z.enum(['github', 'jira', 'linear']),
  owner: z.string().optional(),
  repo: z.string().optional(),
  project: z.string().optional(),
  token: z.string().optional(),
});

const BranchPrefixSchema = z.object({
  feature: z.string().default('feat'),
  bugfix: z.string().default('fix'),
  hotfix: z.string().default('hotfix'),
  chore: z.string().default('chore'),
});

const RepoConfigSchema = z.object({
  platform: z.enum(['github', 'gitlab', 'bitbucket']),
  owner: z.string(),
  repo: z.string(),
  defaultBranch: z.string().optional().default('main'),
  token: z.string().optional(),
  branchPrefix: BranchPrefixSchema.optional(),
});

const PhaseConfigSchema = z.object({
  enabled: z.boolean().default(true),
});

const ArchitectPhaseSchema = PhaseConfigSchema.extend({
  refineSpec: z.boolean().default(true),
});

const EvaluatePhaseSchema = PhaseConfigSchema.extend({
  maxRetries: z.number().default(3),
});

const ReleasePhaseSchema = PhaseConfigSchema.extend({
  requestReviews: z.boolean().default(false),
  reviewers: z.array(z.string()).default([]),
});

const WorkflowHooksSchema = z.object({
  pre_frame: z.string().optional(),
  post_frame: z.string().optional(),
  pre_architect: z.string().optional(),
  post_architect: z.string().optional(),
  pre_build: z.string().optional(),
  post_build: z.string().optional(),
  pre_evaluate: z.string().optional(),
  post_evaluate: z.string().optional(),
  pre_release: z.string().optional(),
  post_release: z.string().optional(),
});

const WorkflowConfigSchema = z.object({
  autonomy: z.enum(['dry-run', 'assisted', 'guarded', 'autonomous']).default('guarded'),
  phases: z.object({
    frame: PhaseConfigSchema.default({ enabled: true }),
    architect: ArchitectPhaseSchema.default({ enabled: true, refineSpec: true }),
    build: PhaseConfigSchema.default({ enabled: true }),
    evaluate: EvaluatePhaseSchema.default({ enabled: true, maxRetries: 3 }),
    release: ReleasePhaseSchema.default({ enabled: true, requestReviews: false, reviewers: [] }),
  }),
  hooks: WorkflowHooksSchema.optional(),
});

const ArtifactConfigSchema = z.object({
  use_codex: z.boolean().default(false),
  local_path: z.string(),
});

const LLMConfigSchema = z.object({
  defaultModel: z.string(),
  modelOverrides: z.record(z.string()).optional(),
});

const FaberConfigSchema = z.object({
  schema_version: z.string().default('1.0'),
  work: WorkConfigSchema,
  repo: RepoConfigSchema,
  artifacts: z.object({
    specs: ArtifactConfigSchema.default({ use_codex: false, local_path: '/specs' }),
    logs: ArtifactConfigSchema.default({ use_codex: false, local_path: '.fractary/logs' }),
    state: ArtifactConfigSchema.default({ use_codex: false, local_path: '.fractary/faber' }),
  }),
  workflow: WorkflowConfigSchema.default({
    autonomy: 'guarded',
    phases: {
      frame: { enabled: true },
      architect: { enabled: true, refineSpec: true },
      build: { enabled: true },
      evaluate: { enabled: true, maxRetries: 3 },
      release: { enabled: true, requestReviews: false, reviewers: [] },
    },
  }),
  llm: LLMConfigSchema.optional(),
});

// ============================================================================
// Configuration Paths
// ============================================================================

const CONFIG_FILENAME_YAML = 'config.yaml';
const CONFIG_FILENAME_JSON = 'config.json';
const FABER_CONFIG_DIR = '.fractary/faber';
const LEGACY_FABER_CONFIG_DIR = '.fractary/plugins/faber';
const WORK_CONFIG_DIR = '.fractary/plugins/work';
const REPO_CONFIG_DIR = '.fractary/plugins/repo';

// ============================================================================
// Configuration Loader
// ============================================================================

/**
 * Find the project root by looking for .fractary or .git directory
 */
export function findProjectRoot(startDir?: string): string {
  let dir = startDir || process.cwd();

  // First, try to find .fractary or .git from current directory
  // This ensures worktrees use their own configuration
  let currentDir = dir;
  while (currentDir !== path.dirname(currentDir)) {
    if (fs.existsSync(path.join(currentDir, '.fractary'))) {
      return currentDir;
    }
    if (fs.existsSync(path.join(currentDir, '.git'))) {
      return currentDir;
    }
    currentDir = path.dirname(currentDir);
  }

  // Only fall back to CLAUDE_WORK_CWD if no .fractary or .git found
  // This handles cases where Claude Code is running in a non-git directory
  const claudeWorkCwd = process.env['CLAUDE_WORK_CWD'];
  if (claudeWorkCwd && fs.existsSync(claudeWorkCwd)) {
    return claudeWorkCwd;
  }

  return process.cwd();
}

/**
 * Load a configuration file (supports both YAML and JSON)
 * Prefers YAML (.yaml) over JSON (.json) for backward compatibility
 */
export function loadConfigFile<T>(configDir: string, root: string): T | null {
  // Try YAML first (preferred format)
  const yamlPath = path.join(root, configDir, CONFIG_FILENAME_YAML);
  if (fs.existsSync(yamlPath)) {
    try {
      const content = fs.readFileSync(yamlPath, 'utf-8');
      return yaml.load(content) as T;
    } catch {
      return null;
    }
  }

  // Fall back to JSON (legacy format)
  const jsonPath = path.join(root, configDir, CONFIG_FILENAME_JSON);
  if (fs.existsSync(jsonPath)) {
    try {
      const content = fs.readFileSync(jsonPath, 'utf-8');
      return JSON.parse(content) as T;
    } catch {
      return null;
    }
  }

  return null;
}

/**
 * Load config file with fallback to legacy location
 * Tries new location first, then falls back to legacy location if provided
 */
function loadConfigFileWithFallback<T>(
  configDir: string,
  legacyConfigDir: string | null,
  root: string
): T | null {
  // Try new location first
  const config = loadConfigFile<T>(configDir, root);
  if (config) return config;

  // Try legacy location if provided
  if (legacyConfigDir) {
    const legacyConfig = loadConfigFile<T>(legacyConfigDir, root);
    if (legacyConfig) {
      console.warn(
        `[DEPRECATED] Config found at legacy location: ${legacyConfigDir}\n` +
          `Run 'fractary-faber init' to migrate to: ${configDir}`
      );
      return legacyConfig;
    }
  }

  return null;
}

/**
 * Load work plugin configuration
 *
 * @param projectRoot - Optional project root directory
 * @param options - Loading options (allowMissing to return null instead of throwing)
 * @returns WorkConfig or null
 * @throws ConfigValidationError if missing and allowMissing is false
 */
export function loadWorkConfig(
  projectRoot?: string,
  options?: LoadConfigOptions
): WorkConfig | null {
  const root = projectRoot || findProjectRoot();
  const config = loadConfigFile<Record<string, unknown>>(WORK_CONFIG_DIR, root);

  if (!config) {
    // Try loading from FABER config as fallback (but only if FABER config file exists to avoid infinite recursion)
    const faberConfigFile = loadConfigFile<Record<string, unknown>>(FABER_CONFIG_DIR, root);
    if (faberConfigFile) {
      const faberConfig = loadFaberConfig(root, { allowMissing: true });
      if (faberConfig?.work) {
        return faberConfig.work;
      }
    }

    if (options?.allowMissing) {
      return null;
    }

    const yamlPath = path.join(root, WORK_CONFIG_DIR, CONFIG_FILENAME_YAML);
    const jsonPath = path.join(root, WORK_CONFIG_DIR, CONFIG_FILENAME_JSON);
    throw new ConfigValidationError([
      'Work plugin configuration not found.',
      '',
      'Run the following command to create a default configuration:',
      '  fractary init',
      '',
      `Expected config at: ${yamlPath} or ${jsonPath}`,
    ]);
  }

  // Handle handlers structure from plugins
  const handlers = config['handlers'] as Record<string, unknown> | undefined;
  if (handlers) {
    // Try complex structure first (handlers.work-tracker.active.platform)
    const workTracker = handlers['work-tracker'] as Record<string, unknown> | undefined;
    if (workTracker) {
      const platform = workTracker['active'] as string;
      const platformConfig = workTracker[platform] as Record<string, unknown> | undefined;

      if (platformConfig) {
        return {
          platform: platform as 'github' | 'jira' | 'linear',
          owner: platformConfig['owner'] as string | undefined,
          repo: platformConfig['repo'] as string | undefined,
          project: platformConfig['project_key'] as string | undefined,
        };
      }
    }

    // Fallback to simple structure (handlers.github)
    const platforms = ['github', 'jira', 'linear'] as const;
    for (const platform of platforms) {
      const platformConfig = handlers[platform] as Record<string, unknown> | undefined;
      if (platformConfig) {
        return {
          platform: platform,
          owner: platformConfig['owner'] as string | undefined,
          repo: platformConfig['repo'] as string | undefined,
          project: platformConfig['project_key'] as string | undefined,
        };
      }
    }
  }

  // Fallback to direct config
  const result = WorkConfigSchema.safeParse(config);
  if (result.success) {
    return result.data;
  }

  // If config is invalid and allowMissing is true, return null
  if (options?.allowMissing) {
    return null;
  }

  throw new ConfigValidationError(['Invalid work configuration']);
}

/**
 * Load repo plugin configuration
 *
 * @param projectRoot - Optional project root directory
 * @param options - Loading options (allowMissing to return null instead of throwing)
 * @returns RepoConfig or null
 * @throws ConfigValidationError if missing and allowMissing is false
 */
export function loadRepoConfig(
  projectRoot?: string,
  options?: LoadConfigOptions
): RepoConfig | null {
  const root = projectRoot || findProjectRoot();
  const config = loadConfigFile<Record<string, unknown>>(REPO_CONFIG_DIR, root);

  if (!config) {
    // Try loading from FABER config as fallback (but only if FABER config file exists to avoid infinite recursion)
    const faberConfigFile = loadConfigFile<Record<string, unknown>>(FABER_CONFIG_DIR, root);
    if (faberConfigFile) {
      const faberConfig = loadFaberConfig(root, { allowMissing: true });
      if (faberConfig?.repo) {
        return faberConfig.repo;
      }
    }

    if (options?.allowMissing) {
      return null;
    }

    const yamlPath = path.join(root, REPO_CONFIG_DIR, CONFIG_FILENAME_YAML);
    const jsonPath = path.join(root, REPO_CONFIG_DIR, CONFIG_FILENAME_JSON);
    throw new ConfigValidationError([
      'Repo plugin configuration not found.',
      '',
      'Run the following command to create a default configuration:',
      '  fractary init',
      '',
      `Expected config at: ${yamlPath} or ${jsonPath}`,
    ]);
  }

  // Handle handlers structure from plugins
  const handlers = config['handlers'] as Record<string, unknown> | undefined;
  if (handlers) {
    // Try complex structure first (handlers.source-control.active.platform)
    const sourceControl = handlers['source-control'] as Record<string, unknown> | undefined;
    if (sourceControl) {
      const platform = sourceControl['active'] as string;
      const platformConfig = sourceControl[platform] as Record<string, unknown> | undefined;

      if (platformConfig) {
        return {
          platform: platform as 'github' | 'gitlab' | 'bitbucket',
          owner: platformConfig['owner'] as string,
          repo: platformConfig['repo'] as string,
          defaultBranch: (platformConfig['default_branch'] as string) || 'main',
        };
      }
    }

    // Fallback to simple structure (handlers.github)
    const platforms = ['github', 'gitlab', 'bitbucket'] as const;
    for (const platform of platforms) {
      const platformConfig = handlers[platform] as Record<string, unknown> | undefined;
      if (platformConfig) {
        return {
          platform: platform,
          owner: platformConfig['owner'] as string,
          repo: platformConfig['repo'] as string,
          defaultBranch: (platformConfig['default_branch'] as string) || 'main',
        };
      }
    }
  }

  // Fallback to direct config
  const result = RepoConfigSchema.safeParse(config);
  if (result.success) {
    return result.data;
  }

  // If config is invalid and allowMissing is true, return null
  if (options?.allowMissing) {
    return null;
  }

  throw new ConfigValidationError(['Invalid repo configuration']);
}

/**
 * Load the full FABER configuration
 *
 * @param projectRoot - Optional project root directory
 * @param options - Loading options (allowMissing to return null instead of throwing)
 * @returns FaberConfig or null (if allowMissing is true and config doesn't exist)
 * @throws ConfigValidationError if config exists but is invalid, or if missing and allowMissing is false
 */
export function loadFaberConfig(
  projectRoot?: string,
  options?: LoadConfigOptions
): FaberConfig | null {
  const root = projectRoot || findProjectRoot();
  const config = loadConfigFileWithFallback<Record<string, unknown>>(
    FABER_CONFIG_DIR,
    LEGACY_FABER_CONFIG_DIR,
    root
  );

  if (!config) {
    // Try to construct from individual plugin configs
    const workConfig = loadWorkConfig(root, { allowMissing: true });
    const repoConfig = loadRepoConfig(root, { allowMissing: true });

    if (workConfig && repoConfig) {
      return {
        schema_version: '1.0',
        work: workConfig,
        repo: repoConfig,
        artifacts: {
          specs: { use_codex: false, local_path: '/specs' },
          logs: { use_codex: false, local_path: '.fractary/logs' },
          state: { use_codex: false, local_path: '.fractary/faber' },
        },
        workflow: {
          autonomy: 'guarded',
          phases: {
            frame: { enabled: true },
            architect: { enabled: true, refineSpec: true },
            build: { enabled: true },
            evaluate: { enabled: true, maxRetries: 3 },
            release: { enabled: true, requestReviews: false, reviewers: [] },
          },
        },
      };
    }

    // Config not found - throw or return null based on options
    if (options?.allowMissing) {
      return null;
    }

    const yamlPath = path.join(root, FABER_CONFIG_DIR, CONFIG_FILENAME_YAML);
    const jsonPath = path.join(root, FABER_CONFIG_DIR, CONFIG_FILENAME_JSON);
    throw new ConfigValidationError([
      'FABER configuration not found.',
      '',
      'Run the following command to create a default configuration:',
      '  fractary init',
      '',
      `Expected config at: ${yamlPath} or ${jsonPath}`,
    ]);
  }

  const result = FaberConfigSchema.safeParse(config);
  if (!result.success) {
    const errors = result.error.errors.map(e => `${e.path.join('.')}: ${e.message}`);
    throw new ConfigValidationError(errors);
  }

  return result.data;
}

/**
 * Validate a configuration object
 */
export function validateConfig(config: unknown): FaberConfig {
  const result = FaberConfigSchema.safeParse(config);
  if (!result.success) {
    const errors = result.error.errors.map(e => `${e.path.join('.')}: ${e.message}`);
    throw new ConfigValidationError(errors);
  }
  return result.data;
}

/**
 * Get the default workflow configuration
 */
export function getDefaultWorkflowConfig(): WorkflowConfig {
  return {
    autonomy: 'guarded',
    phases: {
      frame: { enabled: true },
      architect: { enabled: true, refineSpec: true },
      build: { enabled: true },
      evaluate: { enabled: true, maxRetries: 3 },
      release: { enabled: true, requestReviews: false, reviewers: [] },
    },
  };
}

/**
 * Merge partial config with defaults
 */
export function mergeWithDefaults(
  partial: Partial<WorkflowConfig>
): WorkflowConfig {
  const defaults = getDefaultWorkflowConfig();
  return {
    autonomy: partial.autonomy || defaults.autonomy,
    phases: {
      frame: { ...defaults.phases.frame, ...partial.phases?.frame },
      architect: { ...defaults.phases.architect, ...partial.phases?.architect },
      build: { ...defaults.phases.build, ...partial.phases?.build },
      evaluate: { ...defaults.phases.evaluate, ...partial.phases?.evaluate },
      release: { ...defaults.phases.release, ...partial.phases?.release },
    },
    hooks: partial.hooks || defaults.hooks,
  };
}

// ============================================================================
// Configuration Writers
// ============================================================================

/**
 * Ensure directory exists
 */
function ensureDir(dirPath: string): void {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

/**
 * Write configuration to file
 *
 * @deprecated Use ConfigInitializer.writeConfig() instead
 */
export function writeConfig(
  configPath: string,
  config: Record<string, unknown>
): void {
  ensureDir(path.dirname(configPath));
  fs.writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf-8');
}

/**
 * Initialize FABER configuration in a project
 *
 * @deprecated Use ConfigInitializer.generateDefaultConfig() and ConfigInitializer.writeConfig() instead
 * @example
 * // Old way (deprecated):
 * // initFaberConfig(projectRoot, partialConfig);
 *
 * // New way:
 * // const config = ConfigInitializer.generateDefaultConfig();
 * // ConfigInitializer.writeConfig(config);
 */
export function initFaberConfig(
  projectRoot: string,
  config: Partial<FaberConfig>
): string {
  const configPath = path.join(projectRoot, FABER_CONFIG_DIR, CONFIG_FILENAME_JSON);
  const fullConfig = validateConfig({
    schema_version: '1.0',
    ...config,
    artifacts: config.artifacts || {
      specs: { use_codex: false, local_path: '/specs' },
      logs: { use_codex: false, local_path: '.fractary/logs' },
      state: { use_codex: false, local_path: '.fractary/faber' },
    },
    workflow: config.workflow || getDefaultWorkflowConfig(),
  });

  writeConfig(configPath, fullConfig as unknown as Record<string, unknown>);
  return configPath;
}

// ============================================================================
// Module-specific Config Loaders
// ============================================================================

/**
 * Load spec configuration
 *
 * @param projectRoot - Optional project root directory
 * @param options - Loading options (allowMissing to return default config instead of throwing)
 * @returns SpecConfig (with defaults if allowMissing is true and config missing)
 * @throws ConfigValidationError if missing and allowMissing is false
 */
export function loadSpecConfig(
  projectRoot?: string,
  options?: LoadConfigOptions
): SpecConfig {
  const root = projectRoot || findProjectRoot();
  const faberConfig = loadFaberConfig(root, { allowMissing: true });

  if (faberConfig?.artifacts?.specs) {
    const configPath = faberConfig.artifacts.specs.local_path;
    // If it's the schema default (/specs), use relative default instead
    if (configPath === '/specs') {
      return {
        localPath: path.join(root, 'specs'),
      };
    }
    return {
      localPath: path.isAbsolute(configPath) ? configPath : path.join(root, configPath),
    };
  }

  // No FABER config found - throw or return defaults based on options
  if (!options?.allowMissing) {
    throw new ConfigValidationError([
      'Spec configuration not found.',
      '',
      'Run the following command to create a default configuration:',
      '  fractary init',
    ]);
  }

  // Return default spec config
  return {
    localPath: path.join(root, 'specs'),
  };
}

/**
 * Load log configuration
 *
 * @param projectRoot - Optional project root directory
 * @returns LogConfig (always returns defaults if config missing - logs are optional)
 */
export function loadLogConfig(projectRoot?: string): LogConfig {
  const root = projectRoot || findProjectRoot();
  const faberConfig = loadFaberConfig(root, { allowMissing: true });

  if (faberConfig?.artifacts?.logs) {
    const configPath = faberConfig.artifacts.logs.local_path;
    return {
      localPath: path.isAbsolute(configPath) ? configPath : path.join(root, configPath),
    };
  }

  // No FABER config found - return defaults (logs are optional)
  return {
    localPath: path.join(root, '.fractary', 'logs'),
  };
}

/**
 * Load state configuration
 *
 * @param projectRoot - Optional project root directory
 * @returns StateConfig (always returns defaults if config missing - state is optional)
 */
export function loadStateConfig(projectRoot?: string): StateConfig {
  const root = projectRoot || findProjectRoot();
  const faberConfig = loadFaberConfig(root, { allowMissing: true });

  if (faberConfig?.artifacts?.state) {
    const configPath = faberConfig.artifacts.state.local_path;
    // If it's the schema default (.fractary/plugins/faber), use new default instead
    if (configPath === '.fractary/plugins/faber') {
      return {
        localPath: path.join(root, '.fractary', 'faber'),
      };
    }
    return {
      localPath: path.isAbsolute(configPath) ? configPath : path.join(root, configPath),
    };
  }

  // No FABER config found - return defaults (state is optional)
  return {
    localPath: path.join(root, '.fractary', 'faber'),
  };
}

// ============================================================================
// Exports
// ============================================================================

export { ConfigInitializer } from './config/initializer.js';

export {
  FaberConfigSchema,
  WorkConfigSchema,
  RepoConfigSchema,
  WorkflowConfigSchema,
};
