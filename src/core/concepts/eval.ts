/**
 * Eval concept loader
 */

import { z } from 'zod';
import { BaseConceptLoader } from './base';
import { Eval, ConceptType, Scenario, Metric } from '../../types';
import * as yaml from 'js-yaml';
import { promises as fs } from 'fs';
import path from 'path';

const ScenarioSchema = z.object({
  name: z.string(),
  description: z.string().optional(),
  inputs: z.record(z.unknown()),
  expected_outputs: z.record(z.unknown()).optional(),
  assertions: z.array(z.string()).optional()
});

const MetricSchema = z.object({
  name: z.string(),
  type: z.enum(['accuracy', 'coverage', 'performance', 'quality']),
  threshold: z.number().optional()
});

const EvalMetadataSchema = z.object({
  name: z.string(),
  description: z.string().optional(),
  targets: z.array(z.string()),
  scenarios: z.array(ScenarioSchema),
  metrics: z.array(MetricSchema).optional(),
  success_threshold: z.number().optional(),
  platforms: z.array(z.string()).optional()
});

export class EvalLoader extends BaseConceptLoader<Eval> {
  protected async loadConceptContent(conceptPath: string, metadata: any): Promise<Eval> {
    const evalMetadata = EvalMetadataSchema.parse(metadata);

    return {
      name: evalMetadata.name,
      type: ConceptType.EVAL,
      description: evalMetadata.description,
      targets: evalMetadata.targets,
      scenarios: evalMetadata.scenarios,
      metrics: evalMetadata.metrics || [],
      success_threshold: evalMetadata.success_threshold || 80,
      platforms: evalMetadata.platforms || []
    };
  }

  protected async loadMetadata(conceptPath: string): Promise<any> {
    const metadataPath = path.join(conceptPath, 'eval.yml');
    const content = await fs.readFile(metadataPath, 'utf-8');
    return yaml.load(content);
  }

  protected async validateConcept(evalConcept: Eval): Promise<void> {
    // Validate eval structure
    if (evalConcept.scenarios.length === 0) {
      throw new Error('Eval must have at least one scenario');
    }

    if (evalConcept.targets.length === 0) {
      throw new Error('Eval must target at least one concept');
    }

    // Validate target format
    for (const target of evalConcept.targets) {
      if (!target.includes(':')) {
        throw new Error(`Invalid target format: ${target}. Use format 'type:name'`);
      }
    }
  }

  getSchema() {
    return EvalMetadataSchema;
  }
}