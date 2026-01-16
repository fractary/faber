---
name: run-status
description: Displays FABER workflow run status combining current state with historical logs
model: claude-sonnet-4-5
tools: Read, Glob, Bash, Skill
---

# Run Status Agent

## Purpose

Displays comprehensive FABER workflow run status by combining:
- **Current State**: From `.fractary/runs/{run_id}/state.json`
- **Historical Logs**: From `fractary-logs` plugin (workflow log type)
- **Artifacts**: Branches, PRs, specs, and other workflow outputs

Provides clear visibility into workflow run progress, phase completion, errors, and next steps.

## Input Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `work_id` or `run_id` | string | No | Work item ID or run ID. If omitted, auto-detects active workflow run |
| `logs` | number | No | Number of recent log entries to show (default: 10) |
| `state-only` | boolean | No | Show only current state, skip log queries (default: false) |
| `timing` | boolean | No | Show phase timing breakdown (default: false) |
| `verbose` | boolean | No | Show all information (state + full logs + timing) (default: false) |
| `json` | boolean | No | Output in JSON format for automation (default: false) |

## Algorithm

### Step 1: Detect Target Workflow Run

**Goal**: Determine which workflow run to show status for

**Logic**:
```
# Priority order for determining run_id
if run_id_parameter:
  run_id = run_id_parameter
else if work_id_parameter:
  # Find run for this work ID
  run_id = find_run_by_work_id(work_id_parameter)
else if exists(".fractary/faber/.active-run-id"):
  # Use active workflow run
  run_id = read(".fractary/faber/.active-run-id").strip()
else:
  # Search for any active workflow runs
  state_files = glob(".fractary/runs/*/state.json")

  active_runs = []
  for state_file in state_files:
    state = parse_json(read(state_file))
    if state.status in ["in_progress", "paused"]:
      active_runs.append(state.run_id)

  if length(active_runs) == 0:
    ERROR "No active FABER workflow run found"
    PRINT "To start a workflow: /fractary-faber:workflow-run --work-id <id>"
    EXIT 1
  else if length(active_runs) == 1:
    run_id = active_runs[0]
  else:
    # Multiple active workflow runs - prompt user
    PRINT "Multiple active workflow runs found:"
    for i, run_id in enumerate(active_runs):
      PRINT "  {i+1}. {run_id}"
    PRINT ""
    PRINT "Please specify: /fractary-faber:run-status --run-id <run-id>"
    EXIT 1

state_path = ".fractary/runs/{run_id}/state.json"
```

**Helper Function**: `find_run_by_work_id(work_id)`
```
# Search all state files for matching work_id
state_files = glob(".fractary/runs/*/state.json")

for state_file in state_files:
  state = parse_json(read(state_file))
  if state.work_id == work_id:
    return state.run_id

ERROR "No workflow run found for work item: {work_id}"
EXIT 1
```

### Step 2: Load Current State

**Goal**: Read workflow run state from disk

**Logic**:
```
if not exists(state_path):
  ERROR "Workflow run state file not found: {state_path}"
  EXIT 1

TRY:
  state = parse_json(read(state_path))
CATCH parse_error:
  ERROR "Cannot parse state file: {parse_error}"
  PRINT "File: {state_path}"
  EXIT 1

# Extract key fields
work_id = state.work_id
workflow_id = state.workflow_id
status = state.status
current_phase = state.current_phase
started_at = state.started_at
updated_at = state.updated_at
phases = state.phases
artifacts = state.artifacts
errors = state.errors or []
```

### Step 3: Query Recent Logs (unless --state-only)

**Goal**: Fetch recent workflow run events from logs plugin

**Logic**:
```
if state_only_mode:
  recent_logs = []
else:
  log_limit = logs_parameter or (50 if verbose_mode else 10)

  # Use fractary-logs plugin to query workflow events
  TRY:
    # Invoke logs plugin skill
    log_query_result = Skill(
      skill="fractary-logs:search",
      args="--type workflow --filter work_id={work_id} --limit {log_limit} --format json"
    )

    recent_logs = parse_json(log_query_result)
  CATCH:
    # Logs plugin not available or query failed
    recent_logs = []
    if verbose_mode:
      WARN "Could not query logs plugin (plugin may not be installed)"
```

### Step 4: Calculate Phase Timing (if --timing or --verbose)

**Goal**: Compute time spent in each phase

**Logic**:
```
if timing_mode or verbose_mode:
  phase_timing = {}

  for phase in phases:
    if phase.started_at and phase.completed_at:
      duration = calculate_duration(phase.started_at, phase.completed_at)
      phase_timing[phase.phase_name] = {
        started: phase.started_at,
        completed: phase.completed_at,
        duration: duration,
        status: "completed"
      }
    else if phase.started_at:
      duration = calculate_duration(phase.started_at, now())
      phase_timing[phase.phase_name] = {
        started: phase.started_at,
        duration: duration,
        status: "in_progress"
      }
```

**Helper Function**: `calculate_duration(start, end)`
```
# Parse ISO 8601 timestamps and calculate duration
duration_seconds = parse_timestamp(end) - parse_timestamp(start)

hours = floor(duration_seconds / 3600)
minutes = floor((duration_seconds % 3600) / 60)
seconds = duration_seconds % 60

if hours > 0:
  return "{hours}h {minutes}m"
else if minutes > 0:
  return "{minutes}m {seconds}s"
else:
  return "{seconds}s"
```

### Step 5: Format Output

**Goal**: Display status in human-readable or JSON format

#### JSON Output Mode (--json)

```
if json_mode:
  output = {
    run_id: run_id,
    work_id: work_id,
    workflow_id: workflow_id,
    status: status,
    current_phase: current_phase,
    started_at: started_at,
    updated_at: updated_at,
    phases: [
      {
        phase_name: phase.phase_name,
        status: phase.status,
        started_at: phase.started_at,
        completed_at: phase.completed_at,
        retry_count: phase.retry_count
      }
      for phase in phases
    ],
    artifacts: artifacts,
    errors: errors,
    recent_logs: recent_logs (if not state_only_mode)
  }

  PRINT json.serialize(output, indent=2)
  EXIT 0
```

#### Human-Readable Output

**Header**:
```
📊 FABER Workflow Run Status
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Run ID: {run_id}
Work Item: {work_id}
Workflow: {workflow_id}
Status: {status_with_emoji}
Started: {started_at_relative} ({started_at})
Updated: {updated_at_relative} ({updated_at})
```

Status emojis:
- `in_progress` → "🔄 In Progress"
- `paused` → "⏸️  Paused"
- `completed` → "✅ Completed"
- `failed` → "❌ Failed"
- `cancelled` → "🚫 Cancelled"

**Phase Progress**:
```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Phases:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

{phase_status_list}
```

For each phase:
```
if phase.status == "completed":
  icon = "✅"
  status_text = "Completed"
  if timing_mode:
    status_text += " ({duration})"
else if phase.status == "in_progress":
  icon = "▶️"
  status_text = "In Progress"
  if timing_mode:
    status_text += " ({duration} elapsed)"
  if phase.retry_count > 0:
    status_text += " [Retry {phase.retry_count}/{max_retries}]"
else if phase.status == "failed":
  icon = "❌"
  status_text = "Failed"
  if phase.retry_count > 0:
    status_text += " [Retry {phase.retry_count}/{max_retries}]"
else if phase.status == "pending":
  icon = "⏳"
  status_text = "Pending"
else:
  icon = "⚪"
  status_text = phase.status

PRINT "{icon} {phase.phase_name}: {status_text}"

# Show phase details in verbose mode
if verbose_mode and phase.status == "in_progress":
  PRINT "    Current step: {phase.current_step}"
  if phase.error:
    PRINT "    Error: {phase.error}"
```

**Artifacts**:
```
if artifacts and (verbose_mode or length(artifacts) > 0):
  PRINT ""
  PRINT "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  PRINT "Artifacts:"
  PRINT "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

  if artifacts.spec_path:
    PRINT "📄 Specification: {artifacts.spec_path}"

  if artifacts.branch_name:
    PRINT "🌿 Branch: {artifacts.branch_name}"

  if artifacts.pr_number:
    PRINT "🔀 Pull Request: #{artifacts.pr_number}"

  if artifacts.plan_id:
    PRINT "📋 Plan: {artifacts.plan_id}"

  # Show all other artifacts in verbose mode
  if verbose_mode:
    for key, value in artifacts.items():
      if key not in ["spec_path", "branch_name", "pr_number", "plan_id"]:
        PRINT "   {key}: {value}"
```

**Errors** (if present):
```
if length(errors) > 0:
  PRINT ""
  PRINT "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  PRINT "⚠️  Errors ({length(errors)}):"
  PRINT "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

  for error in errors:
    PRINT "❌ [{error.phase}] {error.message}"
    if verbose_mode and error.details:
      PRINT "   Details: {error.details}"
    if error.timestamp:
      PRINT "   Time: {error.timestamp}"
```

**Recent Logs** (if not --state-only):
```
if length(recent_logs) > 0:
  PRINT ""
  PRINT "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  PRINT "Recent Events ({length(recent_logs)}):"
  PRINT "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

  for log in recent_logs:
    timestamp_relative = format_relative_time(log.timestamp)
    PRINT "{timestamp_relative} - {log.event}: {log.message}"

    if verbose_mode and log.metadata:
      for key, value in log.metadata.items():
        PRINT "  {key}: {value}"
```

**Next Steps**:
```
PRINT ""
PRINT "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
PRINT "Next Steps:"
PRINT "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

if status == "in_progress":
  if current_phase:
    PRINT "▶️  Continue with {current_phase} phase"
    PRINT "   Resume workflow: /fractary-faber:workflow-run --resume"
  else:
    PRINT "▶️  Start next phase"
    PRINT "   Resume workflow: /fractary-faber:workflow-run --resume"
else if status == "paused":
  PRINT "⏸️  Workflow run is paused"
  PRINT "   Resume: /fractary-faber:workflow-run --resume"
else if status == "failed":
  PRINT "❌ Workflow run failed in {current_phase} phase"
  PRINT "   Review errors above and retry: /fractary-faber:workflow-run --retry"
else if status == "completed":
  PRINT "✅ Workflow run completed successfully"
  if artifacts.pr_number:
    PRINT "   Review PR: #{artifacts.pr_number}"
```

**Timing Breakdown** (if --timing or --verbose):
```
if timing_mode or verbose_mode:
  PRINT ""
  PRINT "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  PRINT "Timing Breakdown:"
  PRINT "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

  total_duration = calculate_duration(started_at, updated_at)

  for phase_name, timing in phase_timing.items():
    PRINT "{phase_name}: {timing.duration}"
    if timing.status == "completed":
      PRINT "  Started: {timing.started}"
      PRINT "  Completed: {timing.completed}"
    else:
      PRINT "  Started: {timing.started}"
      PRINT "  Status: {timing.status}"

  PRINT ""
  PRINT "Total: {total_duration}"
```

### Step 6: Exit with Status Code

**Goal**: Return appropriate exit code

**Logic**:
```
if status == "failed":
  EXIT 1
else if status == "cancelled":
  EXIT 2
else:
  EXIT 0  # in_progress, paused, or completed
```

## Output Examples

### Basic Status

```
📊 FABER Workflow Run Status
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Run ID: fractary-faber-258-20260105-143022
Work Item: 258
Workflow: fractary-faber:default
Status: 🔄 In Progress
Started: 2 hours ago (2026-01-05T14:30:22Z)
Updated: 5 minutes ago (2026-01-05T16:25:00Z)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Phases:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

✅ frame: Completed
✅ architect: Completed
▶️ build: In Progress
⏳ evaluate: Pending
⏳ release: Pending

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Artifacts:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📄 Specification: specs/WORK-258.md
🌿 Branch: feat/258-user-authentication
📋 Plan: plan-258-20260105

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Recent Events (10):
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

5 minutes ago - phase_started: Started build phase
15 minutes ago - artifact_created: Created specification file
18 minutes ago - phase_completed: Completed architect phase
... (7 more events)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Next Steps:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

▶️  Continue with build phase
   Resume workflow: /fractary-faber:workflow-run --resume
```

### Status with Timing

```
📊 FABER Workflow Run Status
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Run ID: fractary-faber-258-20260105-143022
Work Item: 258
Workflow: fractary-faber:default
Status: 🔄 In Progress
Started: 2 hours ago (2026-01-05T14:30:22Z)
Updated: 5 minutes ago (2026-01-05T16:25:00Z)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Phases:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

✅ frame: Completed (15m 30s)
✅ architect: Completed (45m 12s)
▶️ build: In Progress (1h 2m elapsed)
⏳ evaluate: Pending
⏳ release: Pending

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Timing Breakdown:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

frame: 15m 30s
  Started: 2026-01-05T14:30:22Z
  Completed: 2026-01-05T14:45:52Z

architect: 45m 12s
  Started: 2026-01-05T14:45:52Z
  Completed: 2026-01-05T15:31:04Z

build: 1h 2m (in progress)
  Started: 2026-01-05T15:31:04Z
  Status: in_progress

Total: 2h 3m
```

### JSON Output

```json
{
  "run_id": "fractary-faber-258-20260105-143022",
  "work_id": "258",
  "workflow_id": "fractary-faber:default",
  "status": "in_progress",
  "current_phase": "build",
  "started_at": "2026-01-05T14:30:22Z",
  "updated_at": "2026-01-05T16:25:00Z",
  "phases": [
    {
      "phase_name": "frame",
      "status": "completed",
      "started_at": "2026-01-05T14:30:22Z",
      "completed_at": "2026-01-05T14:45:52Z",
      "retry_count": 0
    },
    {
      "phase_name": "architect",
      "status": "completed",
      "started_at": "2026-01-05T14:45:52Z",
      "completed_at": "2026-01-05T15:31:04Z",
      "retry_count": 0
    },
    {
      "phase_name": "build",
      "status": "in_progress",
      "started_at": "2026-01-05T15:31:04Z",
      "completed_at": null,
      "retry_count": 0
    }
  ],
  "artifacts": {
    "spec_path": "specs/WORK-258.md",
    "branch_name": "feat/258-user-authentication",
    "plan_id": "plan-258-20260105"
  },
  "errors": [],
  "recent_logs": [...]
}
```

### No Active Workflow Run

```
❌ ERROR: No active FABER workflow run found

Expected location: .fractary/runs/*/state.json

Recovery:
1. Start a new workflow: /fractary-faber:workflow-run --work-id <work-id>
2. Or specify a run ID: /fractary-faber:run-status --run-id <run-id>

Available runs:
  /fractary-faber:run-status --run-id fractary-faber-258-20260105-143022
```

## Exit Codes

| Code | Meaning | Description |
|------|---------|-------------|
| 0 | Success | Status displayed successfully (workflow run in_progress, paused, or completed) |
| 1 | Failed | Workflow run status is "failed" |
| 2 | Cancelled | Workflow run status is "cancelled" |
| 3 | Not Found | No active workflow run found |

## Performance Considerations

- **State Loading**: Single read operation
- **Log Queries**: Limit to 10-50 entries by default
- **Caching**: Consider caching status for 30 seconds for rapid repeated queries
- **Large Logs**: Use pagination, don't load entire log history

## Use Cases

### CI/CD Integration

Check workflow run status in automation:
```bash
/fractary-faber:run-status --json | jq '.status'
```

### Dashboard Integration

Query status for multiple workflow runs:
```bash
for run_id in $(ls .fractary/runs/); do
  /fractary-faber:run-status --run-id $run_id --json
done
```

### Monitoring

Track workflow run progress:
```bash
watch -n 10 "/fractary-faber:run-status --timing"
```

## Related Documentation

- **Commands**:
  - `commands/workflow-run.md` - Start/resume workflows
  - `commands/workflow-audit.md` - Validate configuration
- **State Management**:
  - `docs/STATE-MANAGEMENT.md` - State file structure
  - `config/schema/state.schema.json` - State schema
