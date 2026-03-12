#!/bin/bash
# FABER Session Common Library
# Shared functions for all FABER hook scripts.

# detect_active_run CWD
# Sets: RUN_ID, STATE_FILE, STATUS
# Returns 0 if active run found, 1 otherwise
detect_active_run() {
  local cwd="$1"

  ACTIVE_RUN_FILE="${cwd}/.fractary/faber/runs/.active-run-id"
  [ -f "$ACTIVE_RUN_FILE" ] || return 1

  RUN_ID=$(tr -d '[:space:]' < "$ACTIVE_RUN_FILE")
  [ -n "$RUN_ID" ] || return 1

  STATE_FILE=$(find "${cwd}/.fractary/faber/runs/${RUN_ID}" -name "state-*.json" -type f 2>/dev/null | head -1)
  [ -n "$STATE_FILE" ] && [ -f "$STATE_FILE" ] || return 1

  STATUS=$(jq -r '.status // ""' < "$STATE_FILE" 2>/dev/null)
  [[ "$STATUS" == "in_progress" || "$STATUS" == "paused" || "$STATUS" == "awaiting_feedback" ]] || return 1

  return 0
}

# get_git_state
# Outputs JSON object: {"commit": "...", "branch": "...", "has_uncommitted": true/false}
get_git_state() {
  local commit branch has_uncommitted

  commit=$(git rev-parse --short HEAD 2>/dev/null || echo "unknown")
  branch=$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo "unknown")

  if git diff --quiet HEAD 2>/dev/null && git diff --cached --quiet HEAD 2>/dev/null; then
    has_uncommitted="false"
  else
    has_uncommitted="true"
  fi

  jq -n \
    --arg commit "$commit" \
    --arg branch "$branch" \
    --argjson has_uncommitted "$has_uncommitted" \
    '{commit: $commit, branch: $branch, has_uncommitted: $has_uncommitted}'
}

# write_continuation_note STATE_FILE SAVED_BY TRIGGER
# Writes a Tier 1 continuation note to state.json.
# Preserves Tier 2 fields (working_on, key_files, context_hints) if the existing
# note was written by an agent within the last 5 minutes (staleness guard).
write_continuation_note() {
  local state_file="$1"
  local saved_by="$2"
  local trigger="$3"
  local now
  now=$(date -u +"%Y-%m-%dT%H:%M:%SZ")

  local git_state
  git_state=$(get_git_state)

  # Compute staleness: check if existing agent note is < 5 min old
  local preserve_agent="false"
  local existing_saved_by
  existing_saved_by=$(jq -r '.continuation_note.saved_by // ""' < "$state_file" 2>/dev/null)
  if [ "$existing_saved_by" = "agent:session-saver" ]; then
    local existing_ts
    existing_ts=$(jq -r '.continuation_note.saved_at // ""' < "$state_file" 2>/dev/null)
    if [ -n "$existing_ts" ]; then
      local existing_epoch now_epoch
      existing_epoch=$(date -u -d "$existing_ts" +%s 2>/dev/null || echo 0)
      now_epoch=$(date -u +%s)
      local age=$(( now_epoch - existing_epoch ))
      if [ "$age" -lt 300 ]; then
        preserve_agent="true"
      fi
    fi
  fi

  local updated
  updated=$(jq \
    --arg now "$now" \
    --arg saved_by "$saved_by" \
    --arg trigger "$trigger" \
    --argjson git_state "$git_state" \
    --argjson preserve "$preserve_agent" \
    '
    # Extract current phase/step info
    (.current_phase // "unknown") as $phase |
    (.current_step // null) as $step |
    (.current_step_id // null) as $step_id |

    # Build artifact_paths from top-level artifacts
    {
      spec_path: (.artifacts.spec_path // null),
      branch: (.artifacts.branch // null),
      pr_number: (.artifacts.pr_number // null),
      pr_url: (.artifacts.pr_url // null)
    } as $artifact_paths |

    # Build the note, preserving agent-written fields if recent
    .continuation_note = {
      saved_at: $now,
      saved_by: $saved_by,
      trigger: $trigger,
      phase: $phase,
      step: $step,
      step_id: $step_id,
      artifact_paths: $artifact_paths,
      git_state: $git_state,
      working_on: (if $preserve then .continuation_note.working_on else null end),
      key_files: (if $preserve then (.continuation_note.key_files // []) else [] end),
      context_hints: (if $preserve then .continuation_note.context_hints else null end)
    } |
    .updated_at = $now
    ' "$state_file" 2>/dev/null) || return 1

  echo "$updated" > "$state_file"
}
