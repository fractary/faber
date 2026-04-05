# FABER Workflow Runner — Phase 4 Finalization

Phase 4 runs after workflow `status` is set to `"completed"`. These steps are NOT tracked in the state file (the workflow is already complete). They ARE tracked via progress entries for visibility. All steps are wrapped in try/catch — failures are non-fatal.

---

## Register Phase 4 Progress Tracking

Create progress tracking entries for each finalization step:
1. Plan Adherence Report
2. Execute post_workflow hooks
3. Final cleanup commit & push
4. Final PR merge & branch cleanup
5. Close GitHub issue

---

## Step 4.1: Plan Adherence Report

```
try {
  Mark "Plan Adherence Report" as in_progress
  Run: bash plugins/faber/skills/fractary-faber-run-manager/scripts/verify-plan-adherence.sh \
    --run-id "{runId}" --base-path ".fractary/faber/runs" --format markdown

  IF source_id exists:
    Invoke the fractary-work-issue-comment skill to post the adherence report to issue #{source_id}

  Mark "Plan Adherence Report" as completed
} catch {
  WARN "⚠️  Plan adherence report failed (non-fatal)"
  Mark "Plan Adherence Report" as completed
}
```

---

## Step 4.2: Execute post_workflow Hooks

```
try {
  Mark "Execute post_workflow hooks" as in_progress
  Invoke the fractary-faber-faber-hooks skill with:
    operation: "execute-all"
    boundary: "post_workflow"
    context_json: { work_id, run_id: runId, source_id }
    continue_on_error: true

  Mark "Execute post_workflow hooks" as completed
} catch {
  WARN "⚠️  post_workflow hooks failed (non-fatal)"
  Mark "Execute post_workflow hooks" as completed
}
```

---

## Step 4.3: Final Cleanup Commit & Push

```
hasCleanupChanges = false
try {
  Mark "Final cleanup commit & push" as in_progress
  // Force-add state file (gitignored during active run; committed only at completion)
  Run: git add -f "{statePath}" 2>/dev/null || true
  Run: git add .fractary/ 2>/dev/null || true
  Run: git add .claude/ 2>/dev/null || true

  Check if there are staged changes (git diff --cached --quiet)
  hasCleanupChanges = (exit code != 0)

  IF hasCleanupChanges:
    Run: git commit -m "chore: post-workflow cleanup [{work_id || runId}]"
    Run: git push origin {current_branch}
    LOG "✓ Cleanup committed and pushed"

  Mark "Final cleanup commit & push" as completed
} catch {
  WARN "⚠️  Final cleanup commit failed (non-fatal)"
  Mark "Final cleanup commit & push" as completed
}
```

---

## Step 4.4: Final PR Merge & Branch Cleanup

```
try {
  Mark "Final PR merge & branch cleanup" as in_progress
  IF hasCleanupChanges:
    Get current branch name
    Check for existing PR on this branch: gh pr list --head "{currentBranch}" --json number,state

    IF open PR exists:
      Run: gh pr merge {pr.number} --squash --delete-branch
    ELSE:
      Create new PR: gh pr create --base main --title "chore: post-workflow finalization [{work_id || runId}]" --body "Automated cleanup.\n\nRun ID: {runId}"
      Then merge it: gh pr merge {pr_number} --squash --delete-branch

  Mark "Final PR merge & branch cleanup" as completed
} catch {
  WARN "⚠️  Final PR merge failed (non-fatal)"
  Mark "Final PR merge & branch cleanup" as completed
}
```

---

## Step 4.5: Close Issue

```
try {
  Mark "Close GitHub issue" as in_progress
  IF source_id exists:
    Check issue state: gh issue view {source_id} --json state --jq '.state'
    IF state == "OPEN":
      Run: gh issue close {source_id} --comment "✅ **Workflow completed successfully**\n\nRun ID: `{runId}`\n\n🤖 Closed by FABER post-workflow finalization"
      LOG "✓ Issue #{source_id} closed"
    ELSE:
      LOG "✓ Issue #{source_id} already closed"

  Mark "Close GitHub issue" as completed
} catch {
  WARN "⚠️  Issue close failed (non-fatal)"
  Mark "Close GitHub issue" as completed
}

LOG "═══════════════════════════════════════════════════════════"
LOG "  POST-WORKFLOW FINALIZATION COMPLETE"
LOG "═══════════════════════════════════════════════════════════"
```

---

## Failure Path: Minimal Finalization

Even on failure, commit lingering state and event files:

```
try {
  Create a progress entry: "Cleanup commit of state/event files (failure path)"
  Mark it as in_progress
  Run: git add .fractary/ .claude/ 2>/dev/null || true
  Check if there are staged changes
  IF changes exist:
    Run: git commit -m "chore: post-workflow cleanup (failed) [{work_id || runId}]"
    Run: git push origin {current_branch}
  Mark it as completed
} catch {
  WARN "⚠️  Failure cleanup commit failed (non-fatal)"
}
```
