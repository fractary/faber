/**
 * Validation utilities
 */
import { z } from 'zod';
import { ValidationError, ValidationResult } from '../types';
/**
 * Validate data against a Zod schema
 */
export declare function validateSchema<T>(data: unknown, schema: z.ZodSchema<T>): {
    success: boolean;
    data?: T;
    errors?: ValidationError[];
};
/**
 * Create a validation result
 */
export declare function createValidationResult(valid: boolean, errors?: ValidationError[], warnings?: any[]): ValidationResult;
/**
 * Validate a concept name
 */
export declare function validateConceptName(name: string): boolean;
/**
 * Validate a platform name
 */
export declare function validatePlatformName(name: string): boolean;
/**
 * Validate a file path
 */
export declare function validateFilePath(filePath: string): boolean;
/**
 * Validate an email
 */
export declare function validateEmail(email: string): boolean;
/**
 * Validate a URL
 */
export declare function validateUrl(url: string): boolean;
/**
 * Validate semantic version
 */
export declare function validateSemver(version: string): boolean;
//# sourceMappingURL=validation.d.ts.map