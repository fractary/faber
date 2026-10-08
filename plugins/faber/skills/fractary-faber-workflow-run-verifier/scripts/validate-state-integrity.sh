#!/usr/bin/env bash
#
# validate-state-integrity.sh - Cross-validate state claims against event log
#
# For each step the state records as completed, verifies that a matching
# step_complete event exists in the run's immutable event log. For each phase
# marked "completed", verifies a phase_complete event exists. If the workflow
# is marked "completed", verifies a workflow_complete event exists.
#
# Steps are read from .phases[].steps (keyed by step ID, or as an array) and
# from the root .steps array that older runs used.
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

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
RUN_PATHS_LIB="$SCRIPT_DIR/../../fractary-faber-core/scripts/lib/run-paths.sh"

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

if [[ ! -f "$RUN_PATHS_LIB" ]]; then
    echo '{"status": "error", "message": "run-paths.sh not found: '"$RUN_PATHS_LIB"'"}' >&2
    exit 2
fi
source "$RUN_PATHS_LIB"

# The state file and events must be this run's: never fall back to another run's
STATE_FILE=$(faber_run_state_file "$BASE_PATH" "$RUN_ID")
EVENTS_DIR=$(faber_run_events_dir "$BASE_PATH" "$RUN_ID")

if [[ ! -f "$STATE_FILE" ]]; then
    echo '{"status": "error", "message": "State file not found for run: '"$RUN_ID"'"}' >&2
    exit 2
fi

# Read state file
STATE=$(cat "$STATE_FILE")
if ! echo "$STATE" | jq empty 2>/dev/null; then
    echo '{"status": "error", "message": "State file is not valid JSON"}' >&2
    exit 2
fi

# Collect all events into a temporary lookup
EVENTS_LOOKUP=$(mktemp)
trap 'rm -f "$EVENTS_LOOKUP"' EXIT

if [[ -n "$EVENTS_DIR" ]]; then
    for event_file in "$EVENTS_DIR"/*.json; do
        [[ -f "$event_file" ]] || continue
        cat "$event_file"
    done | jq -s '.' > "$EVENTS_LOOKUP"
else
    echo '[]' > "$EVENTS_LOOKUP"
fi

# Rule 1: Every step recorded as completed must have a step_complete event for
# the same step, and the same phase when the event names one. The event tool
# stores the step ID in "step"; older emitters used "step_id" or metadata.
CLAIMED_STEPS=$(echo "$STATE" | jq -c '
    def done: . == "completed" or . == "success";
    [(.phases // {}) | to_entries[] | .key as $ph | (.value.steps // null) |
        if type == "object" then to_entries[] | select((.value.status // "") | done) | {phase: $ph, id: .key}
        elif type == "array" then .[] | select((.status // "") | done) | {phase: $ph, id: (.id // .name)}
        else empty end]
    + [(.steps // []) | if type == "array" then .[] else empty end
        | select((.status // "") | done) | {phase: .phase, id: (.step_id // .id)}]
    | map(select(.id != null)) | unique')
STEP_COUNT=$(echo "$CLAIMED_STEPS" | jq 'length')

UNBACKED_STEPS=$(jq -c --argjson claimed "$CLAIMED_STEPS" '
    [.[] | select(.type == "step_complete")
         | {step: (.step // .step_id // .metadata.step_id), phase: (.phase // .metadata.phase)}] as $events
    | [$claimed[] | . as $c
        | select([$events[] | select(.step == $c.id and (.phase == null or $c.phase == null or .phase == $c.phase))]
                 | length == 0)]' "$EVENTS_LOOKUP")
VALIDATED_STEPS=$((STEP_COUNT - $(echo "$UNBACKED_STEPS" | jq 'length')))

DISCREPANCIES=$(echo "$UNBACKED_STEPS" | jq '[.[] |
    "Step \"" + .id + "\" (phase: " + (.phase // "unknown") + ") claimed completed but no step_complete event found"]')

# Rule 2: Every phase with status "completed" must have a phase_complete event
COMPLETED_PHASES=$(echo "$STATE" | jq -c '[.phases // {} | to_entries[] | select(.value.status == "completed") | .key]')
UNBACKED_PHASES=$(jq -c --argjson phases "$COMPLETED_PHASES" '
    [.[] | select(.type == "phase_complete") | (.phase // .metadata.phase)] as $events
    | [$phases[] | select(. as $p | $events | index($p) == null)]' "$EVENTS_LOOKUP")
DISCREPANCIES=$(jq -n --argjson d "$DISCREPANCIES" --argjson p "$UNBACKED_PHASES" \
    '$d + [$p[] | "Phase \"" + . + "\" claimed completed but no phase_complete event found"]')

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
        --arg events_dir "$EVENTS_DIR" \
        '{status: "fail", validated_steps: $validated, total_claimed_steps: $total, events_dir: $events_dir, discrepancies: .}'
    exit 1
else
    jq -n \
        --argjson validated "$VALIDATED_STEPS" \
        --argjson total "$STEP_COUNT" \
        --arg events_dir "$EVENTS_DIR" \
        '{status: "pass", validated_steps: $validated, total_claimed_steps: $total, events_dir: $events_dir}'
    exit 0
fi
