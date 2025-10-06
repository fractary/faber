/**
 * Base concept loader and validator
 */
import { z } from 'zod';
import { Concept, ConceptType, ConceptMetadata, ValidationResult, ValidationError, ConceptReference } from '../../types';
export declare const BaseMetadataSchema: z.ZodObject<{
    org: z.ZodString;
    system: z.ZodString;
    name: z.ZodString;
    type: z.ZodNativeEnum<typeof ConceptType>;
    description: z.ZodString;
    created: z.ZodOptional<z.ZodString>;
    updated: z.ZodOptional<z.ZodString>;
    visibility: z.ZodOptional<z.ZodEnum<["public", "internal", "private"]>>;
    tags: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
}, "strip", z.ZodTypeAny, {
    name?: string;
    description?: string;
    org?: string;
    system?: string;
    type?: ConceptType;
    created?: string;
    updated?: string;
    visibility?: "public" | "internal" | "private";
    tags?: string[];
}, {
    name?: string;
    description?: string;
    org?: string;
    system?: string;
    type?: ConceptType;
    created?: string;
    updated?: string;
    visibility?: "public" | "internal" | "private";
    tags?: string[];
}>;
export declare abstract class BaseConceptLoader<T extends Concept> {
    protected conceptType: ConceptType;
    constructor(conceptType: ConceptType);
    /**
     * Load a concept from disk
     */
    load(conceptPath: string): Promise<T>;
    /**
     * Validate a concept
     */
    validate(concept: T): Promise<ValidationResult>;
    /**
     * Load metadata file (agent.yml, tool.yml, etc.)
     */
    protected loadMetadata(conceptPath: string): Promise<ConceptMetadata>;
    /**
     * Validate metadata against schema
     */
    protected validateMetadata(metadata: ConceptMetadata): Promise<ValidationError[]>;
    /**
     * Check if file exists
     */
    protected fileExists(filePath: string): Promise<boolean>;
    /**
     * Read file content
     */
    protected readFile(filePath: string): Promise<string>;
    /**
     * List files in directory
     */
    protected listFiles(dirPath: string, extension?: string): Promise<string[]>;
    /**
     * Parse frontmatter from markdown
     */
    protected parseFrontmatter(content: string): {
        metadata?: Record<string, unknown>;
        body: string;
    };
    protected abstract getMetadataSchema(): z.ZodSchema;
    protected abstract loadConceptContent(conceptPath: string, metadata: ConceptMetadata): Promise<T>;
    protected abstract validateSpecific(concept: T): Promise<ValidationError[]>;
}
/**
 * Concept reference implementation
 */
export declare class ConceptReferenceImpl implements ConceptReference {
    type: ConceptType;
    name: string;
    constructor(type: ConceptType, name: string);
    toString(): string;
    static parse(ref: string): ConceptReferenceImpl;
}
//# sourceMappingURL=base.d.ts.map