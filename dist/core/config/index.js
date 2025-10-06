"use strict";
/**
 * Configuration system exports
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.ConfigLoader = void 0;
exports.initConfig = initConfig;
exports.getConfig = getConfig;
exports.updateConfig = updateConfig;
exports.getPlatformForRole = getPlatformForRole;
exports.getMCPServerConfig = getMCPServerConfig;
exports.overlaysEnabled = overlaysEnabled;
exports.getOverlayPaths = getOverlayPaths;
var loader_1 = require("./loader");
Object.defineProperty(exports, "ConfigLoader", { enumerable: true, get: function () { return loader_1.ConfigLoader; } });
const loader_2 = require("./loader");
/**
 * Global configuration instance
 */
let globalConfig = null;
let configLoader = null;
/**
 * Initialize global configuration
 */
function initConfig(startPath) {
    if (!configLoader) {
        configLoader = new loader_2.ConfigLoader();
    }
    globalConfig = configLoader.load(startPath);
    return globalConfig;
}
/**
 * Get global configuration
 */
function getConfig() {
    if (!globalConfig) {
        initConfig();
    }
    return globalConfig;
}
/**
 * Update global configuration
 */
function updateConfig(updates) {
    if (!configLoader) {
        configLoader = new loader_2.ConfigLoader();
    }
    const current = getConfig();
    globalConfig = configLoader.merge(current, updates);
    return globalConfig;
}
/**
 * Get platform configuration for a role
 */
function getPlatformForRole(roleName) {
    const config = getConfig();
    return config.platforms?.[roleName] || null;
}
/**
 * Get MCP server configuration
 */
function getMCPServerConfig(serverName) {
    const config = getConfig();
    return config.mcp_servers?.[serverName] || null;
}
/**
 * Check if overlays are enabled
 */
function overlaysEnabled() {
    const config = getConfig();
    return config.overlays?.enabled !== false;
}
/**
 * Get overlay paths
 */
function getOverlayPaths() {
    const config = getConfig();
    return config.overlays?.paths || ['.faber/overlays'];
}
//# sourceMappingURL=index.js.map