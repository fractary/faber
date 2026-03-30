# FABER Workflow Runner — Phase 4 Finalization

Phase 4 runs after workflow `status` is set to `"completed"`. These steps are NOT tracked in the state file (the workflow is already complete). They ARE tracked via TaskCreate/TaskUpdate for visibility. All steps are wrapped in try/catch — failures are non-fatal.

---

## Register Phase 4 Tasks

```javascript
const finalizeTaskIds = {};
const finalizeSteps = [
  { key: "adherence",   subject: "Plan Adherence Report" },
  { key: "hooks",       subject: "Execute post_workflow hooks" },
  { key: "commit-push", subject: "Final cleanup commit & push" },
  { key: "pr-merge",    subject: "Final PR merge & branch cleanup" },
  { key: "close-issue", subject: "Close GitHub issue" }
];
for (const step of finalizeSteps) {
  const task = await TaskCreate({ subject: step.subject, description: step.subject });
  finalizeTaskIds[step.key] = task.taskId;
}
```

---

## Step 4.1: Plan Adherence Report

```javascript
try {
  await TaskUpdate({ taskId: finalizeTaskIds["adherence"], status: "in_progress" });
  const adherenceResult = await Bash({
    command: `bash plugins/faber/skills/fractary-faber-run-manager/scripts/verify-plan-adherence.sh --run-id "${runId}" --base-path ".fractary/faber/runs" --format markdown`
  });
  if (source_id) {
    await Skill({ skill: "fractary-work-issue-comment", args: `${source_id} --context "Post the following plan adherence report:\n${adherenceResult.stdout}"` });
  }
  await TaskUpdate({ taskId: finalizeTaskIds["adherence"], status: "completed" });
} catch (e) {
  console.warn("⚠️  Plan adherence report failed (non-fatal):", e.message);
  await TaskUpdate({ taskId: finalizeTaskIds["adherence"], status: "completed" });
}
```

---

## Step 4.2: Execute post_workflow Hooks

```javascript
try {
  await TaskUpdate({ taskId: finalizeTaskIds["hooks"], status: "in_progress" });
  await Skill({
    skill: "fractary-faber-faber-hooks",
    args: JSON.stringify({ operation: "execute-all", boundary: "post_workflow", context_json: { work_id, run_id: runId, source_id }, continue_on_error: true })
  });
  await TaskUpdate({ taskId: finalizeTaskIds["hooks"], status: "completed" });
} catch (e) {
  console.warn("⚠️  post_workflow hooks failed (non-fatal):", e.message);
  await TaskUpdate({ taskId: finalizeTaskIds["hooks"], status: "completed" });
}
```

---

## Step 4.3: Final Cleanup Commit & Push

```javascript
let hasCleanupChanges = false;
try {
  await TaskUpdate({ taskId: finalizeTaskIds["commit-push"], status: "in_progress" });
  // Force-add state file (gitignored during active run; committed only at completion)
  await Bash({ command: `git add -f "${statePath}" 2>/dev/null || true` });
  await Bash({ command: `git add .fractary/ 2>/dev/null || true` });
  await Bash({ command: `git add .claude/ 2>/dev/null || true` });

  const diffResult = await Bash({ command: `git diff --cached --quiet 2>/dev/null; echo $?` });
  hasCleanupChanges = diffResult.stdout.trim() !== "0";

  if (hasCleanupChanges) {
    await Bash({ command: `git commit -m "chore: post-workflow cleanup [${work_id || runId}]"` });
    const branchResult = await Bash({ command: `git branch --show-current` });
    await Bash({ command: `git push origin ${branchResult.stdout.trim()}` });
    console.log("✓ Cleanup committed and pushed");
  }
  await TaskUpdate({ taskId: finalizeTaskIds["commit-push"], status: "completed" });
} catch (e) {
  console.warn("⚠️  Final cleanup commit failed (non-fatal):", e.message);
  await TaskUpdate({ taskId: finalizeTaskIds["commit-push"], status: "completed" });
}
```

---

## Step 4.4: Final PR Merge & Branch Cleanup

```javascript
try {
  await TaskUpdate({ taskId: finalizeTaskIds["pr-merge"], status: "in_progress" });
  if (hasCleanupChanges) {
    const branchResult = await Bash({ command: `git branch --show-current` });
    const currentBranch = branchResult.stdout.trim();
    const prListResult = await Bash({ command: `gh pr list --head "${currentBranch}" --json number,state --jq '.[0]' 2>/dev/null || echo '{}'` });
    const prInfo = prListResult.stdout.trim();

    if (prInfo && prInfo !== '{}') {
      const pr = JSON.parse(prInfo);
      if (pr.state === "OPEN") {
        await Bash({ command: `gh pr merge ${pr.number} --squash --delete-branch` });
      } else {
        await Bash({ command: `gh pr create --base main --title "chore: post-workflow finalization [${work_id || runId}]" --body "Automated cleanup.\n\nRun ID: ${runId}"` });
        const newPr = await Bash({ command: `gh pr list --head "${currentBranch}" --json number --jq '.[0].number'` });
        if (newPr.stdout.trim()) await Bash({ command: `gh pr merge ${newPr.stdout.trim()} --squash --delete-branch` });
      }
    } else {
      await Bash({ command: `gh pr create --base main --title "chore: post-workflow finalization [${work_id || runId}]" --body "Automated cleanup.\n\nRun ID: ${runId}"` });
      const newPr = await Bash({ command: `gh pr list --head "${currentBranch}" --json number --jq '.[0].number'` });
      if (newPr.stdout.trim()) await Bash({ command: `gh pr merge ${newPr.stdout.trim()} --squash --delete-branch` });
    }
  }
  await TaskUpdate({ taskId: finalizeTaskIds["pr-merge"], status: "completed" });
} catch (e) {
  console.warn("⚠️  Final PR merge failed (non-fatal):", e.message);
  await TaskUpdate({ taskId: finalizeTaskIds["pr-merge"], status: "completed" });
}
```

---

## Step 4.5: Close Issue

```javascript
try {
  await TaskUpdate({ taskId: finalizeTaskIds["close-issue"], status: "in_progress" });
  if (source_id) {
    const issueStateResult = await Bash({ command: `gh issue view ${source_id} --json state --jq '.state' 2>/dev/null || echo 'UNKNOWN'` });
    const issueState = issueStateResult.stdout.trim();
    if (issueState === "OPEN") {
      await Bash({ command: `gh issue close ${source_id} --comment "✅ **Workflow completed successfully**\n\nRun ID: \`${runId}\`\n\n🤖 Closed by FABER post-workflow finalization"` });
      console.log(`✓ Issue #${source_id} closed`);
    } else {
      console.log(`✓ Issue #${source_id} already closed`);
    }
  }
  await TaskUpdate({ taskId: finalizeTaskIds["close-issue"], status: "completed" });
} catch (e) {
  console.warn("⚠️  Issue close failed (non-fatal):", e.message);
  await TaskUpdate({ taskId: finalizeTaskIds["close-issue"], status: "completed" });
}

console.log("\n═══════════════════════════════════════════════════════════");
console.log("  POST-WORKFLOW FINALIZATION COMPLETE");
console.log("═══════════════════════════════════════════════════════════");
```

---

## Failure Path: Minimal Finalization

Even on failure, commit lingering state and event files:

```javascript
try {
  const failureTask = await TaskCreate({ subject: "Cleanup commit of state/event files (failure path)" });
  await TaskUpdate({ taskId: failureTask.taskId, status: "in_progress" });
  await Bash({ command: `git add .fractary/ .claude/ 2>/dev/null || true` });
  const diff = await Bash({ command: `git diff --cached --quiet 2>/dev/null; echo $?` });
  if (diff.stdout.trim() !== "0") {
    await Bash({ command: `git commit -m "chore: post-workflow cleanup (failed) [${work_id || runId}]"` });
    const branch = await Bash({ command: `git branch --show-current` });
    await Bash({ command: `git push origin ${branch.stdout.trim()}` });
  }
  await TaskUpdate({ taskId: failureTask.taskId, status: "completed" });
} catch (e) {
  console.warn("⚠️  Failure cleanup commit failed (non-fatal):", e.message);
}
```
