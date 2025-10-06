/**
 * Core types for Faber-CLI
 */

// Export all types from separate modules
export * from './concepts';
export * from './contexts';
export * from './overlays';
export * from './config';
export * from './bindings';

// Additional types for API
export interface ConceptInfo {
  type: ConceptType;
  name: string;
  description?: string;
  path: string;
}

// Re-export ConceptType for backward compatibility
import { ConceptType } from './concepts';
export { ConceptType };