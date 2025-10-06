/**
 * Configuration system exports
 */

export { ConfigLoader } from './loader';

import { Config, MCPServerConfig } from '../../types';
import { ConfigLoader } from './loader';

/**
 * Global configuration instance
 */
let globalConfig: Config | null = null;
let configLoader: ConfigLoader | null = null;

/**
 * Initialize global configuration
 */
export function initConfig(startPath?: string): Config {
  if (!configLoader) {
    configLoader = new ConfigLoader();
  }

  globalConfig = configLoader.load(startPath);
  return globalConfig;
}

/**
 * Get global configuration
 */
export function getConfig(): Config {
  if (!globalConfig) {
    initConfig();
  }
  return globalConfig!;
}

/**
 * Update global configuration
 */
export function updateConfig(updates: Partial<Config>): Config {
  if (!configLoader) {
    configLoader = new ConfigLoader();
  }

  const current = getConfig();
  globalConfig = configLoader.merge(current, updates);
  return globalConfig;
}

/**
 * Get platform configuration for a role
 */
export function getPlatformForRole(roleName: string): string | null {
  const config = getConfig();
  return config.platforms?.[roleName] || null;
}

/**
 * Get MCP server configuration
 */
export function getMCPServerConfig(serverName: string): MCPServerConfig | null {
  const config = getConfig();
  return config.mcp_servers?.[serverName] || null;
}

/**
 * Check if overlays are enabled
 */
export function overlaysEnabled(): boolean {
  const config = getConfig();
  return config.overlays?.enabled !== false;
}

/**
 * Get overlay paths
 */
export function getOverlayPaths(): string[] {
  const config = getConfig();
  return config.overlays?.paths || ['.faber/overlays'];
}