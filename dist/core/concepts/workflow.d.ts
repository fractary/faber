/**
 * Workflow concept loader
 */
import { z } from 'zod';
import { BaseConceptLoader } from './base';
import { Workflow } from '../../types';
export declare class WorkflowLoader extends BaseConceptLoader<Workflow> {
    constructor();
    protected getMetadataSchema(): z.ZodSchema;
    protected loadConceptContent(conceptPath: string, metadata: any): Promise<Workflow>;
    protected validateSpecific(concept: Workflow): Promise<any[]>;
    protected loadMetadata(conceptPath: string): Promise<any>;
    protected validateConcept(workflow: Workflow): Promise<void>;
    getSchema(): z.ZodObject<{
        name: z.ZodString;
        description: z.ZodOptional<z.ZodString>;
        stages: z.ZodArray<z.ZodObject<{
            name: z.ZodString;
            team: z.ZodString;
            entry_criteria: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
            tasks: z.ZodArray<z.ZodString, "many">;
            exit_criteria: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
            on_failure: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
        }, "strip", z.ZodTypeAny, {
            team?: string;
            name?: string;
            tasks?: string[];
            entry_criteria?: string[];
            exit_criteria?: string[];
            on_failure?: string[];
        }, {
            team?: string;
            name?: string;
            tasks?: string[];
            entry_criteria?: string[];
            exit_criteria?: string[];
            on_failure?: string[];
        }>, "many">;
        teams: z.ZodArray<z.ZodString, "many">;
        triggers: z.ZodOptional<z.ZodArray<z.ZodObject<{
            type: z.ZodEnum<["manual", "scheduled", "event"]>;
            config: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
        }, "strip", z.ZodTypeAny, {
            type?: "manual" | "scheduled" | "event";
            config?: Record<string, unknown>;
        }, {
            type?: "manual" | "scheduled" | "event";
            config?: Record<string, unknown>;
        }>, "many">>;
        conditions: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
    }, "strip", z.ZodTypeAny, {
        name?: string;
        description?: string;
        stages?: {
            team?: string;
            name?: string;
            tasks?: string[];
            entry_criteria?: string[];
            exit_criteria?: string[];
            on_failure?: string[];
        }[];
        teams?: string[];
        triggers?: {
            type?: "manual" | "scheduled" | "event";
            config?: Record<string, unknown>;
        }[];
        conditions?: Record<string, unknown>;
    }, {
        name?: string;
        description?: string;
        stages?: {
            team?: string;
            name?: string;
            tasks?: string[];
            entry_criteria?: string[];
            exit_criteria?: string[];
            on_failure?: string[];
        }[];
        teams?: string[];
        triggers?: {
            type?: "manual" | "scheduled" | "event";
            config?: Record<string, unknown>;
        }[];
        conditions?: Record<string, unknown>;
    }>;
}
//# sourceMappingURL=workflow.d.ts.map