/**
 * @fractary/faber - Agent Type Selector
 *
 * Selects the appropriate agent type based on context and requirements.
 */

import { readFile } from 'fs/promises';
import { join, resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import yaml from 'js-yaml';

const parseYaml = (content: string) => yaml.load(content);

import type {
  AgentTypeId,
  SelectionContext,
  SelectionResult,
  SelectorConfig,
  KeywordMatchConfig,
  FaberPhaseName,
  AgentScope,
} from './types.js';
import { AgentTypeRegistry, getAgentTypeRegistry } from './type-registry.js';

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
 * AgentTypeSelector - Selects agent types based on context
 *
 * Uses keyword matching, FABER phase affinity, and other signals
 * to recommend the most appropriate agent type.
 *
 * @example
 * ```typescript
 * const selector = new AgentTypeSelector();
 * await selector.loadConfig();
 *
 * const result = selector.select({
 *   purpose: 'design an API endpoint',
 *   faber_phase: 'architect'
 * });
 *
 * console.log(result.recommended); // 'asset-architect'
 * console.log(result.confidence);  // 0.85
 * ```
 */
export class AgentTypeSelector {
  private config: SelectorConfig | null = null;
  private registry: AgentTypeRegistry;
  private templatesPath: string;
  private loaded: boolean = false;

  constructor(options: { templatesPath?: string; registry?: AgentTypeRegistry } = {}) {
    this.templatesPath = options.templatesPath
      ? resolve(options.templatesPath)
      : resolve(getPackageRoot(), DEFAULT_TEMPLATES_PATH);
    this.registry = options.registry || getAgentTypeRegistry();
  }

  /**
   * Load the selector configuration
   */
  async loadConfig(): Promise<void> {
    if (this.loaded) return;

    // Load selector.yaml
    const selectorPath = join(this.templatesPath, 'selector.yaml');
    try {
      const selectorContent = await readFile(selectorPath, 'utf-8');
      this.config = parseYaml(selectorContent) as SelectorConfig;
    } catch (error) {
      throw new Error(
        `Failed to load selector configuration from ${selectorPath}: ${error instanceof Error ? error.message : String(error)}`
      );
    }

    // Ensure registry is loaded
    await this.registry.loadCoreTypes();

    this.loaded = true;
  }

  /**
   * Select the most appropriate agent type for the given context
   */
  select(context: SelectionContext): SelectionResult {
    if (!this.config) {
      throw new Error('Selector not loaded. Call loadConfig() first.');
    }

    const scores: Map<AgentTypeId, number> = new Map();
    const reasons: Map<AgentTypeId, string[]> = new Map();

    // Initialize all types with base score
    for (const typeId of this.registry.getTypeIds()) {
      scores.set(typeId, 0);
      reasons.set(typeId, []);
    }

    // Score based on keywords from purpose
    if (context.purpose) {
      this.scoreByKeywords(context.purpose, scores, reasons);
    }

    // Score based on explicit keywords
    if (context.keywords && context.keywords.length > 0) {
      for (const keyword of context.keywords) {
        this.scoreByKeywords(keyword, scores, reasons);
      }
    }

    // Score based on FABER phase
    if (context.faber_phase) {
      this.scoreByPhase(context.faber_phase, scores, reasons);
    }

    // Score based on scope preference
    if (context.scope) {
      this.scoreByScope(context.scope, scores, reasons);
    }

    // Score based on validation target
    if (context.validates) {
      this.scoreByValidation(context.validates, scores, reasons);
    }

    // Sort by score
    const sortedTypes = Array.from(scores.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([typeId, score]) => ({
        typeId,
        score,
        reasons: reasons.get(typeId) || [],
      }));

    // Guard against empty results
    if (sortedTypes.length === 0) {
      throw new Error(
        'No agent types available. Ensure registry is loaded with loadCoreTypes() first.'
      );
    }

    // Determine confidence level
    const topScore = sortedTypes[0].score;
    const maxPossibleScore = this.getMaxPossibleScore(context);
    const normalizedConfidence = Math.min(topScore / maxPossibleScore, 1);

    const confidence = this.normalizeConfidence(normalizedConfidence);

    // Build result
    const result: SelectionResult = {
      recommended: sortedTypes[0].typeId,
      confidence,
      reasoning: sortedTypes[0].reasons.join('; ') || 'Default selection',
      alternatives: sortedTypes.slice(1, 4).map((t) => ({
        type_id: t.typeId,
        confidence: Math.min(t.score / maxPossibleScore, 1),
        reasoning: t.reasons.join('; ') || 'Alternative option',
      })),
    };

    return result;
  }

  /**
   * Score types based on keyword matching
   */
  private scoreByKeywords(
    text: string,
    scores: Map<AgentTypeId, number>,
    reasons: Map<AgentTypeId, string[]>
  ): void {
    if (!this.config) return;

    const lowerText = text.toLowerCase();

    for (const [typeId, matchConfig] of Object.entries(
      this.config.keyword_matching
    ) as [AgentTypeId, KeywordMatchConfig][]) {
      const typeReasons = reasons.get(typeId) || [];

      // Check positive keywords
      for (const keyword of matchConfig.keywords) {
        if (lowerText.includes(keyword.toLowerCase())) {
          const currentScore = scores.get(typeId) || 0;
          scores.set(typeId, currentScore + 10);
          typeReasons.push(`Matched keyword: "${keyword}"`);
        }
      }

      // Check negative keywords
      if (matchConfig.negative_keywords) {
        for (const keyword of matchConfig.negative_keywords) {
          if (lowerText.includes(keyword.toLowerCase())) {
            const currentScore = scores.get(typeId) || 0;
            scores.set(typeId, currentScore - 5);
            typeReasons.push(`Negative keyword: "${keyword}"`);
          }
        }
      }

      reasons.set(typeId, typeReasons);
    }
  }

  /**
   * Score types based on FABER phase affinity
   */
  private scoreByPhase(
    phase: FaberPhaseName,
    scores: Map<AgentTypeId, number>,
    reasons: Map<AgentTypeId, string[]>
  ): void {
    if (!this.config) return;

    const phaseTypes = this.config.phase_affinity[phase] || [];

    for (const typeId of phaseTypes) {
      const currentScore = scores.get(typeId) || 0;
      scores.set(typeId, currentScore + 15);

      const typeReasons = reasons.get(typeId) || [];
      typeReasons.push(`Phase affinity: ${phase}`);
      reasons.set(typeId, typeReasons);
    }
  }

  /**
   * Score types based on scope preference
   */
  private scoreByScope(
    scope: AgentScope,
    scores: Map<AgentTypeId, number>,
    reasons: Map<AgentTypeId, string[]>
  ): void {
    for (const type of this.registry.getAllTypes()) {
      if (type.scope === scope) {
        const currentScore = scores.get(type.id) || 0;
        scores.set(type.id, currentScore + 8);

        const typeReasons = reasons.get(type.id) || [];
        typeReasons.push(`Scope match: ${scope}`);
        reasons.set(type.id, typeReasons);
      }
    }
  }

  /**
   * Score types based on validation target
   */
  private scoreByValidation(
    validatesType: AgentTypeId,
    scores: Map<AgentTypeId, number>,
    reasons: Map<AgentTypeId, string[]>
  ): void {
    for (const type of this.registry.getAllTypes()) {
      if (type.validates_agent_type === validatesType) {
        const currentScore = scores.get(type.id) || 0;
        scores.set(type.id, currentScore + 25);

        const typeReasons = reasons.get(type.id) || [];
        typeReasons.push(`Validates: ${validatesType}`);
        reasons.set(type.id, typeReasons);
      }
    }
  }

  /**
   * Calculate the maximum possible score for a given context
   */
  private getMaxPossibleScore(context: SelectionContext): number {
    let max = 10; // Base score for having any keywords

    if (context.purpose) max += 20; // Multiple keyword matches possible
    if (context.keywords) max += context.keywords.length * 10;
    if (context.faber_phase) max += 15;
    if (context.scope) max += 8;
    if (context.validates) max += 25;

    return max;
  }

  /**
   * Normalize confidence to a meaningful range
   */
  private normalizeConfidence(raw: number): number {
    if (!this.config) return raw;

    const thresholds = this.config.confidence;

    if (raw >= thresholds.high) return raw;
    if (raw >= thresholds.medium) return raw;
    return raw;
  }

  /**
   * Get the configuration
   */
  getConfig(): SelectorConfig | null {
    return this.config;
  }

  /**
   * Check if selector is loaded
   */
  isLoaded(): boolean {
    return this.loaded;
  }
}

/**
 * Singleton instance of the selector
 */
let defaultSelector: AgentTypeSelector | null = null;

/**
 * Get the default agent type selector (singleton)
 */
export function getAgentTypeSelector(options?: {
  templatesPath?: string;
  registry?: AgentTypeRegistry;
}): AgentTypeSelector {
  if (!defaultSelector || options) {
    defaultSelector = new AgentTypeSelector(options);
  }
  return defaultSelector;
}
