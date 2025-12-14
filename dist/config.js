"use strict";
/**
 * @fractary/faber - Configuration Management
 *
 * Handles loading and validating FABER configuration from project files.
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.WorkflowConfigSchema = exports.RepoConfigSchema = exports.WorkConfigSchema = exports.FaberConfigSchema = exports.ConfigInitializer = void 0;
exports.findProjectRoot = findProjectRoot;
exports.loadJsonConfig = loadJsonConfig;
exports.loadWorkConfig = loadWorkConfig;
exports.loadRepoConfig = loadRepoConfig;
exports.loadFaberConfig = loadFaberConfig;
exports.validateConfig = validateConfig;
exports.getDefaultWorkflowConfig = getDefaultWorkflowConfig;
exports.mergeWithDefaults = mergeWithDefaults;
exports.writeConfig = writeConfig;
exports.initFaberConfig = initFaberConfig;
exports.loadSpecConfig = loadSpecConfig;
exports.loadLogConfig = loadLogConfig;
exports.loadStateConfig = loadStateConfig;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const zod_1 = require("zod");
const errors_1 = require("./errors");
// ============================================================================
// Configuration Schemas
// ============================================================================
const WorkConfigSchema = zod_1.z.object({
    platform: zod_1.z.enum(['github', 'jira', 'linear']),
    owner: zod_1.z.string().optional(),
    repo: zod_1.z.string().optional(),
    project: zod_1.z.string().optional(),
    token: zod_1.z.string().optional(),
});
exports.WorkConfigSchema = WorkConfigSchema;
const BranchPrefixSchema = zod_1.z.object({
    feature: zod_1.z.string().default('feat'),
    bugfix: zod_1.z.string().default('fix'),
    hotfix: zod_1.z.string().default('hotfix'),
    chore: zod_1.z.string().default('chore'),
});
const RepoConfigSchema = zod_1.z.object({
    platform: zod_1.z.enum(['github', 'gitlab', 'bitbucket']),
    owner: zod_1.z.string(),
    repo: zod_1.z.string(),
    defaultBranch: zod_1.z.string().optional().default('main'),
    token: zod_1.z.string().optional(),
    branchPrefix: BranchPrefixSchema.optional(),
});
exports.RepoConfigSchema = RepoConfigSchema;
const PhaseConfigSchema = zod_1.z.object({
    enabled: zod_1.z.boolean().default(true),
});
const ArchitectPhaseSchema = PhaseConfigSchema.extend({
    refineSpec: zod_1.z.boolean().default(true),
});
const EvaluatePhaseSchema = PhaseConfigSchema.extend({
    maxRetries: zod_1.z.number().default(3),
});
const ReleasePhaseSchema = PhaseConfigSchema.extend({
    requestReviews: zod_1.z.boolean().default(false),
    reviewers: zod_1.z.array(zod_1.z.string()).default([]),
});
const WorkflowHooksSchema = zod_1.z.object({
    pre_frame: zod_1.z.string().optional(),
    post_frame: zod_1.z.string().optional(),
    pre_architect: zod_1.z.string().optional(),
    post_architect: zod_1.z.string().optional(),
    pre_build: zod_1.z.string().optional(),
    post_build: zod_1.z.string().optional(),
    pre_evaluate: zod_1.z.string().optional(),
    post_evaluate: zod_1.z.string().optional(),
    pre_release: zod_1.z.string().optional(),
    post_release: zod_1.z.string().optional(),
});
const WorkflowConfigSchema = zod_1.z.object({
    autonomy: zod_1.z.enum(['dry-run', 'assisted', 'guarded', 'autonomous']).default('guarded'),
    phases: zod_1.z.object({
        frame: PhaseConfigSchema.default({ enabled: true }),
        architect: ArchitectPhaseSchema.default({ enabled: true, refineSpec: true }),
        build: PhaseConfigSchema.default({ enabled: true }),
        evaluate: EvaluatePhaseSchema.default({ enabled: true, maxRetries: 3 }),
        release: ReleasePhaseSchema.default({ enabled: true, requestReviews: false, reviewers: [] }),
    }),
    hooks: WorkflowHooksSchema.optional(),
});
exports.WorkflowConfigSchema = WorkflowConfigSchema;
const ArtifactConfigSchema = zod_1.z.object({
    use_codex: zod_1.z.boolean().default(false),
    local_path: zod_1.z.string(),
});
const LLMConfigSchema = zod_1.z.object({
    defaultModel: zod_1.z.string(),
    modelOverrides: zod_1.z.record(zod_1.z.string()).optional(),
});
const FaberConfigSchema = zod_1.z.object({
    schema_version: zod_1.z.string().default('1.0'),
    work: WorkConfigSchema,
    repo: RepoConfigSchema,
    artifacts: zod_1.z.object({
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
exports.FaberConfigSchema = FaberConfigSchema;
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
function findProjectRoot(startDir) {
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
function loadJsonConfig(filePath) {
    if (!fs.existsSync(filePath)) {
        return null;
    }
    try {
        const content = fs.readFileSync(filePath, 'utf-8');
        return JSON.parse(content);
    }
    catch {
        return null;
    }
}
/**
 * Load work plugin configuration
 *
 * @param projectRoot - Optional project root directory
 * @param options - Loading options (allowMissing to return null instead of throwing)
 * @returns WorkConfig or null
 * @throws ConfigValidationError if missing and allowMissing is false
 */
function loadWorkConfig(projectRoot, options) {
    const root = projectRoot || findProjectRoot();
    const configPath = path.join(root, WORK_CONFIG_PATH);
    const config = loadJsonConfig(configPath);
    if (!config) {
        if (options?.allowMissing) {
            return null;
        }
        throw new errors_1.ConfigValidationError([
            'Work plugin configuration not found.',
            '',
            'Run the following command to create a default configuration:',
            '  fractary init',
            '',
            `Expected config at: ${configPath}`,
        ]);
    }
    // Handle handlers structure from plugins
    const handlers = config['handlers'];
    if (handlers) {
        const workTracker = handlers['work-tracker'];
        if (workTracker) {
            const platform = workTracker['active'];
            const platformConfig = workTracker[platform];
            if (platformConfig) {
                return {
                    platform: platform,
                    owner: platformConfig['owner'],
                    repo: platformConfig['repo'],
                    project: platformConfig['project_key'],
                };
            }
        }
    }
    // Fallback to direct config
    const result = WorkConfigSchema.safeParse(config);
    if (result.success) {
        return result.data;
    }
    throw new errors_1.ConfigValidationError(['Invalid work configuration']);
}
/**
 * Load repo plugin configuration
 *
 * @param projectRoot - Optional project root directory
 * @param options - Loading options (allowMissing to return null instead of throwing)
 * @returns RepoConfig or null
 * @throws ConfigValidationError if missing and allowMissing is false
 */
function loadRepoConfig(projectRoot, options) {
    const root = projectRoot || findProjectRoot();
    const configPath = path.join(root, REPO_CONFIG_PATH);
    const config = loadJsonConfig(configPath);
    if (!config) {
        if (options?.allowMissing) {
            return null;
        }
        throw new errors_1.ConfigValidationError([
            'Repo plugin configuration not found.',
            '',
            'Run the following command to create a default configuration:',
            '  fractary init',
            '',
            `Expected config at: ${configPath}`,
        ]);
    }
    // Handle handlers structure from plugins
    const handlers = config['handlers'];
    if (handlers) {
        const sourceControl = handlers['source-control'];
        if (sourceControl) {
            const platform = sourceControl['active'];
            const platformConfig = sourceControl[platform];
            if (platformConfig) {
                return {
                    platform: platform,
                    owner: platformConfig['owner'],
                    repo: platformConfig['repo'],
                    defaultBranch: platformConfig['default_branch'] || 'main',
                };
            }
        }
    }
    // Fallback to direct config
    const result = RepoConfigSchema.safeParse(config);
    if (result.success) {
        return result.data;
    }
    throw new errors_1.ConfigValidationError(['Invalid repo configuration']);
}
/**
 * Load the full FABER configuration
 *
 * @param projectRoot - Optional project root directory
 * @param options - Loading options (allowMissing to return null instead of throwing)
 * @returns FaberConfig or null (if allowMissing is true and config doesn't exist)
 * @throws ConfigValidationError if config exists but is invalid, or if missing and allowMissing is false
 */
function loadFaberConfig(projectRoot, options) {
    const root = projectRoot || findProjectRoot();
    const configPath = path.join(root, FABER_CONFIG_PATH);
    const config = loadJsonConfig(configPath);
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
        // Config not found - throw or return null based on options
        if (options?.allowMissing) {
            return null;
        }
        throw new errors_1.ConfigValidationError([
            'FABER configuration not found.',
            '',
            'Run the following command to create a default configuration:',
            '  fractary init',
            '',
            `Expected config at: ${configPath}`,
        ]);
    }
    const result = FaberConfigSchema.safeParse(config);
    if (!result.success) {
        const errors = result.error.errors.map(e => `${e.path.join('.')}: ${e.message}`);
        throw new errors_1.ConfigValidationError(errors);
    }
    return result.data;
}
/**
 * Validate a configuration object
 */
function validateConfig(config) {
    const result = FaberConfigSchema.safeParse(config);
    if (!result.success) {
        const errors = result.error.errors.map(e => `${e.path.join('.')}: ${e.message}`);
        throw new errors_1.ConfigValidationError(errors);
    }
    return result.data;
}
/**
 * Get the default workflow configuration
 */
function getDefaultWorkflowConfig() {
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
function mergeWithDefaults(partial) {
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
function ensureDir(dirPath) {
    if (!fs.existsSync(dirPath)) {
        fs.mkdirSync(dirPath, { recursive: true });
    }
}
/**
 * Write configuration to file
 *
 * @deprecated Use ConfigInitializer.writeConfig() instead
 */
function writeConfig(configPath, config) {
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
function initFaberConfig(projectRoot, config) {
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
    writeConfig(configPath, fullConfig);
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
function loadSpecConfig(projectRoot, options) {
    const root = projectRoot || findProjectRoot();
    const faberConfig = loadFaberConfig(root, { allowMissing: true });
    if (faberConfig?.artifacts?.specs) {
        return {
            localPath: path.join(root, faberConfig.artifacts.specs.local_path),
        };
    }
    // No FABER config found - throw or return defaults based on options
    if (!options?.allowMissing) {
        throw new errors_1.ConfigValidationError([
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
function loadLogConfig(projectRoot) {
    const root = projectRoot || findProjectRoot();
    const faberConfig = loadFaberConfig(root, { allowMissing: true });
    if (faberConfig?.artifacts?.logs) {
        return {
            localPath: path.join(root, faberConfig.artifacts.logs.local_path),
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
function loadStateConfig(projectRoot) {
    const root = projectRoot || findProjectRoot();
    const faberConfig = loadFaberConfig(root, { allowMissing: true });
    if (faberConfig?.artifacts?.state) {
        return {
            localPath: path.join(root, faberConfig.artifacts.state.local_path),
        };
    }
    // No FABER config found - return defaults (state is optional)
    return {
        localPath: path.join(root, '.faber', 'state'),
    };
}
// ============================================================================
// Exports
// ============================================================================
var initializer_1 = require("./config/initializer");
Object.defineProperty(exports, "ConfigInitializer", { enumerable: true, get: function () { return initializer_1.ConfigInitializer; } });
//# sourceMappingURL=config.js.map