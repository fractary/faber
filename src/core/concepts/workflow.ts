/**
 * Workflow concept loader
 */

import { z } from 'zod';
import { BaseConceptLoader } from './base';
import { Workflow, ConceptType, Stage, Trigger } from '../../types';
import * as yaml from 'js-yaml';
import { promises as fs } from 'fs';
import path from 'path';

const StageSchema = z.object({
  name: z.string(),
  team: z.string(),
  entry_criteria: z.array(z.string()).optional(),
  tasks: z.array(z.string()),
  exit_criteria: z.array(z.string()).optional(),
  on_failure: z.array(z.string()).optional()
});

const TriggerSchema = z.object({
  type: z.enum(['manual', 'scheduled', 'event']),
  config: z.record(z.unknown()).optional()
});

const WorkflowMetadataSchema = z.object({
  name: z.string(),
  description: z.string().optional(),
  stages: z.array(StageSchema),
  teams: z.array(z.string()),
  triggers: z.array(TriggerSchema).optional(),
  conditions: z.record(z.unknown()).optional()
});

export class WorkflowLoader extends BaseConceptLoader<Workflow> {
  constructor() {
    super(ConceptType.WORKFLOW);
  }

  protected getMetadataSchema(): z.ZodSchema {
    return WorkflowMetadataSchema;
  }

  protected async loadConceptContent(conceptPath: string, metadata: any): Promise<Workflow> {
    const workflowMetadata = WorkflowMetadataSchema.parse(metadata);

    return {
      name: workflowMetadata.name,
      type: ConceptType.WORKFLOW,
      description: workflowMetadata.description,
      stages: (workflowMetadata.stages || []) as Stage[],
      teams: workflowMetadata.teams,
      triggers: (workflowMetadata.triggers || []) as Trigger[],
      conditions: workflowMetadata.conditions || {}
    };
  }

  protected async validateSpecific(concept: Workflow): Promise<any[]> {
    return [];
  }

  protected async loadMetadata(conceptPath: string): Promise<any> {
    const metadataPath = path.join(conceptPath, 'workflow.yml');
    const content = await fs.readFile(metadataPath, 'utf-8');
    return yaml.load(content);
  }

  protected async validateConcept(workflow: Workflow): Promise<void> {
    // Validate workflow structure
    if (workflow.stages.length === 0) {
      throw new Error('Workflow must have at least one stage');
    }

    // Validate teams are referenced in stages
    const stageTeams = new Set(workflow.stages.map(s => s.team));
    for (const team of workflow.teams) {
      if (!stageTeams.has(team)) {
        console.warn(`Team ${team} declared but not used in any stage`);
      }
    }
  }

  getSchema() {
    return WorkflowMetadataSchema;
  }
}