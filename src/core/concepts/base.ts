/**
 * Base concept loader and validator
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import * as yaml from 'js-yaml';
import { z } from 'zod';
import {
  Concept,
  ConceptType,
  ConceptMetadata,
  ValidationResult,
  ValidationError,
  ConceptReference
} from '../../types';

// Base metadata schema
export const BaseMetadataSchema = z.object({
  org: z.string().regex(/^[a-z0-9-]+$/),
  system: z.string().regex(/^[a-z0-9-]+$/),
  name: z.string().regex(/^[a-z0-9-]+$/),
  type: z.nativeEnum(ConceptType),
  description: z.string(),
  created: z.string().optional(),
  updated: z.string().optional(),
  visibility: z.enum(['public', 'internal', 'private']).optional(),
  tags: z.array(z.string()).optional()
});

export abstract class BaseConceptLoader<T extends Concept> {
  protected conceptType: ConceptType;

  constructor(conceptType: ConceptType) {
    this.conceptType = conceptType;
  }

  /**
   * Load a concept from disk
   */
  async load(conceptPath: string): Promise<T> {
    // Verify directory exists
    const stats = await fs.stat(conceptPath).catch(() => null);
    if (!stats || !stats.isDirectory()) {
      throw new Error(`Concept path does not exist or is not a directory: ${conceptPath}`);
    }

    // Load metadata
    const metadata = await this.loadMetadata(conceptPath);

    // Validate metadata type matches expected
    if (metadata.type !== this.conceptType) {
      throw new Error(`Expected ${this.conceptType} but found ${metadata.type} at ${conceptPath}`);
    }

    // Load concept-specific content
    const concept = await this.loadConceptContent(conceptPath, metadata);

    return concept;
  }

  /**
   * Validate a concept
   */
  async validate(concept: T): Promise<ValidationResult> {
    const errors: ValidationError[] = [];

    // Validate metadata
    const metadataErrors = await this.validateMetadata(concept.metadata);
    errors.push(...metadataErrors);

    // Validate concept-specific rules
    const specificErrors = await this.validateSpecific(concept);
    errors.push(...specificErrors);

    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * Load metadata file (agent.yml, tool.yml, etc.)
   */
  protected async loadMetadata(conceptPath: string): Promise<ConceptMetadata> {
    const metadataFiles = [
      'agent.yml',
      'tool.yml',
      'eval.yml',
      'team.yml',
      'workflow.yml'
    ];

    let metadataContent: string | null = null;
    let metadataFile: string | null = null;

    for (const file of metadataFiles) {
      const filePath = path.join(conceptPath, file);
      try {
        metadataContent = await fs.readFile(filePath, 'utf-8');
        metadataFile = file;
        break;
      } catch {
        // Try next file
      }
    }

    if (!metadataContent || !metadataFile) {
      throw new Error(`No metadata file found in ${conceptPath}`);
    }

    try {
      const metadata = yaml.load(metadataContent) as ConceptMetadata;
      return metadata;
    } catch (error) {
      throw new Error(`Failed to parse ${metadataFile}: ${error}`);
    }
  }

  /**
   * Validate metadata against schema
   */
  protected async validateMetadata(metadata: ConceptMetadata): Promise<ValidationError[]> {
    const errors: ValidationError[] = [];

    try {
      const schema = this.getMetadataSchema();
      schema.parse(metadata);
    } catch (error) {
      if (error instanceof z.ZodError) {
        for (const issue of error.issues) {
          errors.push({
            path: issue.path.join('.'),
            message: issue.message,
            type: 'error'
          });
        }
      }
    }

    return errors;
  }

  /**
   * Check if file exists
   */
  protected async fileExists(filePath: string): Promise<boolean> {
    try {
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Read file content
   */
  protected async readFile(filePath: string): Promise<string> {
    return fs.readFile(filePath, 'utf-8');
  }

  /**
   * List files in directory
   */
  protected async listFiles(dirPath: string, extension?: string): Promise<string[]> {
    try {
      const files = await fs.readdir(dirPath);
      if (extension) {
        return files.filter(f => f.endsWith(extension));
      }
      return files;
    } catch {
      return [];
    }
  }

  /**
   * Parse frontmatter from markdown
   */
  protected parseFrontmatter(content: string): { metadata?: Record<string, unknown>; body: string } {
    const frontmatterRegex = /^---\n([\s\S]*?)\n---\n([\s\S]*)$/;
    const match = content.match(frontmatterRegex);

    if (match) {
      try {
        const metadata = yaml.load(match[1]) as Record<string, unknown>;
        return { metadata, body: match[2] };
      } catch {
        return { body: content };
      }
    }

    return { body: content };
  }

  // Abstract methods to be implemented by subclasses
  protected abstract getMetadataSchema(): z.ZodSchema;
  protected abstract loadConceptContent(conceptPath: string, metadata: ConceptMetadata): Promise<T>;
  protected abstract validateSpecific(concept: T): Promise<ValidationError[]>;
}

/**
 * Concept reference implementation
 */
export class ConceptReferenceImpl implements ConceptReference {
  constructor(
    public type: ConceptType,
    public name: string
  ) {}

  toString(): string {
    return `${this.type}:${this.name}`;
  }

  static parse(ref: string): ConceptReferenceImpl {
    const [type, name] = ref.split(':');
    if (!type || !name) {
      throw new Error(`Invalid concept reference: ${ref}`);
    }

    if (!Object.values(ConceptType).includes(type as ConceptType)) {
      throw new Error(`Unknown concept type: ${type}`);
    }

    return new ConceptReferenceImpl(type as ConceptType, name);
  }
}