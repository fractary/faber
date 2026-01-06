/**
 * SDK Type Adapter
 *
 * Converts between @fractary/core SDK types and FABER CLI types
 */

import type { Issue as SDKIssue, Worktree as SDKWorktree } from '@fractary/core';

// CLI types (defined in repo-client.ts)
interface CLIIssue {
  id: string;
  number: number;
  title: string;
  description: string;
  labels: string[];
  url: string;
  state: string;
}

interface WorktreeResult {
  path: string;
  absolute_path: string;
  branch: string;
  created_at: string;
  organization: string;
  project: string;
  work_id: string;
}

/**
 * Convert SDK Issue to CLI Issue
 *
 * @param sdkIssue - Issue from @fractary/core SDK
 * @returns CLI Issue format
 */
export function sdkIssueToCLIIssue(sdkIssue: SDKIssue): CLIIssue {
  return {
    id: sdkIssue.id,
    number: sdkIssue.number,
    title: sdkIssue.title,
    description: sdkIssue.body, // Map 'body' to 'description'
    labels: sdkIssue.labels.map(label => label.name), // Extract label names
    url: sdkIssue.url,
    state: sdkIssue.state,
  };
}

/**
 * Convert SDK Worktree to CLI WorktreeResult
 *
 * @param sdkWorktree - Worktree from @fractary/core SDK
 * @param organization - GitHub organization
 * @param project - GitHub project/repo name
 * @param workId - Work/issue ID
 * @returns CLI WorktreeResult format
 */
export function sdkWorktreeToCLIWorktreeResult(
  sdkWorktree: SDKWorktree,
  organization: string,
  project: string,
  workId: string
): WorktreeResult {
  return {
    path: sdkWorktree.path,
    absolute_path: sdkWorktree.path, // SDK path is already absolute
    branch: sdkWorktree.branch || '',
    created_at: new Date().toISOString(),
    organization,
    project,
    work_id: workId,
  };
}
