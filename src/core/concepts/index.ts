/**
 * Concept system exports
 */

export { BaseConceptLoader, ConceptReferenceImpl } from './base';
export { RoleLoader } from './role';

import { ConceptType } from '../../types';
import { BaseConceptLoader } from './base';
import { RoleLoader } from './role';

// Factory for creating concept loaders
export function createConceptLoader(type: ConceptType): BaseConceptLoader<any> {
  switch (type) {
    case ConceptType.ROLE:
      return new RoleLoader();

    case ConceptType.TOOL:
      // TODO: Implement ToolLoader
      throw new Error('ToolLoader not yet implemented');

    case ConceptType.EVAL:
      // TODO: Implement EvalLoader
      throw new Error('EvalLoader not yet implemented');

    case ConceptType.TEAM:
      // TODO: Implement TeamLoader
      throw new Error('TeamLoader not yet implemented');

    case ConceptType.WORKFLOW:
      // TODO: Implement WorkflowLoader
      throw new Error('WorkflowLoader not yet implemented');

    default:
      throw new Error(`Unknown concept type: ${type}`);
  }
}