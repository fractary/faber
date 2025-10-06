"use strict";
/**
 * Base concept loader and validator
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
exports.ConceptReferenceImpl = exports.BaseConceptLoader = exports.BaseMetadataSchema = void 0;
const fs = __importStar(require("fs/promises"));
const path = __importStar(require("path"));
const yaml = __importStar(require("js-yaml"));
const zod_1 = require("zod");
const types_1 = require("../../types");
// Base metadata schema
exports.BaseMetadataSchema = zod_1.z.object({
    org: zod_1.z.string().regex(/^[a-z0-9-]+$/),
    system: zod_1.z.string().regex(/^[a-z0-9-]+$/),
    name: zod_1.z.string().regex(/^[a-z0-9-]+$/),
    type: zod_1.z.nativeEnum(types_1.ConceptType),
    description: zod_1.z.string(),
    created: zod_1.z.string().optional(),
    updated: zod_1.z.string().optional(),
    visibility: zod_1.z.enum(['public', 'internal', 'private']).optional(),
    tags: zod_1.z.array(zod_1.z.string()).optional()
});
class BaseConceptLoader {
    constructor(conceptType) {
        this.conceptType = conceptType;
    }
    /**
     * Load a concept from disk
     */
    async load(conceptPath) {
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
    async validate(concept) {
        const errors = [];
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
    async loadMetadata(conceptPath) {
        const metadataFiles = [
            'agent.yml',
            'tool.yml',
            'eval.yml',
            'team.yml',
            'workflow.yml'
        ];
        let metadataContent = null;
        let metadataFile = null;
        for (const file of metadataFiles) {
            const filePath = path.join(conceptPath, file);
            try {
                metadataContent = await fs.readFile(filePath, 'utf-8');
                metadataFile = file;
                break;
            }
            catch {
                // Try next file
            }
        }
        if (!metadataContent || !metadataFile) {
            throw new Error(`No metadata file found in ${conceptPath}`);
        }
        try {
            const metadata = yaml.load(metadataContent);
            return metadata;
        }
        catch (error) {
            throw new Error(`Failed to parse ${metadataFile}: ${error}`);
        }
    }
    /**
     * Validate metadata against schema
     */
    async validateMetadata(metadata) {
        const errors = [];
        try {
            const schema = this.getMetadataSchema();
            schema.parse(metadata);
        }
        catch (error) {
            if (error instanceof zod_1.z.ZodError) {
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
    async fileExists(filePath) {
        try {
            await fs.access(filePath);
            return true;
        }
        catch {
            return false;
        }
    }
    /**
     * Read file content
     */
    async readFile(filePath) {
        return fs.readFile(filePath, 'utf-8');
    }
    /**
     * List files in directory
     */
    async listFiles(dirPath, extension) {
        try {
            const files = await fs.readdir(dirPath);
            if (extension) {
                return files.filter(f => f.endsWith(extension));
            }
            return files;
        }
        catch {
            return [];
        }
    }
    /**
     * Parse frontmatter from markdown
     */
    parseFrontmatter(content) {
        const frontmatterRegex = /^---\n([\s\S]*?)\n---\n([\s\S]*)$/;
        const match = content.match(frontmatterRegex);
        if (match) {
            try {
                const metadata = yaml.load(match[1]);
                return { metadata, body: match[2] };
            }
            catch {
                return { body: content };
            }
        }
        return { body: content };
    }
}
exports.BaseConceptLoader = BaseConceptLoader;
/**
 * Concept reference implementation
 */
class ConceptReferenceImpl {
    constructor(type, name) {
        this.type = type;
        this.name = name;
    }
    toString() {
        return `${this.type}:${this.name}`;
    }
    static parse(ref) {
        const [type, name] = ref.split(':');
        if (!type || !name) {
            throw new Error(`Invalid concept reference: ${ref}`);
        }
        if (!Object.values(types_1.ConceptType).includes(type)) {
            throw new Error(`Unknown concept type: ${type}`);
        }
        return new ConceptReferenceImpl(type, name);
    }
}
exports.ConceptReferenceImpl = ConceptReferenceImpl;
//# sourceMappingURL=base.js.map