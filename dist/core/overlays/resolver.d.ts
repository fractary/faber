/**
 * Overlay system for customization without forking
 */
import { Context } from '../../types';
export interface Overlays {
    organization: OverlayContent;
    platforms: Record<string, OverlayContent>;
    roles: Record<string, OverlayContent>;
    teams: Record<string, OverlayContent>;
    workflows: Record<string, OverlayContent>;
}
export interface OverlayContent {
    contexts: Context[];
    config?: Record<string, unknown>;
}
export declare class OverlayResolver {
    private contextLoader;
    private overlayPath;
    constructor(overlayPath?: string);
    /**
     * Resolve all overlays for a concept
     */
    resolveOverlays(conceptType: string, conceptName: string, platform?: string): Promise<Overlays>;
    /**
     * Load organization-level overlays
     */
    private loadOrganizationOverlays;
    /**
     * Load platform-specific overlays
     */
    private loadPlatformOverlays;
    /**
     * Load role-specific overlays
     */
    private loadRoleOverlays;
    /**
     * Load team-specific overlays
     */
    private loadTeamOverlays;
    /**
     * Load workflow-specific overlays
     */
    private loadWorkflowOverlays;
    /**
     * Load overlay content from a directory
     */
    private loadOverlayContent;
    /**
     * Load all contexts from overlay directory
     */
    private loadOverlayContexts;
    /**
     * Merge overlay configurations with precedence
     */
    mergeConfigurations(base: Record<string, unknown>, overlays: Overlays): Record<string, unknown>;
    /**
     * Deep merge two objects
     */
    private deepMerge;
    /**
     * Collect all contexts from overlays in precedence order
     */
    collectContexts(overlays: Overlays): Context[];
}
//# sourceMappingURL=resolver.d.ts.map