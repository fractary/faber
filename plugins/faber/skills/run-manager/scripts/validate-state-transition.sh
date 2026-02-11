#!/usr/bin/env bash
#
# validate-state-transition.sh - Validate state transitions for FABER workflows
#
# Enforces:
#   - Max 1 new step completion per update
#   - Forward-only step transitions (pending -> in_progress -> success/failure)
#   - Phase can only be "completed" if ALL its steps are "success"
#   - Workflow can only be "completed" if ALL enabled phases are "completed"
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

# Rule 1: Max 1 new step completion per update
# Count completed steps in current vs proposed
CURRENT_STEP_COUNT=$(echo "$CURRENT_STATE" | jq '[.steps // [] | .[] | select(.status == "success" or .status == "failure" or .status == "warning")] | length')
PROPOSED_STEP_COUNT=$(echo "$PROPOSED_STATE" | jq '[.steps // [] | .[] | select(.status == "success" or .status == "failure" or .status == "warning")] | length')
STEP_DIFF=$((PROPOSED_STEP_COUNT - CURRENT_STEP_COUNT))

if [[ $STEP_DIFF -gt 1 ]]; then
    VIOLATIONS=$(echo "$VIOLATIONS" | jq --arg diff "$STEP_DIFF" \
        '. + ["Cannot advance more than 1 step per update (attempted: " + $diff + " new completions)"]')
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
                (.value.enabled // true) == true) |
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
