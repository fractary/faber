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

// ============================================================================
// Workflow CRUD Operations
// ============================================================================

export interface CreateWorkflowOptions extends LoadRegistryOptions {
  /** Workflow name/ID */
  name: string;
  /** Optional template to copy from */
  template?: string;
  /** Workflow description */
  description?: string;
}

export interface UpdateWorkflowOptions extends LoadRegistryOptions {
  /** Workflow name/ID to update */
  name: string;
  /** New description */
  description?: string;
}

export interface WorkflowInspectionResult {
  /** Workflow entry from registry */
  entry: WorkflowEntry;
  /** Absolute path to the workflow file */
  filePath: string;
  /** Whether the workflow file exists on disk */
  fileExists: boolean;
  /** Parsed workflow content (if file exists) */
  content?: Record<string, unknown>;
  /** File size in bytes (if file exists) */
  fileSize?: number;
  /** Last modified time (if file exists) */
  lastModified?: string;
}

export interface DebugReport {
  /** Run ID being debugged */
  runId: string;
  /** Whether run state was found */
  found: boolean;
  /** Current run state (if found) */
  state?: Record<string, unknown>;
  /** Events found for the run */
  events?: string[];
  /** Detected issues */
  issues: string[];
}

/**
 * Create a new workflow and register it in the manifest.
 *
 * @param options Creation options
 * @returns The created workflow entry and file path
 */
export function createWorkflow(
  options: CreateWorkflowOptions
): { entry: WorkflowEntry; filePath: string; manifestPath: string } {
  const projectRoot = options.projectRoot || findProjectRoot();
  const workflowsPath =
    options.config?.workflows?.path || FABER_DEFAULTS.paths.workflows;
  const workflowsDir = path.isAbsolute(workflowsPath)
    ? workflowsPath
    : path.join(projectRoot, workflowsPath);

  // Validate name format
  if (!/^[a-z][a-z0-9-]*$/.test(options.name)) {
    throw new WorkflowRegistryError(
      `Invalid workflow name '${options.name}'. Must be lowercase alphanumeric with hyphens.`
    );
  }

  // Check for duplicates
  if (workflowExists(options.name, options)) {
    throw new WorkflowRegistryError(
      `Workflow '${options.name}' already exists.`
    );
  }

  // Determine workflow file
  const fileName = `${options.name}.yaml`;
  const filePath = path.join(workflowsDir, fileName);

  // Ensure workflows directory exists
  fs.mkdirSync(workflowsDir, { recursive: true });

  // Create workflow file content
  let content: Record<string, unknown>;
  if (options.template) {
    // Copy from template
    const templateEntry = getWorkflow({ ...options, workflowId: options.template });
    const templatePath = path.join(workflowsDir, templateEntry.file);
    if (fs.existsSync(templatePath)) {
      const templateContent = fs.readFileSync(templatePath, 'utf-8');
      content = yaml.load(templateContent) as Record<string, unknown>;
    } else {
      content = { id: options.name, description: options.description || '' };
    }
  } else {
    content = {
      id: options.name,
      description: options.description || `Workflow: ${options.name}`,
      phases: {
        frame: { enabled: true, steps: [] },
        architect: { enabled: true, steps: [] },
        build: { enabled: true, steps: [] },
        evaluate: { enabled: true, steps: [] },
        release: { enabled: true, steps: [] },
      },
    };
  }

  // Write workflow file
  const yamlContent = yaml.dump(content, {
    indent: 2,
    lineWidth: 100,
    noRefs: true,
    sortKeys: false,
  });
  fs.writeFileSync(filePath, yamlContent, 'utf-8');

  // Create entry
  const entry: WorkflowEntry = {
    id: options.name,
    file: fileName,
    description: options.description,
  };

  // Update manifest
  const manifestPath = path.join(workflowsDir, FABER_DEFAULTS.manifestFilename);
  let registry: WorkflowRegistry;
  if (fs.existsSync(manifestPath)) {
    registry = loadWorkflowRegistry(options);
  } else {
    registry = { workflows: [] };
  }
  registry.workflows.push(entry);

  const manifestContent = yaml.dump(registry, {
    indent: 2,
    lineWidth: 100,
    noRefs: true,
    sortKeys: false,
  });
  const manifestFileContent = `# Workflow Registry - Lists available FABER workflows
# Each workflow is defined in a separate file in this directory
# Schema: https://fractary.dev/schemas/workflow-registry.schema.json

${manifestContent}`;
  fs.writeFileSync(manifestPath, manifestFileContent, 'utf-8');

  return { entry, filePath, manifestPath };
}

/**
 * Update an existing workflow's registry entry.
 *
 * @param options Update options
 */
export function updateWorkflow(options: UpdateWorkflowOptions): WorkflowEntry {
  const projectRoot = options.projectRoot || findProjectRoot();
  const workflowsPath =
    options.config?.workflows?.path || FABER_DEFAULTS.paths.workflows;
  const workflowsDir = path.isAbsolute(workflowsPath)
    ? workflowsPath
    : path.join(projectRoot, workflowsPath);

  const registry = loadWorkflowRegistry(options);
  const index = registry.workflows.findIndex((w) => w.id === options.name);

  if (index === -1) {
    throw new RegistryWorkflowNotFoundError(
      options.name,
      registry.workflows.map((w) => w.id)
    );
  }

  // Update entry
  if (options.description !== undefined) {
    registry.workflows[index].description = options.description;
  }

  // Write manifest
  const manifestPath = path.join(workflowsDir, FABER_DEFAULTS.manifestFilename);
  const manifestContent = yaml.dump(registry, {
    indent: 2,
    lineWidth: 100,
    noRefs: true,
    sortKeys: false,
  });
  const manifestFileContent = `# Workflow Registry - Lists available FABER workflows
# Each workflow is defined in a separate file in this directory
# Schema: https://fractary.dev/schemas/workflow-registry.schema.json

${manifestContent}`;
  fs.writeFileSync(manifestPath, manifestFileContent, 'utf-8');

  return registry.workflows[index];
}

/**
 * Inspect a workflow: returns entry, file info, and parsed content.
 *
 * @param options Options including workflowId
 * @returns Detailed workflow inspection result
 */
export function inspectWorkflow(options: GetWorkflowOptions): WorkflowInspectionResult {
  const projectRoot = options.projectRoot || findProjectRoot();
  const workflowsPath =
    options.config?.workflows?.path || FABER_DEFAULTS.paths.workflows;
  const workflowsDir = path.isAbsolute(workflowsPath)
    ? workflowsPath
    : path.join(projectRoot, workflowsPath);

  const entry = getWorkflow(options);
  const filePath = path.join(workflowsDir, entry.file);
  const fileExists = fs.existsSync(filePath);

  const result: WorkflowInspectionResult = {
    entry,
    filePath,
    fileExists,
  };

  if (fileExists) {
    const stat = fs.statSync(filePath);
    result.fileSize = stat.size;
    result.lastModified = stat.mtime.toISOString();

    try {
      const content = fs.readFileSync(filePath, 'utf-8');
      result.content = yaml.load(content) as Record<string, unknown>;
    } catch {
      // Could not parse - still return other info
    }
  }

  return result;
}

/**
 * Debug a workflow run by examining its state and events.
 *
 * @param runId Run identifier
 * @param projectRoot Optional project root
 * @returns Debug report
 */
export function debugWorkflow(runId: string, projectRoot?: string): DebugReport {
  const root = projectRoot || findProjectRoot();
  const runsDir = path.join(root, FABER_DEFAULTS.paths.runs);
  const runDir = path.join(runsDir, runId);

  const report: DebugReport = {
    runId,
    found: false,
    issues: [],
  };

  if (!fs.existsSync(runDir)) {
    report.issues.push(`Run directory not found: ${runDir}`);
    return report;
  }

  report.found = true;

  // Load state
  const statePath = path.join(runDir, 'state.json');
  if (fs.existsSync(statePath)) {
    try {
      report.state = JSON.parse(fs.readFileSync(statePath, 'utf-8'));
    } catch (e) {
      report.issues.push(`Failed to parse state.json: ${e instanceof Error ? e.message : String(e)}`);
    }
  } else {
    report.issues.push('state.json not found');
  }

  // Load events
  const eventsDir = path.join(runDir, 'events');
  if (fs.existsSync(eventsDir)) {
    try {
      report.events = fs.readdirSync(eventsDir)
        .filter(f => f.endsWith('.json') && !f.startsWith('.'))
        .sort();
    } catch {
      report.issues.push('Failed to read events directory');
    }
  } else {
    report.issues.push('events directory not found');
  }

  // Check for common issues
  if (report.state) {
    const state = report.state as Record<string, unknown>;
    if (state['status'] === 'in_progress') {
      const updatedAt = state['updated_at'] as string | undefined;
      if (updatedAt) {
        const lastUpdate = new Date(updatedAt);
        const now = new Date();
        const hoursSinceUpdate = (now.getTime() - lastUpdate.getTime()) / (1000 * 60 * 60);
        if (hoursSinceUpdate > 1) {
          report.issues.push(`Workflow appears stale: last updated ${Math.round(hoursSinceUpdate)} hours ago`);
        }
      }
    }
  }

  return report;
}
