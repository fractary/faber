#!/usr/bin/env bash
#
# validate-state-integrity.sh - Cross-validate state claims against event log
#
# For each step marked "success" in the state file, verifies that a
# corresponding step_complete event exists in the immutable event log.
# For each phase marked "completed", verifies a phase_complete event exists.
#
# Usage:
#   validate-state-integrity.sh --run-id <id> [--base-path <path>]
#
# Exit Codes:
#   0 - All state claims have corresponding events (PASS)
#   1 - Discrepancies found (FAIL)
#   2 - Input error (missing args, files not found)
#

set -euo pipefail

# Parse arguments
RUN_ID=""
BASE_PATH=".fractary/faber/runs"

while [[ $# -gt 0 ]]; do
    case "$1" in
        --run-id)
            RUN_ID="$2"
            shift 2
            ;;
        --base-path)
            BASE_PATH="$2"
            shift 2
            ;;
        -h|--help)
            echo "Usage: validate-state-integrity.sh --run-id <id> [--base-path <path>]"
            echo ""
            echo "Cross-validates state claims against the immutable event log."
            echo ""
            echo "Options:"
            echo "  --run-id <id>       Full run identifier"
            echo "  --base-path <path>  Base path for run artifacts (default: .fractary/faber/runs)"
            exit 0
            ;;
        *)
            echo "Unknown argument: $1" >&2
            exit 2
            ;;
    esac
done

if [[ -z "$RUN_ID" ]]; then
    echo '{"status": "error", "message": "Missing --run-id argument"}' >&2
    exit 2
fi

# Derive paths from run_id
# run_id format: {plan_id}-run-{timestamp}
RUN_MARKER="-run-"
RUN_MARKER_POS="${RUN_ID##*$RUN_MARKER}"
PLAN_ID="${RUN_ID%$RUN_MARKER*}"
RUN_SUFFIX="$RUN_MARKER_POS"

STATE_FILE="$BASE_PATH/$PLAN_ID/state-$RUN_SUFFIX.json"
EVENTS_DIR="$BASE_PATH/$RUN_ID/events"

# Also try alternative event directory locations
if [[ ! -d "$EVENTS_DIR" ]]; then
    EVENTS_DIR="$BASE_PATH/$PLAN_ID/events"
fi

# Validate state file exists
if [[ ! -f "$STATE_FILE" ]]; then
    # Try finding state file by pattern
    STATE_FILE=$(find "$BASE_PATH/$PLAN_ID" -name "state-*.json" -type f 2>/dev/null | head -1)
    if [[ -z "$STATE_FILE" || ! -f "$STATE_FILE" ]]; then
        echo '{"status": "error", "message": "State file not found for run: '"$RUN_ID"'"}' >&2
        exit 2
    fi
fi

# Read state file
STATE=$(cat "$STATE_FILE")
if ! echo "$STATE" | jq empty 2>/dev/null; then
    echo '{"status": "error", "message": "State file is not valid JSON"}' >&2
    exit 2
fi

DISCREPANCIES="[]"
VALIDATED_STEPS=0

# Collect all events into a temporary lookup
EVENTS_LOOKUP=$(mktemp)
trap 'rm -f "$EVENTS_LOOKUP"' EXIT

if [[ -d "$EVENTS_DIR" ]]; then
    # Read all event files and build lookup
    for event_file in "$EVENTS_DIR"/*.json; do
        [[ -f "$event_file" ]] || continue
        cat "$event_file"
    done | jq -s '.' > "$EVENTS_LOOKUP"
else
    echo '[]' > "$EVENTS_LOOKUP"
fi

# Rule 1: Every step with status "success" must have a step_complete event
COMPLETED_STEPS=$(echo "$STATE" | jq -c '[.steps // [] | .[] | select(.status == "success")]')
STEP_COUNT=$(echo "$COMPLETED_STEPS" | jq 'length')

for i in $(seq 0 $((STEP_COUNT - 1))); do
    STEP_ID=$(echo "$COMPLETED_STEPS" | jq -r ".[$i].step_id")
    STEP_PHASE=$(echo "$COMPLETED_STEPS" | jq -r ".[$i].phase")

    # Look for matching step_complete event
    MATCHING_EVENT=$(jq --arg sid "$STEP_ID" --arg phase "$STEP_PHASE" \
        '[.[] | select(.type == "step_complete" and .step == $sid and .phase == $phase)] | length' \
        "$EVENTS_LOOKUP")

    if [[ "$MATCHING_EVENT" -eq 0 ]]; then
        DISCREPANCIES=$(echo "$DISCREPANCIES" | jq --arg sid "$STEP_ID" --arg phase "$STEP_PHASE" \
            '. + ["Step \"" + $sid + "\" (phase: " + $phase + ") claimed success but no step_complete event found"]')
    else
        VALIDATED_STEPS=$((VALIDATED_STEPS + 1))
    fi
done

# Rule 2: Every phase with status "completed" must have a phase_complete event
COMPLETED_PHASES=$(echo "$STATE" | jq -r '
    [.phases // {} | to_entries[] | select(.value.status == "completed") | .key] | .[]')

for phase_name in $COMPLETED_PHASES; do
    MATCHING_PHASE_EVENT=$(jq --arg phase "$phase_name" \
        '[.[] | select(.type == "phase_complete" and .phase == $phase)] | length' \
        "$EVENTS_LOOKUP")

    if [[ "$MATCHING_PHASE_EVENT" -eq 0 ]]; then
        DISCREPANCIES=$(echo "$DISCREPANCIES" | jq --arg phase "$phase_name" \
            '. + ["Phase \"" + $phase + "\" claimed completed but no phase_complete event found"]')
    fi
done

# Rule 3: If workflow status is "completed", verify workflow_complete event exists
WORKFLOW_STATUS=$(echo "$STATE" | jq -r '.status // "unknown"')
if [[ "$WORKFLOW_STATUS" == "completed" ]]; then
    WORKFLOW_COMPLETE_EVENT=$(jq '[.[] | select(.type == "workflow_complete")] | length' "$EVENTS_LOOKUP")
    if [[ "$WORKFLOW_COMPLETE_EVENT" -eq 0 ]]; then
        DISCREPANCIES=$(echo "$DISCREPANCIES" | jq \
            '. + ["Workflow claimed completed but no workflow_complete event found"]')
    fi
fi

# Output result
DISCREPANCY_COUNT=$(echo "$DISCREPANCIES" | jq 'length')

if [[ "$DISCREPANCY_COUNT" -gt 0 ]]; then
    echo "$DISCREPANCIES" | jq \
        --argjson validated "$VALIDATED_STEPS" \
        --argjson total "$STEP_COUNT" \
        '{status: "fail", validated_steps: $validated, total_claimed_steps: $total, discrepancies: .}'
    exit 1
else
    echo "{}" | jq \
        --argjson validated "$VALIDATED_STEPS" \
        --argjson total "$STEP_COUNT" \
        '{status: "pass", validated_steps: $validated, total_claimed_steps: $total}'
    exit 0
fi
