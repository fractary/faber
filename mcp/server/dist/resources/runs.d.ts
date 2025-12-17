/**
 * MCP Resource Handlers for FABER Runs
 *
 * Provides access to run data via faber:// URIs.
 */
import { LocalFilesBackend } from '../backends/local-files.js';
export interface Resource {
    uri: string;
    name: string;
    description: string;
    mimeType: string;
}
export interface ResourceContent {
    uri: string;
    mimeType: string;
    text: string;
}
export interface ReadResourceResult {
    contents: ResourceContent[];
}
/**
 * List all run resources
 *
 * @param backend LocalFilesBackend instance
 * @returns Array of resource definitions
 */
export declare function listRunResources(backend: LocalFilesBackend): Promise<Resource[]>;
/**
 * Read resource content
 *
 * @param uri Resource URI (faber://runs/...)
 * @param backend LocalFilesBackend instance
 * @returns Resource contents
 */
export declare function readRunResource(uri: string, backend: LocalFilesBackend): Promise<ReadResourceResult>;
//# sourceMappingURL=runs.d.ts.map