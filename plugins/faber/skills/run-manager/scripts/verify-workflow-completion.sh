#!/usr/bin/env bash
#
# verify-workflow-completion.sh - Verify all conditions for marking workflow completed
#
# Composite verification that MUST pass before workflow status can be set to "completed".
# Calls validate-state-integrity.sh and performs additional completeness checks.
#
# Checks:
#   1. Event-state cross-validation (via validate-state-integrity.sh)
#   2. All enabled phases are completed or skipped
#   3. Claimed step count matches expected steps from plan
#   4. workflow_complete event exists in event log
#
# Usage:
#   verify-workflow-completion.sh --run-id <id> [--base-path <path>]
#
# Exit Codes:
#   0 - All verification checks pass (safe to mark completed)
#   1 - One or more checks failed (do NOT mark completed)
#   2 - Input error (missing args, files not found)
#

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

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
            echo "Usage: verify-workflow-completion.sh --run-id <id> [--base-path <path>]"
            echo ""
            echo "Verifies all conditions required before marking a workflow as completed."
            echo ""
            echo "Options:"
            echo "  --run-id <id>       Full run identifier"
            echo "  --base-path <path>  Base path for run artifacts (default: .fractary/faber/runs)"
            echo ""
            echo "Checks performed:"
            echo "  1. Event-state cross-validation (all success claims backed by events)"
            echo "  2. All enabled phases are completed or skipped"
            echo "  3. Claimed vs expected step count from plan"
            echo "  4. workflow_complete event exists"
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
PLAN_ID="${RUN_ID%$RUN_MARKER*}"
RUN_SUFFIX="${RUN_ID##*$RUN_MARKER}"

STATE_FILE="$BASE_PATH/$PLAN_ID/state-$RUN_SUFFIX.json"
EVENTS_DIR="$BASE_PATH/$RUN_ID/events"
PLAN_FILE="$BASE_PATH/$RUN_ID/plan.json"

# Try alternative event directory locations
if [[ ! -d "$EVENTS_DIR" ]]; then
    EVENTS_DIR="$BASE_PATH/$PLAN_ID/events"
fi

# Try alternative plan file locations
if [[ ! -f "$PLAN_FILE" ]]; then
    PLAN_FILE="$BASE_PATH/$PLAN_ID/plan.json"
fi

# Validate state file exists
if [[ ! -f "$STATE_FILE" ]]; then
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

CHECKS="[]"
ALL_PASSED=true

# ============================================================
# Check 1: Event-State Cross-Validation
# ============================================================
INTEGRITY_SCRIPT="$SCRIPT_DIR/validate-state-integrity.sh"
if [[ -x "$INTEGRITY_SCRIPT" ]]; then
    INTEGRITY_RESULT=$("$INTEGRITY_SCRIPT" --run-id "$RUN_ID" --base-path "$BASE_PATH" 2>/dev/null) || true
    INTEGRITY_STATUS=$(echo "$INTEGRITY_RESULT" | jq -r '.status // "error"')

    if [[ "$INTEGRITY_STATUS" == "pass" ]]; then
        VALIDATED=$(echo "$INTEGRITY_RESULT" | jq '.validated_steps // 0')
        CHECKS=$(echo "$CHECKS" | jq --argjson v "$VALIDATED" \
            '. + [{"check": "event_state_integrity", "status": "pass", "detail": ("All " + ($v | tostring) + " step claims backed by events")}]')
    elif [[ "$INTEGRITY_STATUS" == "fail" ]]; then
        ALL_PASSED=false
        DISCREPANCIES=$(echo "$INTEGRITY_RESULT" | jq -c '.discrepancies // []')
        CHECKS=$(echo "$CHECKS" | jq --argjson d "$DISCREPANCIES" \
            '. + [{"check": "event_state_integrity", "status": "fail", "detail": "State claims not backed by events", "discrepancies": $d}]')
    else
        ALL_PASSED=false
        CHECKS=$(echo "$CHECKS" | jq \
            '. + [{"check": "event_state_integrity", "status": "fail", "detail": "Integrity check returned error"}]')
    fi
else
    ALL_PASSED=false
    CHECKS=$(echo "$CHECKS" | jq \
        '. + [{"check": "event_state_integrity", "status": "fail", "detail": "validate-state-integrity.sh not found or not executable"}]')
fi

# ============================================================
# Check 2: All Enabled Phases Completed or Skipped
# ============================================================
INCOMPLETE_PHASES=$(echo "$STATE" | jq -r '
    [.phases // {} | to_entries[] |
     select(.value.status != "completed" and .value.status != "skipped" and
            (.value.enabled // true) == true) |
     .key] | join(", ")')

if [[ -z "$INCOMPLETE_PHASES" ]]; then
    COMPLETED_COUNT=$(echo "$STATE" | jq '[.phases // {} | to_entries[] | select(.value.status == "completed")] | length')
    SKIPPED_COUNT=$(echo "$STATE" | jq '[.phases // {} | to_entries[] | select(.value.status == "skipped")] | length')
    CHECKS=$(echo "$CHECKS" | jq --argjson c "$COMPLETED_COUNT" --argjson s "$SKIPPED_COUNT" \
        '. + [{"check": "phases_complete", "status": "pass", "detail": (($c | tostring) + " completed, " + ($s | tostring) + " skipped")}]')
else
    ALL_PASSED=false
    CHECKS=$(echo "$CHECKS" | jq --arg p "$INCOMPLETE_PHASES" \
        '. + [{"check": "phases_complete", "status": "fail", "detail": ("Incomplete phases: " + $p)}]')
fi

# ============================================================
# Check 3: Claimed vs Expected Step Count from Plan
# ============================================================
if [[ -f "$PLAN_FILE" ]]; then
    PLAN=$(cat "$PLAN_FILE")
    if echo "$PLAN" | jq empty 2>/dev/null; then
        # Count expected steps from plan: all steps across all enabled phases
        # Steps can be in pre_steps, steps, post_steps arrays per phase
        EXPECTED_STEPS=$(echo "$PLAN" | jq '
            [.workflow.phases // {} | to_entries[] |
             select((.value.enabled // true) == true) |
             ((.value.pre_steps // []) + (.value.steps // []) + (.value.post_steps // []))[]] |
            length')

        # Count claimed successful steps from state
        # Look in both root .steps array and per-phase completed_steps/completed_step_ids
        CLAIMED_STEPS=$(echo "$STATE" | jq '
            (
                [.steps // [] | .[] | select(.status == "success")] | length
            ) as $root_steps |
            (
                [.phases // {} | to_entries[] | .value.completed_step_ids // [] | .[]] | unique | length
            ) as $phase_steps |
            if $root_steps > 0 then $root_steps else $phase_steps end')

        if [[ "$EXPECTED_STEPS" -gt 0 && "$CLAIMED_STEPS" -eq "$EXPECTED_STEPS" ]]; then
            CHECKS=$(echo "$CHECKS" | jq --argjson e "$EXPECTED_STEPS" --argjson c "$CLAIMED_STEPS" \
                '. + [{"check": "step_count", "status": "pass", "detail": (($c | tostring) + "/" + ($e | tostring) + " steps completed")}]')
        elif [[ "$EXPECTED_STEPS" -gt 0 && "$CLAIMED_STEPS" -gt "$EXPECTED_STEPS" ]]; then
            ALL_PASSED=false
            CHECKS=$(echo "$CHECKS" | jq --argjson e "$EXPECTED_STEPS" --argjson c "$CLAIMED_STEPS" \
                '. + [{"check": "step_count", "status": "fail", "detail": ("More steps claimed (" + ($c | tostring) + ") than expected (" + ($e | tostring) + ") - possible fabrication")}]')
        elif [[ "$EXPECTED_STEPS" -gt 0 ]]; then
            ALL_PASSED=false
            CHECKS=$(echo "$CHECKS" | jq --argjson e "$EXPECTED_STEPS" --argjson c "$CLAIMED_STEPS" \
                '. + [{"check": "step_count", "status": "fail", "detail": ("Only " + ($c | tostring) + "/" + ($e | tostring) + " steps completed")}]')
        else
            # No expected steps could be determined from plan
            CHECKS=$(echo "$CHECKS" | jq \
                '. + [{"check": "step_count", "status": "warn", "detail": "Could not determine expected step count from plan"}]')
        fi
    else
        CHECKS=$(echo "$CHECKS" | jq \
            '. + [{"check": "step_count", "status": "warn", "detail": "Plan file is not valid JSON"}]')
    fi
else
    CHECKS=$(echo "$CHECKS" | jq \
        '. + [{"check": "step_count", "status": "warn", "detail": "Plan file not found - cannot verify step count"}]')
fi

# ============================================================
# Check 4: workflow_complete Event Exists
# ============================================================
EVENTS_LOOKUP=$(mktemp)
trap 'rm -f "$EVENTS_LOOKUP"' EXIT

if [[ -d "$EVENTS_DIR" ]]; then
    for event_file in "$EVENTS_DIR"/*.json; do
        [[ -f "$event_file" ]] || continue
        cat "$event_file"
    done | jq -s '.' > "$EVENTS_LOOKUP"
else
    echo '[]' > "$EVENTS_LOOKUP"
fi

WORKFLOW_COMPLETE_COUNT=$(jq '[.[] | select(.type == "workflow_complete")] | length' "$EVENTS_LOOKUP")

if [[ "$WORKFLOW_COMPLETE_COUNT" -gt 0 ]]; then
    CHECKS=$(echo "$CHECKS" | jq \
        '. + [{"check": "workflow_complete_event", "status": "pass", "detail": "workflow_complete event found"}]')
else
    ALL_PASSED=false
    CHECKS=$(echo "$CHECKS" | jq \
        '. + [{"check": "workflow_complete_event", "status": "fail", "detail": "No workflow_complete event found in event log"}]')
fi

# ============================================================
# Output Result
# ============================================================
PASS_COUNT=$(echo "$CHECKS" | jq '[.[] | select(.status == "pass")] | length')
FAIL_COUNT=$(echo "$CHECKS" | jq '[.[] | select(.status == "fail")] | length')
WARN_COUNT=$(echo "$CHECKS" | jq '[.[] | select(.status == "warn")] | length')

if [[ "$ALL_PASSED" == true ]]; then
    echo "$CHECKS" | jq \
        --argjson pass "$PASS_COUNT" \
        --argjson warn "$WARN_COUNT" \
        '{status: "pass", summary: (($pass | tostring) + " checks passed" + (if $warn > 0 then ", " + ($warn | tostring) + " warnings" else "" end)), checks: .}'
    exit 0
else
    echo "$CHECKS" | jq \
        --argjson pass "$PASS_COUNT" \
        --argjson fail "$FAIL_COUNT" \
        --argjson warn "$WARN_COUNT" \
        '{status: "fail", summary: (($fail | tostring) + " checks failed, " + ($pass | tostring) + " passed" + (if $warn > 0 then ", " + ($warn | tostring) + " warnings" else "" end)), checks: .}'
    exit 1
fi
