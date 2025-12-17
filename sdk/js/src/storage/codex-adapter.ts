/**
 * @fractary/faber - Codex Adapter
 *
 * Optional integration with @fractary/codex for cross-project storage.
 * Uses runtime detection - no compile-time dependency on Codex.
 */

import { Storage, FaberConfig } from '../types';
import { FaberError } from '../errors';
import { LocalStorage } from './local';
import { findProjectRoot } from '../config';

// Type definitions for Codex (runtime detection)
// These match the actual @fractary/codex API

interface ResolvedReference {
  uri: string;
  org: string;
  project: string;
  path: string;
  isCurrentProject: boolean;
  localPath?: string;
  remotePath?: string;
}

interface FetchResult {
  content: Buffer;
  contentType: string;
  size: number;
  source: string;
  metadata?: Record<string, unknown>;
}

interface CacheManagerConfig {
  cacheDir: string;
  defaultTtl?: number;
  enablePersistence?: boolean;
}

interface CacheManager {
  get(reference: ResolvedReference, options?: { ttl?: number }): Promise<FetchResult>;
  has(uri: string): Promise<boolean>;
  set(uri: string, result: FetchResult, ttl?: number): Promise<unknown>;
  invalidate(uri: string): Promise<boolean>;
  clear(): Promise<void>;
  setStorageManager(storage: StorageManager): void;
}

interface StorageManager {
  fetch(reference: ResolvedReference): Promise<FetchResult>;
  exists(reference: ResolvedReference): Promise<boolean>;
}

interface CodexConfig {
  organization?: string;
  directories?: {
    specs?: string;
    docs?: string;
    logs?: string;
  };
}

interface CodexModule {
  createCacheManager(config: CacheManagerConfig): CacheManager;
  createStorageManager(config?: Record<string, unknown>): StorageManager;
  resolveReference(uri: string, options?: Record<string, unknown>): ResolvedReference | null;
  loadConfig(options?: Record<string, unknown>): Promise<CodexConfig>;
  buildUri(org: string, project: string, path: string): string;
}

/**
 * Adapter for @fractary/codex integration
 */
export class CodexAdapter {
  private codex: CodexModule | null = null;
  private cacheManager: CacheManager | null = null;
  private storageManager: StorageManager | null = null;
  private config: CodexConfig | null = null;

  constructor() {
    this.codex = this.tryLoadCodex();
  }

  /**
   * Try to load @fractary/codex at runtime
   */
  private tryLoadCodex(): CodexModule | null {
    try {
      // Dynamic require - no compile-time dependency
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const codexModule = require('@fractary/codex') as CodexModule;
      return codexModule;
    } catch {
      // Codex not installed - this is fine
      return null;
    }
  }

  /**
   * Initialize codex managers (lazy initialization)
   */
  private async ensureInitialized(): Promise<void> {
    if (!this.codex) {
      throw new FaberError('Codex not available', 'CODEX_NOT_AVAILABLE', {});
    }

    if (!this.cacheManager) {
      this.storageManager = this.codex.createStorageManager({
        github: { token: process.env.GITHUB_TOKEN },
      });

      this.cacheManager = this.codex.createCacheManager({
        cacheDir: '.fractary/plugins/faber/cache',
        defaultTtl: 3600,
        enablePersistence: true,
      });

      this.cacheManager.setStorageManager(this.storageManager);
    }

    if (!this.config) {
      try {
        this.config = await this.codex.loadConfig();
      } catch {
        this.config = {};
      }
    }
  }

  /**
   * Check if Codex is available
   */
  isAvailable(): boolean {
    return this.codex !== null;
  }

  /**
   * Get loaded config
   */
  async getConfig(): Promise<CodexConfig> {
    await this.ensureInitialized();
    return this.config || {};
  }

  /**
   * Check if Codex is enabled for a specific artifact type
   */
  isEnabledFor(artifactType: string): boolean {
    if (!this.codex) return false;

    // Check if codex has directories configured for this type
    const typeDirectoryMap: Record<string, string> = {
      specs: 'specs',
      logs: 'logs',
      state: 'state',
    };

    return typeDirectoryMap[artifactType] !== undefined;
  }

  /**
   * Build a codex URI for an artifact
   */
  buildUri(type: string, id: string): string {
    if (!this.codex) {
      throw new FaberError('Codex not available', 'CODEX_NOT_AVAILABLE', {});
    }

    // Get org from config or use 'local'
    const org = this.config?.organization || 'local';
    const project = this.detectProject();
    const path = `${type}/${id}`;

    return this.codex.buildUri(org, project, path);
  }

  /**
   * Detect current project name
   */
  private detectProject(): string {
    try {
      const root = findProjectRoot();
      const parts = root.split('/');
      return parts[parts.length - 1] || 'unknown';
    } catch {
      return 'unknown';
    }
  }

  /**
   * Store content via Codex
   */
  async store(type: string, id: string, content: string): Promise<string> {
    await this.ensureInitialized();

    if (!this.cacheManager || !this.codex) {
      throw new FaberError('Codex not initialized', 'CODEX_NOT_AVAILABLE', {});
    }

    const uri = this.buildUri(type, id);

    // Create a FetchResult-like object for caching
    const result: FetchResult = {
      content: Buffer.from(content, 'utf-8'),
      contentType: 'text/plain',
      size: Buffer.byteLength(content, 'utf-8'),
      source: 'faber',
    };

    await this.cacheManager.set(uri, result);
    return uri;
  }

  /**
   * Retrieve content via Codex
   */
  async retrieve(type: string, id: string): Promise<string | null> {
    await this.ensureInitialized();

    if (!this.cacheManager || !this.codex) {
      throw new FaberError('Codex not initialized', 'CODEX_NOT_AVAILABLE', {});
    }

    const uri = this.buildUri(type, id);
    const reference = this.codex.resolveReference(uri);

    if (!reference) {
      return null;
    }

    try {
      const result = await this.cacheManager.get(reference);
      return result.content.toString('utf-8');
    } catch {
      return null;
    }
  }

  /**
   * Check if content exists via Codex
   */
  async exists(type: string, id: string): Promise<boolean> {
    await this.ensureInitialized();

    if (!this.cacheManager || !this.codex) {
      throw new FaberError('Codex not initialized', 'CODEX_NOT_AVAILABLE', {});
    }

    const uri = this.buildUri(type, id);
    return this.cacheManager.has(uri);
  }

  /**
   * List content via Codex
   * Note: Codex doesn't have a native list operation, so this returns empty
   * In practice, listing should use local storage
   */
  async list(_type: string): Promise<string[]> {
    // Codex cache doesn't support listing by type
    // This would require filesystem operations on the cache directory
    return [];
  }

  /**
   * Delete content via Codex
   */
  async delete(type: string, id: string): Promise<void> {
    await this.ensureInitialized();

    if (!this.cacheManager || !this.codex) {
      throw new FaberError('Codex not initialized', 'CODEX_NOT_AVAILABLE', {});
    }

    const uri = this.buildUri(type, id);
    await this.cacheManager.invalidate(uri);
  }

  /**
   * Get a Codex reference URI
   */
  getReference(type: string, id: string): string {
    return `codex://${type}/${id}`;
  }
}

/**
 * Storage implementation that delegates to Codex
 */
class CodexStorage implements Storage {
  private codex: CodexAdapter;
  private type: string;

  constructor(codex: CodexAdapter, type: string) {
    this.codex = codex;
    this.type = type;
  }

  async write(id: string, content: string): Promise<string> {
    await this.codex.store(this.type, id, content);
    return this.codex.getReference(this.type, id);
  }

  async read(id: string): Promise<string | null> {
    return this.codex.retrieve(this.type, id);
  }

  async exists(id: string): Promise<boolean> {
    return this.codex.exists(this.type, id);
  }

  async list(prefix?: string): Promise<string[]> {
    const all = await this.codex.list(this.type);
    if (!prefix) return all;
    return all.filter(item => item.startsWith(prefix));
  }

  async delete(id: string): Promise<void> {
    return this.codex.delete(this.type, id);
  }
}

/**
 * Artifact type to storage path mapping
 */
const DEFAULT_PATHS: Record<string, string> = {
  specs: '/specs',
  logs: '.fractary/logs',
  state: '.fractary/plugins/faber',
};

/**
 * Create storage for an artifact type
 *
 * Uses Codex if:
 * 1. @fractary/codex is installed
 * 2. Codex is configured and enabled for this artifact type
 * 3. FABER config has use_codex: true for this artifact
 *
 * Otherwise falls back to local storage.
 */
export function createStorage(
  artifactType: 'specs' | 'logs' | 'state',
  config?: FaberConfig
): Storage {
  const codex = new CodexAdapter();
  const projectRoot = findProjectRoot();

  // Check if Codex should be used
  const useCodex =
    config?.artifacts?.[artifactType]?.use_codex === true &&
    codex.isAvailable() &&
    codex.isEnabledFor(artifactType);

  if (useCodex) {
    return new CodexStorage(codex, artifactType);
  }

  // Fall back to local storage
  const localPath =
    config?.artifacts?.[artifactType]?.local_path ||
    DEFAULT_PATHS[artifactType];

  // Resolve relative to project root
  const fullPath = localPath.startsWith('/')
    ? `${projectRoot}${localPath}`
    : `${projectRoot}/${localPath}`;

  return new LocalStorage(fullPath);
}
