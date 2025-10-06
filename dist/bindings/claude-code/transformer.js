"use strict";
/**
 * Claude Code binding transformer
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.ClaudeCodeTransformer = void 0;
const path = __importStar(require("path"));
const yaml = __importStar(require("js-yaml"));
const Handlebars = __importStar(require("handlebars"));
const types_1 = require("../../types");
const base_1 = require("../../core/concepts/base");
class ClaudeCodeTransformer {
    constructor(bindingConfigPath) {
        this.templates = {};
        // Load binding configuration
        const configPath = bindingConfigPath || path.join(__dirname, 'binding.yml');
        this.bindingConfig = this.loadBindingConfig(configPath);
        this.loadTemplates();
    }
    /**
     * Transform role to Claude Code deployment
     */
    async transform(role, config, overlays) {
        const files = new Map();
        const directories = [];
        // Generate agent file
        const agentContent = await this.generateAgentFile(role, config, overlays);
        const agentPath = this.resolvePath(this.bindingConfig.output_structure.role_path, role);
        files.set(agentPath, agentContent);
        directories.push(path.dirname(agentPath));
        // Copy contexts
        await this.copyContexts(role, files, directories);
        // Copy overlay contexts
        await this.copyOverlayContexts(overlays, role, files, directories);
        // Copy tasks
        await this.copyTasks(role, files, directories);
        // Copy flows
        await this.copyFlows(role, files, directories);
        // Copy configuration
        const configPath = this.bindingConfig.output_structure.config_path;
        files.set(configPath, yaml.dump(config));
        directories.push(path.dirname(configPath));
        // Create metadata
        const metadata = {
            concept: new base_1.ConceptReferenceImpl(types_1.ConceptType.ROLE, role.metadata.name),
            binding: 'claude-code',
            timestamp: new Date(),
            config: config
        };
        return {
            files,
            directories: [...new Set(directories)], // Remove duplicates
            metadata
        };
    }
    /**
     * Generate agent file content
     */
    async generateAgentFile(role, config, overlays) {
        // Prepare template data
        const templateData = {
            metadata: role.metadata,
            prompt: role.prompt,
            tasks: Array.from(role.tasks.values()),
            flows: Array.from(role.flows.values()),
            contextCategories: Object.values(types_1.ContextCategory),
            overlayContexts: this.collectOverlayContexts(overlays),
            mcpServers: this.getMCPServers(role, config),
            paths: {
                contextPrefix: this.resolvePath(this.bindingConfig.path_resolution.context_prefix, role),
                taskPrefix: this.resolvePath(this.bindingConfig.path_resolution.task_prefix, role),
                flowPrefix: this.resolvePath(this.bindingConfig.path_resolution.flow_prefix, role)
            }
        };
        // Generate frontmatter
        const frontmatter = this.templates.frontmatter(templateData);
        // Generate body
        const body = this.templates.body(templateData);
        return `${frontmatter}\n${body}`;
    }
    /**
     * Copy contexts to deployment
     */
    async copyContexts(role, files, directories) {
        const docsPath = this.resolvePath(this.bindingConfig.output_structure.docs_path, role);
        const contextsPath = path.join(docsPath, 'contexts');
        for (const [key, context] of role.contexts) {
            const contextPath = path.join(contextsPath, key + '.md');
            let content = context.content;
            // Add frontmatter if not present
            if (context.metadata) {
                content = `---\n${yaml.dump(context.metadata)}---\n\n${content}`;
            }
            files.set(contextPath, content);
            directories.push(path.dirname(contextPath));
        }
    }
    /**
     * Copy overlay contexts to deployment
     */
    async copyOverlayContexts(overlays, role, files, directories) {
        const docsPath = this.resolvePath(this.bindingConfig.output_structure.docs_path, role);
        const overlaysPath = path.join(docsPath, 'contexts', '_overlays');
        // Organization overlays
        for (const context of overlays.organization.contexts) {
            const contextPath = path.join(overlaysPath, 'organization', context.category, context.name + '.md');
            files.set(contextPath, context.content);
            directories.push(path.dirname(contextPath));
        }
        // Platform overlays
        for (const [platform, overlay] of Object.entries(overlays.platforms)) {
            for (const context of overlay.contexts) {
                const contextPath = path.join(overlaysPath, 'platforms', platform, context.category, context.name + '.md');
                files.set(contextPath, context.content);
                directories.push(path.dirname(contextPath));
            }
        }
        // Role overlays
        for (const [roleName, overlay] of Object.entries(overlays.roles)) {
            for (const context of overlay.contexts) {
                const contextPath = path.join(overlaysPath, 'roles', roleName, context.category, context.name + '.md');
                files.set(contextPath, context.content);
                directories.push(path.dirname(contextPath));
            }
        }
    }
    /**
     * Copy tasks to deployment
     */
    async copyTasks(role, files, directories) {
        const docsPath = this.resolvePath(this.bindingConfig.output_structure.docs_path, role);
        const tasksPath = path.join(docsPath, 'tasks');
        for (const task of role.tasks.values()) {
            const taskPath = path.join(tasksPath, task.name + '.md');
            files.set(taskPath, task.content);
            directories.push(path.dirname(taskPath));
        }
    }
    /**
     * Copy flows to deployment
     */
    async copyFlows(role, files, directories) {
        const docsPath = this.resolvePath(this.bindingConfig.output_structure.docs_path, role);
        const flowsPath = path.join(docsPath, 'flows');
        for (const flow of role.flows.values()) {
            const flowPath = path.join(flowsPath, flow.name + '.md');
            files.set(flowPath, flow.content);
            directories.push(path.dirname(flowPath));
        }
    }
    /**
     * Load binding configuration
     */
    loadBindingConfig(configPath) {
        try {
            const content = require('fs').readFileSync(configPath, 'utf-8');
            return yaml.load(content);
        }
        catch (error) {
            throw new Error(`Failed to load binding config: ${error}`);
        }
    }
    /**
     * Load Handlebars templates
     */
    loadTemplates() {
        if (this.bindingConfig.templates?.role_frontmatter) {
            const templatePath = path.join(__dirname, this.bindingConfig.templates.role_frontmatter);
            const templateContent = require('fs').readFileSync(templatePath, 'utf-8');
            this.templates.frontmatter = Handlebars.compile(templateContent);
        }
        if (this.bindingConfig.templates?.role_body) {
            const templatePath = path.join(__dirname, this.bindingConfig.templates.role_body);
            const templateContent = require('fs').readFileSync(templatePath, 'utf-8');
            this.templates.body = Handlebars.compile(templateContent);
        }
    }
    /**
     * Resolve path template
     */
    resolvePath(template, role) {
        return template
            .replace('{org}', role.metadata.org)
            .replace('{system}', role.metadata.system)
            .replace('{name}', role.metadata.name);
    }
    /**
     * Collect overlay contexts for template
     */
    collectOverlayContexts(overlays) {
        const contexts = [];
        // Add organization contexts
        for (const context of overlays.organization.contexts) {
            contexts.push({
                ...context,
                path: `/.faber/overlays/organization/contexts/${context.category}/${context.name}.md`
            });
        }
        // Add platform contexts
        for (const [platform, overlay] of Object.entries(overlays.platforms)) {
            for (const context of overlay.contexts) {
                contexts.push({
                    ...context,
                    path: `/.faber/overlays/platforms/${platform}/contexts/${context.category}/${context.name}.md`
                });
            }
        }
        // Add role contexts
        for (const [roleName, overlay] of Object.entries(overlays.roles)) {
            for (const context of overlay.contexts) {
                contexts.push({
                    ...context,
                    path: `/.faber/overlays/roles/${roleName}/contexts/${context.category}/${context.name}.md`
                });
            }
        }
        return contexts;
    }
    /**
     * Get MCP servers used by role
     */
    getMCPServers(role, config) {
        const servers = {};
        // Check platform contexts for MCP server references
        for (const context of role.contexts.values()) {
            if (context.metadata?.mcp_server) {
                const serverName = context.metadata.mcp_server;
                const serverConfig = config.mcp_servers?.[serverName];
                if (serverConfig) {
                    servers[serverName] = serverConfig;
                }
            }
        }
        return Object.keys(servers).length > 0 ? servers : null;
    }
}
exports.ClaudeCodeTransformer = ClaudeCodeTransformer;
//# sourceMappingURL=transformer.js.map