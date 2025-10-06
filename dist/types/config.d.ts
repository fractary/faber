/**
 * Configuration type definitions
 */
export interface Config {
    platforms?: Record<string, string>;
    mcp_servers?: Record<string, MCPServerConfig>;
    overlays?: {
        enabled: boolean;
        paths?: string[];
    };
    bindings?: Record<string, BindingConfig>;
}
export interface MCPServerConfig {
    command?: string;
    args?: string[];
    env?: Record<string, string>;
    url?: string;
    api_key?: string;
}
export interface BindingConfig {
    auto_activate?: boolean;
    default_platform?: string;
    context_loading?: 'lazy' | 'eager';
    python_version?: string;
    async_mode?: boolean;
    [key: string]: unknown;
}
//# sourceMappingURL=config.d.ts.map