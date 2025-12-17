/**
 * Type definitions for FABER Event Gateway
 */
export const EventTypes = [
    "workflow_start",
    "workflow_complete",
    "workflow_error",
    "workflow_cancelled",
    "workflow_resumed",
    "workflow_rerun",
    "phase_start",
    "phase_skip",
    "phase_complete",
    "phase_error",
    "step_start",
    "step_complete",
    "step_error",
    "step_retry",
    "artifact_create",
    "artifact_modify",
    "commit_create",
    "branch_create",
    "pr_create",
    "pr_merge",
    "spec_generate",
    "spec_validate",
    "test_run",
    "docs_update",
    "checkpoint",
    "skill_invoke",
    "agent_invoke",
    "decision_point",
    "retry_loop_enter",
    "retry_loop_exit",
    "approval_request",
    "approval_granted",
    "approval_denied",
    "hook_execute",
];
export const Phases = [
    "frame",
    "architect",
    "build",
    "evaluate",
    "release",
];
export const EventStatuses = [
    "started",
    "completed",
    "failed",
    "skipped",
    "pending",
    "cancelled",
];
export const RunStatuses = [
    "pending",
    "in_progress",
    "completed",
    "failed",
    "cancelled",
];
//# sourceMappingURL=types.js.map