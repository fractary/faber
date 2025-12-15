/**
 * @fractary/faber - Agent Executor
 *
 * Bridges FABER workflow with Forge's AgentAPI for agent resolution and execution.
 */

import { AgentAPI, ExecutableAgentInterface, AgentResult } from '@fractary/forge';
import { PhaseContext } from './types';
import { WorkflowError } from '../errors';

export interface ForgeConfig {
  enabled: boolean;
  prefer_local: boolean;
}

export interface AgentExecutorConfig {
  forge?: ForgeConfig;
}

/**
 * Maps FABER phases to Forge agent names
 */
const PHASE_AGENT_MAP: Record<string, string> = {
  frame: 'frame-agent',
  architect: 'architect-agent',
  build: 'build-agent',
  evaluate: 'evaluate-agent',
  release: 'release-agent',
};

export class AgentExecutor {
  private forge?: AgentAPI;
  private useLegacy: boolean;
  private agentCache: Map<string, ExecutableAgentInterface> = new Map();

  constructor(config?: AgentExecutorConfig) {
    this.useLegacy = !config?.forge?.enabled;

    if (!this.useLegacy) {
      this.forge = new AgentAPI(config?.forge);
    }
  }

  /**
   * Get agent name for a FABER phase or return custom agent name directly
   *
   * If phaseName is a known FABER phase (frame, architect, etc.), returns the mapped agent name.
   * If phaseName looks like a custom agent name (contains '-agent' or '@'), returns it directly.
   * Otherwise, generates a default agent name by appending '-agent'.
   */
  getAgentNameForPhase(phaseName: string): string {
    // If it's a known phase, use the mapping
    if (PHASE_AGENT_MAP[phaseName]) {
      return PHASE_AGENT_MAP[phaseName];
    }

    // If it looks like a custom agent name (contains '-agent' or version specifier '@'),
    // return it directly without modification
    if (phaseName.includes('-agent') || phaseName.includes('@')) {
      return phaseName;
    }

    // Default fallback: append '-agent' suffix
    return `${phaseName}-agent`;
  }

  /**
   * Check if using Forge mode
   */
  isForgeEnabled(): boolean {
    return !this.useLegacy;
  }

  /**
   * Execute a phase agent
   */
  async executePhaseAgent(
    phaseName: string,
    task: string,
    context: PhaseContext
  ): Promise<AgentResult> {
    if (this.useLegacy) {
      return this.executeLegacyPhase(phaseName, task, context);
    }

    return this.executeForgeAgent(phaseName, task, context);
  }

  /**
   * Execute using Forge agent
   */
  private async executeForgeAgent(
    phaseName: string,
    task: string,
    context: PhaseContext
  ): Promise<AgentResult> {
    const agentName = this.getAgentNameForPhase(phaseName);

    try {
      // Check cache first
      let agent = this.agentCache.get(agentName);

      if (!agent) {
        // Resolve agent from Forge
        agent = await this.forge!.resolveAgent(agentName);
        this.agentCache.set(agentName, agent);
      }

      // Invoke agent with task and context
      return await agent.invoke(task, {
        workflowId: context.workflowId,
        workId: context.workId,
        phase: context.phase,
        autonomy: context.autonomy,
        issue: context.issue,
        spec: context.spec,
        branch: context.branch,
        previousOutputs: context.previousOutputs,
      });
    } catch (error) {
      if (error instanceof Error && error.name === 'AgentNotFoundError') {
        throw new WorkflowError(
          `Agent '${agentName}' not found. ` +
          `Run 'forge install ${agentName}' or check your .fractary/agents/ directory.`,
          { phase: phaseName, agent: agentName }
        );
      }
      throw error;
    }
  }

  /**
   * Execute using legacy hardcoded logic (fallback)
   */
  private async executeLegacyPhase(
    phaseName: string,
    _task: string,
    _context: PhaseContext
  ): Promise<AgentResult> {
    // Return structured result matching Forge format
    // This preserves backward compatibility during migration
    return {
      output: `Legacy phase execution: ${phaseName}`,
      messages: [],
      metadata: {
        legacy: true,
        phase: phaseName,
      },
    };
  }

  /**
   * Clear agent cache
   */
  clearCache(): void {
    this.agentCache.clear();
  }

  /**
   * Health check for all phase agents
   */
  async healthCheck(): Promise<{
    healthy: boolean;
    phases: Record<string, { healthy: boolean; error?: string }>;
  }> {
    if (this.useLegacy) {
      return { healthy: true, phases: {} };
    }

    const phases = Object.keys(PHASE_AGENT_MAP);
    const results: Record<string, { healthy: boolean; error?: string }> = {};
    let allHealthy = true;

    for (const phase of phases) {
      const agentName = PHASE_AGENT_MAP[phase];
      try {
        const check = await this.forge!.healthCheck(agentName);
        results[phase] = { healthy: check.healthy };
        if (!check.healthy) allHealthy = false;
      } catch (error) {
        results[phase] = {
          healthy: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        };
        allHealthy = false;
      }
    }

    return { healthy: allHealthy, phases: results };
  }
}
