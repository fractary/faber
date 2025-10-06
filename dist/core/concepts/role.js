"use strict";
/**
 * Role concept loader and validator
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
exports.RoleLoader = void 0;
const path = __importStar(require("path"));
const yaml = __importStar(require("js-yaml"));
const zod_1 = require("zod");
const base_1 = require("./base");
const types_1 = require("../../types");
// Role metadata schema
const RoleMetadataSchema = base_1.BaseMetadataSchema.extend({
    type: zod_1.z.literal(types_1.ConceptType.ROLE),
    platforms: zod_1.z.array(zod_1.z.string()),
    default_platform: zod_1.z.string().optional(),
    platform_config_key: zod_1.z.string().optional(),
    color: zod_1.z.string().optional(),
    agent_type: zod_1.z.enum(['autonomous', 'interactive', 'batch']).optional()
});
class RoleLoader extends base_1.BaseConceptLoader {
    constructor() {
        super(types_1.ConceptType.ROLE);
    }
    getMetadataSchema() {
        return RoleMetadataSchema;
    }
    async loadConceptContent(conceptPath, metadata) {
        // Load prompt
        const promptPath = path.join(conceptPath, 'prompt.md');
        const prompt = await this.loadPrompt(promptPath);
        // Load tasks
        const tasks = await this.loadTasks(path.join(conceptPath, 'tasks'));
        // Load flows
        const flows = await this.loadFlows(path.join(conceptPath, 'flows'));
        // Load contexts
        const contexts = await this.loadContexts(path.join(conceptPath, 'contexts'));
        // Load custom bindings
        const bindings = await this.loadBindings(path.join(conceptPath, 'bindings'));
        return {
            name: metadata.name,
            type: types_1.ConceptType.ROLE,
            metadata,
            path: conceptPath,
            prompt,
            tasks,
            flows,
            contexts,
            bindings
        };
    }
    async validateSpecific(role) {
        const errors = [];
        // Must have prompt.md
        if (!role.prompt) {
            errors.push({
                path: 'prompt.md',
                message: 'Role must have a prompt.md file',
                type: 'error'
            });
        }
        // Must have at least one task or flow
        if (role.tasks.size === 0 && role.flows.size === 0) {
            errors.push({
                path: 'tasks|flows',
                message: 'Role must have at least one task or flow',
                type: 'error'
            });
        }
        // Platform validation
        if (role.metadata.platforms && role.metadata.platforms.length > 0) {
            // Must have platform context for each declared platform
            for (const platform of role.metadata.platforms) {
                const platformContext = `platform-${platform}`;
                const hasContext = Array.from(role.contexts.values()).some(ctx => ctx.category === types_1.ContextCategory.PLATFORM && ctx.name === platformContext);
                if (!hasContext) {
                    errors.push({
                        path: `contexts/platforms/platform-${platform}.md`,
                        message: `Missing platform context for declared platform: ${platform}`,
                        type: 'error'
                    });
                }
            }
            // Default platform must be in platforms list
            if (role.metadata.default_platform &&
                !role.metadata.platforms.includes(role.metadata.default_platform)) {
                errors.push({
                    path: 'agent.yml',
                    message: 'default_platform must be in platforms list',
                    type: 'error'
                });
            }
        }
        // Validate context references in prompt
        const contextRefs = this.extractContextReferences(role.prompt);
        for (const ref of contextRefs) {
            const refPath = ref.replace(/^\//, '');
            const hasContext = Array.from(role.contexts.values()).some(ctx => ctx.path === refPath || ctx.path?.endsWith(refPath));
            if (!hasContext && !ref.includes('/.faber/overlays/')) {
                errors.push({
                    path: 'prompt.md',
                    message: `Referenced context not found: ${ref}`,
                    type: 'warning'
                });
            }
        }
        return errors;
    }
    async loadPrompt(promptPath) {
        if (await this.fileExists(promptPath)) {
            return this.readFile(promptPath);
        }
        return '';
    }
    async loadTasks(tasksDir) {
        const tasks = new Map();
        const taskFiles = await this.listFiles(tasksDir, '.md');
        for (const file of taskFiles) {
            const name = path.basename(file, '.md');
            const content = await this.readFile(path.join(tasksDir, file));
            tasks.set(name, {
                name,
                content,
                path: path.join(tasksDir, file)
            });
        }
        return tasks;
    }
    async loadFlows(flowsDir) {
        const flows = new Map();
        const flowFiles = await this.listFiles(flowsDir, '.md');
        for (const file of flowFiles) {
            const name = path.basename(file, '.md');
            const content = await this.readFile(path.join(flowsDir, file));
            flows.set(name, {
                name,
                content,
                path: path.join(flowsDir, file)
            });
        }
        return flows;
    }
    async loadContexts(contextsDir) {
        const contexts = new Map();
        const categories = Object.values(types_1.ContextCategory);
        for (const category of categories) {
            const categoryDir = path.join(contextsDir, category);
            const contextFiles = await this.listFiles(categoryDir, '.md');
            for (const file of contextFiles) {
                const name = path.basename(file, '.md');
                const filePath = path.join(categoryDir, file);
                const content = await this.readFile(filePath);
                const { metadata, body } = this.parseFrontmatter(content);
                const context = {
                    category,
                    name,
                    content: body,
                    metadata: metadata,
                    path: filePath
                };
                contexts.set(`${category}/${name}`, context);
            }
        }
        return contexts;
    }
    async loadBindings(bindingsDir) {
        const bindingFiles = await this.listFiles(bindingsDir, '.binding.yml');
        if (bindingFiles.length === 0) {
            return undefined;
        }
        const bindings = new Map();
        for (const file of bindingFiles) {
            const framework = path.basename(file, '.binding.yml');
            const content = await this.readFile(path.join(bindingsDir, file));
            try {
                const config = yaml.load(content);
                bindings.set(framework, config);
            }
            catch (error) {
                console.error(`Failed to parse binding ${file}: ${error}`);
            }
        }
        return bindings;
    }
    extractContextReferences(prompt) {
        // Extract context references from prompt
        // Matches patterns like: /contexts/platforms/platform-linear.md
        const regex = /\/contexts\/[a-z-]+\/[a-z-]+\.md/g;
        const matches = prompt.match(regex);
        return matches || [];
    }
}
exports.RoleLoader = RoleLoader;
//# sourceMappingURL=role.js.map