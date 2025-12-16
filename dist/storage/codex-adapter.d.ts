/**
 * @fractary/faber - Codex Adapter
 *
 * Optional integration with @fractary/codex for cross-project storage.
 * Uses runtime detection - no compile-time dependency on Codex.
 */
import { Storage, FaberConfig } from '../types';
interface CodexConfig {
    organization?: string;
    directories?: {
        specs?: string;
        docs?: string;
        logs?: string;
    };
}
/**
 * Adapter for @fractary/codex integration
 */
export declare class CodexAdapter {
    private codex;
    private cacheManager;
    private storageManager;
    private config;
    constructor();
    /**
     * Try to load @fractary/codex at runtime
     */
    private tryLoadCodex;
    /**
     * Initialize codex managers (lazy initialization)
     */
    private ensureInitialized;
    /**
     * Check if Codex is available
     */
    isAvailable(): boolean;
    /**
     * Get loaded config
     */
    getConfig(): Promise<CodexConfig>;
    /**
     * Check if Codex is enabled for a specific artifact type
     */
    isEnabledFor(artifactType: string): boolean;
    /**
     * Build a codex URI for an artifact
     */
    buildUri(type: string, id: string): string;
    /**
     * Detect current project name
     */
    private detectProject;
    /**
     * Store content via Codex
     */
    store(type: string, id: string, content: string): Promise<string>;
    /**
     * Retrieve content via Codex
     */
    retrieve(type: string, id: string): Promise<string | null>;
    /**
     * Check if content exists via Codex
     */
    exists(type: string, id: string): Promise<boolean>;
    /**
     * List content via Codex
     * Note: Codex doesn't have a native list operation, so this returns empty
     * In practice, listing should use local storage
     */
    list(_type: string): Promise<string[]>;
    /**
     * Delete content via Codex
     */
    delete(type: string, id: string): Promise<void>;
    /**
     * Get a Codex reference URI
     */
    getReference(type: string, id: string): string;
}
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
export declare function createStorage(artifactType: 'specs' | 'logs' | 'state', config?: FaberConfig): Storage;
export {};
//# sourceMappingURL=codex-adapter.d.ts.map