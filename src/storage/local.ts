/**
 * @fractary/faber - Local Storage Implementation
 *
 * Direct filesystem storage for FABER artifacts.
 */

import * as fs from 'fs';
import * as path from 'path';
import { Storage } from '../types';

/**
 * Local filesystem storage implementation
 */
export class LocalStorage implements Storage {
  private basePath: string;

  constructor(basePath: string) {
    this.basePath = basePath;
    this.ensureDir(basePath);
  }

  private ensureDir(dirPath: string): void {
    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath, { recursive: true });
    }
  }

  private getFullPath(id: string): string {
    return path.join(this.basePath, id);
  }

  /**
   * Write content to storage
   * @returns The path where content was written
   */
  async write(id: string, content: string): Promise<string> {
    const fullPath = this.getFullPath(id);
    this.ensureDir(path.dirname(fullPath));
    fs.writeFileSync(fullPath, content, 'utf-8');
    return fullPath;
  }

  /**
   * Read content from storage
   * @returns Content or null if not found
   */
  async read(id: string): Promise<string | null> {
    const fullPath = this.getFullPath(id);
    if (!fs.existsSync(fullPath)) {
      return null;
    }
    return fs.readFileSync(fullPath, 'utf-8');
  }

  /**
   * Check if content exists
   */
  async exists(id: string): Promise<boolean> {
    const fullPath = this.getFullPath(id);
    return fs.existsSync(fullPath);
  }

  /**
   * List all items in storage (optionally with prefix)
   */
  async list(prefix?: string): Promise<string[]> {
    const searchPath = prefix
      ? path.join(this.basePath, prefix)
      : this.basePath;

    if (!fs.existsSync(searchPath)) {
      return [];
    }

    const results: string[] = [];
    const walkDir = (dir: string, base: string): void => {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        const relativePath = path.join(base, entry.name);
        if (entry.isDirectory()) {
          walkDir(path.join(dir, entry.name), relativePath);
        } else {
          results.push(relativePath);
        }
      }
    };

    if (fs.statSync(searchPath).isDirectory()) {
      walkDir(searchPath, prefix || '');
    } else {
      results.push(prefix || '');
    }

    return results;
  }

  /**
   * Delete content from storage
   */
  async delete(id: string): Promise<void> {
    const fullPath = this.getFullPath(id);
    if (fs.existsSync(fullPath)) {
      fs.unlinkSync(fullPath);
    }
  }

  /**
   * Get the base path for this storage
   */
  getBasePath(): string {
    return this.basePath;
  }
}
