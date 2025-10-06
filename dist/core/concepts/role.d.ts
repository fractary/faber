/**
 * Role concept loader and validator
 */
import { z } from 'zod';
import { BaseConceptLoader } from './base';
import { Role, RoleMetadata, ValidationError } from '../../types';
export declare class RoleLoader extends BaseConceptLoader<Role> {
    constructor();
    protected getMetadataSchema(): z.ZodSchema;
    protected loadConceptContent(conceptPath: string, metadata: RoleMetadata): Promise<Role>;
    protected validateSpecific(role: Role): Promise<ValidationError[]>;
    private loadPrompt;
    private loadTasks;
    private loadFlows;
    private loadContexts;
    private loadBindings;
    private extractContextReferences;
}
//# sourceMappingURL=role.d.ts.map