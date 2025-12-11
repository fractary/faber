/**
 * @fractary/faber - FABER SDK
 *
 * Development toolkit for AI-assisted workflows.
 *
 * Modules:
 * - work: Work tracking (GitHub Issues, Jira, Linear)
 * - repo: Repository operations (Git, GitHub, GitLab, Bitbucket)
 * - spec: Specification management
 * - logs: Log management and session capture
 * - state: Workflow state persistence
 * - workflow: FABER workflow orchestration
 * - storage: Artifact storage (local and Codex integration)
 */

// Core exports
export * from './types';
export * from './errors';
export * from './config';

// Module exports
export * from './work';
export * from './repo';
export * from './spec';
export * from './logs';
export * from './state';
export * from './workflow';
export * from './storage';
