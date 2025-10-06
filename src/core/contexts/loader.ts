/**
 * Context loader and resolver
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import * as yaml from 'js-yaml';
import {
  Context,
  ContextCategory,
  Role,
  Config
} from '../../types';

export class ContextLoader {
  /**
   * Load a single context file
   */
  async loadContext(
    filePath: string,
    category: ContextCategory
  ): Promise<Context> {
    const content = await fs.readFile(filePath, 'utf-8');
    const name = path.basename(filePath, '.md');
    const { metadata, body } = this.parseFrontmatter(content);

    return {
      category,
      name,
      content: body,
      metadata: metadata as any,
      path: filePath
    };
  }

  /**
   * Load all contexts in a category
   */
  async loadCategoryContexts(
    categoryPath: string,
    category: ContextCategory
  ): Promise<Context[]> {
    const contexts: Context[] = [];

    try {
      const files = await fs.readdir(categoryPath);
      const mdFiles = files.filter(f => f.endsWith('.md'));

      for (const file of mdFiles) {
        const filePath = path.join(categoryPath, file);
        const context = await this.loadContext(filePath, category);
        contexts.push(context);
      }
    } catch {
      // Category directory doesn't exist
    }

    return contexts;
  }

  /**
   * Load all contexts for a role
   */
  async loadRoleContexts(rolePath: string): Promise<Map<string, Context>> {
    const contexts = new Map<string, Context>();
    const contextsDir = path.join(rolePath, 'contexts');
    const categories = Object.values(ContextCategory);

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
  async loadPlatformContext(
    role: Role,
    platform: string
  ): Promise<Context | null> {
    const platformKey = `${ContextCategory.PLATFORM}/platform-${platform}`;
    return role.contexts.get(platformKey) || null;
  }

  /**
   * Load specialist context on demand
   */
  async loadSpecialistContext(
    role: Role,
    specialistName: string
  ): Promise<Context | null> {
    const specialistKey = `${ContextCategory.SPECIALIST}/specialist-${specialistName}`;
    return role.contexts.get(specialistKey) || null;
  }

  /**
   * Parse frontmatter from markdown content
   */
  private parseFrontmatter(content: string): {
    metadata?: any;
    body: string;
  } {
    const frontmatterRegex = /^---\n([\s\S]*?)\n---\n([\s\S]*)$/;
    const match = content.match(frontmatterRegex);

    if (match) {
      try {
        const metadata = yaml.load(match[1]) as any;
        return { metadata, body: match[2] };
      } catch {
        return { body: content };
      }
    }

    return { body: content };
  }
}

/**
 * Context resolver for determining which contexts to load
 */
export class ContextResolver {
  private loader: ContextLoader;

  constructor() {
    this.loader = new ContextLoader();
  }

  /**
   * Resolve all contexts for a role (base + overlays)
   */
  async resolveContexts(
    role: Role,
    config: Config,
    overlayPath?: string
  ): Promise<Context[]> {
    const contexts: Context[] = [];

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
    const standards = this.loadCategoryContexts(role, ContextCategory.STANDARD);
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
  private detectPlatform(role: Role, config: Config): string | null {
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
  private loadCategoryContexts(role: Role, category: ContextCategory): Context[] {
    const contexts: Context[] = [];
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
  private async loadOrganizationOverlays(overlayPath: string): Promise<Context[]> {
    const orgPath = path.join(overlayPath, 'organization', 'contexts');
    const contexts: Context[] = [];

    // Load standards
    const standardsPath = path.join(orgPath, 'standards');
    const standards = await this.loader.loadCategoryContexts(
      standardsPath,
      ContextCategory.STANDARD
    );
    contexts.push(...standards);

    // Load references
    const referencesPath = path.join(orgPath, 'references');
    const references = await this.loader.loadCategoryContexts(
      referencesPath,
      ContextCategory.REFERENCE
    );
    contexts.push(...references);

    return contexts;
  }

  /**
   * Load platform-specific overlay contexts
   */
  private async loadPlatformOverlays(
    overlayPath: string,
    platform: string
  ): Promise<Context[]> {
    const platformPath = path.join(overlayPath, 'platforms', platform, 'contexts');
    const contexts: Context[] = [];

    for (const category of Object.values(ContextCategory)) {
      const categoryPath = path.join(platformPath, category);
      const categoryContexts = await this.loader.loadCategoryContexts(
        categoryPath,
        category
      );
      contexts.push(...categoryContexts);
    }

    return contexts;
  }

  /**
   * Load role-specific overlay contexts
   */
  private async loadRoleOverlays(
    overlayPath: string,
    roleName: string
  ): Promise<Context[]> {
    const rolePath = path.join(overlayPath, 'roles', roleName, 'contexts');
    const contexts: Context[] = [];

    for (const category of Object.values(ContextCategory)) {
      const categoryPath = path.join(rolePath, category);
      const categoryContexts = await this.loader.loadCategoryContexts(
        categoryPath,
        category
      );
      contexts.push(...categoryContexts);
    }

    return contexts;
  }

  /**
   * Analyze user request to determine specialist contexts needed
   */
  analyzeRequestForSpecialists(request: string): string[] {
    const specialists: string[] = [];
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