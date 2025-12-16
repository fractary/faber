/**
 * @fractary/faber - Configuration Management
 *
 * Handles loading and validating FABER configuration from project files.
 */
import { z } from 'zod';
import { FaberConfig, WorkConfig, RepoConfig, WorkflowConfig, SpecConfig, LogConfig, StateConfig } from './types';
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
declare const WorkConfigSchema: z.ZodObject<{
    platform: z.ZodEnum<["github", "jira", "linear"]>;
    owner: z.ZodOptional<z.ZodString>;
    repo: z.ZodOptional<z.ZodString>;
    project: z.ZodOptional<z.ZodString>;
    token: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    platform: "github" | "jira" | "linear";
    owner?: string | undefined;
    repo?: string | undefined;
    project?: string | undefined;
    token?: string | undefined;
}, {
    platform: "github" | "jira" | "linear";
    owner?: string | undefined;
    repo?: string | undefined;
    project?: string | undefined;
    token?: string | undefined;
}>;
declare const RepoConfigSchema: z.ZodObject<{
    platform: z.ZodEnum<["github", "gitlab", "bitbucket"]>;
    owner: z.ZodString;
    repo: z.ZodString;
    defaultBranch: z.ZodDefault<z.ZodOptional<z.ZodString>>;
    token: z.ZodOptional<z.ZodString>;
    branchPrefix: z.ZodOptional<z.ZodObject<{
        feature: z.ZodDefault<z.ZodString>;
        bugfix: z.ZodDefault<z.ZodString>;
        hotfix: z.ZodDefault<z.ZodString>;
        chore: z.ZodDefault<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        feature: string;
        chore: string;
        bugfix: string;
        hotfix: string;
    }, {
        feature?: string | undefined;
        chore?: string | undefined;
        bugfix?: string | undefined;
        hotfix?: string | undefined;
    }>>;
}, "strip", z.ZodTypeAny, {
    platform: "github" | "gitlab" | "bitbucket";
    owner: string;
    repo: string;
    defaultBranch: string;
    token?: string | undefined;
    branchPrefix?: {
        feature: string;
        chore: string;
        bugfix: string;
        hotfix: string;
    } | undefined;
}, {
    platform: "github" | "gitlab" | "bitbucket";
    owner: string;
    repo: string;
    token?: string | undefined;
    defaultBranch?: string | undefined;
    branchPrefix?: {
        feature?: string | undefined;
        chore?: string | undefined;
        bugfix?: string | undefined;
        hotfix?: string | undefined;
    } | undefined;
}>;
declare const WorkflowConfigSchema: z.ZodObject<{
    autonomy: z.ZodDefault<z.ZodEnum<["dry-run", "assisted", "guarded", "autonomous"]>>;
    phases: z.ZodObject<{
        frame: z.ZodDefault<z.ZodObject<{
            enabled: z.ZodDefault<z.ZodBoolean>;
        }, "strip", z.ZodTypeAny, {
            enabled: boolean;
        }, {
            enabled?: boolean | undefined;
        }>>;
        architect: z.ZodDefault<z.ZodObject<{
            enabled: z.ZodDefault<z.ZodBoolean>;
        } & {
            refineSpec: z.ZodDefault<z.ZodBoolean>;
        }, "strip", z.ZodTypeAny, {
            refineSpec: boolean;
            enabled: boolean;
        }, {
            refineSpec?: boolean | undefined;
            enabled?: boolean | undefined;
        }>>;
        build: z.ZodDefault<z.ZodObject<{
            enabled: z.ZodDefault<z.ZodBoolean>;
        }, "strip", z.ZodTypeAny, {
            enabled: boolean;
        }, {
            enabled?: boolean | undefined;
        }>>;
        evaluate: z.ZodDefault<z.ZodObject<{
            enabled: z.ZodDefault<z.ZodBoolean>;
        } & {
            maxRetries: z.ZodDefault<z.ZodNumber>;
        }, "strip", z.ZodTypeAny, {
            maxRetries: number;
            enabled: boolean;
        }, {
            maxRetries?: number | undefined;
            enabled?: boolean | undefined;
        }>>;
        release: z.ZodDefault<z.ZodObject<{
            enabled: z.ZodDefault<z.ZodBoolean>;
        } & {
            requestReviews: z.ZodDefault<z.ZodBoolean>;
            reviewers: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
        }, "strip", z.ZodTypeAny, {
            requestReviews: boolean;
            reviewers: string[];
            enabled: boolean;
        }, {
            requestReviews?: boolean | undefined;
            reviewers?: string[] | undefined;
            enabled?: boolean | undefined;
        }>>;
    }, "strip", z.ZodTypeAny, {
        frame: {
            enabled: boolean;
        };
        architect: {
            refineSpec: boolean;
            enabled: boolean;
        };
        build: {
            enabled: boolean;
        };
        evaluate: {
            maxRetries: number;
            enabled: boolean;
        };
        release: {
            requestReviews: boolean;
            reviewers: string[];
            enabled: boolean;
        };
    }, {
        frame?: {
            enabled?: boolean | undefined;
        } | undefined;
        architect?: {
            refineSpec?: boolean | undefined;
            enabled?: boolean | undefined;
        } | undefined;
        build?: {
            enabled?: boolean | undefined;
        } | undefined;
        evaluate?: {
            maxRetries?: number | undefined;
            enabled?: boolean | undefined;
        } | undefined;
        release?: {
            requestReviews?: boolean | undefined;
            reviewers?: string[] | undefined;
            enabled?: boolean | undefined;
        } | undefined;
    }>;
    hooks: z.ZodOptional<z.ZodObject<{
        pre_frame: z.ZodOptional<z.ZodString>;
        post_frame: z.ZodOptional<z.ZodString>;
        pre_architect: z.ZodOptional<z.ZodString>;
        post_architect: z.ZodOptional<z.ZodString>;
        pre_build: z.ZodOptional<z.ZodString>;
        post_build: z.ZodOptional<z.ZodString>;
        pre_evaluate: z.ZodOptional<z.ZodString>;
        post_evaluate: z.ZodOptional<z.ZodString>;
        pre_release: z.ZodOptional<z.ZodString>;
        post_release: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        pre_frame?: string | undefined;
        post_frame?: string | undefined;
        pre_architect?: string | undefined;
        post_architect?: string | undefined;
        pre_build?: string | undefined;
        post_build?: string | undefined;
        pre_evaluate?: string | undefined;
        post_evaluate?: string | undefined;
        pre_release?: string | undefined;
        post_release?: string | undefined;
    }, {
        pre_frame?: string | undefined;
        post_frame?: string | undefined;
        pre_architect?: string | undefined;
        post_architect?: string | undefined;
        pre_build?: string | undefined;
        post_build?: string | undefined;
        pre_evaluate?: string | undefined;
        post_evaluate?: string | undefined;
        pre_release?: string | undefined;
        post_release?: string | undefined;
    }>>;
}, "strip", z.ZodTypeAny, {
    autonomy: "dry-run" | "assisted" | "guarded" | "autonomous";
    phases: {
        frame: {
            enabled: boolean;
        };
        architect: {
            refineSpec: boolean;
            enabled: boolean;
        };
        build: {
            enabled: boolean;
        };
        evaluate: {
            maxRetries: number;
            enabled: boolean;
        };
        release: {
            requestReviews: boolean;
            reviewers: string[];
            enabled: boolean;
        };
    };
    hooks?: {
        pre_frame?: string | undefined;
        post_frame?: string | undefined;
        pre_architect?: string | undefined;
        post_architect?: string | undefined;
        pre_build?: string | undefined;
        post_build?: string | undefined;
        pre_evaluate?: string | undefined;
        post_evaluate?: string | undefined;
        pre_release?: string | undefined;
        post_release?: string | undefined;
    } | undefined;
}, {
    phases: {
        frame?: {
            enabled?: boolean | undefined;
        } | undefined;
        architect?: {
            refineSpec?: boolean | undefined;
            enabled?: boolean | undefined;
        } | undefined;
        build?: {
            enabled?: boolean | undefined;
        } | undefined;
        evaluate?: {
            maxRetries?: number | undefined;
            enabled?: boolean | undefined;
        } | undefined;
        release?: {
            requestReviews?: boolean | undefined;
            reviewers?: string[] | undefined;
            enabled?: boolean | undefined;
        } | undefined;
    };
    autonomy?: "dry-run" | "assisted" | "guarded" | "autonomous" | undefined;
    hooks?: {
        pre_frame?: string | undefined;
        post_frame?: string | undefined;
        pre_architect?: string | undefined;
        post_architect?: string | undefined;
        pre_build?: string | undefined;
        post_build?: string | undefined;
        pre_evaluate?: string | undefined;
        post_evaluate?: string | undefined;
        pre_release?: string | undefined;
        post_release?: string | undefined;
    } | undefined;
}>;
declare const FaberConfigSchema: z.ZodObject<{
    schema_version: z.ZodDefault<z.ZodString>;
    work: z.ZodObject<{
        platform: z.ZodEnum<["github", "jira", "linear"]>;
        owner: z.ZodOptional<z.ZodString>;
        repo: z.ZodOptional<z.ZodString>;
        project: z.ZodOptional<z.ZodString>;
        token: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        platform: "github" | "jira" | "linear";
        owner?: string | undefined;
        repo?: string | undefined;
        project?: string | undefined;
        token?: string | undefined;
    }, {
        platform: "github" | "jira" | "linear";
        owner?: string | undefined;
        repo?: string | undefined;
        project?: string | undefined;
        token?: string | undefined;
    }>;
    repo: z.ZodObject<{
        platform: z.ZodEnum<["github", "gitlab", "bitbucket"]>;
        owner: z.ZodString;
        repo: z.ZodString;
        defaultBranch: z.ZodDefault<z.ZodOptional<z.ZodString>>;
        token: z.ZodOptional<z.ZodString>;
        branchPrefix: z.ZodOptional<z.ZodObject<{
            feature: z.ZodDefault<z.ZodString>;
            bugfix: z.ZodDefault<z.ZodString>;
            hotfix: z.ZodDefault<z.ZodString>;
            chore: z.ZodDefault<z.ZodString>;
        }, "strip", z.ZodTypeAny, {
            feature: string;
            chore: string;
            bugfix: string;
            hotfix: string;
        }, {
            feature?: string | undefined;
            chore?: string | undefined;
            bugfix?: string | undefined;
            hotfix?: string | undefined;
        }>>;
    }, "strip", z.ZodTypeAny, {
        platform: "github" | "gitlab" | "bitbucket";
        owner: string;
        repo: string;
        defaultBranch: string;
        token?: string | undefined;
        branchPrefix?: {
            feature: string;
            chore: string;
            bugfix: string;
            hotfix: string;
        } | undefined;
    }, {
        platform: "github" | "gitlab" | "bitbucket";
        owner: string;
        repo: string;
        token?: string | undefined;
        defaultBranch?: string | undefined;
        branchPrefix?: {
            feature?: string | undefined;
            chore?: string | undefined;
            bugfix?: string | undefined;
            hotfix?: string | undefined;
        } | undefined;
    }>;
    artifacts: z.ZodObject<{
        specs: z.ZodDefault<z.ZodObject<{
            use_codex: z.ZodDefault<z.ZodBoolean>;
            local_path: z.ZodString;
        }, "strip", z.ZodTypeAny, {
            use_codex: boolean;
            local_path: string;
        }, {
            local_path: string;
            use_codex?: boolean | undefined;
        }>>;
        logs: z.ZodDefault<z.ZodObject<{
            use_codex: z.ZodDefault<z.ZodBoolean>;
            local_path: z.ZodString;
        }, "strip", z.ZodTypeAny, {
            use_codex: boolean;
            local_path: string;
        }, {
            local_path: string;
            use_codex?: boolean | undefined;
        }>>;
        state: z.ZodDefault<z.ZodObject<{
            use_codex: z.ZodDefault<z.ZodBoolean>;
            local_path: z.ZodString;
        }, "strip", z.ZodTypeAny, {
            use_codex: boolean;
            local_path: string;
        }, {
            local_path: string;
            use_codex?: boolean | undefined;
        }>>;
    }, "strip", z.ZodTypeAny, {
        specs: {
            use_codex: boolean;
            local_path: string;
        };
        logs: {
            use_codex: boolean;
            local_path: string;
        };
        state: {
            use_codex: boolean;
            local_path: string;
        };
    }, {
        specs?: {
            local_path: string;
            use_codex?: boolean | undefined;
        } | undefined;
        logs?: {
            local_path: string;
            use_codex?: boolean | undefined;
        } | undefined;
        state?: {
            local_path: string;
            use_codex?: boolean | undefined;
        } | undefined;
    }>;
    workflow: z.ZodDefault<z.ZodObject<{
        autonomy: z.ZodDefault<z.ZodEnum<["dry-run", "assisted", "guarded", "autonomous"]>>;
        phases: z.ZodObject<{
            frame: z.ZodDefault<z.ZodObject<{
                enabled: z.ZodDefault<z.ZodBoolean>;
            }, "strip", z.ZodTypeAny, {
                enabled: boolean;
            }, {
                enabled?: boolean | undefined;
            }>>;
            architect: z.ZodDefault<z.ZodObject<{
                enabled: z.ZodDefault<z.ZodBoolean>;
            } & {
                refineSpec: z.ZodDefault<z.ZodBoolean>;
            }, "strip", z.ZodTypeAny, {
                refineSpec: boolean;
                enabled: boolean;
            }, {
                refineSpec?: boolean | undefined;
                enabled?: boolean | undefined;
            }>>;
            build: z.ZodDefault<z.ZodObject<{
                enabled: z.ZodDefault<z.ZodBoolean>;
            }, "strip", z.ZodTypeAny, {
                enabled: boolean;
            }, {
                enabled?: boolean | undefined;
            }>>;
            evaluate: z.ZodDefault<z.ZodObject<{
                enabled: z.ZodDefault<z.ZodBoolean>;
            } & {
                maxRetries: z.ZodDefault<z.ZodNumber>;
            }, "strip", z.ZodTypeAny, {
                maxRetries: number;
                enabled: boolean;
            }, {
                maxRetries?: number | undefined;
                enabled?: boolean | undefined;
            }>>;
            release: z.ZodDefault<z.ZodObject<{
                enabled: z.ZodDefault<z.ZodBoolean>;
            } & {
                requestReviews: z.ZodDefault<z.ZodBoolean>;
                reviewers: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
            }, "strip", z.ZodTypeAny, {
                requestReviews: boolean;
                reviewers: string[];
                enabled: boolean;
            }, {
                requestReviews?: boolean | undefined;
                reviewers?: string[] | undefined;
                enabled?: boolean | undefined;
            }>>;
        }, "strip", z.ZodTypeAny, {
            frame: {
                enabled: boolean;
            };
            architect: {
                refineSpec: boolean;
                enabled: boolean;
            };
            build: {
                enabled: boolean;
            };
            evaluate: {
                maxRetries: number;
                enabled: boolean;
            };
            release: {
                requestReviews: boolean;
                reviewers: string[];
                enabled: boolean;
            };
        }, {
            frame?: {
                enabled?: boolean | undefined;
            } | undefined;
            architect?: {
                refineSpec?: boolean | undefined;
                enabled?: boolean | undefined;
            } | undefined;
            build?: {
                enabled?: boolean | undefined;
            } | undefined;
            evaluate?: {
                maxRetries?: number | undefined;
                enabled?: boolean | undefined;
            } | undefined;
            release?: {
                requestReviews?: boolean | undefined;
                reviewers?: string[] | undefined;
                enabled?: boolean | undefined;
            } | undefined;
        }>;
        hooks: z.ZodOptional<z.ZodObject<{
            pre_frame: z.ZodOptional<z.ZodString>;
            post_frame: z.ZodOptional<z.ZodString>;
            pre_architect: z.ZodOptional<z.ZodString>;
            post_architect: z.ZodOptional<z.ZodString>;
            pre_build: z.ZodOptional<z.ZodString>;
            post_build: z.ZodOptional<z.ZodString>;
            pre_evaluate: z.ZodOptional<z.ZodString>;
            post_evaluate: z.ZodOptional<z.ZodString>;
            pre_release: z.ZodOptional<z.ZodString>;
            post_release: z.ZodOptional<z.ZodString>;
        }, "strip", z.ZodTypeAny, {
            pre_frame?: string | undefined;
            post_frame?: string | undefined;
            pre_architect?: string | undefined;
            post_architect?: string | undefined;
            pre_build?: string | undefined;
            post_build?: string | undefined;
            pre_evaluate?: string | undefined;
            post_evaluate?: string | undefined;
            pre_release?: string | undefined;
            post_release?: string | undefined;
        }, {
            pre_frame?: string | undefined;
            post_frame?: string | undefined;
            pre_architect?: string | undefined;
            post_architect?: string | undefined;
            pre_build?: string | undefined;
            post_build?: string | undefined;
            pre_evaluate?: string | undefined;
            post_evaluate?: string | undefined;
            pre_release?: string | undefined;
            post_release?: string | undefined;
        }>>;
    }, "strip", z.ZodTypeAny, {
        autonomy: "dry-run" | "assisted" | "guarded" | "autonomous";
        phases: {
            frame: {
                enabled: boolean;
            };
            architect: {
                refineSpec: boolean;
                enabled: boolean;
            };
            build: {
                enabled: boolean;
            };
            evaluate: {
                maxRetries: number;
                enabled: boolean;
            };
            release: {
                requestReviews: boolean;
                reviewers: string[];
                enabled: boolean;
            };
        };
        hooks?: {
            pre_frame?: string | undefined;
            post_frame?: string | undefined;
            pre_architect?: string | undefined;
            post_architect?: string | undefined;
            pre_build?: string | undefined;
            post_build?: string | undefined;
            pre_evaluate?: string | undefined;
            post_evaluate?: string | undefined;
            pre_release?: string | undefined;
            post_release?: string | undefined;
        } | undefined;
    }, {
        phases: {
            frame?: {
                enabled?: boolean | undefined;
            } | undefined;
            architect?: {
                refineSpec?: boolean | undefined;
                enabled?: boolean | undefined;
            } | undefined;
            build?: {
                enabled?: boolean | undefined;
            } | undefined;
            evaluate?: {
                maxRetries?: number | undefined;
                enabled?: boolean | undefined;
            } | undefined;
            release?: {
                requestReviews?: boolean | undefined;
                reviewers?: string[] | undefined;
                enabled?: boolean | undefined;
            } | undefined;
        };
        autonomy?: "dry-run" | "assisted" | "guarded" | "autonomous" | undefined;
        hooks?: {
            pre_frame?: string | undefined;
            post_frame?: string | undefined;
            pre_architect?: string | undefined;
            post_architect?: string | undefined;
            pre_build?: string | undefined;
            post_build?: string | undefined;
            pre_evaluate?: string | undefined;
            post_evaluate?: string | undefined;
            pre_release?: string | undefined;
            post_release?: string | undefined;
        } | undefined;
    }>>;
    llm: z.ZodOptional<z.ZodObject<{
        defaultModel: z.ZodString;
        modelOverrides: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodString>>;
    }, "strip", z.ZodTypeAny, {
        defaultModel: string;
        modelOverrides?: Record<string, string> | undefined;
    }, {
        defaultModel: string;
        modelOverrides?: Record<string, string> | undefined;
    }>>;
}, "strip", z.ZodTypeAny, {
    workflow: {
        autonomy: "dry-run" | "assisted" | "guarded" | "autonomous";
        phases: {
            frame: {
                enabled: boolean;
            };
            architect: {
                refineSpec: boolean;
                enabled: boolean;
            };
            build: {
                enabled: boolean;
            };
            evaluate: {
                maxRetries: number;
                enabled: boolean;
            };
            release: {
                requestReviews: boolean;
                reviewers: string[];
                enabled: boolean;
            };
        };
        hooks?: {
            pre_frame?: string | undefined;
            post_frame?: string | undefined;
            pre_architect?: string | undefined;
            post_architect?: string | undefined;
            pre_build?: string | undefined;
            post_build?: string | undefined;
            pre_evaluate?: string | undefined;
            post_evaluate?: string | undefined;
            pre_release?: string | undefined;
            post_release?: string | undefined;
        } | undefined;
    };
    repo: {
        platform: "github" | "gitlab" | "bitbucket";
        owner: string;
        repo: string;
        defaultBranch: string;
        token?: string | undefined;
        branchPrefix?: {
            feature: string;
            chore: string;
            bugfix: string;
            hotfix: string;
        } | undefined;
    };
    schema_version: string;
    work: {
        platform: "github" | "jira" | "linear";
        owner?: string | undefined;
        repo?: string | undefined;
        project?: string | undefined;
        token?: string | undefined;
    };
    artifacts: {
        specs: {
            use_codex: boolean;
            local_path: string;
        };
        logs: {
            use_codex: boolean;
            local_path: string;
        };
        state: {
            use_codex: boolean;
            local_path: string;
        };
    };
    llm?: {
        defaultModel: string;
        modelOverrides?: Record<string, string> | undefined;
    } | undefined;
}, {
    repo: {
        platform: "github" | "gitlab" | "bitbucket";
        owner: string;
        repo: string;
        token?: string | undefined;
        defaultBranch?: string | undefined;
        branchPrefix?: {
            feature?: string | undefined;
            chore?: string | undefined;
            bugfix?: string | undefined;
            hotfix?: string | undefined;
        } | undefined;
    };
    work: {
        platform: "github" | "jira" | "linear";
        owner?: string | undefined;
        repo?: string | undefined;
        project?: string | undefined;
        token?: string | undefined;
    };
    artifacts: {
        specs?: {
            local_path: string;
            use_codex?: boolean | undefined;
        } | undefined;
        logs?: {
            local_path: string;
            use_codex?: boolean | undefined;
        } | undefined;
        state?: {
            local_path: string;
            use_codex?: boolean | undefined;
        } | undefined;
    };
    workflow?: {
        phases: {
            frame?: {
                enabled?: boolean | undefined;
            } | undefined;
            architect?: {
                refineSpec?: boolean | undefined;
                enabled?: boolean | undefined;
            } | undefined;
            build?: {
                enabled?: boolean | undefined;
            } | undefined;
            evaluate?: {
                maxRetries?: number | undefined;
                enabled?: boolean | undefined;
            } | undefined;
            release?: {
                requestReviews?: boolean | undefined;
                reviewers?: string[] | undefined;
                enabled?: boolean | undefined;
            } | undefined;
        };
        autonomy?: "dry-run" | "assisted" | "guarded" | "autonomous" | undefined;
        hooks?: {
            pre_frame?: string | undefined;
            post_frame?: string | undefined;
            pre_architect?: string | undefined;
            post_architect?: string | undefined;
            pre_build?: string | undefined;
            post_build?: string | undefined;
            pre_evaluate?: string | undefined;
            post_evaluate?: string | undefined;
            pre_release?: string | undefined;
            post_release?: string | undefined;
        } | undefined;
    } | undefined;
    schema_version?: string | undefined;
    llm?: {
        defaultModel: string;
        modelOverrides?: Record<string, string> | undefined;
    } | undefined;
}>;
/**
 * Find the project root by looking for .fractary or .git directory
 */
export declare function findProjectRoot(startDir?: string): string;
/**
 * Load a JSON configuration file
 */
export declare function loadJsonConfig<T>(filePath: string): T | null;
/**
 * Load work plugin configuration
 *
 * @param projectRoot - Optional project root directory
 * @param options - Loading options (allowMissing to return null instead of throwing)
 * @returns WorkConfig or null
 * @throws ConfigValidationError if missing and allowMissing is false
 */
export declare function loadWorkConfig(projectRoot?: string, options?: LoadConfigOptions): WorkConfig | null;
/**
 * Load repo plugin configuration
 *
 * @param projectRoot - Optional project root directory
 * @param options - Loading options (allowMissing to return null instead of throwing)
 * @returns RepoConfig or null
 * @throws ConfigValidationError if missing and allowMissing is false
 */
export declare function loadRepoConfig(projectRoot?: string, options?: LoadConfigOptions): RepoConfig | null;
/**
 * Load the full FABER configuration
 *
 * @param projectRoot - Optional project root directory
 * @param options - Loading options (allowMissing to return null instead of throwing)
 * @returns FaberConfig or null (if allowMissing is true and config doesn't exist)
 * @throws ConfigValidationError if config exists but is invalid, or if missing and allowMissing is false
 */
export declare function loadFaberConfig(projectRoot?: string, options?: LoadConfigOptions): FaberConfig | null;
/**
 * Validate a configuration object
 */
export declare function validateConfig(config: unknown): FaberConfig;
/**
 * Get the default workflow configuration
 */
export declare function getDefaultWorkflowConfig(): WorkflowConfig;
/**
 * Merge partial config with defaults
 */
export declare function mergeWithDefaults(partial: Partial<WorkflowConfig>): WorkflowConfig;
/**
 * Write configuration to file
 *
 * @deprecated Use ConfigInitializer.writeConfig() instead
 */
export declare function writeConfig(configPath: string, config: Record<string, unknown>): void;
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
export declare function initFaberConfig(projectRoot: string, config: Partial<FaberConfig>): string;
/**
 * Load spec configuration
 *
 * @param projectRoot - Optional project root directory
 * @param options - Loading options (allowMissing to return default config instead of throwing)
 * @returns SpecConfig (with defaults if allowMissing is true and config missing)
 * @throws ConfigValidationError if missing and allowMissing is false
 */
export declare function loadSpecConfig(projectRoot?: string, options?: LoadConfigOptions): SpecConfig;
/**
 * Load log configuration
 *
 * @param projectRoot - Optional project root directory
 * @returns LogConfig (always returns defaults if config missing - logs are optional)
 */
export declare function loadLogConfig(projectRoot?: string): LogConfig;
/**
 * Load state configuration
 *
 * @param projectRoot - Optional project root directory
 * @returns StateConfig (always returns defaults if config missing - state is optional)
 */
export declare function loadStateConfig(projectRoot?: string): StateConfig;
export { ConfigInitializer } from './config/initializer';
export { FaberConfigSchema, WorkConfigSchema, RepoConfigSchema, WorkflowConfigSchema, };
//# sourceMappingURL=config.d.ts.map