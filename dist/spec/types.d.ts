/**
 * @fractary/faber - Spec Module Types
 *
 * Re-exports from main types + spec-specific interfaces.
 */
import type { SpecTemplateType } from '../types';
export type { SpecConfig, SpecTemplateType, Specification, SpecMetadata, SpecPhase, SpecTask, SpecCreateOptions, SpecListOptions, SpecValidateResult, SpecRefineResult, RefinementQuestion, WorkType, } from '../types';
/**
 * Template definition
 */
export interface SpecTemplate {
    id: SpecTemplateType;
    name: string;
    description: string;
    sections: TemplateSection[];
}
export interface TemplateSection {
    id: string;
    title: string;
    required: boolean;
    description: string;
    defaultContent?: string;
}
/**
 * Spec file frontmatter
 */
export interface SpecFrontmatter {
    id: string;
    title: string;
    work_id?: string;
    work_type: string;
    template: string;
    created_at: string;
    updated_at: string;
    validation_status?: string;
    source: string;
}
/**
 * Phase update options
 */
export interface PhaseUpdateOptions {
    status?: 'not_started' | 'in_progress' | 'complete';
    objective?: string;
    notes?: string[];
}
/**
 * Task update options
 */
export interface TaskUpdateOptions {
    text?: string;
    completed?: boolean;
}
//# sourceMappingURL=types.d.ts.map