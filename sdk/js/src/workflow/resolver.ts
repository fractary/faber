/**
 * @fractary/faber - Workflow Resolver
 *
 * Handles workflow inheritance resolution with deterministic merge behavior.
 * This is the SDK equivalent of plugins/faber/skills/faber-config/scripts/merge-workflows.sh
 *
 * Centralized workflow resolution ensures consistent behavior across CLI, MCP, and agents.
 */

import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

// ============================================================================
// Workflow File Types
// ============================================================================

/**
 * Step definition in a workflow phase
 */
export interface WorkflowStep {
  id: string;
  name: string;
  description?: string;
  prompt: string;
  guards?: {
    skip_if?: string;
    require_if?: string;
  };
  /** Source workflow ID (added during merge) */
  source?: string;
  /** Position type (added during merge) */
  position?: 'pre_step' | 'step' | 'post_step';
}

/**
 * Phase definition in a workflow file
 */
export interface WorkflowPhaseConfig {
  enabled?: boolean;
  description?: string;
  pre_steps?: WorkflowStep[];
  steps?: WorkflowStep[];
  post_steps?: WorkflowStep[];
  require_approval?: boolean;
  max_retries?: number;
}

/**
 * Autonomy configuration in workflow file
 */
export interface WorkflowAutonomyConfig {
  level?: 'dry-run' | 'assisted' | 'guarded' | 'autonomous';
  description?: string;
  require_approval_for?: string[];
}

/**
 * Critical artifact definition
 */
export interface CriticalArtifact {
  id: string;
  type: 'json' | 'markdown' | 'work_plugin';
  path?: string;
  path_from_state?: string;
  command?: string;
  description: string;
  required: boolean;
  condition?: string;
  reload_triggers?: string[];
}

/**
 * Critical artifacts configuration
 */
export interface CriticalArtifactsConfig {
  always_load?: CriticalArtifact[];
  conditional_load?: CriticalArtifact[];
}

/**
 * Context overlays for injecting additional instructions into inherited steps.
 * Context cascades: global → phase → step (most general to most specific).
 * In inheritance, ancestor context prepends to child context.
 */
export interface ContextOverlays {
  /** Context appended to ALL steps in ALL phases */
  global?: string;
  /** Phase-specific context that applies to all steps within a phase */
  phases?: {
    frame?: string;
    architect?: string;
    build?: string;
    evaluate?: string;
    release?: string;
  };
  /** Step-specific context by step ID */
  steps?: Record<string, string>;
}

/**
 * Raw workflow file structure (as stored in JSON files)
 */
export interface WorkflowFileConfig {
  $schema?: string;
  id: string;
  description?: string;
  asset_type?: string;
  extends?: string;
  skip_steps?: string[];
  phases?: {
    frame?: WorkflowPhaseConfig;
    architect?: WorkflowPhaseConfig;
    build?: WorkflowPhaseConfig;
    evaluate?: WorkflowPhaseConfig;
    release?: WorkflowPhaseConfig;
  };
  autonomy?: WorkflowAutonomyConfig;
  critical_artifacts?: CriticalArtifactsConfig;
  integrations?: Record<string, unknown>;
  /** Context overlays for injecting additional instructions into inherited steps */
  context?: ContextOverlays;
}

/**
 * Resolved (merged) workflow with inheritance applied
 */
export interface ResolvedWorkflow {
  id: string;
  description?: string;
  /** Inheritance chain from child to root ancestor */
  inheritance_chain: string[];
  /** Step IDs that were skipped via skip_steps */
  skipped_steps?: string[];
  phases: {
    frame: ResolvedPhase;
    architect: ResolvedPhase;
    build: ResolvedPhase;
    evaluate: ResolvedPhase;
    release: ResolvedPhase;
  };
  autonomy?: WorkflowAutonomyConfig;
  critical_artifacts?: CriticalArtifactsConfig;
  integrations?: Record<string, unknown>;
  /** Merged context overlays from inheritance chain */
  context?: ContextOverlays;
}

/**
 * Resolved phase with merged steps
 */
export interface ResolvedPhase {
  enabled: boolean;
  description?: string;
  /** All steps merged according to inheritance rules */
  steps: WorkflowStep[];
  require_approval?: boolean;
  max_retries?: number;
}

// ============================================================================
// Workflow Resolver Options
// ============================================================================

export interface WorkflowResolverOptions {
  /** Marketplace root directory (default: ~/.claude/plugins/marketplaces) */
  marketplaceRoot?: string;
  /** Project root directory (default: process.cwd()) */
  projectRoot?: string;
}

// ============================================================================
// Custom Errors
// ============================================================================

export class WorkflowNotFoundError extends Error {
  constructor(
    public workflowId: string,
    public searchedPaths: string[]
  ) {
    super(`Workflow not found: ${workflowId}`);
    this.name = 'WorkflowNotFoundError';
  }
}

export class CircularInheritanceError extends Error {
  constructor(
    public workflowId: string,
    public chain: string[]
  ) {
    super(`Circular inheritance detected: ${workflowId} creates inheritance cycle`);
    this.name = 'CircularInheritanceError';
  }
}

export class DuplicateStepIdError extends Error {
  constructor(public duplicateIds: string[]) {
    super(`Duplicate step IDs found: ${duplicateIds.join(', ')}`);
    this.name = 'DuplicateStepIdError';
  }
}

export class InvalidWorkflowError extends Error {
  constructor(
    public workflowId: string,
    public reason: string
  ) {
    super(`Invalid workflow ${workflowId}: ${reason}`);
    this.name = 'InvalidWorkflowError';
  }
}

// ============================================================================
// Workflow Resolver Class
// ============================================================================

/**
 * Resolves workflow inheritance chains and merges phases.
 *
 * Merge algorithm (for each phase):
 * 1. Pre-steps: Root ancestor first (reversed chain order)
 * 2. Main steps: Only from child (first in chain)
 * 3. Post-steps: Child first (chain order)
 *
 * Example for default → core:
 * - chain = ["default", "core"] (child first)
 * - pre_steps: core.pre_steps, then default.pre_steps
 * - steps: only default.steps
 * - post_steps: default.post_steps, then core.post_steps
 */
export class WorkflowResolver {
  private marketplaceRoot: string;
  private projectRoot: string;
  private workflowCache: Map<string, WorkflowFileConfig> = new Map();

  constructor(options: WorkflowResolverOptions = {}) {
    this.marketplaceRoot =
      options.marketplaceRoot ||
      process.env['CLAUDE_MARKETPLACE_ROOT'] ||
      path.join(process.env['HOME'] || os.homedir(), '.claude/plugins/marketplaces');
    this.projectRoot = options.projectRoot || process.cwd();
  }

  /**
   * Sanitize a path component to prevent path traversal attacks.
   * Rejects components containing '..' or absolute path indicators.
   */
  private sanitizePathComponent(component: string, context: string): string {
    // Reject empty components
    if (!component || component.trim() === '') {
      throw new InvalidWorkflowError(component, `${context} cannot be empty`);
    }

    // Reject path traversal sequences
    if (component.includes('..')) {
      throw new InvalidWorkflowError(component, `${context} cannot contain '..' (path traversal attempt)`);
    }

    // Reject absolute paths (Unix or Windows style)
    if (component.startsWith('/') || component.startsWith('\\') || /^[a-zA-Z]:/.test(component)) {
      throw new InvalidWorkflowError(component, `${context} cannot be an absolute path`);
    }

    // Reject null bytes (could bypass checks in some systems)
    if (component.includes('\0')) {
      throw new InvalidWorkflowError(component, `${context} contains invalid characters`);
    }

    return component;
  }

  /**
   * Resolve a workflow by ID, applying inheritance and merging phases.
   */
  async resolveWorkflow(workflowId: string): Promise<ResolvedWorkflow> {
    // Build inheritance chain (child first, ancestors last)
    const chain = await this.buildInheritanceChain(workflowId);

    // Load child workflow for base metadata
    const childWorkflow = await this.loadWorkflowFile(chain[0]);
    const skipSteps = childWorkflow.skip_steps || [];

    // Merge phases for the entire chain
    const phases = this.mergePhasesForChain(chain, skipSteps);

    // Validate unique step IDs across all phases
    this.validateUniqueStepIds(phases);

    // Merge context overlays from inheritance chain
    const context = this.mergeContextOverlays(chain);

    // Build resolved workflow
    const resolved: ResolvedWorkflow = {
      id: childWorkflow.id,
      description: childWorkflow.description,
      inheritance_chain: chain,
      phases,
      autonomy: childWorkflow.autonomy,
      critical_artifacts: childWorkflow.critical_artifacts,
      integrations: childWorkflow.integrations,
    };

    if (skipSteps.length > 0) {
      resolved.skipped_steps = skipSteps;
    }

    // Include context overlays if any were defined
    if (context && (context.global || Object.keys(context.phases || {}).length > 0 || Object.keys(context.steps || {}).length > 0)) {
      resolved.context = context;
    }

    return resolved;
  }

  /**
   * Build the inheritance chain from a workflow ID.
   * Returns array with child first, root ancestor last.
   */
  private async buildInheritanceChain(workflowId: string): Promise<string[]> {
    const chain: string[] = [];
    const visited = new Set<string>();
    let currentId: string | undefined = workflowId;

    while (currentId) {
      // Check for circular inheritance
      if (visited.has(currentId)) {
        throw new CircularInheritanceError(currentId, chain);
      }

      visited.add(currentId);
      chain.push(currentId);

      // Load workflow and get extends
      const workflow = await this.loadWorkflowFile(currentId);
      currentId = workflow.extends;
    }

    return chain;
  }

  /**
   * Load a workflow file by ID.
   * Supports namespace resolution (fractary-faber:, project:, etc.)
   */
  private async loadWorkflowFile(workflowId: string): Promise<WorkflowFileConfig> {
    // Check cache first
    if (this.workflowCache.has(workflowId)) {
      return this.workflowCache.get(workflowId)!;
    }

    const filePath = this.resolveWorkflowPath(workflowId);
    const searchedPaths: string[] = [filePath];

    if (!fs.existsSync(filePath)) {
      // Fallback: if no explicit namespace, try plugin defaults
      if (!workflowId.includes(':')) {
        const fallbackPath = path.join(
          this.marketplaceRoot,
          'fractary-faber/plugins/faber/config/workflows',
          `${workflowId}.json`
        );
        searchedPaths.push(fallbackPath);

        if (fs.existsSync(fallbackPath)) {
          return this.loadAndCacheWorkflow(workflowId, fallbackPath);
        }
      }

      throw new WorkflowNotFoundError(workflowId, searchedPaths);
    }

    return this.loadAndCacheWorkflow(workflowId, filePath);
  }

  /**
   * Load and cache a workflow from a file path.
   */
  private loadAndCacheWorkflow(workflowId: string, filePath: string): WorkflowFileConfig {
    try {
      const content = fs.readFileSync(filePath, 'utf-8');
      const workflow = JSON.parse(content) as WorkflowFileConfig;
      this.workflowCache.set(workflowId, workflow);
      return workflow;
    } catch (error) {
      if (error instanceof SyntaxError) {
        throw new InvalidWorkflowError(workflowId, `JSON parse error: ${error.message}`);
      }
      throw error;
    }
  }

  /**
   * Resolve a workflow ID to a file path based on namespace.
   * Validates all path components to prevent path traversal attacks.
   */
  private resolveWorkflowPath(workflowId: string): string {
    let namespace: string;
    let workflowName: string;

    if (workflowId.includes(':')) {
      const parts = workflowId.split(':');
      namespace = parts[0];
      workflowName = parts.slice(1).join(':');
    } else {
      namespace = 'project';
      workflowName = workflowId;
    }

    // Sanitize namespace and workflow name to prevent path traversal
    this.sanitizePathComponent(namespace, 'namespace');
    this.sanitizePathComponent(workflowName, 'workflow name');

    switch (namespace) {
      case 'fractary-faber':
        return path.join(
          this.marketplaceRoot,
          'fractary-faber/plugins/faber/config/workflows',
          `${workflowName}.json`
        );

      case 'fractary-faber-cloud':
        return path.join(
          this.marketplaceRoot,
          'fractary-faber/plugins/faber-cloud/config/workflows',
          `${workflowName}.json`
        );

      case 'fractary-core': {
        // Extract plugin name from workflow_name if it contains slash
        const parts = workflowName.split('/');
        // Sanitize each part individually
        const plugin = this.sanitizePathComponent(parts[0], 'plugin name');
        const workflow = parts.length > 1
          ? this.sanitizePathComponent(parts.slice(1).join('/'), 'workflow name')
          : plugin;
        return path.join(
          this.marketplaceRoot,
          `fractary-core/plugins/${plugin}/config/workflows`,
          `${workflow}.json`
        );
      }

      case 'fractary-codex':
        return path.join(
          this.marketplaceRoot,
          'fractary-codex/plugins/codex/config/workflows',
          `${workflowName}.json`
        );

      case 'project':
      case '':
        return path.join(this.projectRoot, '.fractary/faber/workflows', `${workflowName}.json`);

      default: {
        // Fallback to old unified marketplace for backward compatibility
        // Sanitize the derived plugin name as well
        const pluginName = this.sanitizePathComponent(
          namespace.replace('fractary-', ''),
          'plugin name'
        );
        return path.join(
          this.marketplaceRoot,
          `fractary/plugins/${pluginName}/config/workflows`,
          `${workflowName}.json`
        );
      }
    }
  }

  /**
   * Merge phases for an entire inheritance chain.
   */
  private mergePhasesForChain(
    chain: string[],
    skipSteps: string[]
  ): ResolvedWorkflow['phases'] {
    const phaseNames = ['frame', 'architect', 'build', 'evaluate', 'release'] as const;
    const phases: Record<string, ResolvedPhase> = {};

    for (const phaseName of phaseNames) {
      const mergedSteps = this.mergePhaseSteps(chain, phaseName);
      const filteredSteps = this.applySkipSteps(mergedSteps, skipSteps);

      // Get phase config from child workflow
      const childWorkflow = this.workflowCache.get(chain[0])!;
      const childPhase = childWorkflow.phases?.[phaseName];

      phases[phaseName] = {
        enabled: childPhase?.enabled ?? true,
        description: childPhase?.description,
        steps: filteredSteps,
        require_approval: childPhase?.require_approval,
        max_retries: phaseName === 'evaluate' ? childPhase?.max_retries ?? 3 : undefined,
      };
    }

    return phases as ResolvedWorkflow['phases'];
  }

  /**
   * Merge steps for a single phase across the inheritance chain.
   *
   * Order:
   * 1. Pre-steps: Root ancestor first (reversed chain - index n-1 to 0)
   * 2. Main steps: Only from child (index 0)
   * 3. Post-steps: Child first (chain order - index 0 to n-1)
   */
  private mergePhaseSteps(
    chain: string[],
    phaseName: 'frame' | 'architect' | 'build' | 'evaluate' | 'release'
  ): WorkflowStep[] {
    const mergedSteps: WorkflowStep[] = [];

    // Pre-steps: iterate from root (last in chain) to child (first) - reversed
    for (let i = chain.length - 1; i >= 0; i--) {
      const workflowId = chain[i];
      const workflow = this.workflowCache.get(workflowId)!;
      const phase = workflow.phases?.[phaseName];
      const preSteps = phase?.pre_steps || [];

      for (const step of preSteps) {
        mergedSteps.push({
          ...step,
          source: workflowId,
          position: 'pre_step',
        });
      }
    }

    // Main steps: only from child (index 0)
    const childWorkflow = this.workflowCache.get(chain[0])!;
    const childPhase = childWorkflow.phases?.[phaseName];
    const mainSteps = childPhase?.steps || [];

    for (const step of mainSteps) {
      mergedSteps.push({
        ...step,
        source: chain[0],
        position: 'step',
      });
    }

    // Post-steps: iterate from child (first) to root (last) - chain order
    for (let i = 0; i < chain.length; i++) {
      const workflowId = chain[i];
      const workflow = this.workflowCache.get(workflowId)!;
      const phase = workflow.phases?.[phaseName];
      const postSteps = phase?.post_steps || [];

      for (const step of postSteps) {
        mergedSteps.push({
          ...step,
          source: workflowId,
          position: 'post_step',
        });
      }
    }

    return mergedSteps;
  }

  /**
   * Apply skip_steps to filter out specified step IDs.
   */
  private applySkipSteps(steps: WorkflowStep[], skipSteps: string[]): WorkflowStep[] {
    if (!skipSteps || skipSteps.length === 0) {
      return steps;
    }

    const skipSet = new Set(skipSteps);
    return steps.filter((step) => !skipSet.has(step.id));
  }

  /**
   * Validate that all step IDs are unique across all phases.
   */
  private validateUniqueStepIds(phases: ResolvedWorkflow['phases']): void {
    const allIds = new Map<string, string>(); // id -> phase
    const duplicates: string[] = [];

    for (const [phaseName, phase] of Object.entries(phases)) {
      for (const step of phase.steps) {
        if (allIds.has(step.id)) {
          duplicates.push(`${step.id} (in ${allIds.get(step.id)} and ${phaseName})`);
        } else {
          allIds.set(step.id, phaseName);
        }
      }
    }

    if (duplicates.length > 0) {
      throw new DuplicateStepIdError(duplicates);
    }
  }

  /**
   * Merge context overlays from the inheritance chain.
   * Iterates from root (last in chain) to child (first) so ancestor context prepends to child.
   * This ensures project-specific context (child) is most prominent.
   */
  private mergeContextOverlays(chain: string[]): ContextOverlays | undefined {
    const result: ContextOverlays = {
      global: '',
      phases: {},
      steps: {},
    };

    const phaseNames = ['frame', 'architect', 'build', 'evaluate', 'release'] as const;

    // Iterate root→child (reversed chain order) so ancestor context prepends to child
    for (let i = chain.length - 1; i >= 0; i--) {
      const workflow = this.workflowCache.get(chain[i])!;
      const ctx = workflow.context;
      if (!ctx) continue;

      // Merge global context
      if (ctx.global) {
        result.global = result.global
          ? result.global + '\n\n' + ctx.global
          : ctx.global;
      }

      // Merge phase contexts
      for (const phase of phaseNames) {
        if (ctx.phases?.[phase]) {
          result.phases![phase] = result.phases![phase]
            ? result.phases![phase] + '\n\n' + ctx.phases[phase]
            : ctx.phases[phase];
        }
      }

      // Merge step contexts (child overrides ancestor for same step ID)
      if (ctx.steps) {
        result.steps = { ...result.steps, ...ctx.steps };
      }
    }

    // Check if any context was defined
    const hasContent =
      result.global ||
      Object.keys(result.phases || {}).length > 0 ||
      Object.keys(result.steps || {}).length > 0;

    if (!hasContent) {
      return undefined;
    }

    // Clean up empty fields
    if (!result.global) {
      delete result.global;
    }
    if (Object.keys(result.phases || {}).length === 0) {
      delete result.phases;
    }
    if (Object.keys(result.steps || {}).length === 0) {
      delete result.steps;
    }

    return result;
  }

  /**
   * Clear the workflow cache (useful for testing or reloading)
   */
  clearCache(): void {
    this.workflowCache.clear();
  }
}
