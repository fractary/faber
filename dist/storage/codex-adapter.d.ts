/**
 * @fractary/faber - Codex Adapter
 *
 * Optional integration with @fractary/codex for cross-project storage.
 * Uses runtime detection - no compile-time dependency on Codex.
 */
import { Storage, FaberConfig } from '../types';
/**
 * Adapter for @fractary/codex integration
 */
export declare class CodexAdapter {
    private codex;
    constructor();
    /**
     * Try to load @fractary/codex at runtime
     */
    private tryLoadCodex;
    /**
     * Check if Codex is available
     */
    isAvailable(): boolean;
    /**
     * Check if Codex is enabled for a specific artifact type
     */
    isEnabledFor(artifactType: string): boolean;
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
     */
    list(type: string): Promise<string[]>;
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
//# sourceMappingURL=codex-adapter.d.ts.map