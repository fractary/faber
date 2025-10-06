/**
 * Overlay system for customization without forking
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import * as yaml from 'js-yaml';
import { Context, ContextCategory } from '../../types';
import { ContextLoader } from '../contexts/loader';

export interface Overlays {
  organization: OverlayContent;
  platforms: Record<string, OverlayContent>;
  roles: Record<string, OverlayContent>;
  teams: Record<string, OverlayContent>;
  workflows: Record<string, OverlayContent>;
}

export interface OverlayContent {
  contexts: Context[];
  config?: Record<string, unknown>;
}

export class OverlayResolver {
  private contextLoader: ContextLoader;
  private overlayPath: string;

  constructor(overlayPath: string = '.faber/overlays') {
    this.overlayPath = overlayPath;
    this.contextLoader = new ContextLoader();
  }

  /**
   * Resolve all overlays for a concept
   */
  async resolveOverlays(
    conceptType: string,
    conceptName: string,
    platform?: string
  ): Promise<Overlays> {
    const overlays: Overlays = {
      organization: await this.loadOrganizationOverlays(),
      platforms: {},
      roles: {},
      teams: {},
      workflows: {}
    };

    // Load platform overlays if platform specified
    if (platform) {
      overlays.platforms[platform] = await this.loadPlatformOverlays(platform);
    }

    // Load concept-specific overlays
    switch (conceptType) {
      case 'role':
        overlays.roles[conceptName] = await this.loadRoleOverlays(conceptName);
        break;
      case 'team':
        overlays.teams[conceptName] = await this.loadTeamOverlays(conceptName);
        break;
      case 'workflow':
        overlays.workflows[conceptName] = await this.loadWorkflowOverlays(conceptName);
        break;
    }

    return overlays;
  }

  /**
   * Load organization-level overlays
   */
  private async loadOrganizationOverlays(): Promise<OverlayContent> {
    const orgPath = path.join(this.overlayPath, 'organization');
    return this.loadOverlayContent(orgPath);
  }

  /**
   * Load platform-specific overlays
   */
  private async loadPlatformOverlays(platform: string): Promise<OverlayContent> {
    const platformPath = path.join(this.overlayPath, 'platforms', platform);
    return this.loadOverlayContent(platformPath);
  }

  /**
   * Load role-specific overlays
   */
  private async loadRoleOverlays(roleName: string): Promise<OverlayContent> {
    const rolePath = path.join(this.overlayPath, 'roles', roleName);
    return this.loadOverlayContent(rolePath);
  }

  /**
   * Load team-specific overlays
   */
  private async loadTeamOverlays(teamName: string): Promise<OverlayContent> {
    const teamPath = path.join(this.overlayPath, 'teams', teamName);
    return this.loadOverlayContent(teamPath);
  }

  /**
   * Load workflow-specific overlays
   */
  private async loadWorkflowOverlays(workflowName: string): Promise<OverlayContent> {
    const workflowPath = path.join(this.overlayPath, 'workflows', workflowName);
    return this.loadOverlayContent(workflowPath);
  }

  /**
   * Load overlay content from a directory
   */
  private async loadOverlayContent(overlayDir: string): Promise<OverlayContent> {
    const content: OverlayContent = {
      contexts: [],
      config: undefined
    };

    // Check if directory exists
    try {
      await fs.access(overlayDir);
    } catch {
      return content;
    }

    // Load contexts
    const contextsPath = path.join(overlayDir, 'contexts');
    content.contexts = await this.loadOverlayContexts(contextsPath);

    // Load config if exists
    const configPath = path.join(overlayDir, 'config.yml');
    try {
      const configContent = await fs.readFile(configPath, 'utf-8');
      content.config = yaml.load(configContent) as Record<string, unknown>;
    } catch {
      // No config file
    }

    return content;
  }

  /**
   * Load all contexts from overlay directory
   */
  private async loadOverlayContexts(contextsPath: string): Promise<Context[]> {
    const contexts: Context[] = [];

    try {
      await fs.access(contextsPath);
    } catch {
      return contexts;
    }

    // Load contexts from each category
    for (const category of Object.values(ContextCategory)) {
      const categoryPath = path.join(contextsPath, category);
      const categoryContexts = await this.contextLoader.loadCategoryContexts(
        categoryPath,
        category
      );
      contexts.push(...categoryContexts);
    }

    return contexts;
  }

  /**
   * Merge overlay configurations with precedence
   */
  mergeConfigurations(
    base: Record<string, unknown>,
    overlays: Overlays
  ): Record<string, unknown> {
    let merged = { ...base };

    // Apply overlays in order of precedence
    // 1. Organization overlay
    if (overlays.organization.config) {
      merged = this.deepMerge(merged, overlays.organization.config);
    }

    // 2. Platform overlays
    for (const platformOverlay of Object.values(overlays.platforms)) {
      if (platformOverlay.config) {
        merged = this.deepMerge(merged, platformOverlay.config);
      }
    }

    // 3. Role overlays
    for (const roleOverlay of Object.values(overlays.roles)) {
      if (roleOverlay.config) {
        merged = this.deepMerge(merged, roleOverlay.config);
      }
    }

    // 4. Team overlays
    for (const teamOverlay of Object.values(overlays.teams)) {
      if (teamOverlay.config) {
        merged = this.deepMerge(merged, teamOverlay.config);
      }
    }

    // 5. Workflow overlays
    for (const workflowOverlay of Object.values(overlays.workflows)) {
      if (workflowOverlay.config) {
        merged = this.deepMerge(merged, workflowOverlay.config);
      }
    }

    return merged;
  }

  /**
   * Deep merge two objects
   */
  private deepMerge(
    target: Record<string, unknown>,
    source: Record<string, unknown>
  ): Record<string, unknown> {
    const result = { ...target };

    for (const key in source) {
      if (source.hasOwnProperty(key)) {
        if (
          typeof source[key] === 'object' &&
          source[key] !== null &&
          !Array.isArray(source[key]) &&
          typeof target[key] === 'object' &&
          target[key] !== null &&
          !Array.isArray(target[key])
        ) {
          // Recursively merge objects
          result[key] = this.deepMerge(
            target[key] as Record<string, unknown>,
            source[key] as Record<string, unknown>
          );
        } else if (Array.isArray(source[key]) && Array.isArray(target[key])) {
          // Merge arrays (append strategy)
          result[key] = [...(target[key] as unknown[]), ...(source[key] as unknown[])];
        } else {
          // Override value
          result[key] = source[key];
        }
      }
    }

    return result;
  }

  /**
   * Collect all contexts from overlays in precedence order
   */
  collectContexts(overlays: Overlays): Context[] {
    const contexts: Context[] = [];

    // Collect in precedence order
    contexts.push(...overlays.organization.contexts);

    for (const platformOverlay of Object.values(overlays.platforms)) {
      contexts.push(...platformOverlay.contexts);
    }

    for (const roleOverlay of Object.values(overlays.roles)) {
      contexts.push(...roleOverlay.contexts);
    }

    for (const teamOverlay of Object.values(overlays.teams)) {
      contexts.push(...teamOverlay.contexts);
    }

    for (const workflowOverlay of Object.values(overlays.workflows)) {
      contexts.push(...workflowOverlay.contexts);
    }

    return contexts;
  }
}