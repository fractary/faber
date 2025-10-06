/**
 * Binding type definitions
 */

import { Concept, ConceptType } from './concepts';
import { Config } from './config';
import { Overlays } from './overlays';

export interface BindingTransformer {
  transform(concept: Concept, config: Config, overlays?: Overlays): Promise<DeploymentArtifact>;
  validate(concept: Concept): Promise<ValidationResult>;
  getRequirements(): BindingRequirements;
}

export interface DeploymentArtifact {
  framework: string;
  concept: string;
  conceptType: ConceptType;
  files: FileArtifact[];
  metadata: DeploymentMetadata;
}

export interface FileArtifact {
  path: string;
  content: string;
  encoding?: string;
  permissions?: string;
}

export interface DeploymentMetadata {
  version: string;
  timestamp: string;
  config: Config;
  overlays?: Overlays;
  platform?: string;
}

export interface BindingRequirements {
  minVersion?: string;
  requiredFeatures?: string[];
  supportedConcepts: ConceptType[];
}

export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
  info?: ValidationInfo[];
}

export interface ValidationError {
  path: string;
  message: string;
  code?: string;
  type?: 'error' | 'warning';
}

export interface ValidationWarning {
  path: string;
  message: string;
  code: string;
  suggestion?: string;
}

export interface ValidationInfo {
  path: string;
  message: string;
}