/**
 * @fractary/faber-mcp - Package exports
 *
 * Unified MCP server for FABER workflow orchestration.
 */

// Export tool creation functions
export { createWorkflowTools, createEventTools } from './tools/index.js';

// Export backend implementations
export { LocalFilesBackend } from './backends/local-files.js';

// Export types
export * from './types.js';

// Package version
export const version = '1.1.5';
