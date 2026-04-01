# Session Save Protocol

Protocol for persisting session metadata before a session ends. The primary value of save is producing a Tier 2 continuation note that enables the next session to resume work with full context.

## Parameters

| Parameter | Description |
|-----------|-------------|
| `--run-id <id>` | Target a specific run |
| `--reason <reason>` | Why the session is ending (e.g., `user_request`, `phase_complete`, `context_limit`) |

## Step 1: Detect Active Workflow

Resolve the active run using this priority chain:

1. `--run-id` parameter (if provided).
2. `.active-run-id` file in the project root.
3. If neither yields a valid run, exit gracefully with no error.

## Step 2: Load State

Read and parse `state.json` from the resolved run directory. Validate that the file exists and contains valid JSON.

## Step 3: Get Current Session

1. Extract `current_session_id` from state.
2. Look up the session entry in `session_history`.
3. If no matching entry exists, construct a new session record with `started_at` set to the current timestamp.

## Step 4: Update Session

Update the current session record with:

- `ended_at` -- ISO 8601 timestamp of session end.
- `end_reason` -- the reason the session is ending (from `--reason` or inferred).
- `phases_completed` -- list of phases completed during this session.
- `artifacts_loaded` -- list of artifacts that were loaded during this session.
- `environment` -- platform, shell, and working directory info.

## Step 4.5: Write Tier 2 Continuation Note

This is the key value of the save operation. The continuation note captures enough context for the next session to resume without re-reading the full codebase.

Write the following structure to state as the continuation note:

```json
{
  "saved_at": "<ISO 8601 timestamp>",
  "saved_by": "skill:session-manager",
  "trigger": "<reason for session end>",
  "phase": "<current phase>",
  "step": "<current step name>",
  "step_id": "<current step ID>",
  "working_on": "<1-3 sentence summary of what was being worked on -- mention specific files, functions, and concepts>",
  "key_files": [
    "<files actively being edited or reviewed>"
  ],
  "artifact_paths": {
    "spec_path": "<path to spec if exists>",
    "branch": "<current git branch>",
    "pr_number": "<PR number if exists>",
    "pr_url": "<PR URL if exists>"
  },
  "git_state": {
    "commit": "<current HEAD commit hash>",
    "branch": "<current branch name>",
    "has_uncommitted": true
  },
  "context_hints": "<guidance for the next session -- what to do next, what to watch out for, what decisions were made>"
}
```

### Field Guidelines

- **working_on**: Be specific. Reference file paths, function names, and the conceptual task. Example: "Implementing the retry logic in `src/client.ts` `sendWithRetry()` -- backoff calculation is done, need to wire up the max-retries config."
- **key_files**: Only files that are actively being edited or are critical to understanding the current work. Do not list every file ever touched.
- **artifact_paths**: Capture pointers to durable artifacts so the next session can find them without searching.
- **git_state**: Snapshot of the git working tree so the next session knows if there are uncommitted changes to review.
- **context_hints**: Actionable guidance. Example: "The failing test in `auth.test.ts` is expected -- waiting on the upstream fix in PR #42. Skip it for now and focus on the validation logic."

## Step 5: Move to History

1. Append the completed session record to the `session_history` array in state.
2. Clear `current_session_id` (set to `null`).
3. Increment `total_sessions` by 1.

## Step 6: Write State

1. Create a backup of the current `state.json` (copy to `state.json.bak`).
2. Write the updated state as formatted JSON.
3. Verify the write by reading back the file and confirming valid JSON with the expected `total_sessions` count.

## Step 7: Report

Output a summary containing:

- **Session ID** -- the ID of the session that was saved.
- **End reason** -- why the session ended.
- **Duration** -- elapsed time from `started_at` to `ended_at`.
- **Phases completed** -- list of phases completed in this session.
