/**
 * Context system exports
 */

export { ContextLoader } from './loader';
export { ContextResolver } from './loader';

import { Context, ContextCategory } from '../../types';

/**
 * Context utilities
 */
export class ContextUtils {
  /**
   * Merge multiple contexts with precedence
   */
  static mergeContexts(contexts: Context[]): string {
    // Later contexts override earlier ones
    const merged: string[] = [];

    for (const context of contexts) {
      merged.push(`# Context: ${context.name} (${context.category})\n`);
      merged.push(context.content);
      merged.push('\n---\n');
    }

    return merged.join('\n');
  }

  /**
   * Filter contexts by category
   */
  static filterByCategory(
    contexts: Context[],
    category: ContextCategory
  ): Context[] {
    return contexts.filter(ctx => ctx.category === category);
  }

  /**
   * Check if context is platform-specific
   */
  static isPlatformContext(context: Context): boolean {
    return context.category === ContextCategory.PLATFORM;
  }

  /**
   * Check if context requires MCP server
   */
  static requiresMCPServer(context: Context): boolean {
    return Boolean(
      context.metadata?.mcp_server &&
      context.metadata.mcp_server !== 'null'
    );
  }

  /**
   * Get required MCP tools from context
   */
  static getRequiredTools(context: Context): string[] {
    return context.metadata?.required_tools || [];
  }

  /**
   * Sort contexts by priority (platform > standards > specialists > others)
   */
  static sortByPriority(contexts: Context[]): Context[] {
    const priority: Record<ContextCategory, number> = {
      [ContextCategory.PLATFORM]: 1,
      [ContextCategory.STANDARD]: 2,
      [ContextCategory.SPECIALIST]: 3,
      [ContextCategory.PLAYBOOK]: 4,
      [ContextCategory.PATTERN]: 5,
      [ContextCategory.REFERENCE]: 6,
      [ContextCategory.TROUBLESHOOTING]: 7
    };

    return contexts.sort((a, b) => {
      const aPriority = priority[a.category] || 99;
      const bPriority = priority[b.category] || 99;
      return aPriority - bPriority;
    });
  }
}