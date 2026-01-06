/**
 * Anthropic API Client
 *
 * Generates workflow plans via Claude API
 */

import Anthropic from '@anthropic-ai/sdk';
import fs from 'fs/promises';
import path from 'path';
import { Git } from '@fractary/faber';

interface GeneratePlanInput {
  workflow: string;
  issueTitle: string;
  issueDescription: string;
  issueNumber: number;
}

interface WorkflowPlan {
  plan_id: string;
  created_by: string;
  cli_version: string;
  created_at: string;
  issue: {
    source: string;
    id: string;
    url: string;
  };
  branch: string;
  worktree: string;
  workflow: string;
  phases: any[];
  [key: string]: any;
}

/**
 * Anthropic API Client
 */
export class AnthropicClient {
  private client: Anthropic;
  private config: any;
  private git: Git;

  constructor(config: any) {
    this.config = config;
    this.git = new Git();

    const apiKey = config.anthropic?.api_key;
    if (!apiKey) {
      throw new Error('Anthropic API key not found. Set ANTHROPIC_API_KEY environment variable.');
    }

    this.client = new Anthropic({
      apiKey,
    });
  }

  /**
   * Generate workflow plan via Claude API
   */
  async generatePlan(input: GeneratePlanInput): Promise<WorkflowPlan> {
    // Load workflow configuration
    const workflowConfig = await this.loadWorkflowConfig(input.workflow);

    // Generate plan ID
    const timestamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+Z/, '').replace('T', '-');
    const planId = `fractary-faber-${input.issueNumber}-${timestamp}`;

    // Construct prompt for Claude
    const prompt = this.constructPlanningPrompt(input, workflowConfig);

    // Call Claude API
    const response = await this.client.messages.create({
      model: 'claude-sonnet-4-5-20250929',
      max_tokens: 8192,
      messages: [
        {
          role: 'user',
          content: prompt,
        },
      ],
    });

    // Extract plan JSON from response
    const content = response.content[0];
    if (content.type !== 'text') {
      throw new Error('Unexpected response type from Claude API');
    }

    const planJson = this.extractJsonFromResponse(content.text);

    // Add metadata
    const { organization, project } = await this.extractRepoInfo();
    const plan: WorkflowPlan = {
      ...planJson,
      plan_id: planId,
      created_by: 'cli',
      cli_version: '1.0.0',
      created_at: new Date().toISOString(),
      issue: {
        source: 'github',
        id: input.issueNumber.toString(),
        url: `https://github.com/${organization}/${project}/issues/${input.issueNumber}`,
      },
      branch: `feature/${input.issueNumber}`,
      worktree: `~/.claude-worktrees/${organization}-${project}-${input.issueNumber}`,
      workflow: input.workflow,
    };

    return plan;
  }

  /**
   * Load workflow configuration
   */
  private async loadWorkflowConfig(workflow: string): Promise<any> {
    const workflowPath = path.join(
      this.config.workflow?.config_path || './plugins/faber/config/workflows',
      `${workflow}.json`
    );

    try {
      const content = await fs.readFile(workflowPath, 'utf-8');
      return JSON.parse(content);
    } catch (error) {
      throw new Error(`Failed to load workflow config: ${workflow} (${workflowPath})`);
    }
  }

  /**
   * Construct planning prompt for Claude
   */
  private constructPlanningPrompt(input: GeneratePlanInput, workflowConfig: any): string {
    return `You are a workflow planning assistant for the FABER system. Your task is to generate a structured workflow plan based on the provided issue and workflow configuration.

**Issue Information:**
- Number: #${input.issueNumber}
- Title: ${input.issueTitle}
- Description: ${input.issueDescription}

**Workflow Type:** ${input.workflow}

**Workflow Configuration:**
${JSON.stringify(workflowConfig, null, 2)}

**Your Task:**
Generate a complete workflow plan that includes:
1. All phases from the workflow configuration
2. Specific steps for each phase based on the issue requirements
3. Success criteria for each phase
4. Estimated complexity

**Output Format:**
Return ONLY a valid JSON object with the following structure:

\`\`\`json
{
  "phases": [
    {
      "phase": "phase_name",
      "description": "What this phase accomplishes",
      "steps": [
        {
          "action": "specific action to take",
          "details": "additional context or requirements"
        }
      ],
      "success_criteria": [
        "criterion 1",
        "criterion 2"
      ],
      "complexity": "low|medium|high"
    }
  ],
  "overall_complexity": "low|medium|high",
  "estimated_phases": 4,
  "special_considerations": [
    "Any special notes or warnings"
  ]
}
\`\`\`

Generate the plan now:`;
  }

  /**
   * Extract JSON from Claude response
   */
  private extractJsonFromResponse(text: string): any {
    // Try to find JSON in code blocks
    const jsonBlockMatch = text.match(/```json\s*\n([\s\S]*?)\n```/);
    if (jsonBlockMatch) {
      return JSON.parse(jsonBlockMatch[1]);
    }

    // Try to find JSON in the text
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }

    throw new Error('Could not extract JSON from Claude response');
  }

  /**
   * Extract repository organization and project name using SDK Git class
   */
  private async extractRepoInfo(): Promise<{ organization: string; project: string }> {
    try {
      const remoteUrl = this.git.exec('remote get-url origin');

      // Parse git@github.com:organization/project.git or https://github.com/organization/project.git
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
