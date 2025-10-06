/**
 * Template utilities
 */
/**
 * Register common Handlebars helpers
 */
export declare function registerHelpers(): void;
/**
 * Compile a template from string
 */
export declare function compileTemplate(template: string): HandlebarsTemplateDelegate;
/**
 * Load and compile a template from file
 */
export declare function loadTemplate(filePath: string): Promise<HandlebarsTemplateDelegate>;
/**
 * Render a template with data
 */
export declare function renderTemplate(template: HandlebarsTemplateDelegate, data: any): string;
/**
 * Load, compile and render a template in one go
 */
export declare function renderTemplateFile(filePath: string, data: any): Promise<string>;
/**
 * Clear template cache
 */
export declare function clearTemplateCache(): void;
//# sourceMappingURL=template.d.ts.map