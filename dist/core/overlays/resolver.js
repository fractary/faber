"use strict";
/**
 * Overlay system for customization without forking
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
exports.OverlayResolver = void 0;
const fs = __importStar(require("fs/promises"));
const path = __importStar(require("path"));
const yaml = __importStar(require("js-yaml"));
const types_1 = require("../../types");
const loader_1 = require("../contexts/loader");
class OverlayResolver {
    constructor(overlayPath = '.faber/overlays') {
        this.overlayPath = overlayPath;
        this.contextLoader = new loader_1.ContextLoader();
    }
    /**
     * Resolve all overlays for a concept
     */
    async resolveOverlays(conceptType, conceptName, platform) {
        const overlays = {
            organization: await this.loadOrganizationOverlays(),
            platforms: {},
            roles: {},
            teams: {},
            workflows: {}
        };
        // Load platform overlays if platform specified
        if (platform) {
            overlays.platforms[platform] = await this.loadPlatformOverlays(platform);
        }
        // Load concept-specific overlays
        switch (conceptType) {
            case 'role':
                overlays.roles[conceptName] = await this.loadRoleOverlays(conceptName);
                break;
            case 'team':
                overlays.teams[conceptName] = await this.loadTeamOverlays(conceptName);
                break;
            case 'workflow':
                overlays.workflows[conceptName] = await this.loadWorkflowOverlays(conceptName);
                break;
        }
        return overlays;
    }
    /**
     * Load organization-level overlays
     */
    async loadOrganizationOverlays() {
        const orgPath = path.join(this.overlayPath, 'organization');
        return this.loadOverlayContent(orgPath);
    }
    /**
     * Load platform-specific overlays
     */
    async loadPlatformOverlays(platform) {
        const platformPath = path.join(this.overlayPath, 'platforms', platform);
        return this.loadOverlayContent(platformPath);
    }
    /**
     * Load role-specific overlays
     */
    async loadRoleOverlays(roleName) {
        const rolePath = path.join(this.overlayPath, 'roles', roleName);
        return this.loadOverlayContent(rolePath);
    }
    /**
     * Load team-specific overlays
     */
    async loadTeamOverlays(teamName) {
        const teamPath = path.join(this.overlayPath, 'teams', teamName);
        return this.loadOverlayContent(teamPath);
    }
    /**
     * Load workflow-specific overlays
     */
    async loadWorkflowOverlays(workflowName) {
        const workflowPath = path.join(this.overlayPath, 'workflows', workflowName);
        return this.loadOverlayContent(workflowPath);
    }
    /**
     * Load overlay content from a directory
     */
    async loadOverlayContent(overlayDir) {
        const content = {
            contexts: [],
            config: undefined
        };
        // Check if directory exists
        try {
            await fs.access(overlayDir);
        }
        catch {
            return content;
        }
        // Load contexts
        const contextsPath = path.join(overlayDir, 'contexts');
        content.contexts = await this.loadOverlayContexts(contextsPath);
        // Load config if exists
        const configPath = path.join(overlayDir, 'config.yml');
        try {
            const configContent = await fs.readFile(configPath, 'utf-8');
            content.config = yaml.load(configContent);
        }
        catch {
            // No config file
        }
        return content;
    }
    /**
     * Load all contexts from overlay directory
     */
    async loadOverlayContexts(contextsPath) {
        const contexts = [];
        try {
            await fs.access(contextsPath);
        }
        catch {
            return contexts;
        }
        // Load contexts from each category
        for (const category of Object.values(types_1.ContextCategory)) {
            const categoryPath = path.join(contextsPath, category);
            const categoryContexts = await this.contextLoader.loadCategoryContexts(categoryPath, category);
            contexts.push(...categoryContexts);
        }
        return contexts;
    }
    /**
     * Merge overlay configurations with precedence
     */
    mergeConfigurations(base, overlays) {
        let merged = { ...base };
        // Apply overlays in order of precedence
        // 1. Organization overlay
        if (overlays.organization.config) {
            merged = this.deepMerge(merged, overlays.organization.config);
        }
        // 2. Platform overlays
        for (const platformOverlay of Object.values(overlays.platforms)) {
            if (platformOverlay.config) {
                merged = this.deepMerge(merged, platformOverlay.config);
            }
        }
        // 3. Role overlays
        for (const roleOverlay of Object.values(overlays.roles)) {
            if (roleOverlay.config) {
                merged = this.deepMerge(merged, roleOverlay.config);
            }
        }
        // 4. Team overlays
        for (const teamOverlay of Object.values(overlays.teams)) {
            if (teamOverlay.config) {
                merged = this.deepMerge(merged, teamOverlay.config);
            }
        }
        // 5. Workflow overlays
        for (const workflowOverlay of Object.values(overlays.workflows)) {
            if (workflowOverlay.config) {
                merged = this.deepMerge(merged, workflowOverlay.config);
            }
        }
        return merged;
    }
    /**
     * Deep merge two objects
     */
    deepMerge(target, source) {
        const result = { ...target };
        for (const key in source) {
            if (source.hasOwnProperty(key)) {
                if (typeof source[key] === 'object' &&
                    source[key] !== null &&
                    !Array.isArray(source[key]) &&
                    typeof target[key] === 'object' &&
                    target[key] !== null &&
                    !Array.isArray(target[key])) {
                    // Recursively merge objects
                    result[key] = this.deepMerge(target[key], source[key]);
                }
                else if (Array.isArray(source[key]) && Array.isArray(target[key])) {
                    // Merge arrays (append strategy)
                    result[key] = [...target[key], ...source[key]];
                }
                else {
                    // Override value
                    result[key] = source[key];
                }
            }
        }
        return result;
    }
    /**
     * Collect all contexts from overlays in precedence order
     */
    collectContexts(overlays) {
        const contexts = [];
        // Collect in precedence order
        contexts.push(...overlays.organization.contexts);
        for (const platformOverlay of Object.values(overlays.platforms)) {
            contexts.push(...platformOverlay.contexts);
        }
        for (const roleOverlay of Object.values(overlays.roles)) {
            contexts.push(...roleOverlay.contexts);
        }
        for (const teamOverlay of Object.values(overlays.teams)) {
            contexts.push(...teamOverlay.contexts);
        }
        for (const workflowOverlay of Object.values(overlays.workflows)) {
            contexts.push(...workflowOverlay.contexts);
        }
        return contexts;
    }
}
exports.OverlayResolver = OverlayResolver;
//# sourceMappingURL=resolver.js.map