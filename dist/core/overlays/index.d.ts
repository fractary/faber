/**
 * Overlay system exports
 */
export { OverlayResolver, Overlays, OverlayContent } from './resolver';
import { Context } from '../../types';
import { Overlays } from './resolver';
/**
 * Overlay utilities
 */
export declare class OverlayUtils {
    /**
     * Check if overlays are enabled
     */
    static hasOverlays(overlays: Overlays): boolean;
    /**
     * Count total overlay contexts
     */
    static countContexts(overlays: Overlays): number;
    /**
     * Find conflicts between base and overlay contexts
     */
    static findConflicts(baseContexts: Context[], overlayContexts: Context[]): Array<{
        base: Context;
        overlay: Context;
    }>;
    /**
     * Apply merge strategy to conflicting contexts
     */
    static mergeConflicts(base: Context, overlay: Context, strategy?: 'override' | 'merge' | 'append'): Context;
}
//# sourceMappingURL=index.d.ts.map