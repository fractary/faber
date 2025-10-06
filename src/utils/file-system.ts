/**
 * File system utilities
 */

import { promises as fs } from 'fs';
import path from 'path';

/**
 * Ensure a directory exists, creating it if necessary
 */
export async function ensureDirectoryExists(dirPath: string): Promise<void> {
  try {
    await fs.mkdir(dirPath, { recursive: true });
  } catch (error) {
    if ((error as any).code !== 'EEXIST') {
      throw error;
    }
  }
}

/**
 * Write content to a file
 */
export async function writeFile(filePath: string, content: string): Promise<void> {
  await ensureDirectoryExists(path.dirname(filePath));
  await fs.writeFile(filePath, content, 'utf-8');
}

/**
 * Read a file
 */
export async function readFile(filePath: string): Promise<string> {
  return fs.readFile(filePath, 'utf-8');
}

/**
 * Check if a file exists
 */
export async function fileExists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

/**
 * Check if a directory exists
 */
export async function directoryExists(dirPath: string): Promise<boolean> {
  try {
    const stats = await fs.stat(dirPath);
    return stats.isDirectory();
  } catch {
    return false;
  }
}

/**
 * List files in a directory
 */
export async function listFiles(dirPath: string, pattern?: RegExp): Promise<string[]> {
  const entries = await fs.readdir(dirPath, { withFileTypes: true });
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
export async function listDirectories(dirPath: string): Promise<string[]> {
  const entries = await fs.readdir(dirPath, { withFileTypes: true });
  return entries
    .filter(entry => entry.isDirectory())
    .map(entry => entry.name);
}

/**
 * Copy a file
 */
export async function copyFile(source: string, destination: string): Promise<void> {
  await ensureDirectoryExists(path.dirname(destination));
  await fs.copyFile(source, destination);
}

/**
 * Remove a file or directory
 */
export async function remove(targetPath: string): Promise<void> {
  await fs.rm(targetPath, { recursive: true, force: true });
}