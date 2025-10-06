/**
 * Configuration system exports
 */
export { ConfigLoader } from './loader';
import { Config, MCPServerConfig } from '../../types';
/**
 * Initialize global configuration
 */
export declare function initConfig(startPath?: string): Config;
/**
 * Get global configuration
 */
export declare function getConfig(): Config;
/**
 * Update global configuration
 */
export declare function updateConfig(updates: Partial<Config>): Config;
/**
 * Get platform configuration for a role
 */
export declare function getPlatformForRole(roleName: string): string | null;
/**
 * Get MCP server configuration
 */
export declare function getMCPServerConfig(serverName: string): MCPServerConfig | null;
/**
 * Check if overlays are enabled
 */
export declare function overlaysEnabled(): boolean;
/**
 * Get overlay paths
 */
export declare function getOverlayPaths(): string[];
//# sourceMappingURL=index.d.ts.map