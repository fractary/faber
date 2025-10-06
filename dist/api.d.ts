/**
 * Faber-CLI Programmatic API
 */
import { EventEmitter } from 'events';
import { Config, ConceptType, ValidationResult, Concept } from './types';
import { Overlays } from './core/overlays/resolver';
import { ConceptInfo, DeploymentArtifact } from './types';
export interface FaberOptions {
    projectPath?: string;
    configPath?: string;
    verbose?: boolean;
    quiet?: boolean;
}
export interface CreateOptions {
    org?: string;
    system?: string;
    platforms?: string[];
    description?: string;
    members?: string[];
    type?: string;
    target?: string;
}
export interface BuildOptions {
    output?: string;
    noOverlays?: boolean;
    platform?: string;
    dryRun?: boolean;
    verbose?: boolean;
}
export declare class FaberAPI extends EventEmitter {
    private projectPath;
    private configPath;
    private config;
    private configLoader;
    constructor(options?: FaberOptions);
    /**
     * Initialize a new Faber project
     */
    init(template?: string): Promise<void>;
    /**
     * Get project configuration
     */
    getConfig(): Promise<Config>;
    /**
     * Set configuration value
     */
    setConfig(key: string, value: any): Promise<void>;
    /**
     * Create a new concept
     */
    createConcept(type: ConceptType, name: string, options?: CreateOptions): Promise<void>;
    /**
     * Load a concept
     */
    loadConcept<T extends Concept>(type: ConceptType, name: string): Promise<T>;
    /**
     * List concepts
     */
    listConcepts(type?: ConceptType): Promise<ConceptInfo[]>;
    /**
     * Validate a concept
     */
    validateConcept(type: ConceptType, name: string): Promise<ValidationResult>;
    /**
     * Build a deployment
     */
    build(framework: string, concept: Concept, options?: BuildOptions): Promise<DeploymentArtifact>;
    /**
     * Deploy an artifact
     */
    deploy(artifact: DeploymentArtifact, target: string): Promise<void>;
    /**
     * Resolve overlays
     */
    resolveOverlays(type: string, name: string, platform?: string): Promise<Overlays>;
    /**
     * Apply overlays to concept
     */
    applyOverlays(concept: Concept, overlays: Overlays): Promise<Concept>;
}
//# sourceMappingURL=api.d.ts.map