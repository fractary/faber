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

/**
 * Validates work ID format
 * Work IDs must be numeric (GitHub issue numbers)
 *
 * @param workId - Work ID to validate
 * @returns True if valid
 * @throws Error if invalid
 */
export function validateWorkId(workId: string): boolean {
  // Work IDs must be numeric (1-8 digits for GitHub issue numbers)
  const workIdPattern = /^\d{1,8}$/;

  if (!workIdPattern.test(workId)) {
    throw new Error(
      `Invalid work ID format: "${workId}". Work IDs must be numeric (e.g., "123", "456").`
    );
  }

  return true;
}

/**
 * Validates multiple comma-separated work IDs
 *
 * @param workIds - Comma-separated work IDs
 * @returns Array of validated work IDs
 * @throws Error if any ID is invalid
 */
export function validateWorkIds(workIds: string): string[] {
  const ids = workIds.split(',').map(id => id.trim()).filter(Boolean);

  if (ids.length === 0) {
    throw new Error('No work IDs provided');
  }

  if (ids.length > 50) {
    throw new Error(
      `Too many work IDs (${ids.length}). Maximum is 50 to prevent API overload.`
    );
  }

  // Validate each ID
  ids.forEach(id => validateWorkId(id));

  return ids;
}

/**
 * Validates label format
 * Labels must be alphanumeric with hyphens, colons, and underscores only
 *
 * @param label - Label to validate
 * @returns True if valid
 * @throws Error if invalid
 */
export function validateLabel(label: string): boolean {
  // Labels: alphanumeric, hyphens, colons, underscores (GitHub label format)
  // Examples: "workflow:etl", "status:approved", "priority-high"
  const labelPattern = /^[a-zA-Z0-9_:-]{1,50}$/;

  if (!labelPattern.test(label)) {
    throw new Error(
      `Invalid label format: "${label}". Labels must be alphanumeric with hyphens, colons, or underscores (max 50 chars).`
    );
  }

  return true;
}

/**
 * Validates multiple comma-separated labels
 *
 * @param labels - Comma-separated labels
 * @returns Array of validated labels
 * @throws Error if any label is invalid
 */
export function validateLabels(labels: string): string[] {
  const labelArray = labels.split(',').map(l => l.trim()).filter(Boolean);

  if (labelArray.length === 0) {
    throw new Error('No labels provided');
  }

  if (labelArray.length > 20) {
    throw new Error(
      `Too many labels (${labelArray.length}). Maximum is 20.`
    );
  }

  // Validate each label
  labelArray.forEach(label => validateLabel(label));

  return labelArray;
}

/**
 * Validates workflow name format
 * Workflow names must be alphanumeric with hyphens and underscores
 *
 * @param workflowName - Workflow name to validate
 * @returns True if valid
 * @throws Error if invalid
 */
export function validateWorkflowName(workflowName: string): boolean {
  // Workflow names: alphanumeric, hyphens, underscores
  // Examples: "etl", "data-pipeline", "bugfix"
  const workflowPattern = /^[a-zA-Z0-9_-]{1,50}$/;

  if (!workflowPattern.test(workflowName)) {
    throw new Error(
      `Invalid workflow name: "${workflowName}". Workflow names must be alphanumeric with hyphens or underscores (max 50 chars).`
    );
  }

  return true;
}

/**
 * Validates and sanitizes file path to prevent path traversal
 * Ensures path doesn't contain dangerous patterns like ../, absolute paths, etc.
 *
 * @param filePath - File path to validate
 * @param baseDir - Base directory that path must be relative to (optional)
 * @returns Sanitized path
 * @throws Error if path is unsafe
 */
export function validateSafePath(filePath: string, baseDir?: string): string {
  // Remove any null bytes
  if (filePath.includes('\0')) {
    throw new Error('Path contains null bytes');
  }

  // Check for path traversal patterns
  const dangerousPatterns = [
    /\.\./,           // Parent directory (..)
    /^\//, // Absolute path
    /^[a-zA-Z]:\\/,   // Windows absolute path
    /^~\//,           // Home directory
  ];

  for (const pattern of dangerousPatterns) {
    if (pattern.test(filePath)) {
      throw new Error(
        `Unsafe path detected: "${filePath}". Paths must be relative and cannot contain "..", absolute paths, or home directory references.`
      );
    }
  }

  // Normalize path (remove redundant separators, etc.)
  const normalized = filePath.replace(/\/+/g, '/').replace(/\\/g, '/');

  // If base directory provided, ensure path starts with it
  if (baseDir) {
    const normalizedBase = baseDir.replace(/\/+$/, '');
    if (!normalized.startsWith(normalizedBase)) {
      throw new Error(
        `Path "${filePath}" must be within base directory "${baseDir}"`
      );
    }
  }

  return normalized;
}

/**
 * Validates JSON response size to prevent DoS attacks
 *
 * @param jsonString - JSON string to validate
 * @param maxSizeBytes - Maximum allowed size in bytes (default: 1MB)
 * @returns True if valid
 * @throws Error if too large
 */
export function validateJsonSize(jsonString: string, maxSizeBytes: number = 1024 * 1024): boolean {
  const sizeBytes = Buffer.byteLength(jsonString, 'utf8');

  if (sizeBytes > maxSizeBytes) {
    const sizeMB = (sizeBytes / 1024 / 1024).toFixed(2);
    const maxMB = (maxSizeBytes / 1024 / 1024).toFixed(2);
    throw new Error(
      `JSON response too large: ${sizeMB}MB (maximum: ${maxMB}MB). This may indicate an API error or DoS attempt.`
    );
  }

  return true;
}

/**
 * Slugify a string for use in identifiers (plan IDs, paths, etc.)
 * Converts to lowercase, replaces non-alphanumeric with hyphens, trims hyphens.
 *
 * @param input - String to slugify
 * @returns Slugified string (max 50 chars)
 */
export function slugify(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 50);
}

/**
 * Validates plan ID format
 * Plan IDs follow format: {org}-{project}-{work-id}
 * Also accepts legacy format with timestamp: {org}-{project}-{work-id}-{YYYYMMDD}-{HHMMSS}
 *
 * @param planId - Plan ID to validate
 * @returns True if valid
 * @throws Error if invalid
 */
export function validatePlanId(planId: string): boolean {
  // Accepts slug segments. The new format ends with a work-id (digits or slug).
  // Legacy format may end with -{8digits}-{6digits} timestamp suffix.
  // Only [a-z0-9-] allowed, which inherently prevents path traversal.
  const planIdPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*(?:-\d{8}-\d{6})?$/;

  if (!planIdPattern.test(planId)) {
    throw new Error(
      `Invalid plan ID format: "${planId}". Expected format: {org}-{project}-{work-id}`
    );
  }

  return true;
}
