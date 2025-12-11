/**
 * @fractary/faber - Spec Templates
 *
 * Built-in specification templates for different work types.
 */
import { SpecTemplate, SpecTemplateType } from './types';
/**
 * All built-in templates
 */
export declare const templates: Record<SpecTemplateType, SpecTemplate>;
/**
 * Get a template by type
 */
export declare function getTemplate(type: SpecTemplateType): SpecTemplate;
/**
 * List all available templates
 */
export declare function listTemplates(): SpecTemplate[];
/**
 * Generate spec content from a template
 */
export declare function generateSpecContent(template: SpecTemplate, options: {
    title: string;
    workId?: string;
    workType: string;
    context?: string;
}): string;
//# sourceMappingURL=templates.d.ts.map