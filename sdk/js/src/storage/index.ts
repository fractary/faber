/**
 * @fractary/faber - Storage Module
 *
 * Provides local storage for artifacts (specs, logs, state).
 * When @fractary/codex is installed and enabled, delegates to Codex.
 */

export { LocalStorage } from './local.js';
export { CodexAdapter, createStorage } from './codex-adapter.js';
