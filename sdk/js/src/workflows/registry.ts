/**
 * @fractary/faber - Workflow Registry
 *
 * Manages workflow discovery and loading from the workflows manifest.
 * Provides a unified interface for finding and loading workflow definitions.
 */

import * as fs from 'fs';
import * as path from 'path';
import * as yaml from 'js-yaml';
import { z } from 'zod';
import type { WorkflowRegistry, WorkflowEntry, FaberPluginConfig } from '../types.js';
import { FABER_DEFAULTS } from '../defaults.js';
import { findProjectRoot } from '../config.js';

// ============================================================================
// Schema Validation
// ============================================================================

const WorkflowEntrySchema = z.object({
  id: z
    .string()
    .min(1)
    .max(64)
    .regex(/^[a-z][a-z0-9-]*$/, 'Workflow ID must be lowercase alphanumeric with hyphens'),
  file: z
    .string()
    .min(1)
    .max(255)
    .regex(/^[a-zA-Z0-9][a-zA-Z0-9._-]*\.(yaml|yml|json)$/, 'File must be a .yaml, .yml, or .json file'),
  description: z.string().max(500).optional(),
});

const WorkflowRegistrySchema = z.object({
  workflows: z.array(WorkflowEntrySchema).min(1),
});

// ============================================================================
// Registry Errors
// ============================================================================

export class WorkflowRegistryError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'WorkflowRegistryError';
  }
}

export class RegistryWorkflowNotFoundError extends WorkflowRegistryError {
  constructor(
    public workflowId: string,
    public availableWorkflows: string[]
  ) {
    super(
      `Workflow '${workflowId}' not found. Available workflows: ${availableWorkflows.join(', ') || 'none'}`
    );
    this.name = 'RegistryWorkflowNotFoundError';
  }
}

// ============================================================================
// Registry Loader
// ============================================================================

export interface LoadRegistryOptions {
  /** Project root directory (auto-detected if not provided) */
  projectRoot?: string;
  /** FABER plugin config (loaded from unified config if not provided) */
  config?: FaberPluginConfig;
  /** Whether to auto-discover workflows if manifest doesn't exist */
  autoDiscover?: boolean;
}

/**
 * Load the workflow registry from the manifest file or auto-discover workflows.
 *
 * @param options Loading options
 * @returns Workflow registry
 * @throws WorkflowRegistryError if registry cannot be loaded
 */
export function loadWorkflowRegistry(options: LoadRegistryOptions = {}): WorkflowRegistry {
  const projectRoot = options.projectRoot || findProjectRoot();
  const workflowsPath =
    options.config?.workflows?.path || FABER_DEFAULTS.paths.workflows;
  const workflowsDir = path.isAbsolute(workflowsPath)
    ? workflowsPath
    : path.join(projectRoot, workflowsPath);

  const manifestPath = path.join(workflowsDir, FABER_DEFAULTS.manifestFilename);

  // Try to load manifest file
  if (fs.existsSync(manifestPath)) {
    return loadManifestFile(manifestPath);
  }

  // Auto-discover if enabled
  if (options.autoDiscover !== false) {
    return autoDiscoverWorkflows(workflowsDir);
  }

  // Return empty registry
  return { workflows: [] };
}

/**
 * Load registry from manifest file (workflows.yaml)
 */
function loadManifestFile(manifestPath: string): WorkflowRegistry {
  try {
    const content = fs.readFileSync(manifestPath, 'utf-8');
    const data = yaml.load(content);

    const result = WorkflowRegistrySchema.safeParse(data);
    if (!result.success) {
      const errors = result.error.errors
        .map((e) => `${e.path.join('.')}: ${e.message}`)
        .join(', ');
      throw new WorkflowRegistryError(
        `Invalid workflow manifest at ${manifestPath}: ${errors}`
      );
    }

    return result.data;
  } catch (error) {
    if (error instanceof WorkflowRegistryError) throw error;
    throw new WorkflowRegistryError(
      `Failed to load workflow manifest: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

/**
 * Auto-discover workflows by scanning the workflows directory
 */
function autoDiscoverWorkflows(workflowsDir: string): WorkflowRegistry {
  if (!fs.existsSync(workflowsDir)) {
    return { workflows: [] };
  }

  const files = fs.readdirSync(workflowsDir);
  const workflows: WorkflowEntry[] = [];

  for (const file of files) {
    // Skip manifest file and non-workflow files
    if (file === FABER_DEFAULTS.manifestFilename) continue;
    if (!/\.(yaml|yml|json)$/.test(file)) continue;

    // Skip files starting with underscore (templates, partials)
    if (file.startsWith('_')) continue;

    // Extract ID from filename
    const id = file.replace(/\.(yaml|yml|json)$/, '');

    // Validate ID format
    if (!/^[a-z][a-z0-9-]*$/.test(id)) {
      console.warn(`Skipping workflow file ${file}: invalid ID format`);
      continue;
    }

    workflows.push({
      id,
      file,
    });
  }

  // Sort by ID for consistent ordering
  workflows.sort((a, b) => a.id.localeCompare(b.id));

  return { workflows };
}

// ============================================================================
// Workflow Access Functions
// ============================================================================

export interface GetWorkflowOptions extends LoadRegistryOptions {
  /** Workflow ID to retrieve */
  workflowId: string;
}

/**
 * Get a specific workflow entry by ID
 *
 * @param options Options including workflowId
 * @returns Workflow entry
 * @throws WorkflowNotFoundError if workflow doesn't exist
 */
export function getWorkflow(options: GetWorkflowOptions): WorkflowEntry {
  const registry = loadWorkflowRegistry(options);
  const workflow = registry.workflows.find((w) => w.id === options.workflowId);

  if (!workflow) {
    throw new RegistryWorkflowNotFoundError(
      options.workflowId,
      registry.workflows.map((w) => w.id)
    );
  }

  return workflow;
}

/**
 * Get the file path for a workflow
 *
 * @param options Options including workflowId
 * @returns Absolute path to the workflow file
 * @throws WorkflowNotFoundError if workflow doesn't exist
 */
export function getWorkflowPath(options: GetWorkflowOptions): string {
  const projectRoot = options.projectRoot || findProjectRoot();
  const workflowsPath =
    options.config?.workflows?.path || FABER_DEFAULTS.paths.workflows;
  const workflowsDir = path.isAbsolute(workflowsPath)
    ? workflowsPath
    : path.join(projectRoot, workflowsPath);

  const workflow = getWorkflow(options);
  return path.join(workflowsDir, workflow.file);
}

/**
 * List all available workflows
 *
 * @param options Loading options
 * @returns Array of workflow entries
 */
export function listWorkflows(options: LoadRegistryOptions = {}): WorkflowEntry[] {
  const registry = loadWorkflowRegistry(options);
  return registry.workflows;
}

/**
 * Check if a workflow exists
 *
 * @param workflowId Workflow ID to check
 * @param options Loading options
 * @returns true if workflow exists
 */
export function workflowExists(
  workflowId: string,
  options: LoadRegistryOptions = {}
): boolean {
  const registry = loadWorkflowRegistry(options);
  return registry.workflows.some((w) => w.id === workflowId);
}

/**
 * Get the default workflow ID from config or fallback
 *
 * @param options Loading options
 * @returns Default workflow ID
 */
export function getDefaultWorkflowId(options: LoadRegistryOptions = {}): string {
  return options.config?.workflows?.default || FABER_DEFAULTS.workflow.defaultWorkflow;
}

// ============================================================================
// Registry Management
// ============================================================================

export interface CreateManifestOptions {
  /** Project root directory */
  projectRoot?: string;
  /** Workflows directory path */
  workflowsPath?: string;
  /** Initial workflows to include */
  workflows?: WorkflowEntry[];
}

/**
 * Create a new workflow manifest file
 *
 * @param options Creation options
 * @returns Path to created manifest
 */
export function createWorkflowManifest(options: CreateManifestOptions = {}): string {
  const projectRoot = options.projectRoot || findProjectRoot();
  const workflowsPath = options.workflowsPath || FABER_DEFAULTS.paths.workflows;
  const workflowsDir = path.isAbsolute(workflowsPath)
    ? workflowsPath
    : path.join(projectRoot, workflowsPath);

  // Ensure directory exists
  fs.mkdirSync(workflowsDir, { recursive: true });

  const manifestPath = path.join(workflowsDir, FABER_DEFAULTS.manifestFilename);

  // Use provided workflows or create default entry
  const workflows = options.workflows || [
    {
      id: 'default',
      file: 'default.yaml',
      description: 'Default FABER workflow for software development',
    },
  ];

  const registry: WorkflowRegistry = { workflows };

  const content = yaml.dump(registry, {
    indent: 2,
    lineWidth: 100,
    noRefs: true,
    sortKeys: false,
  });

  // Add header comment
  const fileContent = `# Workflow Registry - Lists available FABER workflows
# Each workflow is defined in a separate file in this directory
# Schema: https://fractary.dev/schemas/workflow-registry.schema.json

${content}`;

  fs.writeFileSync(manifestPath, fileContent, 'utf-8');

  return manifestPath;
}
