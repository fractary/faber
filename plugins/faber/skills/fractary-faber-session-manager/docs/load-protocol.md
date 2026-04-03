# Session Load Protocol

Protocol for reloading critical artifacts into conversation context for an active FABER workflow run.

## Parameters

| Parameter | Description |
|-----------|-------------|
| `--run-id <id>` | Target a specific run |
| `--work-id <id>` | Find run by work item ID |
| `--minimal` | Minimal output mode (state summary only) |
| `--artifacts <list>` | Comma-separated artifact filter |
| `--context <hint>` | Prioritization hint for conditional artifacts |
| `--force` | Bypass recency check and reload all artifacts |
| `--dry-run` | Show what would be loaded without loading |

## Step 1: Detect Target Workflow

Resolve which run to load using this priority chain:

1. `work_id` parameter (if provided)
2. `run_id` parameter (if provided)
3. `.active-run-id` file in the project root
4. Scan all state files for a run with status `in_progress` or `paused`

### work_id Resolution

When `work_id` is provided, search all `.fractary/faber/runs/*/state.json` files for a matching `work_id` field. Additionally, fetch the associated GitHub issue for context:

```bash
gh issue view {work_id} --json number,title,body,state,labels,assignees,author,createdAt,updatedAt,comments
```

If no matching run is found, report the failure and stop.

## Step 2: Load State

1. Read `state.json` from the resolved run directory.
2. Extract `workflow_id` from state.
3. Load the workflow configuration using the resolved `workflow_id`.
4. Extract `critical_artifacts` from the workflow config.
5. Extract `continuation_note` from state if present (used in Step 8).

## Step 3: Minimal Mode

Triggered when `--minimal` flag is set or when `trigger == session_start`.

In minimal mode:

1. Read `state.json`.
2. Output a summary containing: run ID, current phase, current step, status, artifact paths.
3. Output the message: "check progress tracking to see pending steps".
4. **STOP** -- do not proceed to further steps.

Minimal mode skips GitHub issue fetching, spec loading, and protocol loading. This keeps session-start fast and context-light.

## Step 4: Determine Artifacts

Evaluate the workflow's `critical_artifacts` configuration to build the artifact load list.

### Artifact Categories

- **always_load** -- loaded unconditionally on every reload.
- **conditional_load** -- each entry has conditions evaluated against the current state (phase, step, status). Only loaded when conditions match.
- **phase_specific** -- keyed by phase name. Only loaded when the current phase matches.

### Filtering

- If `--artifacts` is specified, restrict the load list to only those artifact names.
- If `--context` is specified, use the hint to prioritize conditional artifacts (e.g., `--context "debugging test failures"` may prioritize test-related artifacts).

## Step 5: Check Recency

Unless `--force` is set, check `state.context_metadata.artifacts_in_context` for each artifact in the load list.

Skip any artifact that was loaded within the last **5 minutes**. This prevents redundant reloads that waste context window space.

When `--force` is set, bypass this check entirely and reload all resolved artifacts.

## Step 6: Load Artifacts

Load each artifact according to its type:

| Type | Method |
|------|--------|
| `json` | Read tool on the JSON file path |
| `markdown` | Read tool on the markdown file path |
| `directory` | Glob tool to discover files, then Read tool on each |
| `work_plugin` | Skill tool to invoke the work plugin |
| `skill` | Skill tool to invoke the named skill |
| `git_info` | Bash tool to run git commands |

### Path Placeholders

Artifact paths may contain placeholders. Resolve them before loading:

| Placeholder | Value |
|-------------|-------|
| `{run_id}` | Current run ID |
| `{plan_id}` | Current plan ID |
| `{work_id}` | Current work item ID |
| `{project_root}` | Project root directory |

## Step 7: Update State

After loading, write the following metadata back to `state.json`:

### context_metadata

- `last_artifact_reload` -- ISO 8601 timestamp of this reload.
- `reload_count` -- increment by 1.
- `artifacts_in_context` -- map of artifact name to load timestamp for each artifact loaded in this operation.

### Session Tracking

- Generate a new `session_id`.
- Record environment info (platform, shell, working directory).

## Step 8: Report

Output a summary report containing:

1. **Loaded artifacts** -- list of artifact names and types that were loaded.
2. **Session tracking** -- new session ID and environment info.
3. **Continuation note** -- if present, display the continuation context:
   - **Tier 1**: Note produced by a hook (highest fidelity, generated at the phase boundary).
   - **Tier 2**: Note produced by the session-saver agent, containing `working_on`, `key_files`, and `context_hints`.

## Dry-Run Mode

When `--dry-run` is set, execute Steps 1 through 5 normally, then instead of loading artifacts:

1. List all artifacts that would be loaded, with their types and resolved paths.
2. Indicate which artifacts would be skipped due to recency.
3. Do **not** update state or session tracking.
4. Do **not** read any artifact files.
