/**
 * Validation utilities
 */

import { z } from 'zod';
import { ValidationError, ValidationResult } from '../types';

/**
 * Validate data against a Zod schema
 */
export function validateSchema<T>(
  data: unknown,
  schema: z.ZodSchema<T>
): { success: boolean; data?: T; errors?: ValidationError[] } {
  try {
    const validated = schema.parse(data);
    return { success: true, data: validated };
  } catch (error) {
    if (error instanceof z.ZodError) {
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
export function createValidationResult(
  valid: boolean,
  errors: ValidationError[] = [],
  warnings: any[] = []
): ValidationResult {
  return {
    valid,
    errors,
    warnings
  };
}

/**
 * Validate a concept name
 */
export function validateConceptName(name: string): boolean {
  // Must be kebab-case, alphanumeric with hyphens
  const pattern = /^[a-z0-9]+(-[a-z0-9]+)*$/;
  return pattern.test(name);
}

/**
 * Validate a platform name
 */
export function validatePlatformName(name: string): boolean {
  // Must be lowercase alphanumeric with optional hyphens
  const pattern = /^[a-z0-9]+(-[a-z0-9]+)*$/;
  return pattern.test(name);
}

/**
 * Validate a file path
 */
export function validateFilePath(filePath: string): boolean {
  // Basic validation - no null bytes, must not be empty
  return filePath.length > 0 && !filePath.includes('\0');
}

/**
 * Validate an email
 */
export function validateEmail(email: string): boolean {
  const pattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return pattern.test(email);
}

/**
 * Validate a URL
 */
export function validateUrl(url: string): boolean {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
}

/**
 * Validate semantic version
 */
export function validateSemver(version: string): boolean {
  const pattern = /^\d+\.\d+\.\d+(-[a-z0-9.]+)?(\+[a-z0-9.]+)?$/i;
  return pattern.test(version);
}