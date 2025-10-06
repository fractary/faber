"use strict";
/**
 * Context system exports
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.ContextUtils = exports.ContextResolver = exports.ContextLoader = void 0;
var loader_1 = require("./loader");
Object.defineProperty(exports, "ContextLoader", { enumerable: true, get: function () { return loader_1.ContextLoader; } });
var loader_2 = require("./loader");
Object.defineProperty(exports, "ContextResolver", { enumerable: true, get: function () { return loader_2.ContextResolver; } });
const types_1 = require("../../types");
/**
 * Context utilities
 */
class ContextUtils {
    /**
     * Merge multiple contexts with precedence
     */
    static mergeContexts(contexts) {
        // Later contexts override earlier ones
        const merged = [];
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
    static filterByCategory(contexts, category) {
        return contexts.filter(ctx => ctx.category === category);
    }
    /**
     * Check if context is platform-specific
     */
    static isPlatformContext(context) {
        return context.category === types_1.ContextCategory.PLATFORM;
    }
    /**
     * Check if context requires MCP server
     */
    static requiresMCPServer(context) {
        return Boolean(context.metadata?.mcp_server &&
            context.metadata.mcp_server !== 'null');
    }
    /**
     * Get required MCP tools from context
     */
    static getRequiredTools(context) {
        return context.metadata?.required_tools || [];
    }
    /**
     * Sort contexts by priority (platform > standards > specialists > others)
     */
    static sortByPriority(contexts) {
        const priority = {
            [types_1.ContextCategory.PLATFORM]: 1,
            [types_1.ContextCategory.STANDARD]: 2,
            [types_1.ContextCategory.SPECIALIST]: 3,
            [types_1.ContextCategory.PLAYBOOK]: 4,
            [types_1.ContextCategory.PATTERN]: 5,
            [types_1.ContextCategory.REFERENCE]: 6,
            [types_1.ContextCategory.TROUBLESHOOTING]: 7
        };
        return contexts.sort((a, b) => {
            const aPriority = priority[a.category] || 99;
            const bPriority = priority[b.category] || 99;
            return aPriority - bPriority;
        });
    }
}
exports.ContextUtils = ContextUtils;
//# sourceMappingURL=index.js.map