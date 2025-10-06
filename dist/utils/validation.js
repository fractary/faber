"use strict";
/**
 * Validation utilities
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateSchema = validateSchema;
exports.createValidationResult = createValidationResult;
exports.validateConceptName = validateConceptName;
exports.validatePlatformName = validatePlatformName;
exports.validateFilePath = validateFilePath;
exports.validateEmail = validateEmail;
exports.validateUrl = validateUrl;
exports.validateSemver = validateSemver;
const zod_1 = require("zod");
/**
 * Validate data against a Zod schema
 */
function validateSchema(data, schema) {
    try {
        const validated = schema.parse(data);
        return { success: true, data: validated };
    }
    catch (error) {
        if (error instanceof zod_1.z.ZodError) {
            const errors = error.errors.map(e => ({
                path: e.path.join('.'),
                message: e.message,
                code: e.code
            }));
            return { success: false, errors };
        }
        throw error;
    }
}
/**
 * Create a validation result
 */
function createValidationResult(valid, errors = [], warnings = []) {
    return {
        valid,
        errors,
        warnings
    };
}
/**
 * Validate a concept name
 */
function validateConceptName(name) {
    // Must be kebab-case, alphanumeric with hyphens
    const pattern = /^[a-z0-9]+(-[a-z0-9]+)*$/;
    return pattern.test(name);
}
/**
 * Validate a platform name
 */
function validatePlatformName(name) {
    // Must be lowercase alphanumeric with optional hyphens
    const pattern = /^[a-z0-9]+(-[a-z0-9]+)*$/;
    return pattern.test(name);
}
/**
 * Validate a file path
 */
function validateFilePath(filePath) {
    // Basic validation - no null bytes, must not be empty
    return filePath.length > 0 && !filePath.includes('\0');
}
/**
 * Validate an email
 */
function validateEmail(email) {
    const pattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return pattern.test(email);
}
/**
 * Validate a URL
 */
function validateUrl(url) {
    try {
        new URL(url);
        return true;
    }
    catch {
        return false;
    }
}
/**
 * Validate semantic version
 */
function validateSemver(version) {
    const pattern = /^\d+\.\d+\.\d+(-[a-z0-9.]+)?(\+[a-z0-9.]+)?$/i;
    return pattern.test(version);
}
//# sourceMappingURL=validation.js.map