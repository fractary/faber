"use strict";
/**
 * Template utilities
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerHelpers = registerHelpers;
exports.compileTemplate = compileTemplate;
exports.loadTemplate = loadTemplate;
exports.renderTemplate = renderTemplate;
exports.renderTemplateFile = renderTemplateFile;
exports.clearTemplateCache = clearTemplateCache;
const handlebars_1 = __importDefault(require("handlebars"));
const file_system_1 = require("./file-system");
// Cache for compiled templates
const templateCache = new Map();
/**
 * Register common Handlebars helpers
 */
function registerHelpers() {
    // Convert to snake_case
    handlebars_1.default.registerHelper('snake_case', (str) => {
        return str.replace(/([A-Z])/g, '_$1').toLowerCase().replace(/^_/, '').replace(/-/g, '_');
    });
    // Convert to camelCase
    handlebars_1.default.registerHelper('camel_case', (str) => {
        return str.replace(/-([a-z])/g, (g) => g[1].toUpperCase());
    });
    // Convert to PascalCase
    handlebars_1.default.registerHelper('pascal_case', (str) => {
        const camel = str.replace(/-([a-z])/g, (g) => g[1].toUpperCase());
        return camel.charAt(0).toUpperCase() + camel.slice(1);
    });
    // Convert to UPPER_SNAKE_CASE
    handlebars_1.default.registerHelper('upper_snake_case', (str) => {
        return str.replace(/([A-Z])/g, '_$1').toUpperCase().replace(/^_/, '').replace(/-/g, '_');
    });
    // Convert array to Python list
    handlebars_1.default.registerHelper('python_list', (arr) => {
        return `[${arr.map(s => `"${s}"`).join(', ')}]`;
    });
    // Convert array to JavaScript array
    handlebars_1.default.registerHelper('js_array', (arr) => {
        return JSON.stringify(arr);
    });
    // Conditional helper
    handlebars_1.default.registerHelper('if_eq', function (a, b, options) {
        if (a === b) {
            return options.fn(this);
        }
        return options.inverse(this);
    });
    // Join array with separator
    handlebars_1.default.registerHelper('join', (arr, separator) => {
        return arr.join(separator);
    });
    // Indent text
    handlebars_1.default.registerHelper('indent', (text, spaces) => {
        const indent = ' '.repeat(spaces);
        return text.split('\n').map(line => indent + line).join('\n');
    });
}
/**
 * Compile a template from string
 */
function compileTemplate(template) {
    return handlebars_1.default.compile(template);
}
/**
 * Load and compile a template from file
 */
async function loadTemplate(filePath) {
    // Check cache
    if (templateCache.has(filePath)) {
        return templateCache.get(filePath);
    }
    // Load and compile
    const content = await (0, file_system_1.readFile)(filePath);
    const compiled = compileTemplate(content);
    // Cache
    templateCache.set(filePath, compiled);
    return compiled;
}
/**
 * Render a template with data
 */
function renderTemplate(template, data) {
    return template(data);
}
/**
 * Load, compile and render a template in one go
 */
async function renderTemplateFile(filePath, data) {
    const template = await loadTemplate(filePath);
    return renderTemplate(template, data);
}
/**
 * Clear template cache
 */
function clearTemplateCache() {
    templateCache.clear();
}
// Register helpers on module load
registerHelpers();
//# sourceMappingURL=template.js.map