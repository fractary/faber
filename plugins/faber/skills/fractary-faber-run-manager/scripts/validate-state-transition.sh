#!/usr/bin/env bash
#
# validate-state-transition.sh - Validate state transitions for FABER workflows
#
# Enforces:
#   - At most 1 step finished (completed, failed or skipped) per update
#   - A step that becomes "skipped" records why, in its "reason"
#   - Forward-only workflow status transitions (pending -> in_progress -> completed/failed/paused)
#   - Workflow can only be "completed" if ALL enabled phases are "completed" or "skipped"
#
# Usage:
#   validate-state-transition.sh --current <path> --proposed <path>
#   validate-state-transition.sh --current <path> --proposed-json <json>
#
# Exit Codes:
#   0 - Transition is valid
#   1 - Transition is invalid (violations found)
#   2 - Input error (missing args, file not found, bad JSON)
#

set -euo pipefail

# Parse arguments
CURRENT_PATH=""
PROPOSED_PATH=""
PROPOSED_JSON=""

while [[ $# -gt 0 ]]; do
    case "$1" in
        --current)
            CURRENT_PATH="$2"
            shift 2
            ;;
        --proposed)
            PROPOSED_PATH="$2"
            shift 2
            ;;
        --proposed-json)
            PROPOSED_JSON="$2"
            shift 2
            ;;
        -h|--help)
            echo "Usage: validate-state-transition.sh --current <path> --proposed <path>"
            echo ""
            echo "Validates that a proposed state update follows transition rules."
            echo ""
            echo "Options:"
            echo "  --current <path>       Path to current state JSON file"
            echo "  --proposed <path>      Path to proposed state JSON file"
            echo "  --proposed-json <json>  Proposed state as inline JSON"
            exit 0
            ;;
        *)
            echo "Unknown argument: $1" >&2
            exit 2
            ;;
    esac
done

# Validate inputs
if [[ -z "$CURRENT_PATH" ]]; then
    echo '{"status": "error", "message": "Missing --current argument"}' >&2
    exit 2
fi

if [[ -z "$PROPOSED_PATH" && -z "$PROPOSED_JSON" ]]; then
    echo '{"status": "error", "message": "Missing --proposed or --proposed-json argument"}' >&2
    exit 2
fi

if [[ ! -f "$CURRENT_PATH" ]]; then
    echo '{"status": "error", "message": "Current state file not found: '"$CURRENT_PATH"'"}' >&2
    exit 2
fi

# Read current state
CURRENT_STATE=$(cat "$CURRENT_PATH")

# Read proposed state
if [[ -n "$PROPOSED_PATH" ]]; then
    if [[ ! -f "$PROPOSED_PATH" ]]; then
        echo '{"status": "error", "message": "Proposed state file not found: '"$PROPOSED_PATH"'"}' >&2
        exit 2
    fi
    PROPOSED_STATE=$(cat "$PROPOSED_PATH")
else
    PROPOSED_STATE="$PROPOSED_JSON"
fi

# Validate both are valid JSON
if ! echo "$CURRENT_STATE" | jq empty 2>/dev/null; then
    echo '{"status": "error", "message": "Current state is not valid JSON"}' >&2
    exit 2
fi

if ! echo "$PROPOSED_STATE" | jq empty 2>/dev/null; then
    echo '{"status": "error", "message": "Proposed state is not valid JSON"}' >&2
    exit 2
fi

VIOLATIONS="[]"

# Rules 1 and 4 compare each step's status in the current and proposed state.
# Steps live in .phases[].steps, keyed by step ID (workflow-run skill) or as an
# array (state-update-step.sh); older states keep a root .steps array.
STEP_CHANGES=$(jq -n --slurpfile current <(printf '%s' "$CURRENT_STATE") --slurpfile proposed <(printf '%s' "$PROPOSED_STATE") '
  def finished: . == "success" or . == "failure" or . == "warning"
      or . == "completed" or . == "failed" or . == "skipped";
  def steps_by_key:
      [(.phases // {}) | to_entries[] | .key as $ph | (.value.steps // null) |
          if type == "object" then to_entries[] | {key: "\($ph):\(.key)", value: .value}
          elif type == "array" then .[] | {key: "\($ph):\(.id // .name)", value: .}
          else empty end]
      + [(.steps // []) | if type == "array" then .[] else empty end
          | {key: "\(.phase // "unknown"):\(.step_id // .id)", value: .}]
      | from_entries;
  ($current[0] | steps_by_key) as $before
  | [($proposed[0] | steps_by_key) | to_entries[]
     | select(((.value.status // "") | finished) and (.value.status != ($before[.key].status // "")))]
  | {finished: map(.key),
     skipped_without_reason: map(select(.value.status == "skipped"
         and ((.value.reason // "") | tostring | test("\\S") | not)) | .key)}')

# Rule 1: At most 1 step finished per update. A step finishes when it becomes
# completed, failed or skipped, so a batch of skips is caught like a batch of
# completions.
FINISHED_COUNT=$(echo "$STEP_CHANGES" | jq '.finished | length')
if [[ "$FINISHED_COUNT" -gt 1 ]]; then
    VIOLATIONS=$(echo "$VIOLATIONS" | jq --argjson changes "$STEP_CHANGES" \
        '. + ["Cannot advance more than 1 step per update (completed, failed or skipped; attempted " + ($changes.finished | length | tostring) + ": " + ($changes.finished | join(", ")) + ")"]')
fi

# Rule 4: A skipped step records why. Skipping is for steps the user or a guard
# decided must not run, never a way to get past the completion gate.
SKIPPED_WITHOUT_REASON=$(echo "$STEP_CHANGES" | jq -r '.skipped_without_reason | join(", ")')
if [[ -n "$SKIPPED_WITHOUT_REASON" ]]; then
    VIOLATIONS=$(echo "$VIOLATIONS" | jq --arg steps "$SKIPPED_WITHOUT_REASON" \
        '. + ["Step skipped without a reason: " + $steps + " (record why in the step'"'"'s \"reason\")"]')
fi

# Rule 2: Forward-only status transitions
# Workflow status can only go forward: pending -> in_progress -> completed/failed/paused
CURRENT_STATUS=$(echo "$CURRENT_STATE" | jq -r '.status // "pending"')
PROPOSED_STATUS=$(echo "$PROPOSED_STATE" | jq -r '.status // "pending"')

valid_transition() {
    local from="$1"
    local to="$2"
    case "$from" in
        pending)
            [[ "$to" == "in_progress" || "$to" == "cancelled" ]] && return 0
            ;;
        in_progress)
            [[ "$to" == "in_progress" || "$to" == "completed" || "$to" == "failed" || "$to" == "paused" || "$to" == "cancelled" ]] && return 0
            ;;
        paused)
            [[ "$to" == "in_progress" || "$to" == "cancelled" || "$to" == "failed" ]] && return 0
            ;;
        failed)
            [[ "$to" == "in_progress" || "$to" == "failed" ]] && return 0
            ;;
        completed)
            # Completed is terminal
            [[ "$to" == "completed" ]] && return 0
            ;;
    esac
    return 1
}

if ! valid_transition "$CURRENT_STATUS" "$PROPOSED_STATUS"; then
    VIOLATIONS=$(echo "$VIOLATIONS" | jq --arg from "$CURRENT_STATUS" --arg to "$PROPOSED_STATUS" \
        '. + ["Invalid workflow status transition: " + $from + " -> " + $to]')
fi

# Rule 3: Workflow can only be "completed" if all enabled phases are "completed" or "skipped"
if [[ "$PROPOSED_STATUS" == "completed" ]]; then
    # Check all phases
    INCOMPLETE_PHASES=$(echo "$PROPOSED_STATE" | jq -r '
        [.phases | to_entries[] |
         select(.value.status != "completed" and .value.status != "skipped" and
                .value.enabled != false) |
         .key] | join(", ")')

    if [[ -n "$INCOMPLETE_PHASES" ]]; then
        VIOLATIONS=$(echo "$VIOLATIONS" | jq --arg phases "$INCOMPLETE_PHASES" \
            '. + ["Cannot mark workflow completed: phases not completed: " + $phases]')
    fi
fi

# Output result
VIOLATION_COUNT=$(echo "$VIOLATIONS" | jq 'length')

if [[ "$VIOLATION_COUNT" -gt 0 ]]; then
    echo "$VIOLATIONS" | jq '{status: "invalid", violations: .}'
    exit 1
else
    echo '{"status": "valid"}'
    exit 0
fi
