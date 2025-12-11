/**
 * @fractary/faber - Configuration Management
 *
 * Handles loading and validating FABER configuration from project files.
 */

import * as fs from 'fs';
import * as path from 'path';
import { z } from 'zod';
import {
  FaberConfig,
  WorkConfig,
  RepoConfig,
  WorkflowConfig,
  SpecConfig,
  LogConfig,
  StateConfig,
} from './types';
import { ConfigValidationError } from './errors';

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
    state: ArtifactConfigSchema.default({ use_codex: false, local_path: '.fractary/plugins/faber' }),
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

const CONFIG_FILENAME = 'config.json';
const FABER_CONFIG_PATH = `.fractary/plugins/faber/${CONFIG_FILENAME}`;
const WORK_CONFIG_PATH = `.fractary/plugins/work/${CONFIG_FILENAME}`;
const REPO_CONFIG_PATH = `.fractary/plugins/repo/${CONFIG_FILENAME}`;

// ============================================================================
// Configuration Loader
// ============================================================================

/**
 * Find the project root by looking for .fractary or .git directory
 */
export function findProjectRoot(startDir?: string): string {
  let dir = startDir || process.cwd();

  // Check for CLAUDE_WORK_CWD environment variable (set by Claude Code)
  const claudeWorkCwd = process.env['CLAUDE_WORK_CWD'];
  if (claudeWorkCwd && fs.existsSync(claudeWorkCwd)) {
    return claudeWorkCwd;
  }

  while (dir !== path.dirname(dir)) {
    if (fs.existsSync(path.join(dir, '.fractary'))) {
      return dir;
    }
    if (fs.existsSync(path.join(dir, '.git'))) {
      return dir;
    }
    dir = path.dirname(dir);
  }

  return process.cwd();
}

/**
 * Load a JSON configuration file
 */
export function loadJsonConfig<T>(filePath: string): T | null {
  if (!fs.existsSync(filePath)) {
    return null;
  }

  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    return JSON.parse(content) as T;
  } catch {
    return null;
  }
}

/**
 * Load work plugin configuration
 */
export function loadWorkConfig(projectRoot?: string): WorkConfig | null {
  const root = projectRoot || findProjectRoot();
  const configPath = path.join(root, WORK_CONFIG_PATH);
  const config = loadJsonConfig<Record<string, unknown>>(configPath);

  if (!config) {
    return null;
  }

  // Handle handlers structure from plugins
  const handlers = config['handlers'] as Record<string, unknown> | undefined;
  if (handlers) {
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
  }

  // Fallback to direct config
  const result = WorkConfigSchema.safeParse(config);
  if (result.success) {
    return result.data;
  }

  return null;
}

/**
 * Load repo plugin configuration
 */
export function loadRepoConfig(projectRoot?: string): RepoConfig | null {
  const root = projectRoot || findProjectRoot();
  const configPath = path.join(root, REPO_CONFIG_PATH);
  const config = loadJsonConfig<Record<string, unknown>>(configPath);

  if (!config) {
    return null;
  }

  // Handle handlers structure from plugins
  const handlers = config['handlers'] as Record<string, unknown> | undefined;
  if (handlers) {
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
  }

  // Fallback to direct config
  const result = RepoConfigSchema.safeParse(config);
  if (result.success) {
    return result.data;
  }

  return null;
}

/**
 * Load the full FABER configuration
 */
export function loadFaberConfig(projectRoot?: string): FaberConfig | null {
  const root = projectRoot || findProjectRoot();
  const configPath = path.join(root, FABER_CONFIG_PATH);
  const config = loadJsonConfig<Record<string, unknown>>(configPath);

  if (!config) {
    // Try to construct from individual plugin configs
    const workConfig = loadWorkConfig(root);
    const repoConfig = loadRepoConfig(root);

    if (workConfig && repoConfig) {
      return {
        schema_version: '1.0',
        work: workConfig,
        repo: repoConfig,
        artifacts: {
          specs: { use_codex: false, local_path: '/specs' },
          logs: { use_codex: false, local_path: '.fractary/logs' },
          state: { use_codex: false, local_path: '.fractary/plugins/faber' },
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

    return null;
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
 */
export function initFaberConfig(
  projectRoot: string,
  config: Partial<FaberConfig>
): string {
  const configPath = path.join(projectRoot, FABER_CONFIG_PATH);
  const fullConfig = validateConfig({
    schema_version: '1.0',
    ...config,
    artifacts: config.artifacts || {
      specs: { use_codex: false, local_path: '/specs' },
      logs: { use_codex: false, local_path: '.fractary/logs' },
      state: { use_codex: false, local_path: '.fractary/plugins/faber' },
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
 */
export function loadSpecConfig(projectRoot?: string): SpecConfig {
  const root = projectRoot || findProjectRoot();
  const faberConfig = loadFaberConfig(root);

  if (faberConfig?.artifacts?.specs) {
    return {
      localPath: path.join(root, faberConfig.artifacts.specs.local_path),
    };
  }

  // Default spec config
  return {
    localPath: path.join(root, 'specs'),
  };
}

/**
 * Load log configuration
 */
export function loadLogConfig(projectRoot?: string): LogConfig {
  const root = projectRoot || findProjectRoot();
  const faberConfig = loadFaberConfig(root);

  if (faberConfig?.artifacts?.logs) {
    return {
      localPath: path.join(root, faberConfig.artifacts.logs.local_path),
    };
  }

  // Default log config
  return {
    localPath: path.join(root, '.fractary', 'logs'),
  };
}

/**
 * Load state configuration
 */
export function loadStateConfig(projectRoot?: string): StateConfig {
  const root = projectRoot || findProjectRoot();
  const faberConfig = loadFaberConfig(root);

  if (faberConfig?.artifacts?.state) {
    return {
      localPath: path.join(root, faberConfig.artifacts.state.local_path),
    };
  }

  // Default state config
  return {
    localPath: path.join(root, '.faber', 'state'),
  };
}

// ============================================================================
// Exports
// ============================================================================

export {
  FaberConfigSchema,
  WorkConfigSchema,
  RepoConfigSchema,
  WorkflowConfigSchema,
};
