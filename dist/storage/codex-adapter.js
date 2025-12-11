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
            return new codexModule.Codex();
        }
        catch {
            // Codex not installed - this is fine
            return null;
        }
    }
    /**
     * Check if Codex is available
     */
    isAvailable() {
        return this.codex !== null;
    }
    /**
     * Check if Codex is enabled for a specific artifact type
     */
    isEnabledFor(artifactType) {
        if (!this.codex)
            return false;
        try {
            const config = this.codex.getConfig();
            return config.types?.[artifactType]?.enabled === true;
        }
        catch {
            return false;
        }
    }
    /**
     * Store content via Codex
     */
    async store(type, id, content) {
        if (!this.codex) {
            throw new errors_1.FaberError('Codex not available', 'CODEX_NOT_AVAILABLE', {});
        }
        return this.codex.store(type, id, content);
    }
    /**
     * Retrieve content via Codex
     */
    async retrieve(type, id) {
        if (!this.codex) {
            throw new errors_1.FaberError('Codex not available', 'CODEX_NOT_AVAILABLE', {});
        }
        return this.codex.get(type, id);
    }
    /**
     * Check if content exists via Codex
     */
    async exists(type, id) {
        if (!this.codex) {
            throw new errors_1.FaberError('Codex not available', 'CODEX_NOT_AVAILABLE', {});
        }
        return this.codex.exists(type, id);
    }
    /**
     * List content via Codex
     */
    async list(type) {
        if (!this.codex) {
            throw new errors_1.FaberError('Codex not available', 'CODEX_NOT_AVAILABLE', {});
        }
        return this.codex.list(type);
    }
    /**
     * Delete content via Codex
     */
    async delete(type, id) {
        if (!this.codex) {
            throw new errors_1.FaberError('Codex not available', 'CODEX_NOT_AVAILABLE', {});
        }
        return this.codex.delete(type, id);
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