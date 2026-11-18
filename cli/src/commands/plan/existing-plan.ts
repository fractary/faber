/**
 * Existing-plan detection for workflow-plan
 */

import fs from 'fs/promises';

/** The fields of a plan that name its work items */
interface PlanWorkItems {
  source?: { work_id?: unknown } | null;
  items?: unknown;
}

/**
 * Whether a work item's plan is already written at the path its plan would be written to.
 *
 * A plan is the work item's when its source or one of its items names the work ID.
 * Only this path is checked: the runs directory also holds the plans of other work
 * items, such as when run history is committed.
 *
 * @param planPath - Path the work item's plan.json would be written to
 * @param workId - The work item's ID
 * @returns true when the work item's plan exists, false when there is no plan at planPath
 * @throws Error when planPath holds a plan that cannot be read or belongs to another
 *   work item, since planning would write over it
 */
export async function hasExistingPlan(planPath: string, workId: string): Promise<boolean> {
  let content: string;
  try {
    content = await fs.readFile(planPath, 'utf8');
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return false;
    }
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Could not read the existing plan at ${planPath}: ${message}`);
  }

  let plan: PlanWorkItems | null;
  try {
    plan = JSON.parse(content);
  } catch {
    throw new Error(
      `The existing plan at ${planPath} is not valid JSON. Use --force-new to replace it`
    );
  }

  const items: Array<{ work_id?: unknown } | null> = Array.isArray(plan?.items) ? plan.items : [];
  const planWorkIds = [plan?.source?.work_id, ...items.map(item => item?.work_id)]
    .filter(id => id !== undefined && id !== null)
    .map(String);

  if (planWorkIds.includes(workId)) {
    return true;
  }

  const owner = planWorkIds.length > 0
    ? `work item ${[...new Set(planWorkIds)].join(', ')}`
    : 'no work item';
  throw new Error(
    `The existing plan at ${planPath} is for ${owner}, not ${workId}. Use --force-new to replace it`
  );
}
