/**
 * @fractary/faber - Agent Executor
 *
 * Bridges FABER workflow with Forge's AgentAPI for agent resolution and execution.
 */
import { AgentResult } from '@fractary/forge';
import { PhaseContext } from './types';
export interface ForgeConfig {
    enabled: boolean;
    prefer_local: boolean;
}
export interface AgentExecutorConfig {
    forge?: ForgeConfig;
}
export declare class AgentExecutor {
    private forge?;
    private useLegacy;
    private agentCache;
    constructor(config?: AgentExecutorConfig);
    /**
     * Get agent name for a FABER phase or return custom agent name directly
     *
     * If phaseName is a known FABER phase (frame, architect, etc.), returns the mapped agent name.
     * If phaseName looks like a custom agent name (contains '-agent' or '@'), returns it directly.
     * Otherwise, generates a default agent name by appending '-agent'.
     */
    getAgentNameForPhase(phaseName: string): string;
    /**
     * Check if using Forge mode
     */
    isForgeEnabled(): boolean;
    /**
     * Execute a phase agent
     */
    executePhaseAgent(phaseName: string, task: string, context: PhaseContext): Promise<AgentResult>;
    /**
     * Execute using Forge agent
     */
    private executeForgeAgent;
    /**
     * Execute using legacy hardcoded logic (fallback)
     */
    private executeLegacyPhase;
    /**
     * Clear agent cache
     */
    clearCache(): void;
    /**
     * Health check for all phase agents
     */
    healthCheck(): Promise<{
        healthy: boolean;
        phases: Record<string, {
            healthy: boolean;
            error?: string;
        }>;
    }>;
}
//# sourceMappingURL=agent-executor.d.ts.map