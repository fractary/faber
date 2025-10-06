"use strict";
/**
 * Context loader and resolver
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
exports.ContextResolver = exports.ContextLoader = void 0;
const fs = __importStar(require("fs/promises"));
const path = __importStar(require("path"));
const yaml = __importStar(require("js-yaml"));
const types_1 = require("../../types");
class ContextLoader {
    /**
     * Load a single context file
     */
    async loadContext(filePath, category) {
        const content = await fs.readFile(filePath, 'utf-8');
        const name = path.basename(filePath, '.md');
        const { metadata, body } = this.parseFrontmatter(content);
        return {
            category,
            name,
            content: body,
            metadata: metadata,
            path: filePath
        };
    }
    /**
     * Load all contexts in a category
     */
    async loadCategoryContexts(categoryPath, category) {
        const contexts = [];
        try {
            const files = await fs.readdir(categoryPath);
            const mdFiles = files.filter(f => f.endsWith('.md'));
            for (const file of mdFiles) {
                const filePath = path.join(categoryPath, file);
                const context = await this.loadContext(filePath, category);
                contexts.push(context);
            }
        }
        catch {
            // Category directory doesn't exist
        }
        return contexts;
    }
    /**
     * Load all contexts for a role
     */
    async loadRoleContexts(rolePath) {
        const contexts = new Map();
        const contextsDir = path.join(rolePath, 'contexts');
        const categories = Object.values(types_1.ContextCategory);
        for (const category of categories) {
            const categoryPath = path.join(contextsDir, category);
            const categoryContexts = await this.loadCategoryContexts(categoryPath, category);
            for (const context of categoryContexts) {
                const key = `${category}/${context.name}`;
                contexts.set(key, context);
            }
        }
        return contexts;
    }
    /**
     * Load platform context for a role
     */
    async loadPlatformContext(role, platform) {
        const platformKey = `${types_1.ContextCategory.PLATFORM}/platform-${platform}`;
        return role.contexts.get(platformKey) || null;
    }
    /**
     * Load specialist context on demand
     */
    async loadSpecialistContext(role, specialistName) {
        const specialistKey = `${types_1.ContextCategory.SPECIALIST}/specialist-${specialistName}`;
        return role.contexts.get(specialistKey) || null;
    }
    /**
     * Parse frontmatter from markdown content
     */
    parseFrontmatter(content) {
        const frontmatterRegex = /^---\n([\s\S]*?)\n---\n([\s\S]*)$/;
        const match = content.match(frontmatterRegex);
        if (match) {
            try {
                const metadata = yaml.load(match[1]);
                return { metadata, body: match[2] };
            }
            catch {
                return { body: content };
            }
        }
        return { body: content };
    }
}
exports.ContextLoader = ContextLoader;
/**
 * Context resolver for determining which contexts to load
 */
class ContextResolver {
    constructor() {
        this.loader = new ContextLoader();
    }
    /**
     * Resolve all contexts for a role (base + overlays)
     */
    async resolveContexts(role, config, overlayPath) {
        const contexts = [];
        // 1. Load platform context based on config
        const platform = this.detectPlatform(role, config);
        if (platform) {
            const platformContext = await this.loader.loadPlatformContext(role, platform);
            if (platformContext) {
                contexts.push(platformContext);
            }
        }
        // 2. Load organization overlays (if overlay path provided)
        if (overlayPath) {
            const orgContexts = await this.loadOrganizationOverlays(overlayPath);
            contexts.push(...orgContexts);
        }
        // 3. Load platform overlays
        if (overlayPath && platform) {
            const platformOverlays = await this.loadPlatformOverlays(overlayPath, platform);
            contexts.push(...platformOverlays);
        }
        // 4. Load base standards
        const standards = this.loadCategoryContexts(role, types_1.ContextCategory.STANDARD);
        contexts.push(...standards);
        // 5. Load role overlays
        if (overlayPath) {
            const roleOverlays = await this.loadRoleOverlays(overlayPath, role.metadata.name);
            contexts.push(...roleOverlays);
        }
        return contexts;
    }
    /**
     * Detect platform from config
     */
    detectPlatform(role, config) {
        // Check config for role-specific platform
        if (config.platforms && role.metadata.platform_config_key) {
            return config.platforms[role.metadata.platform_config_key] || null;
        }
        // Fall back to default platform
        return role.metadata.default_platform || null;
    }
    /**
     * Load contexts from a category
     */
    loadCategoryContexts(role, category) {
        const contexts = [];
        const prefix = `${category}/`;
        for (const [key, context] of role.contexts) {
            if (key.startsWith(prefix)) {
                contexts.push(context);
            }
        }
        return contexts;
    }
    /**
     * Load organization-level overlay contexts
     */
    async loadOrganizationOverlays(overlayPath) {
        const orgPath = path.join(overlayPath, 'organization', 'contexts');
        const contexts = [];
        // Load standards
        const standardsPath = path.join(orgPath, 'standards');
        const standards = await this.loader.loadCategoryContexts(standardsPath, types_1.ContextCategory.STANDARD);
        contexts.push(...standards);
        // Load references
        const referencesPath = path.join(orgPath, 'references');
        const references = await this.loader.loadCategoryContexts(referencesPath, types_1.ContextCategory.REFERENCE);
        contexts.push(...references);
        return contexts;
    }
    /**
     * Load platform-specific overlay contexts
     */
    async loadPlatformOverlays(overlayPath, platform) {
        const platformPath = path.join(overlayPath, 'platforms', platform, 'contexts');
        const contexts = [];
        for (const category of Object.values(types_1.ContextCategory)) {
            const categoryPath = path.join(platformPath, category);
            const categoryContexts = await this.loader.loadCategoryContexts(categoryPath, category);
            contexts.push(...categoryContexts);
        }
        return contexts;
    }
    /**
     * Load role-specific overlay contexts
     */
    async loadRoleOverlays(overlayPath, roleName) {
        const rolePath = path.join(overlayPath, 'roles', roleName, 'contexts');
        const contexts = [];
        for (const category of Object.values(types_1.ContextCategory)) {
            const categoryPath = path.join(rolePath, category);
            const categoryContexts = await this.loader.loadCategoryContexts(categoryPath, category);
            contexts.push(...categoryContexts);
        }
        return contexts;
    }
    /**
     * Analyze user request to determine specialist contexts needed
     */
    analyzeRequestForSpecialists(request) {
        const specialists = [];
        const keywords = request.toLowerCase();
        // Define keyword mappings to specialists
        const specialistMappings = [
            { keywords: ['sprint', 'iteration', 'planning'], specialist: 'sprint-planning' },
            { keywords: ['security', 'vulnerability', 'audit'], specialist: 'security' },
            { keywords: ['performance', 'optimization', 'latency'], specialist: 'performance' },
            { keywords: ['monorepo', 'multi-package'], specialist: 'monorepo' },
            { keywords: ['microservice', 'micro-service'], specialist: 'microservices' },
            { keywords: ['docker', 'container', 'kubernetes'], specialist: 'containers' },
            { keywords: ['ci', 'cd', 'pipeline', 'deployment'], specialist: 'cicd' },
            { keywords: ['test', 'testing', 'tdd', 'bdd'], specialist: 'testing' }
        ];
        for (const mapping of specialistMappings) {
            if (mapping.keywords.some(keyword => keywords.includes(keyword))) {
                specialists.push(mapping.specialist);
            }
        }
        return [...new Set(specialists)]; // Remove duplicates
    }
}
exports.ContextResolver = ContextResolver;
//# sourceMappingURL=loader.js.map