/**
 * Binding system exports
 */
export { ClaudeCodeTransformer } from './claude-code/transformer';
import { ConceptType, DeploymentArtifact, Config } from '../types';
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
export declare function createBinding(framework: string): Binding;
/**
 * Check if binding supports concept type
 */
export declare function bindingSupportsConceptType(binding: Binding, conceptType: ConceptType): boolean;
//# sourceMappingURL=index.d.ts.map