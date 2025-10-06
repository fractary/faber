/**
 * Claude Code binding transformer
 */

import * as path from 'path';
import * as yaml from 'js-yaml';
import * as Handlebars from 'handlebars';
import {
  Role,
  Config,
  DeploymentArtifact,
  DeploymentMetadata,
  BindingConfig,
  ContextCategory,
  ConceptType
} from '../../types';
import { ConceptReferenceImpl } from '../../core/concepts/base';
import { Overlays } from '../../core/overlays';

export class ClaudeCodeTransformer {
  private bindingConfig: BindingConfig;
  private templates: {
    frontmatter?: HandlebarsTemplateDelegate;
    body?: HandlebarsTemplateDelegate;
  } = {};

  constructor(bindingConfigPath?: string) {
    // Load binding configuration
    const configPath = bindingConfigPath || path.join(__dirname, 'binding.yml');
    this.bindingConfig = this.loadBindingConfig(configPath);
    this.loadTemplates();
  }

  /**
   * Transform role to Claude Code deployment
   */
  async transform(
    role: Role,
    config: Config,
    overlays: Overlays
  ): Promise<DeploymentArtifact> {
    const files = new Map<string, string>();
    const directories: string[] = [];

    // Generate agent file
    const agentContent = await this.generateAgentFile(role, config, overlays);
    const agentPath = this.resolvePath(
      this.bindingConfig.output_structure!.role_path!,
      role
    );
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
    const configPath = this.bindingConfig.output_structure!.config_path!;
    files.set(configPath, yaml.dump(config));
    directories.push(path.dirname(configPath));

    // Create metadata
    const metadata: any = {
      concept: new ConceptReferenceImpl(ConceptType.ROLE, role.metadata.name),
      binding: 'claude-code',
      timestamp: new Date().toISOString(),
      config: config as any
    };

    return {
      files: Array.from(files.entries()).map(([path, content]) => ({ path, content })),
      directories: [...new Set(directories)], // Remove duplicates
      metadata
    } as any;
  }

  /**
   * Generate agent file content
   */
  private async generateAgentFile(
    role: Role,
    config: Config,
    overlays: Overlays
  ): Promise<string> {
    // Prepare template data
    const templateData = {
      metadata: role.metadata,
      prompt: role.prompt,
      tasks: Array.from(role.tasks.values()),
      flows: Array.from(role.flows.values()),
      contextCategories: Object.values(ContextCategory),
      overlayContexts: this.collectOverlayContexts(overlays),
      mcpServers: this.getMCPServers(role, config),
      paths: {
        contextPrefix: this.resolvePath(
          this.bindingConfig.path_resolution!.context_prefix!,
          role
        ),
        taskPrefix: this.resolvePath(
          this.bindingConfig.path_resolution!.task_prefix!,
          role
        ),
        flowPrefix: this.resolvePath(
          this.bindingConfig.path_resolution!.flow_prefix!,
          role
        )
      }
    };

    // Generate frontmatter
    const frontmatter = this.templates.frontmatter!(templateData);

    // Generate body
    const body = this.templates.body!(templateData);

    return `${frontmatter}\n${body}`;
  }

  /**
   * Copy contexts to deployment
   */
  private async copyContexts(
    role: Role,
    files: Map<string, string>,
    directories: string[]
  ): Promise<void> {
    const docsPath = this.resolvePath(
      this.bindingConfig.output_structure!.docs_path!,
      role
    );
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
  private async copyOverlayContexts(
    overlays: Overlays,
    role: Role,
    files: Map<string, string>,
    directories: string[]
  ): Promise<void> {
    const docsPath = this.resolvePath(
      this.bindingConfig.output_structure!.docs_path!,
      role
    );
    const overlaysPath = path.join(docsPath, 'contexts', '_overlays');

    // Organization overlays
    for (const context of overlays.organization.contexts) {
      const contextPath = path.join(
        overlaysPath,
        'organization',
        context.category,
        context.name + '.md'
      );
      files.set(contextPath, context.content);
      directories.push(path.dirname(contextPath));
    }

    // Platform overlays
    for (const [platform, overlay] of Object.entries(overlays.platforms)) {
      for (const context of overlay.contexts) {
        const contextPath = path.join(
          overlaysPath,
          'platforms',
          platform,
          context.category,
          context.name + '.md'
        );
        files.set(contextPath, context.content);
        directories.push(path.dirname(contextPath));
      }
    }

    // Role overlays
    for (const [roleName, overlay] of Object.entries(overlays.roles)) {
      for (const context of overlay.contexts) {
        const contextPath = path.join(
          overlaysPath,
          'roles',
          roleName,
          context.category,
          context.name + '.md'
        );
        files.set(contextPath, context.content);
        directories.push(path.dirname(contextPath));
      }
    }
  }

  /**
   * Copy tasks to deployment
   */
  private async copyTasks(
    role: Role,
    files: Map<string, string>,
    directories: string[]
  ): Promise<void> {
    const docsPath = this.resolvePath(
      this.bindingConfig.output_structure!.docs_path!,
      role
    );
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
  private async copyFlows(
    role: Role,
    files: Map<string, string>,
    directories: string[]
  ): Promise<void> {
    const docsPath = this.resolvePath(
      this.bindingConfig.output_structure!.docs_path!,
      role
    );
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
  private loadBindingConfig(configPath: string): BindingConfig {
    try {
      const content = require('fs').readFileSync(configPath, 'utf-8');
      return yaml.load(content) as BindingConfig;
    } catch (error) {
      throw new Error(`Failed to load binding config: ${error}`);
    }
  }

  /**
   * Load Handlebars templates
   */
  private loadTemplates(): void {
    if (this.bindingConfig.templates?.role_frontmatter) {
      const templatePath = path.join(
        __dirname,
        this.bindingConfig.templates.role_frontmatter
      );
      const templateContent = require('fs').readFileSync(templatePath, 'utf-8');
      this.templates.frontmatter = Handlebars.compile(templateContent);
    }

    if (this.bindingConfig.templates?.role_body) {
      const templatePath = path.join(
        __dirname,
        this.bindingConfig.templates.role_body
      );
      const templateContent = require('fs').readFileSync(templatePath, 'utf-8');
      this.templates.body = Handlebars.compile(templateContent);
    }
  }

  /**
   * Resolve path template
   */
  private resolvePath(template: string, role: Role): string {
    return template
      .replace('{org}', role.metadata.org)
      .replace('{system}', role.metadata.system)
      .replace('{name}', role.metadata.name);
  }

  /**
   * Collect overlay contexts for template
   */
  private collectOverlayContexts(overlays: Overlays): any[] {
    const contexts: any[] = [];

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
  private getMCPServers(role: Role, config: Config): Record<string, any> | null {
    const servers: Record<string, any> = {};

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