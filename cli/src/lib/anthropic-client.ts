/**
 * Plan Builder (formerly Anthropic Client)
 *
 * Generates deterministic workflow plans from resolved workflow configurations.
 * The plan structure is built programmatically from the resolved workflow —
 * no LLM call is needed because the plan is a direct representation of the
 * workflow definition with issue/branch metadata attached.
 *
 * This aligns the CLI plan format with the faber-planner agent format,
 * ensuring workflow-run can consume plans from either source.
 */

import Ajv from 'ajv';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { Git, WorkflowResolver, type ResolvedWorkflow } from '@fractary/faber';
import { slugify } from '../utils/validation.js';
import type { LoadedFaberConfig } from '../types/config.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

interface GeneratePlanInput {
  workflow: string;
  issueTitle: string;
  issueDescription: string;
  issueNumber: number;
}

export interface WorkflowPlanItem {
  target: string;
  work_id: string;
  planning_mode: 'work_id';
  issue: {
    number: number;
    title: string;
    url: string;
  };
  target_context: null;
  branch: {
    name: string;
    status: 'new' | 'ready' | 'resume';
  };
  worktree: string | null;
}

export interface WorkflowPlan {
  id: string;
  created: string;
  created_by: string;
  cli_version: string;
  metadata: {
    org: string;
    project: string;
    subproject: string;
    year: string;
    month: string;
    day: string;
    hour: string;
    minute: string;
    second: string;
  };
  source: {
    input: string;
    work_id: string;
    planning_mode: 'work_id';
    target_match: null;
    expanded_from: null;
  };
  workflow: {
    id: string;
    resolved_at: string;
    inheritance_chain: string[];
    phases: ResolvedWorkflow['phases'];
  };
  autonomy: string;
  phases_to_run: string[] | null;
  step_to_run: string | null;
  additional_instructions: string | null;
  items: WorkflowPlanItem[];
  execution: {
    mode: 'sequential' | 'parallel';
    max_concurrent: number;
    status: 'pending';
    started_at: null;
    completed_at: null;
    results: never[];
  };
  [key: string]: any;
}

/**
 * Plan Builder (exported as AnthropicClient for backward compatibility)
 */
export class AnthropicClient {
  private config: LoadedFaberConfig;
  private git: Git;
  private ajv: Ajv;
  private planSchema: any;

  constructor(config: LoadedFaberConfig) {
    this.config = config;
    this.git = new Git();
    this.ajv = new Ajv({ strict: false, validateFormats: false });
  }

  /**
   * Load plan JSON schema for validation
   */
  private async loadPlanSchema(): Promise<void> {
    if (this.planSchema) {
      return;
    }

    try {
      const schemaPath = path.resolve(__dirname, '../../schemas/plan.schema.json');
      const schemaContent = await fs.readFile(schemaPath, 'utf8');
      this.planSchema = JSON.parse(schemaContent);
    } catch (error) {
      console.warn('Warning: Could not load plan schema for validation:', error instanceof Error ? error.message : 'Unknown error');
      this.planSchema = null;
    }
  }

  /**
   * Validate plan JSON against schema
   */
  private validatePlan(plan: any): void {
    if (!this.planSchema) {
      return;
    }

    const validate = this.ajv.compile(this.planSchema);
    const valid = validate(plan);

    if (!valid) {
      const errors = validate.errors?.map(e => `${e.instancePath} ${e.message}`).join(', ') || 'Unknown validation errors';
      throw new Error(`Plan JSON validation failed: ${errors}`);
    }
  }

  /**
   * Generate deterministic workflow plan.
   *
   * Builds the plan structure directly from the resolved workflow configuration,
   * matching the format produced by the faber-planner agent. No LLM call is needed
   * because the plan is a direct representation of the workflow definition.
   */
  async generatePlan(input: GeneratePlanInput): Promise<WorkflowPlan> {
    await this.loadPlanSchema();

    // Resolve workflow with inheritance (uses SDK WorkflowResolver)
    const resolver = new WorkflowResolver({ projectRoot: process.cwd() });
    const workflowConfig = await resolver.resolveWorkflow(input.workflow);

    // Extract repo info
    const { organization, project } = await this.extractRepoInfo();

    // Generate plan ID: {org}-{project}-{work-id}
    // Timestamp is omitted from plan-id since run-ids already contain timestamps.
    // This keeps plan directories human-readable and scoped to the work item.
    const now = new Date();
    const year = now.getFullYear().toString();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const hour = String(now.getHours()).padStart(2, '0');
    const minute = String(now.getMinutes()).padStart(2, '0');
    const second = String(now.getSeconds()).padStart(2, '0');
    const subproject = `issue-${input.issueNumber}`;
    const planId = `${slugify(organization)}-${slugify(project)}-${input.issueNumber}`;

    // Build the plan deterministically — no LLM call needed
    const plan: WorkflowPlan = {
      id: planId,
      created: now.toISOString(),
      created_by: 'cli',
      cli_version: '1.3.2',

      metadata: {
        org: organization,
        project,
        subproject,
        year,
        month,
        day,
        hour,
        minute,
        second,
      },

      source: {
        input: `--work-id ${input.issueNumber}`,
        work_id: input.issueNumber.toString(),
        planning_mode: 'work_id',
        target_match: null,
        expanded_from: null,
      },

      workflow: {
        id: workflowConfig.id,
        resolved_at: now.toISOString(),
        inheritance_chain: workflowConfig.inheritance_chain,
        phases: workflowConfig.phases,
      },

      autonomy: workflowConfig.autonomy?.level || 'guarded',
      phases_to_run: null,
      step_to_run: null,
      additional_instructions: null,

      items: [{
        target: subproject,
        work_id: input.issueNumber.toString(),
        planning_mode: 'work_id',
        issue: {
          number: input.issueNumber,
          title: input.issueTitle,
          url: `https://github.com/${organization}/${project}/issues/${input.issueNumber}`,
        },
        target_context: null,
        branch: {
          name: `feat/${input.issueNumber}`,
          status: 'new',
        },
        worktree: null,
      }],

      execution: {
        mode: 'sequential',
        max_concurrent: 1,
        status: 'pending',
        started_at: null,
        completed_at: null,
        results: [],
      },
    };

    // Validate plan against schema
    this.validatePlan(plan);

    return plan;
  }

  /**
   * Extract repository organization and project name using SDK Git class
   */
  private async extractRepoInfo(): Promise<{ organization: string; project: string }> {
    try {
      const remoteUrl = this.git.exec('remote get-url origin');

      const match = remoteUrl.match(/[:/]([^/]+)\/([^/]+?)(?:\.git)?$/);
      if (match) {
        return {
          organization: match[1],
          project: match[2],
        };
      }
    } catch (error) {
      // Fall back to config or defaults
    }

    return {
      organization: this.config.github?.organization || 'unknown',
      project: this.config.github?.project || 'unknown',
    };
  }
}
