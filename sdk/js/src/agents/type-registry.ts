/**
 * @fractary/faber - Agent Type Registry
 *
 * Registry for loading and managing agent type templates.
 */

import { readFile } from 'fs/promises';
import { join, resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import yaml from 'js-yaml';

const parseYaml = (content: string) => yaml.load(content);

import type {
  AgentType,
  AgentTypeId,
  AgentTypeManifest,
  AgentTypeManifestEntry,
  AgentTypeRegistryOptions,
  AgentTypeTemplate,
  AgentTypeStandards,
  AgentScope,
  FaberPhaseName,
  LoadFromUrlOptions,
} from './types.js';

/**
 * Get the package root directory
 * Works both in development (src/) and production (dist/)
 */
function getPackageRoot(): string {
  // In ESM, __dirname is not available, so we derive it
  const currentFile = fileURLToPath(import.meta.url);
  const currentDir = dirname(currentFile);
  // Navigate up from sdk/js/src/agents or sdk/js/dist/agents to repo root
  return resolve(currentDir, '..', '..', '..', '..');
}

/**
 * Default templates path relative to package root
 */
const DEFAULT_TEMPLATES_PATH = 'templates/agents';

/**
 * AgentTypeRegistry - Loads and manages agent type templates
 *
 * @example
 * ```typescript
 * const registry = new AgentTypeRegistry();
 * await registry.loadCoreTypes();
 *
 * const architect = registry.getType('asset-architect');
 * const allTypes = registry.getAllTypes();
 * const assetTypes = registry.getTypesByScope('asset');
 * ```
 */
export class AgentTypeRegistry {
  private types: Map<AgentTypeId, AgentType> = new Map();
  private templates: Map<AgentTypeId, string> = new Map();
  private standards: Map<AgentTypeId, string> = new Map();
  private manifest: AgentTypeManifest | null = null;
  private templatesPath: string;
  private loaded: boolean = false;

  constructor(options: AgentTypeRegistryOptions = {}) {
    this.templatesPath = options.templatesPath
      ? resolve(options.templatesPath)
      : resolve(getPackageRoot(), DEFAULT_TEMPLATES_PATH);
    // Note: baseUrl from options is available for future remote loading features
  }

  /**
   * Load core agent types from the templates directory
   */
  async loadCoreTypes(): Promise<void> {
    if (this.loaded) return;

    // Load manifest
    const manifestPath = join(this.templatesPath, 'manifest.yaml');
    try {
      const manifestContent = await readFile(manifestPath, 'utf-8');
      this.manifest = parseYaml(manifestContent) as AgentTypeManifest;
    } catch (error) {
      throw new Error(
        `Failed to load agent types manifest from ${manifestPath}: ${error instanceof Error ? error.message : String(error)}`
      );
    }

    // Load each type
    for (const entry of this.manifest.agent_types) {
      await this.loadType(entry);
    }

    this.loaded = true;
  }

  /**
   * Load a single type from its directory
   */
  private async loadType(entry: AgentTypeManifestEntry): Promise<void> {
    const typePath = join(this.templatesPath, entry.id);

    try {
      // Load agent.yaml
      const typeYamlPath = join(typePath, 'agent.yaml');
      const typeContent = await readFile(typeYamlPath, 'utf-8');
      const typeData = parseYaml(typeContent) as AgentType;
      this.types.set(entry.id, typeData);

      // Load template.md
      const templatePath = join(typePath, 'template.md');
      const templateContent = await readFile(templatePath, 'utf-8');
      this.templates.set(entry.id, templateContent);

      // Load standards.md
      const standardsPath = join(typePath, 'standards.md');
      const standardsContent = await readFile(standardsPath, 'utf-8');
      this.standards.set(entry.id, standardsContent);
    } catch (error) {
      throw new Error(
        `Failed to load agent type '${entry.id}' from ${typePath}: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Get a specific agent type by ID
   */
  getType(id: AgentTypeId): AgentType | undefined {
    return this.types.get(id);
  }

  /**
   * Get all loaded agent types
   */
  getAllTypes(): AgentType[] {
    return Array.from(this.types.values());
  }

  /**
   * Get agent types filtered by scope
   */
  getTypesByScope(scope: AgentScope): AgentType[] {
    return this.getAllTypes().filter((type) => type.scope === scope);
  }

  /**
   * Get agent types filtered by FABER phase
   */
  getTypesByPhase(phase: FaberPhaseName): AgentType[] {
    return this.getAllTypes().filter((type) =>
      type.faber.phase_affinity.includes(phase)
    );
  }

  /**
   * Get the template content for an agent type
   */
  getTemplate(id: AgentTypeId): AgentTypeTemplate | undefined {
    const content = this.templates.get(id);
    if (!content) return undefined;
    return { type_id: id, content };
  }

  /**
   * Get the standards content for an agent type
   */
  getStandards(id: AgentTypeId): AgentTypeStandards | undefined {
    const content = this.standards.get(id);
    if (!content) return undefined;
    return { type_id: id, content };
  }

  /**
   * Get the manifest
   */
  getManifest(): AgentTypeManifest | null {
    return this.manifest;
  }

  /**
   * Check if a type exists
   */
  hasType(id: AgentTypeId): boolean {
    return this.types.has(id);
  }

  /**
   * Get all type IDs
   */
  getTypeIds(): AgentTypeId[] {
    return Array.from(this.types.keys());
  }

  /**
   * Get the validator type for a given type (if it has one)
   */
  getValidatorFor(id: AgentTypeId): AgentType | undefined {
    const type = this.types.get(id);
    if (!type) return undefined;

    // Find a validator that validates this type
    for (const t of this.types.values()) {
      if (t.validates_agent_type === id) {
        return t;
      }
    }

    return undefined;
  }

  /**
   * Get the type that a validator validates
   */
  getValidatesType(validatorId: AgentTypeId): AgentType | undefined {
    const validator = this.types.get(validatorId);
    if (!validator?.validates_agent_type) return undefined;
    return this.types.get(validator.validates_agent_type);
  }

  /**
   * Load a custom type from a URL
   *
   * @example
   * ```typescript
   * await registry.loadCustomTypeFromUrl('my-custom-type', {
   *   url: 'https://example.com/my-types/my-custom-type'
   * });
   * ```
   */
  async loadCustomTypeFromUrl(
    id: string,
    options: LoadFromUrlOptions
  ): Promise<void> {
    const { url } = options;

    // Fetch agent.yaml
    const typeUrl = `${url}/agent.yaml`;
    const typeResponse = await fetch(typeUrl);
    if (!typeResponse.ok) {
      throw new Error(`Failed to fetch agent.yaml from ${typeUrl}`);
    }
    const typeContent = await typeResponse.text();
    const typeData = parseYaml(typeContent) as AgentType;

    // Override the ID to the provided one
    typeData.id = id as AgentTypeId;
    this.types.set(id as AgentTypeId, typeData);

    // Fetch template.md
    const templateUrl = `${url}/template.md`;
    const templateResponse = await fetch(templateUrl);
    if (templateResponse.ok) {
      const templateContent = await templateResponse.text();
      this.templates.set(id as AgentTypeId, templateContent);
    }

    // Fetch standards.md
    const standardsUrl = `${url}/standards.md`;
    const standardsResponse = await fetch(standardsUrl);
    if (standardsResponse.ok) {
      const standardsContent = await standardsResponse.text();
      this.standards.set(id as AgentTypeId, standardsContent);
    }
  }

  /**
   * Clear all loaded types
   */
  clear(): void {
    this.types.clear();
    this.templates.clear();
    this.standards.clear();
    this.manifest = null;
    this.loaded = false;
  }
}

/**
 * Singleton instance of the registry
 */
let defaultRegistry: AgentTypeRegistry | null = null;

/**
 * Get the default agent type registry (singleton)
 */
export function getAgentTypeRegistry(
  options?: AgentTypeRegistryOptions
): AgentTypeRegistry {
  if (!defaultRegistry || options) {
    defaultRegistry = new AgentTypeRegistry(options);
  }
  return defaultRegistry;
}
