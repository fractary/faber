/**
 * Team concept loader
 */
import { z } from 'zod';
import { BaseConceptLoader } from './base';
import { Team, CoordinationType } from '../../types';
export declare class TeamLoader extends BaseConceptLoader<Team> {
    constructor();
    protected getMetadataSchema(): z.ZodSchema;
    protected loadConceptContent(conceptPath: string, metadata: any): Promise<Team>;
    protected validateSpecific(concept: Team): Promise<any[]>;
    protected loadMetadata(conceptPath: string): Promise<any>;
    protected validateConcept(team: Team): Promise<void>;
    getSchema(): z.ZodObject<{
        name: z.ZodString;
        description: z.ZodOptional<z.ZodString>;
        members: z.ZodArray<z.ZodObject<{
            role: z.ZodString;
            name: z.ZodOptional<z.ZodString>;
            config: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
        }, "strip", z.ZodTypeAny, {
            role?: string;
            name?: string;
            config?: Record<string, unknown>;
        }, {
            role?: string;
            name?: string;
            config?: Record<string, unknown>;
        }>, "many">;
        coordination: z.ZodOptional<z.ZodNativeEnum<typeof CoordinationType>>;
        leader: z.ZodOptional<z.ZodString>;
        workflows: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    }, "strip", z.ZodTypeAny, {
        name?: string;
        description?: string;
        members?: {
            role?: string;
            name?: string;
            config?: Record<string, unknown>;
        }[];
        coordination?: CoordinationType;
        leader?: string;
        workflows?: string[];
    }, {
        name?: string;
        description?: string;
        members?: {
            role?: string;
            name?: string;
            config?: Record<string, unknown>;
        }[];
        coordination?: CoordinationType;
        leader?: string;
        workflows?: string[];
    }>;
}
//# sourceMappingURL=team.d.ts.map