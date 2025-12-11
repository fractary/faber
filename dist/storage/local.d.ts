/**
 * @fractary/faber - Local Storage Implementation
 *
 * Direct filesystem storage for FABER artifacts.
 */
import { Storage } from '../types';
/**
 * Local filesystem storage implementation
 */
export declare class LocalStorage implements Storage {
    private basePath;
    constructor(basePath: string);
    private ensureDir;
    private getFullPath;
    /**
     * Write content to storage
     * @returns The path where content was written
     */
    write(id: string, content: string): Promise<string>;
    /**
     * Read content from storage
     * @returns Content or null if not found
     */
    read(id: string): Promise<string | null>;
    /**
     * Check if content exists
     */
    exists(id: string): Promise<boolean>;
    /**
     * List all items in storage (optionally with prefix)
     */
    list(prefix?: string): Promise<string[]>;
    /**
     * Delete content from storage
     */
    delete(id: string): Promise<void>;
    /**
     * Get the base path for this storage
     */
    getBasePath(): string;
}
//# sourceMappingURL=local.d.ts.map