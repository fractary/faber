"use strict";
/**
 * @fractary/faber - Local Storage Implementation
 *
 * Direct filesystem storage for FABER artifacts.
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.LocalStorage = void 0;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
/**
 * Local filesystem storage implementation
 */
class LocalStorage {
    basePath;
    constructor(basePath) {
        this.basePath = basePath;
        this.ensureDir(basePath);
    }
    ensureDir(dirPath) {
        if (!fs.existsSync(dirPath)) {
            fs.mkdirSync(dirPath, { recursive: true });
        }
    }
    getFullPath(id) {
        return path.join(this.basePath, id);
    }
    /**
     * Write content to storage
     * @returns The path where content was written
     */
    async write(id, content) {
        const fullPath = this.getFullPath(id);
        this.ensureDir(path.dirname(fullPath));
        fs.writeFileSync(fullPath, content, 'utf-8');
        return fullPath;
    }
    /**
     * Read content from storage
     * @returns Content or null if not found
     */
    async read(id) {
        const fullPath = this.getFullPath(id);
        if (!fs.existsSync(fullPath)) {
            return null;
        }
        return fs.readFileSync(fullPath, 'utf-8');
    }
    /**
     * Check if content exists
     */
    async exists(id) {
        const fullPath = this.getFullPath(id);
        return fs.existsSync(fullPath);
    }
    /**
     * List all items in storage (optionally with prefix)
     */
    async list(prefix) {
        const searchPath = prefix
            ? path.join(this.basePath, prefix)
            : this.basePath;
        if (!fs.existsSync(searchPath)) {
            return [];
        }
        const results = [];
        const walkDir = (dir, base) => {
            const entries = fs.readdirSync(dir, { withFileTypes: true });
            for (const entry of entries) {
                const relativePath = path.join(base, entry.name);
                if (entry.isDirectory()) {
                    walkDir(path.join(dir, entry.name), relativePath);
                }
                else {
                    results.push(relativePath);
                }
            }
        };
        if (fs.statSync(searchPath).isDirectory()) {
            walkDir(searchPath, prefix || '');
        }
        else {
            results.push(prefix || '');
        }
        return results;
    }
    /**
     * Delete content from storage
     */
    async delete(id) {
        const fullPath = this.getFullPath(id);
        if (fs.existsSync(fullPath)) {
            fs.unlinkSync(fullPath);
        }
    }
    /**
     * Get the base path for this storage
     */
    getBasePath() {
        return this.basePath;
    }
}
exports.LocalStorage = LocalStorage;
//# sourceMappingURL=local.js.map