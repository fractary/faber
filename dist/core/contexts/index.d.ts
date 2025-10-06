/**
 * Context system exports
 */
export { ContextLoader } from './loader';
export { ContextResolver } from './loader';
import { Context, ContextCategory } from '../../types';
/**
 * Context utilities
 */
export declare class ContextUtils {
    /**
     * Merge multiple contexts with precedence
     */
    static mergeContexts(contexts: Context[]): string;
    /**
     * Filter contexts by category
     */
    static filterByCategory(contexts: Context[], category: ContextCategory): Context[];
    /**
     * Check if context is platform-specific
     */
    static isPlatformContext(context: Context): boolean;
    /**
     * Check if context requires MCP server
     */
    static requiresMCPServer(context: Context): boolean;
    /**
     * Get required MCP tools from context
     */
    static getRequiredTools(context: Context): string[];
    /**
     * Sort contexts by priority (platform > standards > specialists > others)
     */
    static sortByPriority(contexts: Context[]): Context[];
}
//# sourceMappingURL=index.d.ts.map