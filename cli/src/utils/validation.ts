/**
 * FABER CLI - Input Validation Utilities
 *
 * Common validation functions for CLI inputs
 */

/**
 * Parse and validate an integer string
 * @param value - String value to parse
 * @param fieldName - Field name for error messages
 * @returns Validated integer
 * @throws Error if value is not a valid integer
 */
export function parseValidInteger(value: string, fieldName: string): number {
  const parsed = parseInt(value, 10);

  if (isNaN(parsed)) {
    throw new Error(`Invalid ${fieldName}: "${value}" is not a valid integer`);
  }

  if (!Number.isFinite(parsed)) {
    throw new Error(`Invalid ${fieldName}: value is not finite`);
  }

  return parsed;
}

/**
 * Parse and validate an optional integer string
 * @param value - String value to parse (may be undefined)
 * @param fieldName - Field name for error messages
 * @returns Validated integer or undefined
 * @throws Error if value is provided but not a valid integer
 */
export function parseOptionalInteger(value: string | undefined, fieldName: string): number | undefined {
  if (!value) {
    return undefined;
  }

  return parseValidInteger(value, fieldName);
}

/**
 * Parse and validate a positive integer string
 * @param value - String value to parse
 * @param fieldName - Field name for error messages
 * @returns Validated positive integer
 * @throws Error if value is not a valid positive integer
 */
export function parsePositiveInteger(value: string, fieldName: string): number {
  const parsed = parseValidInteger(value, fieldName);

  if (parsed <= 0) {
    throw new Error(`Invalid ${fieldName}: must be a positive integer (got ${parsed})`);
  }

  return parsed;
}
