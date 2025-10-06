/**
 * Overlay system exports
 */

export { OverlayResolver, Overlays, OverlayContent } from './resolver';

import { Context } from '../../types';
import { Overlays } from './resolver';

/**
 * Overlay utilities
 */
export class OverlayUtils {
  /**
   * Check if overlays are enabled
   */
  static hasOverlays(overlays: Overlays): boolean {
    return (
      overlays.organization.contexts.length > 0 ||
      Object.keys(overlays.platforms).length > 0 ||
      Object.keys(overlays.roles).length > 0 ||
      Object.keys(overlays.teams).length > 0 ||
      Object.keys(overlays.workflows).length > 0
    );
  }

  /**
   * Count total overlay contexts
   */
  static countContexts(overlays: Overlays): number {
    let count = overlays.organization.contexts.length;

    for (const platform of Object.values(overlays.platforms)) {
      count += platform.contexts.length;
    }

    for (const role of Object.values(overlays.roles)) {
      count += role.contexts.length;
    }

    for (const team of Object.values(overlays.teams)) {
      count += team.contexts.length;
    }

    for (const workflow of Object.values(overlays.workflows)) {
      count += workflow.contexts.length;
    }

    return count;
  }

  /**
   * Find conflicts between base and overlay contexts
   */
  static findConflicts(
    baseContexts: Context[],
    overlayContexts: Context[]
  ): Array<{ base: Context; overlay: Context }> {
    const conflicts: Array<{ base: Context; overlay: Context }> = [];

    for (const overlay of overlayContexts) {
      const base = baseContexts.find(
        b => b.category === overlay.category && b.name === overlay.name
      );

      if (base) {
        conflicts.push({ base, overlay });
      }
    }

    return conflicts;
  }

  /**
   * Apply merge strategy to conflicting contexts
   */
  static mergeConflicts(
    base: Context,
    overlay: Context,
    strategy: 'override' | 'merge' | 'append' = 'override'
  ): Context {
    switch (strategy) {
      case 'override':
        // Overlay completely replaces base
        return overlay;

      case 'merge':
        // Merge contents (overlay adds to base)
        return {
          ...base,
          content: `${base.content}\n\n## Overlay Additions\n\n${overlay.content}`,
          metadata: { ...base.metadata, ...overlay.metadata }
        };

      case 'append':
        // Append overlay requirements to base
        return {
          ...base,
          content: `${base.content}\n\n## Additional Requirements (from overlay)\n\n${overlay.content}`
        };

      default:
        return overlay;
    }
  }
}