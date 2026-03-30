# FABER Workflow Runner — Phase 1 Initialization Details

This document contains the full initialization protocol. Read it at the start of Phase 1.
After reading, execute the steps below in order.

---

## Bootstrap Task List

Initialize before any work begins so all steps are visible:

```javascript
const bootstrapTaskIds = {};
const bootstrapSteps = [
  { key: "resolve-plan",  subject: "Resolve plan ID", activeForm: "Resolving plan ID" },
  { key: "validate-plan", subject: "Validate plan", activeForm: "Validating plan" },
  { key: "load-protocol", subject: "Load orchestration protocol", activeForm: "Loading orchestration protocol" },
  { key: "load-plan",     subject: "Load plan and initialize state", activeForm: "Loading plan and initializing state" },
  { key: "track-workflow",subject: "Track active workflow", activeForm: "Tracking active workflow" },
  { key: "init-steps",    subject: "Initialize workflow steps", activeForm: "Initializing workflow steps" }
];
for (const step of bootstrapSteps) {
  const task = await TaskCreate({ subject: step.subject, description: step.subject, activeForm: step.activeForm });
  bootstrapTaskIds[step.key] = task.taskId;
}
```

Update each bootstrap task to `in_progress` → `completed` as its step executes.

---

## Step 1.1: Parse Arguments and Resolve Plan ID

```javascript
const raw = "$ARGUMENTS";
const tokens = raw.trim().split(/\s+/).filter(Boolean);
const args = [];
const flags = {};
for (let i = 0; i < tokens.length; i++) {
  if (tokens[i].startsWith('--')) {
    const flag = tokens[i];
    if (['--force-new', '--worktree', '--resume-batch'].includes(flag)) {
      flags[flag] = true;
    } else if (i + 1 < tokens.length && !tokens[i + 1].startsWith('--')) {
      flags[flag] = tokens[++i];
    } else {
      flags[flag] = true;
    }
  } else {
    args.push(tokens[i]);
  }
}

const arg = args[0] || null;
const resume_run_id = flags['--resume'] || null;
const force_new = !!flags['--force-new'];
const phase_filter = flags['--phase'] || null;
const step_filter = flags['--step'] || null;
const auto_worktree = !!flags['--worktree'];
const resume_batch = !!flags['--resume-batch'];
const workflow_override = flags['--workflow'] || null;
const autonomy_override = flags['--autonomy'] || null;
```

**Resolve plan_id from argument:**

```javascript
let plan_id;
if (!arg) {
  console.error("Error: Missing required argument: <work-id|plan-id>");
  return;
}

if (/^\d+$/.test(arg)) {
  const work_id = arg;
  const issueResult = await Skill({ skill: "fractary-repo-issue-fetch", args: `--ids ${work_id} --format json` });
  const issueData = JSON.parse(issueResult);
  if (!issueData.success || !issueData.issues?.length) {
    console.error(`Error: Issue #${work_id} not found`);
    return;
  }
  const issue = issueData.issues[0];
  plan_id = extractPlanIdFromIssue(issue);

  if (!plan_id) {
    console.log(`→ No existing plan for #${work_id}. Auto-planning...`);
    let plannerPrompt = `${work_id} --auto-run --force-new`;
    if (workflow_override) plannerPrompt += ` --workflow ${workflow_override}`;
    if (autonomy_override) plannerPrompt += ` --autonomy ${autonomy_override}`;
    const planResult = await Agent({
      subagent_type: "fractary-faber-workflow-planner",
      description: `Auto-plan for #${work_id}`,
      prompt: plannerPrompt
    });
    // Extract plan_id from planner output (format: "plan_id: <id>")
    const match = planResult.match(/plan_id:\s*(\S+)/);
    if (!match) { console.error("Error: Auto-planning failed"); return; }
    plan_id = match[1];
  }
} else {
  plan_id = arg;
}

// Helper: extract plan_id from issue comments or body
function extractPlanIdFromIssue(issue) {
  const patterns = [
    /\*\*Plan ID[:\*]*\*?\s*`([^`]+)`/,
    /🤖\s*(?:\*\*)?Workflow [Pp]lan [Cc]reated(?:\*\*)?\s*:\s*(\S+)/,
    /🤖 Workflow plan created: (\S+)/
  ];
  function findPlanId(text) {
    if (!text) return null;
    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match) return match[1];
    }
    return null;
  }
  if (issue.comments) {
    for (let i = issue.comments.length - 1; i >= 0; i--) {
      const planId = findPlanId(issue.comments[i].body);
      if (planId) return planId;
    }
  }
  return findPlanId(issue.body || issue.description);
}
```

**Validation:**
- Plan file must exist at `.fractary/faber/runs/{plan_id}/plan.json`
- Cannot specify both `--phase` and `--step` simultaneously

**Filter processing:**
```javascript
const phaseFilter = phase_filter ? phase_filter.split(',').map(p => p.trim()) : null;
const stepFilter = step_filter ? step_filter.split(',').map(s => s.trim()) : null;
if (phaseFilter && stepFilter) { console.error("Error: Cannot specify both --phase and --step"); return; }
```

---

## Step 1.2: Load Orchestration Protocol

YOU MUST READ THE ORCHESTRATION PROTOCOL INTO YOUR CONTEXT. It is your operating manual.

```bash
PROTOCOL_FILE=$(bash -c '
  for candidate in \
    "$HOME/.pi/agent/git/github.com/fractary/faber/plugins/faber/scripts/find-plugin-root.sh" \
    "$(find "$PWD" -maxdepth 5 -path "*/.pi/git/github.com/fractary/faber/plugins/faber/scripts/find-plugin-root.sh" 2>/dev/null | head -1)" \
    "${CLAUDE_MARKETPLACE_ROOT:+${CLAUDE_MARKETPLACE_ROOT}/fractary-faber/plugins/faber/scripts/find-plugin-root.sh}" \
    "$HOME/.claude/plugins/marketplaces/fractary-faber/plugins/faber/scripts/find-plugin-root.sh"; do
    if [[ -f "$candidate" ]]; then source "$candidate"
      echo "${FRACTARY_PACKAGE_ROOT}/plugins/faber/docs/workflow-orchestration-protocol.md"
      exit 0
    fi
  done
  echo "ERROR: Cannot locate fractary/faber package" >&2; exit 1
')
Read(file_path: "${PROTOCOL_FILE}")
```

The protocol contains: core principles, execution loop, state management, event emission, all 4 guards, result handling, retry logic, autonomy gates.

---

## Step 1.3: Load Plan and Initialize State

```javascript
const planPath = `.fractary/faber/runs/${plan_id}/plan.json`;
const planContent = await Read({ file_path: planPath });
const fullPlan = JSON.parse(planContent);
const workflow = fullPlan.workflow;
const workItems = fullPlan.items;
const autonomy = fullPlan.autonomy || "guarded";
const work_id = workItems.length === 1 ? workItems[0].work_id : null;
const source_id = work_id;

// Compute state path
function getStatePath(runId) {
  const runMarker = '-run-';
  const idx = runId.lastIndexOf(runMarker);
  if (idx === -1) throw new Error(`Invalid run_id: ${runId}`);
  const planId = runId.substring(0, idx);
  const suffix = runId.substring(idx + runMarker.length);
  return `.fractary/faber/runs/${planId}/state-${suffix}.json`;
}

// Auto-resume detection (if --resume not explicit and --force-new not set)
if (!resume_run_id && !force_new) {
  const planDir = `.fractary/faber/runs/${plan_id}`;
  const stateFiles = await Glob({ pattern: `${planDir}/state-*.json` });
  const incompleteRuns = [];
  for (const statePath of stateFiles) {
    try {
      const state = JSON.parse(await Read({ file_path: statePath }));
      if (state.status === "in_progress" || state.status === "failed") incompleteRuns.push(state);
    } catch { continue; }
  }
  if (incompleteRuns.length > 0) {
    incompleteRuns.sort((a, b) => new Date(b.started_at) - new Date(a.started_at));
    resume_run_id = incompleteRuns[0].run_id;
    console.log(`✓ Auto-resuming run: ${resume_run_id}`);
  }
}

// If resuming:
let runId, statePath, state;
if (resume_run_id) {
  runId = resume_run_id;
  statePath = getStatePath(runId);
  state = JSON.parse(await Read({ file_path: statePath }));
  // Restore workflow from state if saved
  // Set eventRunId for MCP event routing
  const eventRunId = `${plan_id}/${runId.split('-run-')[1]}`;
  console.log(`✓ Resuming run: ${runId}`);
} else {
  // New run
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5) + 'Z';
  runId = `${plan_id}-run-${timestamp}`;
  statePath = getStatePath(runId);
  const eventRunId = `${plan_id}/${timestamp}`;

  const initialState = {
    run_id: runId,
    plan_id: plan_id,
    work_id: work_id,
    workflow_id: workflow.id,
    status: "in_progress",
    current_phase: null,
    current_step_id: null,
    phases: {},
    steps_completed: [],
    artifacts: {},
    started_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };

  // Initialize phases in state
  for (const phaseName of Object.keys(workflow.phases)) {
    initialState.phases[phaseName] = { status: "pending", steps: {}, retry_count: 0 };
    const phaseSteps = workflow.phases[phaseName].steps || [];
    for (const step of phaseSteps) {
      initialState.phases[phaseName].steps[step.id] = { status: "pending" };
    }
  }

  // Create run directory sentinel
  await Write({ file_path: `.fractary/faber/runs/${plan_id}/.run-${timestamp}`, content: "1" });
  await Write({ file_path: statePath, content: JSON.stringify(initialState, null, 2) });
  state = initialState;
  console.log(`✓ State initialized: ${statePath}`);
}
```

---

## Step 1.4: Track Active Workflow

```javascript
const activeRunIdPath = `.fractary/faber/runs/.active-run-id`;
let existingRunId = null;
try { existingRunId = (await Read({ file_path: activeRunIdPath })).trim(); } catch {}

if (existingRunId && existingRunId !== runId) {
  if (batch_mode) {
    console.log(`→ Batch mode: switching active workflow from ${existingRunId} to ${runId}`);
  } else {
    // Show conflict warning and ask user (or auto-create worktree if --worktree flag set)
    // See SKILL.md CRITICAL_RULES for worktree conflict handling details
    console.warn(`⚠️  Active workflow conflict: ${existingRunId}`);
    if (auto_worktree) {
      console.log("→ --worktree: Use CLI to create worktree: faber plan --work-id <id>");
      throw new Error("Use CLI for worktree creation");
    }
    const answer = await AskUserQuestion({ questions: [{ question: "Active workflow conflict. Take over this worktree?", options: [{ label: "Take over" }, { label: "Cancel" }] }] });
    if (answer.answers["0"] === "Cancel") throw new Error("User cancelled due to active workflow conflict");
  }
}

await Write({ file_path: activeRunIdPath, content: runId });
console.log(`✓ Active workflow tracked: ${runId}`);
```

---

## Step 1.4b: Post Workflow Start Comment

```javascript
if (work_id) {
  try {
    const enabledPhases = Object.keys(workflow.phases).filter(p => workflow.phases[p].enabled !== false).join(" → ");
    await Skill({
      skill: "fractary-work-issue-comment",
      args: `${work_id} --body "🚀 **FABER Workflow Started**\n\n**Run ID:** \`${runId}\`\n**Workflow:** \`${workflow.id}\`\n**Autonomy:** ${autonomy}\n**Phases:** ${enabledPhases}"`
    });
  } catch (error) { console.warn(`⚠️  Could not post start comment: ${error.message}`); }
}
```

---

## Step 1.5: Load MCP Event Tool

```javascript
await MCPSearch({ query: "select:fractary_faber_event_emit" });
await fractary_faber_event_emit({
  run_id: eventRunId,
  type: "workflow_start",
  metadata: { plan_id, run_id: runId, workflow_id: workflow.id, work_id }
});
console.log("✓ Event system ready");
```

---

## Step 1.6: Apply Phase/Step Filters

```javascript
if (phaseFilter) {
  for (const phaseName of Object.keys(workflow.phases)) {
    if (!phaseFilter.includes(phaseName)) workflow.phases[phaseName].enabled = false;
  }
}
if (stepFilter) {
  // Validate step IDs exist, then filter steps array
  for (const phaseName of Object.keys(workflow.phases)) {
    const phase = workflow.phases[phaseName];
    if (!phase.enabled) continue;
    phase.steps = (phase.steps || []).filter(s => stepFilter.includes(s.id));
    if (phase.steps.length === 0) phase.enabled = false;
  }
}
```

---

## Step 1.7: Initialize Workflow Step Tasks

```javascript
const stepTaskIds = {}; // map: "phase:step_id" → taskId
let stepCount = 0;
for (const phaseName of Object.keys(workflow.phases)) {
  const phase = workflow.phases[phaseName];
  if (phase.enabled === false) continue;
  for (const step of (phase.steps || [])) {
    const task = await TaskCreate({
      subject: `[${phaseName}] ${step.name} (${step.id})`,
      description: step.description || step.name,
      activeForm: `Executing [${phaseName}] ${step.name}`,
      metadata: { faberKey: `${phaseName}:${step.id}` }
    });
    stepTaskIds[`${phaseName}:${step.id}`] = task.taskId;
    stepCount++;
  }
}
await TaskUpdate({ taskId: bootstrapTaskIds["init-steps"], status: "completed" });
console.log(`✓ Progress tracking initialized. Total steps: ${stepCount}`);
```

The `metadata.faberKey` field enables reliable task ID map reconstruction after context compaction.

---

## Step 1.7b: Validate Step ID Prefix Convention

```javascript
try {
  const prefixResult = await Bash({
    command: `bash plugins/faber/skills/fractary-faber-run-manager/scripts/validate-plan-step-ids.sh --plan-file "${planPath}"`
  });
  if (prefixResult.exitCode !== 0) {
    console.warn(`⚠️  STEP ID PREFIX VIOLATIONS: ${prefixResult.stdout}`);
    console.warn(`Steps with wrong prefix will be silently skipped by prefix-based orchestrators. Iterate plan.json directly.`);
  } else {
    console.log("✓ Step ID prefix convention validated");
  }
} catch (e) { console.warn(`⚠️  Step ID validation skipped: ${e.message}`); }
```

> **GIT-REVERSION WARNING:** Active state files live in the git-tracked tree. A `git pull` during an active workflow can silently revert state. If you run `git pull` mid-workflow: run `validate-state-integrity.sh --run-id <run-id>` to verify state vs event log before continuing.
