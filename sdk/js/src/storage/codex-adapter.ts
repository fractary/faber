/**
 * @fractary/faber - Codex Adapter
 *
 * Optional integration with @fractary/codex for cross-project storage.
 * Uses runtime detection - no compile-time dependency on Codex.
 */

import { Storage, FaberConfig } from '../types.js';
import { FaberError } from '../errors.js';
import { LocalStorage } from './local.js';
import { findProjectRoot } from '../config.js';

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
  MemorySearcher?: new (root: string, config?: Partial<MemoryConfig>) => MemorySearcherInstance;
  MemoryWriter?: new (root: string, config?: Partial<MemoryConfig>) => MemoryWriterInstance;
}

// Runtime type definitions for Codex Memory (matches @fractary/codex memory module)

interface MemoryConfig {
  memoryDir: string;
  cacheDir: string;
  syncedMemoryPatterns: string[];
}

interface MemorySearchQuery {
  text?: string;
  memory_type?: string;
  category?: string;
  phase?: string;
  agent?: string;
  tags?: string[];
  status?: string;
  limit?: number;
}

interface MemorySearchResult {
  entry: {
    file_path: string;
    mtime: string;
    source: string;
    frontmatter: Record<string, unknown>;
  };
  score: number;
  source: string;
  filePath: string;
}

interface MemoryWriteOptions {
  memory_type: string;
  title: string;
  description: string;
  body: string;
  frontmatter: Record<string, unknown>;
  template?: string;
}

interface MemoryWriteResult {
  memory_id: string;
  file_path: string;
  deduplicated: boolean;
  existing_id?: string;
}

interface MemorySearcherInstance {
  search(query: MemorySearchQuery): MemorySearchResult[];
}

interface MemoryWriterInstance {
  write(options: MemoryWriteOptions): MemoryWriteResult;
}

/**
 * Adapter for @fractary/codex integration
 */
export class CodexAdapter {
  private codex: CodexModule | null = null;
  private cacheManager: CacheManager | null = null;
  private storageManager: StorageManager | null = null;
  private config: CodexConfig | null = null;
  private codexLoadAttempted = false;

  constructor() {
    // Lazy load codex on first use
  }

  /**
   * Try to load @fractary/codex at runtime (lazy, async)
   */
  private async tryLoadCodex(): Promise<CodexModule | null> {
    if (this.codexLoadAttempted) {
      return this.codex;
    }

    this.codexLoadAttempted = true;

    try {
      // Dynamic import for ESM compatibility - no compile-time dependency
      // Use string variable to prevent TypeScript from attempting module resolution
      const codexModuleName = '@fractary/codex';
      const codexModule = await import(codexModuleName) as unknown as CodexModule;
      this.codex = codexModule;
      return codexModule;
    } catch {
      // Codex not installed - this is fine
      this.codex = null;
      return null;
    }
  }

  /**
   * Initialize codex managers (lazy initialization)
   */
  private async ensureInitialized(): Promise<void> {
    // Try to load codex if not already attempted
    if (!this.codexLoadAttempted) {
      await this.tryLoadCodex();
    }

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
   * Check if Codex is available (lazy loads on first check)
   */
  async isAvailable(): Promise<boolean> {
    if (!this.codexLoadAttempted) {
      await this.tryLoadCodex();
    }
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

  /**
   * Search memories via Codex MemorySearcher
   *
   * Falls back to empty results if Codex is not available.
   */
  async searchMemories(query: MemorySearchQuery): Promise<MemorySearchResult[]> {
    const codex = await this.tryLoadCodex();
    if (!codex) {
      return [];
    }

    try {
      const projectRoot = findProjectRoot();
      const { MemorySearcher } = codex as unknown as {
        MemorySearcher: new (root: string, config?: Partial<MemoryConfig>) => MemorySearcherInstance;
      };
      const searcher = new MemorySearcher(projectRoot);
      return searcher.search(query);
    } catch {
      return [];
    }
  }

  /**
   * Write a memory via Codex MemoryWriter
   *
   * Throws if Codex is not available.
   */
  async writeMemory(options: MemoryWriteOptions): Promise<MemoryWriteResult> {
    const codex = await this.tryLoadCodex();
    if (!codex) {
      throw new FaberError('Codex not available for memory writing', 'CODEX_NOT_AVAILABLE', {});
    }

    const projectRoot = findProjectRoot();
    const { MemoryWriter } = codex as unknown as {
      MemoryWriter: new (root: string, config?: Partial<MemoryConfig>) => MemoryWriterInstance;
    };
    const writer = new MemoryWriter(projectRoot);
    return writer.write(options);
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
export async function createStorage(
  artifactType: 'specs' | 'logs' | 'state',
  config?: FaberConfig
): Promise<Storage> {
  const codex = new CodexAdapter();
  const projectRoot = findProjectRoot();

  // Check if Codex should be used
  const useCodex =
    config?.artifacts?.[artifactType]?.use_codex === true &&
    (await codex.isAvailable()) &&
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
