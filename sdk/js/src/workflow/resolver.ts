/**
 * @fractary/faber - Workflow Resolver
 *
 * Handles workflow inheritance resolution with deterministic merge behavior.
 * This is the SDK equivalent of plugins/faber/skills/faber-config/scripts/merge-workflows.sh
 *
 * Centralized workflow resolution ensures consistent behavior across CLI, MCP, and agents.
 */

import * as crypto from 'crypto';
import * as dns from 'dns';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { promisify } from 'util';

// ============================================================================
// Workflow File Types
// ============================================================================

/**
 * Result handling configuration for steps.
 * Defines behavior for different execution outcomes.
 *
 * Options:
 * - on_success: 'continue' (default) or slash command
 * - on_warning: 'continue' (default), 'stop' (shows prompt), or slash command
 * - on_failure: 'stop' (shows prompt, default) or slash command
 *
 * Note: 'stop' consistently shows an intelligent prompt with options
 * (continue, fix, stop) for both warnings and failures.
 */
export interface StepResultHandling {
  /** Action on success: 'continue' (default) or slash command */
  on_success?: string;
  /** Action on warning: 'continue' (default), 'stop' (shows prompt with options), or slash command */
  on_warning?: string;
  /** Action on failure: 'stop' (shows prompt with options, default) or slash command for recovery */
  on_failure?: string;
}

/**
 * Default result handling values (schema defaults).
 */
export const DEFAULT_RESULT_HANDLING: Required<Omit<StepResultHandling, 'on_pending_input'>> = {
  on_success: 'continue',
  on_warning: 'continue',
  on_failure: 'stop',
};

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
  /** Result handling configuration for this step */
  result_handling?: StepResultHandling;
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
  /** Default result handling for all steps in this phase */
  result_handling?: StepResultHandling;
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
  /** Default result handling for all steps in all phases (workflow-level global default) */
  result_handling?: StepResultHandling;
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
  /** Global result handling default for all steps */
  result_handling?: StepResultHandling;
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
  /** Default result handling for steps in this phase */
  result_handling?: StepResultHandling;
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

export class SSRFError extends Error {
  constructor(
    public url: string,
    public reason: string
  ) {
    super(`SSRF protection blocked URL ${url}: ${reason}`);
    this.name = 'SSRFError';
  }
}

// ============================================================================
// URL Security Helpers
// ============================================================================

const dnsLookup = promisify(dns.lookup);

/** Timeout for URL fetch operations (30 seconds) */
const URL_FETCH_TIMEOUT_MS = 30000;

/** Allowed URL schemes for workflow references */
const ALLOWED_URL_SCHEMES = ['https:'];

/**
 * Check if an IP address is in a private/internal range.
 * Blocks: localhost, private networks, link-local, loopback
 */
function isPrivateIP(ip: string): boolean {
  // IPv4 patterns
  const ipv4Patterns = [
    /^127\./, // 127.0.0.0/8 - Loopback
    /^10\./, // 10.0.0.0/8 - Private
    /^172\.(1[6-9]|2[0-9]|3[0-1])\./, // 172.16.0.0/12 - Private
    /^192\.168\./, // 192.168.0.0/16 - Private
    /^169\.254\./, // 169.254.0.0/16 - Link-local (AWS metadata!)
    /^0\./, // 0.0.0.0/8 - Current network
    /^100\.(6[4-9]|[7-9][0-9]|1[0-1][0-9]|12[0-7])\./, // 100.64.0.0/10 - Carrier-grade NAT
    /^192\.0\.0\./, // 192.0.0.0/24 - IETF Protocol Assignments
    /^192\.0\.2\./, // 192.0.2.0/24 - TEST-NET-1
    /^198\.(1[89])\./, // 198.18.0.0/15 - Benchmarking
    /^198\.51\.100\./, // 198.51.100.0/24 - TEST-NET-2
    /^203\.0\.113\./, // 203.0.113.0/24 - TEST-NET-3
    /^224\./, // 224.0.0.0/4 - Multicast
    /^240\./, // 240.0.0.0/4 - Reserved
    /^255\.255\.255\.255$/, // Broadcast
  ];

  // IPv6 patterns
  const ipv6Patterns = [
    /^::1$/, // Loopback
    /^fe80:/i, // Link-local
    /^fc00:/i, // Unique local (private)
    /^fd[0-9a-f]{2}:/i, // Unique local (private)
    /^::ffff:(127\.|10\.|172\.(1[6-9]|2[0-9]|3[0-1])\.|192\.168\.|169\.254\.)/i, // IPv4-mapped
  ];

  for (const pattern of ipv4Patterns) {
    if (pattern.test(ip)) return true;
  }

  for (const pattern of ipv6Patterns) {
    if (pattern.test(ip)) return true;
  }

  return false;
}

/**
 * Validate a URL for SSRF protection.
 * Throws SSRFError if the URL is potentially dangerous.
 *
 * SECURITY NOTE: DNS Rebinding (TOCTOU) Limitation
 * ------------------------------------------------
 * This validation has a Time-of-Check-Time-of-Use vulnerability: the DNS
 * resolution performed here may return a different IP than the one used
 * by the subsequent fetch() call. An attacker with DNS control could:
 * 1. First resolution (validation): returns public IP -> passes validation
 * 2. Second resolution (fetch): returns private IP -> SSRF achieved
 *
 * Mitigation requires a custom HTTP agent that validates IP at connection
 * time, which is complex to implement. For workflow references, this risk
 * is acceptable because:
 * - URL references are typically from trusted sources (marketplace configs)
 * - The attacker would need DNS control over the domain
 * - Additional mitigations exist (HTTPS-only, redirect blocking)
 *
 * For high-security environments, disable URL references entirely and use
 * only explicit plugin@marketplace:workflow or project-local references.
 */
async function validateUrlSecurity(url: string): Promise<void> {
  let parsedUrl: URL;

  try {
    parsedUrl = new URL(url);
  } catch {
    throw new SSRFError(url, 'Invalid URL format');
  }

  // Check scheme (only HTTPS allowed)
  if (!ALLOWED_URL_SCHEMES.includes(parsedUrl.protocol)) {
    throw new SSRFError(
      url,
      `URL scheme '${parsedUrl.protocol}' not allowed. Only HTTPS is permitted.`
    );
  }

  // Block localhost hostnames
  const hostname = parsedUrl.hostname.toLowerCase();
  if (
    hostname === 'localhost' ||
    hostname === 'localhost.localdomain' ||
    hostname.endsWith('.localhost') ||
    hostname.endsWith('.local')
  ) {
    throw new SSRFError(url, 'Localhost URLs are not allowed');
  }

  // Resolve hostname to IP and check if private
  try {
    const { address } = await dnsLookup(hostname);
    if (isPrivateIP(address)) {
      throw new SSRFError(
        url,
        `URL resolves to private/internal IP address (${address})`
      );
    }
  } catch (error) {
    if (error instanceof SSRFError) throw error;
    throw new SSRFError(url, `Failed to resolve hostname: ${(error as Error).message}`);
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

    // Include workflow-level result_handling if defined
    if (childWorkflow.result_handling) {
      resolved.result_handling = childWorkflow.result_handling;
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
   * Supports URL references, explicit plugin@marketplace references,
   * and project-local references with fallback to plugin defaults.
   */
  private async loadWorkflowFile(workflowId: string): Promise<WorkflowFileConfig> {
    // Check cache first
    if (this.workflowCache.has(workflowId)) {
      return this.workflowCache.get(workflowId)!;
    }

    const pathOrUrl = this.resolveWorkflowPath(workflowId);

    // Handle URL references
    if (typeof pathOrUrl === 'object' && pathOrUrl.type === 'url') {
      return this.fetchWorkflowFromUrl(workflowId, pathOrUrl.url);
    }

    // At this point, pathOrUrl is guaranteed to be a string
    const filePath = pathOrUrl as string;
    const searchedPaths: string[] = [filePath];

    if (!fs.existsSync(filePath)) {
      // Fallback: if project-local (no @ or :), try plugin defaults
      if (!workflowId.includes('@') && !workflowId.includes(':')) {
        const fallbackPath = path.join(
          this.marketplaceRoot,
          'fractary-faber/plugins/faber/.fractary/faber/workflows',
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
   * Fetch a workflow from a URL with caching.
   * Cache is valid for 1 hour.
   *
   * Security: Validates URL to prevent SSRF attacks before fetching.
   */
  private async fetchWorkflowFromUrl(workflowId: string, url: string): Promise<WorkflowFileConfig> {
    // SSRF Protection: Validate URL before fetching
    await validateUrlSecurity(url);

    const cacheDir = path.join(this.marketplaceRoot, '.cache', 'workflows');
    const cacheFile = path.join(cacheDir, `${this.hashString(url)}.json`);

    // Check cache (1 hour TTL)
    if (fs.existsSync(cacheFile)) {
      const stats = fs.statSync(cacheFile);
      const ageMinutes = (Date.now() - stats.mtimeMs) / 60000;
      if (ageMinutes < 60) {
        return this.loadAndCacheWorkflow(workflowId, cacheFile);
      }
    }

    // Fetch from URL with timeout and security settings
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), URL_FETCH_TIMEOUT_MS);

    try {
      const response = await fetch(url, {
        signal: controller.signal,
        redirect: 'error', // Block redirects to prevent SSRF via redirect
        headers: {
          'User-Agent': 'Fractary-Faber-WorkflowResolver/1.0',
        },
      });

      if (!response.ok) {
        throw new WorkflowNotFoundError(workflowId, [url]);
      }

      // Content-Length validation to prevent DoS via memory exhaustion (10MB limit)
      const MAX_CONTENT_LENGTH = 10 * 1024 * 1024; // 10MB
      const contentLengthHeader = response.headers.get('content-length');
      if (contentLengthHeader) {
        const contentLength = parseInt(contentLengthHeader, 10);
        if (contentLength > MAX_CONTENT_LENGTH) {
          throw new InvalidWorkflowError(
            workflowId,
            `Response too large (${contentLength} bytes). Maximum allowed: ${MAX_CONTENT_LENGTH} bytes`
          );
        }
      }

      const content = await response.text();

      // Also validate actual content size (in case Content-Length header was missing/incorrect)
      if (content.length > MAX_CONTENT_LENGTH) {
        throw new InvalidWorkflowError(
          workflowId,
          `Response too large (${content.length} bytes). Maximum allowed: ${MAX_CONTENT_LENGTH} bytes`
        );
      }

      // Validate JSON before caching
      try {
        JSON.parse(content);
      } catch {
        throw new InvalidWorkflowError(workflowId, `Invalid JSON from URL: ${url}`);
      }

      // Create cache directory with restricted permissions (owner only)
      fs.mkdirSync(cacheDir, { recursive: true, mode: 0o700 });

      // Atomic file write to prevent permission race condition:
      // Write to temp file first, then rename (atomic on POSIX systems)
      const tempFile = `${cacheFile}.${process.pid}.tmp`;
      try {
        // Write with restrictive permissions from the start
        const fd = fs.openSync(tempFile, fs.constants.O_WRONLY | fs.constants.O_CREAT | fs.constants.O_EXCL, 0o600);
        fs.writeSync(fd, content);
        fs.closeSync(fd);
        // Atomic rename
        fs.renameSync(tempFile, cacheFile);
      } catch (writeError) {
        // Clean up temp file on error
        try { fs.unlinkSync(tempFile); } catch { /* ignore */ }
        throw writeError;
      }

      // Opportunistic cache cleanup: remove expired entries (>1 hour old)
      this.cleanupExpiredCache(cacheDir);

      return this.loadAndCacheWorkflow(workflowId, cacheFile);
    } catch (error) {
      // Handle timeout
      if (error instanceof Error && error.name === 'AbortError') {
        throw new InvalidWorkflowError(
          workflowId,
          `URL fetch timed out after ${URL_FETCH_TIMEOUT_MS / 1000} seconds: ${url}`
        );
      }
      throw error;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  /**
   * Hash a string using SHA-256.
   */
  private hashString(str: string): string {
    return crypto.createHash('sha256').update(str).digest('hex');
  }

  /**
   * Clean up expired cache entries (older than 1 hour).
   * Called opportunistically when writing new cache files.
   * Errors are silently ignored to not disrupt normal operations.
   */
  private cleanupExpiredCache(cacheDir: string): void {
    try {
      if (!fs.existsSync(cacheDir)) return;

      const files = fs.readdirSync(cacheDir);
      const now = Date.now();
      const ONE_HOUR_MS = 60 * 60 * 1000;

      for (const file of files) {
        // Only process .json cache files (skip .tmp files)
        if (!file.endsWith('.json')) continue;

        const filePath = path.join(cacheDir, file);
        try {
          const stats = fs.statSync(filePath);
          const ageMs = now - stats.mtimeMs;
          if (ageMs > ONE_HOUR_MS) {
            fs.unlinkSync(filePath);
          }
        } catch {
          // Ignore errors for individual files (may have been deleted by another process)
        }
      }
    } catch {
      // Silently ignore cleanup errors - this is opportunistic
    }
  }

  /**
   * Resolve a workflow ID to a file path or URL reference.
   * Supports three formats:
   *   1. URL: url:https://example.com/workflow.json
   *   2. Explicit: plugin@marketplace:workflow
   *   3. Project-local: workflow-name
   * Validates all path components to prevent path traversal attacks.
   */
  private resolveWorkflowPath(workflowId: string): string | { type: 'url'; url: string } {
    // Format 1: URL reference
    if (workflowId.startsWith('url:')) {
      return { type: 'url', url: workflowId.slice(4) };
    }

    // Format 2: Explicit plugin@marketplace:workflow
    const explicitMatch = workflowId.match(/^([^@]+)@([^:]+):(.+)$/);
    if (explicitMatch) {
      const [, plugin, marketplace, workflow] = explicitMatch;
      this.sanitizePathComponent(plugin, 'plugin');
      this.sanitizePathComponent(marketplace, 'marketplace');
      this.sanitizePathComponent(workflow, 'workflow');
      return path.join(
        this.marketplaceRoot,
        marketplace,
        'plugins',
        plugin,
        '.fractary/faber/workflows',
        `${workflow}.json`
      );
    }

    // Format 3: Project-local (no @ symbol)
    this.sanitizePathComponent(workflowId, 'workflow');
    return path.join(this.projectRoot, '.fractary/faber/workflows', `${workflowId}.json`);
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
        result_handling: childPhase?.result_handling,
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

// ============================================================================
// Result Handling Resolution
// ============================================================================

/**
 * Resolve result handling configuration for a step.
 *
 * Cascades configuration from multiple levels with the following precedence
 * (highest to lowest):
 *   1. Step-level (inline result_handling on the step)
 *   2. Phase-level (result_handling in phase definition)
 *   3. Workflow-level (result_handling at workflow root)
 *   4. Schema defaults
 *
 * This allows defining common error handlers (like workflow-debug) once
 * at the workflow level instead of repeating on every step.
 *
 * @param workflow - The resolved workflow configuration
 * @param phaseName - Current phase name (frame, architect, build, evaluate, release)
 * @param step - The step configuration
 * @returns Merged result handling with all levels applied
 */
export function resolveStepResultHandling(
  workflow: ResolvedWorkflow | WorkflowFileConfig,
  phaseName: 'frame' | 'architect' | 'build' | 'evaluate' | 'release',
  step: WorkflowStep
): Required<Omit<StepResultHandling, 'on_pending_input'>> & { on_pending_input: 'wait' } {
  // Start with schema defaults
  const result = {
    on_success: DEFAULT_RESULT_HANDLING.on_success,
    on_warning: DEFAULT_RESULT_HANDLING.on_warning,
    on_failure: DEFAULT_RESULT_HANDLING.on_failure,
    on_pending_input: 'wait' as const, // Immutable - always wait for user input
  };

  // Layer 1: Apply workflow-level global defaults
  const workflowResultHandling = workflow.result_handling;
  if (workflowResultHandling) {
    if (workflowResultHandling.on_success !== undefined) {
      result.on_success = workflowResultHandling.on_success;
    }
    if (workflowResultHandling.on_warning !== undefined) {
      result.on_warning = workflowResultHandling.on_warning;
    }
    if (workflowResultHandling.on_failure !== undefined) {
      result.on_failure = workflowResultHandling.on_failure;
    }
  }

  // Layer 2: Apply phase-level defaults
  const phase = workflow.phases?.[phaseName];
  const phaseResultHandling = phase?.result_handling;
  if (phaseResultHandling) {
    if (phaseResultHandling.on_success !== undefined) {
      result.on_success = phaseResultHandling.on_success;
    }
    if (phaseResultHandling.on_warning !== undefined) {
      result.on_warning = phaseResultHandling.on_warning;
    }
    if (phaseResultHandling.on_failure !== undefined) {
      result.on_failure = phaseResultHandling.on_failure;
    }
  }

  // Layer 3: Apply step-level config (highest priority)
  const stepResultHandling = step.result_handling;
  if (stepResultHandling) {
    if (stepResultHandling.on_success !== undefined) {
      result.on_success = stepResultHandling.on_success;
    }
    if (stepResultHandling.on_warning !== undefined) {
      result.on_warning = stepResultHandling.on_warning;
    }
    if (stepResultHandling.on_failure !== undefined) {
      result.on_failure = stepResultHandling.on_failure;
    }
  }

  return result;
}
