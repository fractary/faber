/**
 * Template utilities
 */

import Handlebars from 'handlebars';
import { readFile } from './file-system';

// Cache for compiled templates
const templateCache = new Map<string, HandlebarsTemplateDelegate>();

/**
 * Register common Handlebars helpers
 */
export function registerHelpers(): void {
  // Convert to snake_case
  Handlebars.registerHelper('snake_case', (str: string) => {
    return str.replace(/([A-Z])/g, '_$1').toLowerCase().replace(/^_/, '').replace(/-/g, '_');
  });

  // Convert to camelCase
  Handlebars.registerHelper('camel_case', (str: string) => {
    return str.replace(/-([a-z])/g, (g) => g[1].toUpperCase());
  });

  // Convert to PascalCase
  Handlebars.registerHelper('pascal_case', (str: string) => {
    const camel = str.replace(/-([a-z])/g, (g) => g[1].toUpperCase());
    return camel.charAt(0).toUpperCase() + camel.slice(1);
  });

  // Convert to UPPER_SNAKE_CASE
  Handlebars.registerHelper('upper_snake_case', (str: string) => {
    return str.replace(/([A-Z])/g, '_$1').toUpperCase().replace(/^_/, '').replace(/-/g, '_');
  });

  // Convert array to Python list
  Handlebars.registerHelper('python_list', (arr: string[]) => {
    return `[${arr.map(s => `"${s}"`).join(', ')}]`;
  });

  // Convert array to JavaScript array
  Handlebars.registerHelper('js_array', (arr: string[]) => {
    return JSON.stringify(arr);
  });

  // Conditional helper
  Handlebars.registerHelper('if_eq', function(a: any, b: any, options: any) {
    if (a === b) {
      return options.fn(this);
    }
    return options.inverse(this);
  });

  // Join array with separator
  Handlebars.registerHelper('join', (arr: string[], separator: string) => {
    return arr.join(separator);
  });

  // Indent text
  Handlebars.registerHelper('indent', (text: string, spaces: number) => {
    const indent = ' '.repeat(spaces);
    return text.split('\n').map(line => indent + line).join('\n');
  });
}

/**
 * Compile a template from string
 */
export function compileTemplate(template: string): HandlebarsTemplateDelegate {
  return Handlebars.compile(template);
}

/**
 * Load and compile a template from file
 */
export async function loadTemplate(filePath: string): Promise<HandlebarsTemplateDelegate> {
  // Check cache
  if (templateCache.has(filePath)) {
    return templateCache.get(filePath)!;
  }

  // Load and compile
  const content = await readFile(filePath);
  const compiled = compileTemplate(content);

  // Cache
  templateCache.set(filePath, compiled);

  return compiled;
}

/**
 * Render a template with data
 */
export function renderTemplate(
  template: HandlebarsTemplateDelegate,
  data: any
): string {
  return template(data);
}

/**
 * Load, compile and render a template in one go
 */
export async function renderTemplateFile(
  filePath: string,
  data: any
): Promise<string> {
  const template = await loadTemplate(filePath);
  return renderTemplate(template, data);
}

/**
 * Clear template cache
 */
export function clearTemplateCache(): void {
  templateCache.clear();
}

// Register helpers on module load
registerHelpers();