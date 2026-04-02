# Run Inspection Protocol

Step-by-step protocol for inspecting a FABER workflow run and displaying its status.

## Steps

### 1. Detect Target Run

Resolve which run to inspect, trying in order:
1. **Positional argument**: check if it matches a `work_id` or `run_id`
2. **Active run file**: read `.active-run-id` in the project root
3. **State file search**: scan `.fractary/faber/runs/*/state.json` for runs with `status: "in_progress"`

If no run can be found, exit with code 3 (not found).

### 2. Load Run State

Read `.fractary/faber/runs/{run_id}/state.json` and extract:
- `work_id` - the associated work item
- `workflow_id` - which workflow is being executed
- `status` - current run status (in_progress, completed, failed, cancelled)
- `current_phase` - the active phase name
- `phases` - object with per-phase status and metadata
- `artifacts` - collected artifacts (spec path, branch, PR, plan ID)
- `errors` - any recorded errors

### 3. Query Logs (unless --state-only)

If the `--state-only` flag is NOT set, retrieve recent log entries:
- Use the `fractary-logs-search` skill
- Arguments: `--type workflow --filter work_id={work_id} --limit {n} --format json`
- Parse the returned log entries for display

### 4. Calculate Timing (if --timing or --verbose)

For each phase that has a `started_at` timestamp:
- Compute duration from `started_at` to `completed_at` (or current time if still in progress)
- Calculate total run duration from the earliest phase start

### 5. Format Output

Render the inspection report with these sections:

**Header**:
- Run ID
- Work Item (work_id)
- Workflow (workflow_id)
- Status with icon: completed, in_progress, failed, cancelled
- Started / Last Updated timestamps

**Phases**:
For each phase, display: icon + name + status
- Completed phases
- In-progress phases (highlighted)
- Failed phases (with error indicator)
- Pending phases
- Show retry count if greater than 0

**Artifacts**:
- Spec path (if generated)
- Branch name (if created)
- PR number (if opened)
- Plan ID (if planned)

**Errors** (if any):
- Phase where error occurred + error message
- In `--verbose` mode: include full error details and stack traces

**Logs** (if queried):
- For each recent log entry: timestamp + event type + message

**Next Steps**:
Context-aware suggestions based on current status:
- `in_progress`: no action needed, run is active
- `failed`: suggest resume or retry commands
- `completed`: suggest reviewing the PR or closing the work item
- `cancelled`: suggest re-running if needed

**Timing Breakdown** (if `--timing` or `--verbose`):
- Per-phase duration
- Total run duration

### 6. JSON Mode

If `--json` flag is set, output a structured JSON object containing all fields:
- `run_id`, `work_id`, `workflow_id`, `status`, `current_phase`
- `phases` with per-phase status and timing
- `artifacts` object
- `errors` array
- `logs` array (if queried)
- `timing` object (if calculated)

### 7. Exit Codes

- `0` - run found and status is completed or in_progress
- `1` - run found but status is failed
- `2` - run found but status is cancelled
- `3` - run not found
