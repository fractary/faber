"use strict";
/**
 * File system utilities
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ensureDirectoryExists = ensureDirectoryExists;
exports.writeFile = writeFile;
exports.readFile = readFile;
exports.fileExists = fileExists;
exports.directoryExists = directoryExists;
exports.listFiles = listFiles;
exports.listDirectories = listDirectories;
exports.copyFile = copyFile;
exports.remove = remove;
const fs_1 = require("fs");
const path_1 = __importDefault(require("path"));
/**
 * Ensure a directory exists, creating it if necessary
 */
async function ensureDirectoryExists(dirPath) {
    try {
        await fs_1.promises.mkdir(dirPath, { recursive: true });
    }
    catch (error) {
        if (error.code !== 'EEXIST') {
            throw error;
        }
    }
}
/**
 * Write content to a file
 */
async function writeFile(filePath, content) {
    await ensureDirectoryExists(path_1.default.dirname(filePath));
    await fs_1.promises.writeFile(filePath, content, 'utf-8');
}
/**
 * Read a file
 */
async function readFile(filePath) {
    return fs_1.promises.readFile(filePath, 'utf-8');
}
/**
 * Check if a file exists
 */
async function fileExists(filePath) {
    try {
        await fs_1.promises.access(filePath);
        return true;
    }
    catch {
        return false;
    }
}
/**
 * Check if a directory exists
 */
async function directoryExists(dirPath) {
    try {
        const stats = await fs_1.promises.stat(dirPath);
        return stats.isDirectory();
    }
    catch {
        return false;
    }
}
/**
 * List files in a directory
 */
async function listFiles(dirPath, pattern) {
    const entries = await fs_1.promises.readdir(dirPath, { withFileTypes: true });
    let files = entries
        .filter(entry => entry.isFile())
        .map(entry => entry.name);
    if (pattern) {
        files = files.filter(file => pattern.test(file));
    }
    return files;
}
/**
 * List directories in a directory
 */
async function listDirectories(dirPath) {
    const entries = await fs_1.promises.readdir(dirPath, { withFileTypes: true });
    return entries
        .filter(entry => entry.isDirectory())
        .map(entry => entry.name);
}
/**
 * Copy a file
 */
async function copyFile(source, destination) {
    await ensureDirectoryExists(path_1.default.dirname(destination));
    await fs_1.promises.copyFile(source, destination);
}
/**
 * Remove a file or directory
 */
async function remove(targetPath) {
    await fs_1.promises.rm(targetPath, { recursive: true, force: true });
}
//# sourceMappingURL=file-system.js.map