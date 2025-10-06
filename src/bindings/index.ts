/**
 * Binding system exports
 */

export { ClaudeCodeTransformer } from './claude-code/transformer';

import { ConceptType, DeploymentArtifact, Config, Role } from '../types';
import { ClaudeCodeTransformer } from './claude-code/transformer';
import { Overlays } from '../core/overlays';

export interface Binding {
  name: string;
  version: string;
  supportedConcepts: ConceptType[];

  transform(concept: any, config: Config, overlays: Overlays): Promise<DeploymentArtifact>;
}

/**
 * Create binding transformer for framework
 */
export function createBinding(framework: string): Binding {
  switch (framework) {
    case 'claude':
    case 'claude-code':
      return {
        name: 'claude-code',
        version: '1.0.0',
        supportedConcepts: [ConceptType.ROLE, ConceptType.TOOL, ConceptType.EVAL],
        transform: async (concept: Role, config: Config, overlays: Overlays) => {
          const transformer = new ClaudeCodeTransformer();
          return transformer.transform(concept, config, overlays);
        }
      };

    case 'langgraph':
      throw new Error('LangGraph binding not yet implemented');

    case 'crewai':
      throw new Error('CrewAI binding not yet implemented');

    default:
      throw new Error(`Unknown binding framework: ${framework}`);
  }
}

/**
 * Check if binding supports concept type
 */
export function bindingSupportsConceptType(
  binding: Binding,
  conceptType: ConceptType
): boolean {
  return binding.supportedConcepts.includes(conceptType);
}