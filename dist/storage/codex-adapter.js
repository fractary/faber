"use strict";
/**
 * @fractary/faber - Codex Adapter
 *
 * Optional integration with @fractary/codex for cross-project storage.
 * Uses runtime detection - no compile-time dependency on Codex.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.CodexAdapter = void 0;
exports.createStorage = createStorage;
const errors_1 = require("../errors");
const local_1 = require("./local");
const config_1 = require("../config");
/**
 * Adapter for @fractary/codex integration
 */
class CodexAdapter {
    codex = null;
    cacheManager = null;
    storageManager = null;
    config = null;
    constructor() {
        this.codex = this.tryLoadCodex();
    }
    /**
     * Try to load @fractary/codex at runtime
     */
    tryLoadCodex() {
        try {
            // Dynamic require - no compile-time dependency
            // eslint-disable-next-line @typescript-eslint/no-require-imports
            const codexModule = require('@fractary/codex');
            return codexModule;
        }
        catch {
            // Codex not installed - this is fine
            return null;
        }
    }
    /**
     * Initialize codex managers (lazy initialization)
     */
    async ensureInitialized() {
        if (!this.codex) {
            throw new errors_1.FaberError('Codex not available', 'CODEX_NOT_AVAILABLE', {});
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
            }
            catch {
                this.config = {};
            }
        }
    }
    /**
     * Check if Codex is available
     */
    isAvailable() {
        return this.codex !== null;
    }
    /**
     * Get loaded config
     */
    async getConfig() {
        await this.ensureInitialized();
        return this.config || {};
    }
    /**
     * Check if Codex is enabled for a specific artifact type
     */
    isEnabledFor(artifactType) {
        if (!this.codex)
            return false;
        // Check if codex has directories configured for this type
        const typeDirectoryMap = {
            specs: 'specs',
            logs: 'logs',
            state: 'state',
        };
        return typeDirectoryMap[artifactType] !== undefined;
    }
    /**
     * Build a codex URI for an artifact
     */
    buildUri(type, id) {
        if (!this.codex) {
            throw new errors_1.FaberError('Codex not available', 'CODEX_NOT_AVAILABLE', {});
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
    detectProject() {
        try {
            const root = (0, config_1.findProjectRoot)();
            const parts = root.split('/');
            return parts[parts.length - 1] || 'unknown';
        }
        catch {
            return 'unknown';
        }
    }
    /**
     * Store content via Codex
     */
    async store(type, id, content) {
        await this.ensureInitialized();
        if (!this.cacheManager || !this.codex) {
            throw new errors_1.FaberError('Codex not initialized', 'CODEX_NOT_AVAILABLE', {});
        }
        const uri = this.buildUri(type, id);
        // Create a FetchResult-like object for caching
        const result = {
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
    async retrieve(type, id) {
        await this.ensureInitialized();
        if (!this.cacheManager || !this.codex) {
            throw new errors_1.FaberError('Codex not initialized', 'CODEX_NOT_AVAILABLE', {});
        }
        const uri = this.buildUri(type, id);
        const reference = this.codex.resolveReference(uri);
        if (!reference) {
            return null;
        }
        try {
            const result = await this.cacheManager.get(reference);
            return result.content.toString('utf-8');
        }
        catch {
            return null;
        }
    }
    /**
     * Check if content exists via Codex
     */
    async exists(type, id) {
        await this.ensureInitialized();
        if (!this.cacheManager || !this.codex) {
            throw new errors_1.FaberError('Codex not initialized', 'CODEX_NOT_AVAILABLE', {});
        }
        const uri = this.buildUri(type, id);
        return this.cacheManager.has(uri);
    }
    /**
     * List content via Codex
     * Note: Codex doesn't have a native list operation, so this returns empty
     * In practice, listing should use local storage
     */
    async list(_type) {
        // Codex cache doesn't support listing by type
        // This would require filesystem operations on the cache directory
        return [];
    }
    /**
     * Delete content via Codex
     */
    async delete(type, id) {
        await this.ensureInitialized();
        if (!this.cacheManager || !this.codex) {
            throw new errors_1.FaberError('Codex not initialized', 'CODEX_NOT_AVAILABLE', {});
        }
        const uri = this.buildUri(type, id);
        await this.cacheManager.invalidate(uri);
    }
    /**
     * Get a Codex reference URI
     */
    getReference(type, id) {
        return `codex://${type}/${id}`;
    }
}
exports.CodexAdapter = CodexAdapter;
/**
 * Storage implementation that delegates to Codex
 */
class CodexStorage {
    codex;
    type;
    constructor(codex, type) {
        this.codex = codex;
        this.type = type;
    }
    async write(id, content) {
        await this.codex.store(this.type, id, content);
        return this.codex.getReference(this.type, id);
    }
    async read(id) {
        return this.codex.retrieve(this.type, id);
    }
    async exists(id) {
        return this.codex.exists(this.type, id);
    }
    async list(prefix) {
        const all = await this.codex.list(this.type);
        if (!prefix)
            return all;
        return all.filter(item => item.startsWith(prefix));
    }
    async delete(id) {
        return this.codex.delete(this.type, id);
    }
}
/**
 * Artifact type to storage path mapping
 */
const DEFAULT_PATHS = {
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
function createStorage(artifactType, config) {
    const codex = new CodexAdapter();
    const projectRoot = (0, config_1.findProjectRoot)();
    // Check if Codex should be used
    const useCodex = config?.artifacts?.[artifactType]?.use_codex === true &&
        codex.isAvailable() &&
        codex.isEnabledFor(artifactType);
    if (useCodex) {
        return new CodexStorage(codex, artifactType);
    }
    // Fall back to local storage
    const localPath = config?.artifacts?.[artifactType]?.local_path ||
        DEFAULT_PATHS[artifactType];
    // Resolve relative to project root
    const fullPath = localPath.startsWith('/')
        ? `${projectRoot}${localPath}`
        : `${projectRoot}/${localPath}`;
    return new local_1.LocalStorage(fullPath);
}
//# sourceMappingURL=codex-adapter.js.map