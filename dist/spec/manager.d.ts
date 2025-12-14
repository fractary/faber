/**
 * @fractary/faber - Spec Manager
 *
 * Specification management for FABER workflows.
 */
import { SpecConfig, Specification, SpecMetadata, SpecCreateOptions, SpecListOptions, SpecValidateResult, SpecRefineResult, WorkType, PhaseUpdateOptions } from './types';
/**
 * Specification Manager
 */
export declare class SpecManager {
    private config;
    private specsDir;
    constructor(config?: Partial<SpecConfig>);
    /**
     * Get default spec configuration
     */
    private getDefaultSpecConfig;
    /**
     * Merge partial config with defaults
     */
    private mergeWithDefaults;
    /**
     * Ensure specs directory exists
     */
    private ensureSpecsDir;
    /**
     * Get spec file path
     */
    private getSpecPath;
    /**
     * Create a new specification
     */
    createSpec(title: string, options?: SpecCreateOptions): Specification;
    /**
     * Get a specification by ID or path
     */
    getSpec(idOrPath: string): Specification | null;
    /**
     * Update a specification
     */
    updateSpec(idOrPath: string, updates: {
        title?: string;
        content?: string;
        workId?: string;
        workType?: WorkType;
        validationStatus?: SpecMetadata['validation_status'];
    }): Specification;
    /**
     * Delete a specification
     */
    deleteSpec(idOrPath: string): boolean;
    /**
     * List all specifications
     */
    listSpecs(options?: SpecListOptions): Specification[];
    /**
     * Update a phase in a specification
     */
    updatePhase(specIdOrPath: string, phaseId: string, updates: PhaseUpdateOptions): Specification;
    /**
     * Complete a task in a phase
     */
    completeTask(specIdOrPath: string, phaseId: string, taskIndex: number): Specification;
    /**
     * Add a task to a phase
     */
    addTask(specIdOrPath: string, phaseId: string, taskText: string): Specification;
    /**
     * Validate a specification
     */
    validateSpec(specIdOrPath: string): SpecValidateResult;
    /**
     * Generate refinement questions for a spec
     */
    generateRefinementQuestions(specIdOrPath: string): Array<{
        id: string;
        question: string;
        category: string;
        priority: 'high' | 'medium' | 'low';
    }>;
    /**
     * Apply refinements to a spec
     */
    refineSpec(specIdOrPath: string, answers: Record<string, string>): SpecRefineResult;
    /**
     * Infer work type from template type
     */
    private inferWorkType;
    /**
     * Update phase content in spec
     */
    private updatePhaseInContent;
    /**
     * Update tasks in content
     */
    private updateTasksInContent;
    /**
     * Get available templates
     */
    getTemplates(): Array<{
        id: string;
        name: string;
        description: string;
    }>;
}
//# sourceMappingURL=manager.d.ts.map