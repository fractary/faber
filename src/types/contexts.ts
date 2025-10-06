/**
 * Context type definitions
 */

export enum ContextCategory {
  SPECIALIST = 'specialists',
  PLATFORM = 'platforms',
  STANDARD = 'standards',
  PATTERN = 'patterns',
  PLAYBOOK = 'playbooks',
  REFERENCE = 'references',
  TROUBLESHOOTING = 'troubleshooting'
}

export interface Context {
  category: ContextCategory;
  name: string;
  content: string;
  frontmatter?: ContextFrontmatter;
  metadata?: ContextFrontmatter; // Alias for frontmatter for backward compatibility
  filePath?: string;
  path?: string; // Alias for filePath
}

export interface ContextFrontmatter {
  category?: ContextCategory;
  name?: string;
  description?: string;
  platform?: string;
  mcp_server?: string;
  required_tools?: string[];
  fallback?: 'api' | 'cli' | 'manual';
  related?: string[];
  tags?: string[];
}

export interface PlatformContext extends Context {
  category: ContextCategory.PLATFORM;
  platform: string;
  mcp_server?: string;
  required_tools?: string[];
}

export interface SpecialistContext extends Context {
  category: ContextCategory.SPECIALIST;
  domain?: string;
  expertise?: string[];
}

export interface StandardContext extends Context {
  category: ContextCategory.STANDARD;
}

export interface PatternContext extends Context {
  category: ContextCategory.PATTERN;
}

export interface PlaybookContext extends Context {
  category: ContextCategory.PLAYBOOK;
}

export interface ReferenceContext extends Context {
  category: ContextCategory.REFERENCE;
}

export interface TroubleshootingContext extends Context {
  category: ContextCategory.TROUBLESHOOTING;
}