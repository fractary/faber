/**
 * @fractary/faber - Step Response
 *
 * A step reports its result in a FABER response block: the last JSON object
 * with a `status` field in its output, bare or in a code fence.
 *
 *   {"status": "failure", "message": "3 tests failed", "errors": ["..."]}
 *
 * In CLI-native execution this block decides the step's status, so a step or
 * validator that reports failure is handled by `on_failure`. The schema is
 * plugins/faber/config/schemas/skill-response.schema.json.
 */

import { z } from 'zod';
import type { ExecutorResult } from './types.js';

/** Provider name that shell command steps (`!` prefix) report */
const COMMAND_PROVIDER = 'command';

const RESPONSE_STATUSES = ['success', 'warning', 'failure'] as const;

/** FABER response block, as defined by skill-response.schema.json */
export const StepResponseSchema = z
  .object({
    status: z.enum(RESPONSE_STATUSES),
    message: z.string().min(1).max(500),
    details: z.record(z.unknown()).optional(),
    errors: z.array(z.string().min(1)).optional(),
    warnings: z.array(z.string().min(1)).optional(),
    error_analysis: z.string().max(2000).optional(),
    warning_analysis: z.string().max(2000).optional(),
    suggested_fixes: z.array(z.string().min(1)).optional(),
  })
  .strict()
  .refine((r) => r.status !== 'failure' || (r.errors?.length ?? 0) > 0, {
    message: 'errors is required when status is failure',
    path: ['errors'],
  })
  .refine((r) => r.status !== 'warning' || (r.warnings?.length ?? 0) > 0, {
    message: 'warnings is required when status is warning',
    path: ['warnings'],
  });

export type StepResponse = z.infer<typeof StepResponseSchema>;

/** Why a step's status did not come from a valid response block */
export type StepResponseReason = 'no_response_block' | 'invalid_response_block' | 'pending_input';

export interface StepResponseOptions {
  /** The step is a validator: without a valid response block it fails instead of warning */
  requireResponse?: boolean;
}

/**
 * Find the response block in a step's output: the last top-level JSON object
 * with a string `status` field.
 * @returns The block, or null if the output has none
 */
export function findResponseBlock(output: string): Record<string, unknown> | null {
  let block: Record<string, unknown> | null = null;
  let start = output.indexOf('{');
  while (start !== -1) {
    const end = findClosingBrace(output, start);
    const value = end === -1 ? undefined : parseJsonObject(output.slice(start, end + 1));
    if (value) {
      if (typeof value.status === 'string') block = value;
      start = output.indexOf('{', end + 1);
    } else {
      start = output.indexOf('{', start + 1);
    }
  }
  return block;
}

/**
 * Set a step's status from the response block in its output.
 *
 * - Shell command steps keep the status of their exit code.
 * - A step its executor could not run stays failed.
 * - A valid block decides the status. `pending_input` fails, because a CLI run
 *   cannot answer. A block that breaks the schema in other ways keeps its status,
 *   and the problems are listed in `response_issues`.
 * - Without a valid block the step warns, or fails when `requireResponse` is set.
 */
export function applyStepResponse(result: ExecutorResult, options: StepResponseOptions = {}): ExecutorResult {
  if (result.metadata.provider === COMMAND_PROVIDER || result.status === 'failure') {
    return result;
  }

  const block = findResponseBlock(result.output);
  const status = typeof block?.status === 'string' ? block.status.toLowerCase() : undefined;

  if (block && status === 'pending_input') {
    return {
      ...result,
      status: 'failure',
      reason: 'pending_input',
      error: `Step is waiting for input, which a CLI run cannot provide${messageSuffix(block)}`,
    };
  }

  if (!block || !isResponseStatus(status)) {
    const reason: StepResponseReason = block ? 'invalid_response_block' : 'no_response_block';
    if (!options.requireResponse) {
      return { ...result, status: 'warning', reason };
    }
    const found = block ? `a response block with invalid status "${String(block.status)}"` : 'no FABER response block';
    return { ...result, status: 'failure', reason, error: `Validator step returned ${found}` };
  }

  const parsed = StepResponseSchema.safeParse({ ...block, status });
  return {
    ...result,
    status,
    error: status === 'failure' ? failureMessage(block) : undefined,
    ...(parsed.success
      ? { response: parsed.data }
      : { response_issues: parsed.error.issues.map((i) => `${i.path.join('.') || 'response'}: ${i.message}`) }),
  };
}

function isResponseStatus(status: string | undefined): status is StepResponse['status'] {
  return (RESPONSE_STATUSES as readonly string[]).includes(status ?? '');
}

function failureMessage(block: Record<string, unknown>): string {
  const errors = Array.isArray(block.errors) ? block.errors.filter((e): e is string => typeof e === 'string') : [];
  if (errors.length > 0) return errors.join('; ');
  return typeof block.message === 'string' && block.message ? block.message : 'Step reported failure';
}

function messageSuffix(block: Record<string, unknown>): string {
  return typeof block.message === 'string' && block.message ? `: ${block.message}` : '';
}

/** Index of the brace that closes the object opened at `start`, or -1 */
function findClosingBrace(text: string, start: number): number {
  let depth = 0;
  let inString = false;
  for (let i = start; i < text.length; i++) {
    const ch = text[i];
    if (inString) {
      if (ch === '\\') i++;
      else if (ch === '"') inString = false;
    } else if (ch === '"') {
      inString = true;
    } else if (ch === '{') {
      depth++;
    } else if (ch === '}' && --depth === 0) {
      return i;
    }
  }
  return -1;
}

function parseJsonObject(text: string): Record<string, unknown> | undefined {
  try {
    const value: unknown = JSON.parse(text);
    return value !== null && typeof value === 'object' && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : undefined;
  } catch {
    return undefined;
  }
}
