"use strict";
/**
 * Faber-CLI Programmatic API
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.FaberAPI = void 0;
const events_1 = require("events");
const path_1 = __importDefault(require("path"));
const types_1 = require("./types");
const loader_1 = require("./core/config/loader");
const role_1 = require("./core/concepts/role");
const team_1 = require("./core/concepts/team");
const workflow_1 = require("./core/concepts/workflow");
const tool_1 = require("./core/concepts/tool");
const eval_1 = require("./core/concepts/eval");
const resolver_1 = require("./core/overlays/resolver");
const transformer_1 = require("./bindings/claude-code/transformer");
const file_system_1 = require("./utils/file-system");
class FaberAPI extends events_1.EventEmitter {
    constructor(options = {}) {
        super();
        this.config = null;
        this.projectPath = options.projectPath || process.cwd();
        this.configPath = options.configPath || path_1.default.join(this.projectPath, '.faber', 'config.yml');
        this.configLoader = new loader_1.ConfigLoader();
    }
    /**
     * Initialize a new Faber project
     */
    async init(template) {
        // Create project structure
        const dirs = [
            '.faber/overlays/organization',
            '.faber/overlays/platforms',
            '.faber/overlays/roles',
            '.faber/overlays/teams',
            '.faber/overlays/workflows',
            'roles',
            'tools',
            'teams',
            'workflows',
            'evals',
            'deployments'
        ];
        for (const dir of dirs) {
            await (0, file_system_1.ensureDirectoryExists)(path_1.default.join(this.projectPath, dir));
        }
        // Create default config
        const defaultConfig = {
            platforms: {},
            mcp_servers: {},
            overlays: {
                enabled: true,
                paths: ['.faber/overlays']
            },
            bindings: {
                claude: {
                    auto_activate: true
                }
            }
        };
        await (0, file_system_1.writeFile)(this.configPath, `# Faber-CLI Configuration\n\n${JSON.stringify(defaultConfig, null, 2)}`);
        this.emit('init', { projectPath: this.projectPath, template });
    }
    /**
     * Get project configuration
     */
    async getConfig() {
        if (!this.config) {
            this.config = await this.configLoader.load(this.configPath);
        }
        return this.config;
    }
    /**
     * Set configuration value
     */
    async setConfig(key, value) {
        const config = await this.getConfig();
        const keys = key.split('.');
        let obj = config;
        for (let i = 0; i < keys.length - 1; i++) {
            if (!(keys[i] in obj)) {
                obj[keys[i]] = {};
            }
            obj = obj[keys[i]];
        }
        obj[keys[keys.length - 1]] = value;
        await (0, file_system_1.writeFile)(this.configPath, JSON.stringify(config, null, 2));
        this.config = config;
        this.emit('config:set', { key, value });
    }
    /**
     * Create a new concept
     */
    async createConcept(type, name, options = {}) {
        const conceptPath = path_1.default.join(this.projectPath, `${type}s`, name);
        await (0, file_system_1.ensureDirectoryExists)(conceptPath);
        // Create metadata file based on type
        const metadata = {
            name,
            description: options.description || `${type} ${name}`,
            ...options
        };
        const metadataFile = type === types_1.ConceptType.ROLE ? 'agent.yml' :
            type === types_1.ConceptType.TEAM ? 'team.yml' :
                type === types_1.ConceptType.WORKFLOW ? 'workflow.yml' :
                    type === types_1.ConceptType.TOOL ? 'tool.yml' :
                        'eval.yml';
        await (0, file_system_1.writeFile)(path_1.default.join(conceptPath, metadataFile), `name: ${name}\n` +
            `description: ${metadata.description}\n` +
            (type === types_1.ConceptType.ROLE && options.platforms ?
                `platforms:\n${options.platforms.map(p => `  - ${p}`).join('\n')}\n` : '') +
            (type === types_1.ConceptType.TEAM && options.members ?
                `members:\n${options.members.map(m => `  - role: ${m}`).join('\n')}\n` : ''));
        // Create prompt.md for roles
        if (type === types_1.ConceptType.ROLE) {
            await (0, file_system_1.writeFile)(path_1.default.join(conceptPath, 'prompt.md'), `# ${name}\n\n${metadata.description}\n\n## Core Behavior\n\n[Define agent behavior here]`);
            // Create subdirectories
            for (const dir of ['tasks', 'flows', 'contexts']) {
                await (0, file_system_1.ensureDirectoryExists)(path_1.default.join(conceptPath, dir));
            }
        }
        this.emit('concept:created', { type, name, options });
    }
    /**
     * Load a concept
     */
    async loadConcept(type, name) {
        const conceptPath = path_1.default.join(this.projectPath, `${type}s`, name);
        let loader;
        switch (type) {
            case types_1.ConceptType.ROLE:
                loader = new role_1.RoleLoader();
                break;
            case types_1.ConceptType.TEAM:
                loader = new team_1.TeamLoader();
                break;
            case types_1.ConceptType.WORKFLOW:
                loader = new workflow_1.WorkflowLoader();
                break;
            case types_1.ConceptType.TOOL:
                loader = new tool_1.ToolLoader();
                break;
            case types_1.ConceptType.EVAL:
                loader = new eval_1.EvalLoader();
                break;
            default:
                throw new Error(`Unknown concept type: ${type}`);
        }
        const concept = await loader.load(conceptPath);
        this.emit('concept:loaded', { type, name, concept });
        return concept;
    }
    /**
     * List concepts
     */
    async listConcepts(type) {
        const concepts = [];
        const types = type ? [type] : Object.values(types_1.ConceptType);
        for (const t of types) {
            // Implementation would scan directories and load metadata
            // For now, returning empty array
        }
        return concepts;
    }
    /**
     * Validate a concept
     */
    async validateConcept(type, name) {
        const concept = await this.loadConcept(type, name);
        let loader;
        switch (type) {
            case types_1.ConceptType.ROLE:
                loader = new role_1.RoleLoader();
                break;
            case types_1.ConceptType.TEAM:
                loader = new team_1.TeamLoader();
                break;
            case types_1.ConceptType.WORKFLOW:
                loader = new workflow_1.WorkflowLoader();
                break;
            case types_1.ConceptType.TOOL:
                loader = new tool_1.ToolLoader();
                break;
            case types_1.ConceptType.EVAL:
                loader = new eval_1.EvalLoader();
                break;
            default:
                throw new Error(`Unknown concept type: ${type}`);
        }
        const result = await loader.validate(concept);
        this.emit('concept:validated', { type, name, result });
        return result;
    }
    /**
     * Build a deployment
     */
    async build(framework, concept, options = {}) {
        this.emit('build:start', { framework, concept: concept.name });
        const config = await this.getConfig();
        // Resolve overlays
        const overlayResolver = new resolver_1.OverlayResolver(this.projectPath);
        const overlays = options.noOverlays ?
            {} :
            await overlayResolver.resolveOverlays(concept.type, concept.name, options.platform);
        // Get transformer
        let transformer;
        switch (framework) {
            case 'claude':
                transformer = new transformer_1.ClaudeCodeTransformer();
                break;
            default:
                throw new Error(`Unknown framework: ${framework}`);
        }
        // Transform
        const artifact = await transformer.transform(concept, config, overlays);
        // Write files unless dry-run
        if (!options.dryRun) {
            const outputDir = options.output || path_1.default.join(this.projectPath, 'deployments', framework);
            for (const file of artifact.files) {
                const filePath = path_1.default.join(outputDir, file.path);
                await (0, file_system_1.ensureDirectoryExists)(path_1.default.dirname(filePath));
                await (0, file_system_1.writeFile)(filePath, file.content);
            }
        }
        this.emit('build:complete', artifact);
        return artifact;
    }
    /**
     * Deploy an artifact
     */
    async deploy(artifact, target) {
        this.emit('deploy:start', { artifact, target });
        for (const file of artifact.files) {
            const filePath = path_1.default.join(target, file.path);
            await (0, file_system_1.ensureDirectoryExists)(path_1.default.dirname(filePath));
            await (0, file_system_1.writeFile)(filePath, file.content);
        }
        this.emit('deploy:complete', { artifact, target });
    }
    /**
     * Resolve overlays
     */
    async resolveOverlays(type, name, platform) {
        const resolver = new resolver_1.OverlayResolver(this.projectPath);
        return resolver.resolveOverlays(type, name, platform);
    }
    /**
     * Apply overlays to concept
     */
    async applyOverlays(concept, overlays) {
        // Deep merge logic would go here
        // For now, returning original concept
        return concept;
    }
}
exports.FaberAPI = FaberAPI;
//# sourceMappingURL=api.js.map