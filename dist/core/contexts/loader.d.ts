/**
 * Context loader and resolver
 */
import { Context, ContextCategory, Role, Config } from '../../types';
export declare class ContextLoader {
    /**
     * Load a single context file
     */
    loadContext(filePath: string, category: ContextCategory): Promise<Context>;
    /**
     * Load all contexts in a category
     */
    loadCategoryContexts(categoryPath: string, category: ContextCategory): Promise<Context[]>;
    /**
     * Load all contexts for a role
     */
    loadRoleContexts(rolePath: string): Promise<Map<string, Context>>;
    /**
     * Load platform context for a role
     */
    loadPlatformContext(role: Role, platform: string): Promise<Context | null>;
    /**
     * Load specialist context on demand
     */
    loadSpecialistContext(role: Role, specialistName: string): Promise<Context | null>;
    /**
     * Parse frontmatter from markdown content
     */
    private parseFrontmatter;
}
/**
 * Context resolver for determining which contexts to load
 */
export declare class ContextResolver {
    private loader;
    constructor();
    /**
     * Resolve all contexts for a role (base + overlays)
     */
    resolveContexts(role: Role, config: Config, overlayPath?: string): Promise<Context[]>;
    /**
     * Detect platform from config
     */
    private detectPlatform;
    /**
     * Load contexts from a category
     */
    private loadCategoryContexts;
    /**
     * Load organization-level overlay contexts
     */
    private loadOrganizationOverlays;
    /**
     * Load platform-specific overlay contexts
     */
    private loadPlatformOverlays;
    /**
     * Load role-specific overlay contexts
     */
    private loadRoleOverlays;
    /**
     * Analyze user request to determine specialist contexts needed
     */
    analyzeRequestForSpecialists(request: string): string[];
}
//# sourceMappingURL=loader.d.ts.map