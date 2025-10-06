/**
 * Eval concept loader
 */
import { z } from 'zod';
import { BaseConceptLoader } from './base';
import { Eval } from '../../types';
export declare class EvalLoader extends BaseConceptLoader<Eval> {
    constructor();
    protected getMetadataSchema(): z.ZodSchema;
    protected loadConceptContent(conceptPath: string, metadata: any): Promise<Eval>;
    protected validateSpecific(concept: Eval): Promise<any[]>;
    protected loadMetadata(conceptPath: string): Promise<any>;
    protected validateConcept(evalConcept: Eval): Promise<void>;
    getSchema(): z.ZodObject<{
        name: z.ZodString;
        description: z.ZodOptional<z.ZodString>;
        targets: z.ZodArray<z.ZodString, "many">;
        scenarios: z.ZodArray<z.ZodObject<{
            name: z.ZodString;
            description: z.ZodOptional<z.ZodString>;
            inputs: z.ZodRecord<z.ZodString, z.ZodUnknown>;
            expected_outputs: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
            assertions: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
        }, "strip", z.ZodTypeAny, {
            name?: string;
            description?: string;
            inputs?: Record<string, unknown>;
            expected_outputs?: Record<string, unknown>;
            assertions?: string[];
        }, {
            name?: string;
            description?: string;
            inputs?: Record<string, unknown>;
            expected_outputs?: Record<string, unknown>;
            assertions?: string[];
        }>, "many">;
        metrics: z.ZodOptional<z.ZodArray<z.ZodObject<{
            name: z.ZodString;
            type: z.ZodEnum<["accuracy", "coverage", "performance", "quality"]>;
            threshold: z.ZodOptional<z.ZodNumber>;
        }, "strip", z.ZodTypeAny, {
            name?: string;
            type?: "accuracy" | "coverage" | "performance" | "quality";
            threshold?: number;
        }, {
            name?: string;
            type?: "accuracy" | "coverage" | "performance" | "quality";
            threshold?: number;
        }>, "many">>;
        success_threshold: z.ZodOptional<z.ZodNumber>;
        platforms: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    }, "strip", z.ZodTypeAny, {
        platforms?: string[];
        name?: string;
        description?: string;
        targets?: string[];
        scenarios?: {
            name?: string;
            description?: string;
            inputs?: Record<string, unknown>;
            expected_outputs?: Record<string, unknown>;
            assertions?: string[];
        }[];
        metrics?: {
            name?: string;
            type?: "accuracy" | "coverage" | "performance" | "quality";
            threshold?: number;
        }[];
        success_threshold?: number;
    }, {
        platforms?: string[];
        name?: string;
        description?: string;
        targets?: string[];
        scenarios?: {
            name?: string;
            description?: string;
            inputs?: Record<string, unknown>;
            expected_outputs?: Record<string, unknown>;
            assertions?: string[];
        }[];
        metrics?: {
            name?: string;
            type?: "accuracy" | "coverage" | "performance" | "quality";
            threshold?: number;
        }[];
        success_threshold?: number;
    }>;
}
//# sourceMappingURL=eval.d.ts.map