/**
 * Core types for Faber-CLI
 */
export * from './concepts';
export * from './contexts';
export * from './overlays';
export * from './config';
export * from './bindings';
export interface ConceptInfo {
    type: ConceptType;
    name: string;
    description?: string;
    path: string;
}
import { ConceptType } from './concepts';
export { ConceptType };
//# sourceMappingURL=index.d.ts.map