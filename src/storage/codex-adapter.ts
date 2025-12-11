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
interface CodexModule {
  Codex: new () => CodexInstance;
}

interface CodexInstance {
  getConfig(): { types?: Record<string, { enabled: boolean }> };
  store(type: string, id: string, content: string): Promise<string>;
  get(type: string, id: string): Promise<string | null>;
  exists(type: string, id: string): Promise<boolean>;
  list(type: string): Promise<string[]>;
  delete(type: string, id: string): Promise<void>;
}

/**
 * Adapter for @fractary/codex integration
 */
export class CodexAdapter {
  private codex: CodexInstance | null = null;

  constructor() {
    this.codex = this.tryLoadCodex();
  }

  /**
   * Try to load @fractary/codex at runtime
   */
  private tryLoadCodex(): CodexInstance | null {
    try {
      // Dynamic require - no compile-time dependency
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const codexModule = require('@fractary/codex') as CodexModule;
      return new codexModule.Codex();
    } catch {
      // Codex not installed - this is fine
      return null;
    }
  }

  /**
   * Check if Codex is available
   */
  isAvailable(): boolean {
    return this.codex !== null;
  }

  /**
   * Check if Codex is enabled for a specific artifact type
   */
  isEnabledFor(artifactType: string): boolean {
    if (!this.codex) return false;

    try {
      const config = this.codex.getConfig();
      return config.types?.[artifactType]?.enabled === true;
    } catch {
      return false;
    }
  }

  /**
   * Store content via Codex
   */
  async store(type: string, id: string, content: string): Promise<string> {
    if (!this.codex) {
      throw new FaberError('Codex not available', 'CODEX_NOT_AVAILABLE', {});
    }
    return this.codex.store(type, id, content);
  }

  /**
   * Retrieve content via Codex
   */
  async retrieve(type: string, id: string): Promise<string | null> {
    if (!this.codex) {
      throw new FaberError('Codex not available', 'CODEX_NOT_AVAILABLE', {});
    }
    return this.codex.get(type, id);
  }

  /**
   * Check if content exists via Codex
   */
  async exists(type: string, id: string): Promise<boolean> {
    if (!this.codex) {
      throw new FaberError('Codex not available', 'CODEX_NOT_AVAILABLE', {});
    }
    return this.codex.exists(type, id);
  }

  /**
   * List content via Codex
   */
  async list(type: string): Promise<string[]> {
    if (!this.codex) {
      throw new FaberError('Codex not available', 'CODEX_NOT_AVAILABLE', {});
    }
    return this.codex.list(type);
  }

  /**
   * Delete content via Codex
   */
  async delete(type: string, id: string): Promise<void> {
    if (!this.codex) {
      throw new FaberError('Codex not available', 'CODEX_NOT_AVAILABLE', {});
    }
    return this.codex.delete(type, id);
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
