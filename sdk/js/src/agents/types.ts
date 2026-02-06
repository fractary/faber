/**
 * @fractary/faber - Agent Types Module
 *
 * TypeScript interfaces for agent type templates and selection.
 */

// ============================================================================
// Scope Types
// ============================================================================

/** Agent scope - what level the agent operates at */
export type AgentScope = 'asset' | 'project';

/** Scope definition in manifest */
export interface AgentScopeDefinition {
  id: AgentScope;
  display_name: string;
  description: string;
}

// ============================================================================
// Agent Type Definitions
// ============================================================================

/** Agent type ID (e.g., 'asset-architect', 'project-auditor') */
export type AgentTypeId =
  | 'asset-architect'
  | 'asset-engineer'
  | 'asset-configurator'
  | 'asset-debugger'
  | 'asset-architect-validator'
  | 'asset-engineer-validator'
  | 'asset-inspector'
  | 'project-auditor';

/** FABER phase names */
export type FaberPhaseName = 'frame' | 'architect' | 'build' | 'evaluate' | 'release' | 'any';

/** Model names */
export type ModelName = 'claude-haiku-4-5' | 'claude-sonnet-4-5' | 'claude-opus-4-6';

/** Tool names */
export type ToolName =
  | 'Bash'
  | 'Read'
  | 'Write'
  | 'Edit'
  | 'Glob'
  | 'Grep'
  | 'AskUserQuestion'
  | 'Skill'
  | 'WebFetch'
  | 'WebSearch';

/** Agent type entry in manifest */
export interface AgentTypeManifestEntry {
  id: AgentTypeId;
  display_name: string;
  scope: AgentScope;
  path: string;
  faber_phase: FaberPhaseName;
  pairs_with?: AgentTypeId;
  description: string;
}

/** Full manifest structure */
export interface AgentTypeManifest {
  version: string;
  base_url: string;
  scopes: AgentScopeDefinition[];
  agent_types: AgentTypeManifestEntry[];
}

// ============================================================================
// Agent Type Configuration
// ============================================================================

/** Configuration for an agent type */
export interface AgentTypeConfig {
  recommended_model: ModelName;
  common_tools: ToolName[];
  required_tools: ToolName[];
  typical_complexity: 'low' | 'medium' | 'high';
  requires_user_interaction: boolean;
  maintains_state: boolean;
}

/** FABER integration configuration */
export interface AgentTypeFaberConfig {
  phase_affinity: FaberPhaseName[];
  exit_codes: AgentTypeExitCode[];
}

/** Exit code definition */
export interface AgentTypeExitCode {
  code: number;
  meaning: string;
}

/** Documentation for an agent type */
export interface AgentTypeDocumentation {
  when_to_use: string[];
  examples: string[];
}

/** Structure requirements for an agent type */
export interface AgentTypeStructure {
  required_sections: string[];
  recommended_sections: string[];
}

/** Critical rule definition */
export interface AgentTypeCriticalRule {
  id: string;
  title: string;
  description: string;
}

/** Frontmatter schema property */
export interface FrontmatterProperty {
  type: string;
  pattern?: string;
  description?: string;
  enum?: string[];
  default?: string;
  maxLength?: number;
  items?: FrontmatterProperty;
  must_include?: string[];
  note?: string;
}

/** Frontmatter schema */
export interface AgentTypeFrontmatterSchema {
  required: string[];
  optional: string[];
  properties: Record<string, FrontmatterProperty>;
}

/** Validation rules */
export interface AgentTypeValidation {
  implementation_steps_min?: number;
  implementation_step_patterns?: string[];
  ambiguous_terms_to_flag?: string[];
}

/** Output format specification */
export interface AgentTypeOutputFormat {
  type: string;
  required_sections?: string[];
  recommended_sections?: string[];
  deliverables?: string[];
  required_fields?: string[];
  recommended_fields?: string[];
  modes?: Array<{
    name: string;
    description: string;
    default?: boolean;
    flag?: string;
  }>;
}

/** Scoring configuration (for validators) */
export interface AgentTypeScoring {
  pass_threshold: number;
  weights: Record<string, number>;
}

/** Threshold configuration (for validators) */
export interface AgentTypeThresholds {
  lint_errors?: number;
  type_errors?: number;
  test_pass_rate?: number;
  coverage_minimum?: number;
}

// ============================================================================
// Full Agent Type Definition
// ============================================================================

/** Complete agent type definition (from agent.yaml) */
export interface AgentType {
  id: AgentTypeId;
  display_name: string;
  scope: AgentScope;
  description: string;

  // Pairing (for validators)
  validates_agent_type?: AgentTypeId;
  pairs_with?: AgentTypeId;
  validation_mode?: 'static' | 'static+dynamic';

  // Configuration
  config: AgentTypeConfig;
  faber: AgentTypeFaberConfig;

  // Documentation
  documentation: AgentTypeDocumentation;

  // Structure requirements
  structure: AgentTypeStructure;
  critical_rules: AgentTypeCriticalRule[];
  implementation_steps: string[];

  // Output format
  output_format: AgentTypeOutputFormat;

  // Frontmatter schema
  frontmatter_schema: AgentTypeFrontmatterSchema;

  // Validation
  validation?: AgentTypeValidation;

  // Scoring (for validators)
  scoring?: AgentTypeScoring;
  thresholds?: AgentTypeThresholds;
}

// ============================================================================
// Template Types
// ============================================================================

/** Template file content */
export interface AgentTypeTemplate {
  type_id: AgentTypeId;
  content: string;
}

/** Standards file content */
export interface AgentTypeStandards {
  type_id: AgentTypeId;
  content: string;
}

// ============================================================================
// Selection Types
// ============================================================================

/** Context for selecting an agent type */
export interface SelectionContext {
  /** Description of what the agent should do */
  purpose?: string;
  /** Keywords describing the agent */
  keywords?: string[];
  /** FABER phase the agent will be used in */
  faber_phase?: FaberPhaseName;
  /** Preferred scope */
  scope?: AgentScope;
  /** Whether the agent should validate another agent's output */
  validates?: AgentTypeId;
}

/** Result of agent type selection */
export interface SelectionResult {
  /** Recommended agent type */
  recommended: AgentTypeId;
  /** Confidence level (0-1) */
  confidence: number;
  /** Reasoning for the selection */
  reasoning: string;
  /** Alternative options with their confidence scores */
  alternatives: Array<{
    type_id: AgentTypeId;
    confidence: number;
    reasoning: string;
  }>;
}

// ============================================================================
// Keyword Matching Types (from selector.yaml)
// ============================================================================

/** Keyword matching configuration for a type */
export interface KeywordMatchConfig {
  keywords: string[];
  negative_keywords?: string[];
}

/** Phase affinity mapping */
export type PhaseAffinityMap = Record<FaberPhaseName, AgentTypeId[]>;

/** Decision tree node */
export interface DecisionTreeNode {
  question: string;
  options: Array<{
    label: string;
    next?: string;
    result?: AgentTypeId;
  }>;
}

/** Decision tree */
export type DecisionTree = Record<string, DecisionTreeNode>;

/** Confidence thresholds */
export interface ConfidenceThresholds {
  high: number;
  medium: number;
  low: number;
}

/** Agent type pairings (architect -> architect-validator) */
export type AgentTypePairings = Partial<Record<AgentTypeId, AgentTypeId>>;

/** Selector configuration (from selector.yaml) */
export interface SelectorConfig {
  version: string;
  description: string;
  keyword_matching: Record<AgentTypeId, KeywordMatchConfig>;
  phase_affinity: PhaseAffinityMap;
  decision_tree: DecisionTree;
  confidence: ConfidenceThresholds;
  pairings: AgentTypePairings;
}

// ============================================================================
// Registry Options
// ============================================================================

/** Options for creating an AgentTypeRegistry */
export interface AgentTypeRegistryOptions {
  /** Path to templates directory (default: templates/agents) */
  templatesPath?: string;
  /** Base URL for remote loading */
  baseUrl?: string;
}

/** Options for loading a type from URL */
export interface LoadFromUrlOptions {
  /** Custom URL to load from */
  url: string;
}
