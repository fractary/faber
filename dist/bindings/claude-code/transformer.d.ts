/**
 * Claude Code binding transformer
 */
import { Role, Config, DeploymentArtifact } from '../../types';
import { Overlays } from '../../core/overlays';
export declare class ClaudeCodeTransformer {
    private bindingConfig;
    private templates;
    constructor(bindingConfigPath?: string);
    /**
     * Transform role to Claude Code deployment
     */
    transform(role: Role, config: Config, overlays: Overlays): Promise<DeploymentArtifact>;
    /**
     * Generate agent file content
     */
    private generateAgentFile;
    /**
     * Copy contexts to deployment
     */
    private copyContexts;
    /**
     * Copy overlay contexts to deployment
     */
    private copyOverlayContexts;
    /**
     * Copy tasks to deployment
     */
    private copyTasks;
    /**
     * Copy flows to deployment
     */
    private copyFlows;
    /**
     * Load binding configuration
     */
    private loadBindingConfig;
    /**
     * Load Handlebars templates
     */
    private loadTemplates;
    /**
     * Resolve path template
     */
    private resolvePath;
    /**
     * Collect overlay contexts for template
     */
    private collectOverlayContexts;
    /**
     * Get MCP servers used by role
     */
    private getMCPServers;
}
//# sourceMappingURL=transformer.d.ts.map