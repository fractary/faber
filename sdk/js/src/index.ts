/**
 * @fractary/faber - FABER SDK
 *
 * Development toolkit for AI-assisted workflows.
 *
 * Modules:
 * - work: Work tracking (GitHub Issues, Jira, Linear)
 * - repo: Repository operations (Git, GitHub, GitLab, Bitbucket)
 * - logs: Log management and session capture
 * - state: Workflow state persistence
 * - workflow: FABER workflow orchestration
 * - storage: Artifact storage (local and Codex integration)
 * - agents: Agent type templates and selection
 * - executors: Multi-model step execution framework
 */

// Core exports
export * from './types.js';
export * from './errors.js';
export * from './config.js';
export * from './paths.js';
export * from './defaults.js';

// Workflow registry
export * from './workflows/registry.js';

// Module exports
export * from './work/index.js';
export * from './repo/index.js';
export * from './logs/index.js';
export * from './state/index.js';
export * from './workflow/index.js';
export * from './storage/index.js';
export * from './agents/fractary-faber-index.js';
export * from './changelog/index.js';

// Executors module
export * from './executors/index.js';

// Auth module
export * from './auth/index.js';
