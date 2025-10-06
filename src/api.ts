/**
 * Faber-CLI Programmatic API
 */

import { EventEmitter } from 'events';
import path from 'path';
import { Config, ConceptType, ValidationResult, Concept } from './types';
import { ConfigLoader } from './core/config/loader';
import { RoleLoader } from './core/concepts/role';
import { TeamLoader } from './core/concepts/team';
import { WorkflowLoader } from './core/concepts/workflow';
import { ToolLoader } from './core/concepts/tool';
import { EvalLoader } from './core/concepts/eval';
import { OverlayResolver } from './core/overlays/resolver';
import { ClaudeCodeTransformer } from './bindings/claude-code/transformer';
import { ensureDirectoryExists, writeFile } from './utils/file-system';
import { ConceptInfo, DeploymentArtifact, Overlays } from './types';

export interface FaberOptions {
  projectPath?: string;
  configPath?: string;
  verbose?: boolean;
  quiet?: boolean;
}

export interface CreateOptions {
  org?: string;
  system?: string;
  platforms?: string[];
  description?: string;
  members?: string[];
  type?: string;
  target?: string;
}

export interface BuildOptions {
  output?: string;
  noOverlays?: boolean;
  platform?: string;
  dryRun?: boolean;
  verbose?: boolean;
}

export class FaberAPI extends EventEmitter {
  private projectPath: string;
  private configPath: string;
  private config: Config | null = null;
  private configLoader: ConfigLoader;

  constructor(options: FaberOptions = {}) {
    super();
    this.projectPath = options.projectPath || process.cwd();
    this.configPath = options.configPath || path.join(this.projectPath, '.faber', 'config.yml');
    this.configLoader = new ConfigLoader();
  }

  /**
   * Initialize a new Faber project
   */
  async init(template?: string): Promise<void> {
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
      await ensureDirectoryExists(path.join(this.projectPath, dir));
    }

    // Create default config
    const defaultConfig: Config = {
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

    await writeFile(
      this.configPath,
      `# Faber-CLI Configuration\n\n${JSON.stringify(defaultConfig, null, 2)}`
    );

    this.emit('init', { projectPath: this.projectPath, template });
  }

  /**
   * Get project configuration
   */
  async getConfig(): Promise<Config> {
    if (!this.config) {
      this.config = await this.configLoader.load(this.configPath);
    }
    return this.config;
  }

  /**
   * Set configuration value
   */
  async setConfig(key: string, value: any): Promise<void> {
    const config = await this.getConfig();
    const keys = key.split('.');
    let obj: any = config;

    for (let i = 0; i < keys.length - 1; i++) {
      if (!(keys[i] in obj)) {
        obj[keys[i]] = {};
      }
      obj = obj[keys[i]];
    }

    obj[keys[keys.length - 1]] = value;

    await writeFile(this.configPath, JSON.stringify(config, null, 2));
    this.config = config;

    this.emit('config:set', { key, value });
  }

  /**
   * Create a new concept
   */
  async createConcept(type: ConceptType, name: string, options: CreateOptions = {}): Promise<void> {
    const conceptPath = path.join(this.projectPath, `${type}s`, name);
    await ensureDirectoryExists(conceptPath);

    // Create metadata file based on type
    const metadata: any = {
      name,
      description: options.description || `${type} ${name}`,
      ...options
    };

    const metadataFile = type === ConceptType.ROLE ? 'agent.yml' :
                         type === ConceptType.TEAM ? 'team.yml' :
                         type === ConceptType.WORKFLOW ? 'workflow.yml' :
                         type === ConceptType.TOOL ? 'tool.yml' :
                         'eval.yml';

    await writeFile(
      path.join(conceptPath, metadataFile),
      `name: ${name}\n` +
      `description: ${metadata.description}\n` +
      (type === ConceptType.ROLE && options.platforms ?
        `platforms:\n${options.platforms.map(p => `  - ${p}`).join('\n')}\n` : '') +
      (type === ConceptType.TEAM && options.members ?
        `members:\n${options.members.map(m => `  - role: ${m}`).join('\n')}\n` : '')
    );

    // Create prompt.md for roles
    if (type === ConceptType.ROLE) {
      await writeFile(
        path.join(conceptPath, 'prompt.md'),
        `# ${name}\n\n${metadata.description}\n\n## Core Behavior\n\n[Define agent behavior here]`
      );

      // Create subdirectories
      for (const dir of ['tasks', 'flows', 'contexts']) {
        await ensureDirectoryExists(path.join(conceptPath, dir));
      }
    }

    this.emit('concept:created', { type, name, options });
  }

  /**
   * Load a concept
   */
  async loadConcept<T extends Concept>(type: ConceptType, name: string): Promise<T> {
    const conceptPath = path.join(this.projectPath, `${type}s`, name);

    let loader;
    switch (type) {
      case ConceptType.ROLE:
        loader = new RoleLoader(this.projectPath);
        break;
      case ConceptType.TEAM:
        loader = new TeamLoader(this.projectPath);
        break;
      case ConceptType.WORKFLOW:
        loader = new WorkflowLoader(this.projectPath);
        break;
      case ConceptType.TOOL:
        loader = new ToolLoader(this.projectPath);
        break;
      case ConceptType.EVAL:
        loader = new EvalLoader(this.projectPath);
        break;
      default:
        throw new Error(`Unknown concept type: ${type}`);
    }

    const concept = await loader.load(conceptPath);
    this.emit('concept:loaded', { type, name, concept });
    return concept as T;
  }

  /**
   * List concepts
   */
  async listConcepts(type?: ConceptType): Promise<ConceptInfo[]> {
    const concepts: ConceptInfo[] = [];
    const types = type ? [type] : Object.values(ConceptType);

    for (const t of types) {
      // Implementation would scan directories and load metadata
      // For now, returning empty array
    }

    return concepts;
  }

  /**
   * Validate a concept
   */
  async validateConcept(type: ConceptType, name: string): Promise<ValidationResult> {
    const concept = await this.loadConcept(type, name);

    let loader;
    switch (type) {
      case ConceptType.ROLE:
        loader = new RoleLoader(this.projectPath);
        break;
      case ConceptType.TEAM:
        loader = new TeamLoader(this.projectPath);
        break;
      case ConceptType.WORKFLOW:
        loader = new WorkflowLoader(this.projectPath);
        break;
      case ConceptType.TOOL:
        loader = new ToolLoader(this.projectPath);
        break;
      case ConceptType.EVAL:
        loader = new EvalLoader(this.projectPath);
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
  async build(framework: string, concept: Concept, options: BuildOptions = {}): Promise<DeploymentArtifact> {
    this.emit('build:start', { framework, concept: concept.name });

    const config = await this.getConfig();

    // Resolve overlays
    const overlayResolver = new OverlayResolver(this.projectPath);
    const overlays = options.noOverlays ?
      {} :
      await overlayResolver.resolveOverlays(concept.type, concept.name, options.platform);

    // Get transformer
    let transformer;
    switch (framework) {
      case 'claude':
        transformer = new ClaudeCodeTransformer();
        break;
      default:
        throw new Error(`Unknown framework: ${framework}`);
    }

    // Transform
    const artifact = await transformer.transform(concept, config, overlays);

    // Write files unless dry-run
    if (!options.dryRun) {
      const outputDir = options.output || path.join(this.projectPath, 'deployments', framework);

      for (const file of artifact.files) {
        const filePath = path.join(outputDir, file.path);
        await ensureDirectoryExists(path.dirname(filePath));
        await writeFile(filePath, file.content);
      }
    }

    this.emit('build:complete', artifact);
    return artifact;
  }

  /**
   * Deploy an artifact
   */
  async deploy(artifact: DeploymentArtifact, target: string): Promise<void> {
    this.emit('deploy:start', { artifact, target });

    for (const file of artifact.files) {
      const filePath = path.join(target, file.path);
      await ensureDirectoryExists(path.dirname(filePath));
      await writeFile(filePath, file.content);
    }

    this.emit('deploy:complete', { artifact, target });
  }

  /**
   * Resolve overlays
   */
  async resolveOverlays(type: string, name: string, platform?: string): Promise<Overlays> {
    const resolver = new OverlayResolver(this.projectPath);
    return resolver.resolveOverlays(type, name, platform);
  }

  /**
   * Apply overlays to concept
   */
  async applyOverlays(concept: Concept, overlays: Overlays): Promise<Concept> {
    // Deep merge logic would go here
    // For now, returning original concept
    return concept;
  }
}