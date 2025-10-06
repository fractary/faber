/**
 * File system utilities
 */
/**
 * Ensure a directory exists, creating it if necessary
 */
export declare function ensureDirectoryExists(dirPath: string): Promise<void>;
/**
 * Write content to a file
 */
export declare function writeFile(filePath: string, content: string): Promise<void>;
/**
 * Read a file
 */
export declare function readFile(filePath: string): Promise<string>;
/**
 * Check if a file exists
 */
export declare function fileExists(filePath: string): Promise<boolean>;
/**
 * Check if a directory exists
 */
export declare function directoryExists(dirPath: string): Promise<boolean>;
/**
 * List files in a directory
 */
export declare function listFiles(dirPath: string, pattern?: RegExp): Promise<string[]>;
/**
 * List directories in a directory
 */
export declare function listDirectories(dirPath: string): Promise<string[]>;
/**
 * Copy a file
 */
export declare function copyFile(source: string, destination: string): Promise<void>;
/**
 * Remove a file or directory
 */
export declare function remove(targetPath: string): Promise<void>;
//# sourceMappingURL=file-system.d.ts.map