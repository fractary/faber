/**
 * Role concept loader and validator
 */

import * as path from 'path';
import * as yaml from 'js-yaml';
import { z } from 'zod';
import { BaseConceptLoader, BaseMetadataSchema } from './base';
import {
  Role,
  RoleMetadata,
  ConceptType,
  Task,
  Flow,
  Context,
  ContextCategory,
  ValidationError,
  BindingConfig
} from '../../types';

// Role metadata schema
const RoleMetadataSchema = BaseMetadataSchema.extend({
  type: z.literal(ConceptType.ROLE),
  platforms: z.array(z.string()),
  default_platform: z.string().optional(),
  platform_config_key: z.string().optional(),
  color: z.string().optional(),
  agent_type: z.enum(['autonomous', 'interactive', 'batch']).optional()
});

export class RoleLoader extends BaseConceptLoader<Role> {
  constructor() {
    super(ConceptType.ROLE);
  }

  protected getMetadataSchema(): z.ZodSchema {
    return RoleMetadataSchema;
  }

  protected async loadConceptContent(conceptPath: string, metadata: RoleMetadata): Promise<Role> {
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
      metadata,
      path: conceptPath,
      prompt,
      tasks,
      flows,
      contexts,
      bindings
    };
  }

  protected async validateSpecific(role: Role): Promise<ValidationError[]> {
    const errors: ValidationError[] = [];

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
        const hasContext = Array.from(role.contexts.values()).some(
          ctx => ctx.category === ContextCategory.PLATFORM && ctx.name === platformContext
        );

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
      const hasContext = Array.from(role.contexts.values()).some(
        ctx => ctx.path === refPath || ctx.path?.endsWith(refPath)
      );

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

  private async loadPrompt(promptPath: string): Promise<string> {
    if (await this.fileExists(promptPath)) {
      return this.readFile(promptPath);
    }
    return '';
  }

  private async loadTasks(tasksDir: string): Promise<Map<string, Task>> {
    const tasks = new Map<string, Task>();
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

  private async loadFlows(flowsDir: string): Promise<Map<string, Flow>> {
    const flows = new Map<string, Flow>();
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

  private async loadContexts(contextsDir: string): Promise<Map<string, Context>> {
    const contexts = new Map<string, Context>();
    const categories = Object.values(ContextCategory);

    for (const category of categories) {
      const categoryDir = path.join(contextsDir, category);
      const contextFiles = await this.listFiles(categoryDir, '.md');

      for (const file of contextFiles) {
        const name = path.basename(file, '.md');
        const filePath = path.join(categoryDir, file);
        const content = await this.readFile(filePath);
        const { metadata, body } = this.parseFrontmatter(content);

        const context: Context = {
          category,
          name,
          content: body,
          metadata: metadata as any,
          path: filePath
        };

        contexts.set(`${category}/${name}`, context);
      }
    }

    return contexts;
  }

  private async loadBindings(bindingsDir: string): Promise<Map<string, BindingConfig> | undefined> {
    const bindingFiles = await this.listFiles(bindingsDir, '.binding.yml');

    if (bindingFiles.length === 0) {
      return undefined;
    }

    const bindings = new Map<string, BindingConfig>();

    for (const file of bindingFiles) {
      const framework = path.basename(file, '.binding.yml');
      const content = await this.readFile(path.join(bindingsDir, file));

      try {
        const config = yaml.load(content) as BindingConfig;
        bindings.set(framework, config);
      } catch (error) {
        console.error(`Failed to parse binding ${file}: ${error}`);
      }
    }

    return bindings;
  }

  private extractContextReferences(prompt: string): string[] {
    // Extract context references from prompt
    // Matches patterns like: /contexts/platforms/platform-linear.md
    const regex = /\/contexts\/[a-z-]+\/[a-z-]+\.md/g;
    const matches = prompt.match(regex);
    return matches || [];
  }
}