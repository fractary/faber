#!/usr/bin/env bash
#
# verify-plan-adherence.sh - Compare planned steps against actually executed steps
#
# Reads plan.json and state.json to produce a per-phase breakdown of which
# planned steps were executed, which were skipped, and which unplanned steps
# were executed. Outputs JSON or GitHub-flavored markdown.
#
# Usage:
#   verify-plan-adherence.sh --run-id <id> [--base-path <path>] [--format markdown|json]
#
# Exit Codes:
#   0 - All planned steps were executed (perfect adherence)
#   1 - Discrepancies found (informational, not blocking)
#   2 - Input error (missing args, files not found)
#

set -euo pipefail

# Parse arguments
RUN_ID=""
BASE_PATH=".fractary/faber/runs"
FORMAT="json"

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
        --format)
            FORMAT="$2"
            shift 2
            ;;
        -h|--help)
            echo "Usage: verify-plan-adherence.sh --run-id <id> [--base-path <path>] [--format markdown|json]"
            echo ""
            echo "Compares planned workflow steps against actually executed steps."
            echo ""
            echo "Options:"
            echo "  --run-id <id>       Full run identifier"
            echo "  --base-path <path>  Base path for run artifacts (default: .fractary/faber/runs)"
            echo "  --format <fmt>      Output format: json (default) or markdown"
            echo ""
            echo "Exit codes:"
            echo "  0 - Perfect adherence (all planned steps executed)"
            echo "  1 - Discrepancies found (skipped or unplanned steps)"
            echo "  2 - Input error"
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
PLAN_FILE="$BASE_PATH/$RUN_ID/plan.json"

# Try alternative plan file location
if [[ ! -f "$PLAN_FILE" ]]; then
    PLAN_FILE="$BASE_PATH/$PLAN_ID/plan.json"
fi

# Try to find state file with fallback
if [[ ! -f "$STATE_FILE" ]]; then
    STATE_FILE=$(find "$BASE_PATH/$PLAN_ID" -name "state-*.json" -type f 2>/dev/null | head -1)
    if [[ -z "$STATE_FILE" || ! -f "$STATE_FILE" ]]; then
        echo '{"status": "error", "message": "State file not found for run: '"$RUN_ID"'"}' >&2
        exit 2
    fi
fi

# Validate plan file exists
if [[ ! -f "$PLAN_FILE" ]]; then
    echo '{"status": "error", "message": "Plan file not found for run: '"$RUN_ID"'"}' >&2
    exit 2
fi

# Read and validate files
STATE=$(cat "$STATE_FILE")
PLAN=$(cat "$PLAN_FILE")

if ! echo "$STATE" | jq empty 2>/dev/null; then
    echo '{"status": "error", "message": "State file is not valid JSON"}' >&2
    exit 2
fi

if ! echo "$PLAN" | jq empty 2>/dev/null; then
    echo '{"status": "error", "message": "Plan file is not valid JSON"}' >&2
    exit 2
fi

# ============================================================
# Build per-phase adherence report
# ============================================================

# Get list of phases from plan
PHASE_NAMES=$(echo "$PLAN" | jq -r '.workflow.phases // {} | keys[]')

PHASES_RESULT="[]"
TOTAL_PLANNED=0
TOTAL_EXECUTED=0
TOTAL_SKIPPED=0
TOTAL_UNPLANNED=0
ALL_SKIPPED="[]"
ALL_UNPLANNED="[]"
HAS_DISCREPANCIES=false

for PHASE in $PHASE_NAMES; do
    # Check if phase is enabled in plan
    ENABLED=$(echo "$PLAN" | jq -r --arg p "$PHASE" '.workflow.phases[$p].enabled // true')
    if [[ "$ENABLED" != "true" ]]; then
        continue
    fi

    # Get planned step IDs from plan (pre_steps + steps + post_steps)
    PLANNED_IDS=$(echo "$PLAN" | jq -r --arg p "$PHASE" '
        [(.workflow.phases[$p].pre_steps // []) +
         (.workflow.phases[$p].steps // []) +
         (.workflow.phases[$p].post_steps // []) | .[].id] | .[]')

    # Get executed step IDs from state
    EXECUTED_IDS=$(echo "$STATE" | jq -r --arg p "$PHASE" '
        .phases[$p].completed_step_ids // [] | .[]')

    # Convert to arrays for comparison
    PLANNED_ARRAY=()
    while IFS= read -r id; do
        [[ -n "$id" ]] && PLANNED_ARRAY+=("$id")
    done <<< "$PLANNED_IDS"

    EXECUTED_ARRAY=()
    while IFS= read -r id; do
        [[ -n "$id" ]] && EXECUTED_ARRAY+=("$id")
    done <<< "$EXECUTED_IDS"

    # Classify steps
    PHASE_EXECUTED=0
    PHASE_SKIPPED=0
    PHASE_UNPLANNED=0
    PHASE_SKIPPED_IDS="[]"
    PHASE_UNPLANNED_IDS="[]"

    # Check planned steps: executed or skipped?
    for planned_id in "${PLANNED_ARRAY[@]}"; do
        FOUND=false
        for exec_id in "${EXECUTED_ARRAY[@]}"; do
            if [[ "$planned_id" == "$exec_id" ]]; then
                FOUND=true
                break
            fi
        done
        if [[ "$FOUND" == true ]]; then
            PHASE_EXECUTED=$((PHASE_EXECUTED + 1))
        else
            PHASE_SKIPPED=$((PHASE_SKIPPED + 1))
            PHASE_SKIPPED_IDS=$(echo "$PHASE_SKIPPED_IDS" | jq --arg id "$planned_id" --arg p "$PHASE" '. + [{"id": $id, "phase": $p}]')
            HAS_DISCREPANCIES=true
        fi
    done

    # Check executed steps: any unplanned?
    for exec_id in "${EXECUTED_ARRAY[@]}"; do
        FOUND=false
        for planned_id in "${PLANNED_ARRAY[@]}"; do
            if [[ "$exec_id" == "$planned_id" ]]; then
                FOUND=true
                break
            fi
        done
        if [[ "$FOUND" != true ]]; then
            PHASE_UNPLANNED=$((PHASE_UNPLANNED + 1))
            PHASE_UNPLANNED_IDS=$(echo "$PHASE_UNPLANNED_IDS" | jq --arg id "$exec_id" --arg p "$PHASE" '. + [{"id": $id, "phase": $p}]')
            HAS_DISCREPANCIES=true
        fi
    done

    PHASE_PLANNED=${#PLANNED_ARRAY[@]}

    # Add phase result
    PHASES_RESULT=$(echo "$PHASES_RESULT" | jq \
        --arg phase "$PHASE" \
        --argjson planned "$PHASE_PLANNED" \
        --argjson executed "$PHASE_EXECUTED" \
        --argjson skipped "$PHASE_SKIPPED" \
        --argjson unplanned "$PHASE_UNPLANNED" \
        --argjson skipped_ids "$PHASE_SKIPPED_IDS" \
        --argjson unplanned_ids "$PHASE_UNPLANNED_IDS" \
        '. + [{
            "phase": $phase,
            "planned": $planned,
            "executed": $executed,
            "skipped": $skipped,
            "unplanned": $unplanned,
            "skipped_steps": $skipped_ids,
            "unplanned_steps": $unplanned_ids
        }]')

    TOTAL_PLANNED=$((TOTAL_PLANNED + PHASE_PLANNED))
    TOTAL_EXECUTED=$((TOTAL_EXECUTED + PHASE_EXECUTED))
    TOTAL_SKIPPED=$((TOTAL_SKIPPED + PHASE_SKIPPED))
    TOTAL_UNPLANNED=$((TOTAL_UNPLANNED + PHASE_UNPLANNED))
    ALL_SKIPPED=$(echo "$ALL_SKIPPED" "$PHASE_SKIPPED_IDS" | jq -s '.[0] + .[1]')
    ALL_UNPLANNED=$(echo "$ALL_UNPLANNED" "$PHASE_UNPLANNED_IDS" | jq -s '.[0] + .[1]')
done

# ============================================================
# Build result
# ============================================================

if [[ "$HAS_DISCREPANCIES" == true ]]; then
    STATUS="discrepancies"
else
    STATUS="perfect"
fi

RESULT=$(jq -n \
    --arg status "$STATUS" \
    --arg run_id "$RUN_ID" \
    --argjson total_planned "$TOTAL_PLANNED" \
    --argjson total_executed "$TOTAL_EXECUTED" \
    --argjson total_skipped "$TOTAL_SKIPPED" \
    --argjson total_unplanned "$TOTAL_UNPLANNED" \
    --argjson phases "$PHASES_RESULT" \
    --argjson skipped_steps "$ALL_SKIPPED" \
    --argjson unplanned_steps "$ALL_UNPLANNED" \
    '{
        status: $status,
        run_id: $run_id,
        summary: {
            total_planned: $total_planned,
            total_executed: $total_executed,
            total_skipped: $total_skipped,
            total_unplanned: $total_unplanned
        },
        phases: $phases,
        skipped_steps: $skipped_steps,
        unplanned_steps: $unplanned_steps
    }')

# ============================================================
# Output
# ============================================================

if [[ "$FORMAT" == "markdown" ]]; then
    echo "## Plan Adherence Report"
    echo ""
    echo "**Run ID:** \`$RUN_ID\`"
    if [[ "$HAS_DISCREPANCIES" == true ]]; then
        echo "**Result:** $TOTAL_EXECUTED/$TOTAL_PLANNED planned steps executed (discrepancies found)"
    else
        echo "**Result:** $TOTAL_EXECUTED/$TOTAL_PLANNED planned steps executed (perfect adherence)"
    fi
    echo ""
    echo "### Per-Phase Breakdown"
    echo "| Phase | Planned | Executed | Skipped | Unplanned |"
    echo "|-------|---------|----------|---------|-----------|"
    echo "$PHASES_RESULT" | jq -r '.[] | "| " + .phase + " | " + (.planned | tostring) + " | " + (.executed | tostring) + " | " + (.skipped | tostring) + " | " + (.unplanned | tostring) + " |"'

    if [[ "$TOTAL_SKIPPED" -gt 0 ]]; then
        echo ""
        echo "### Skipped Steps (planned but not executed)"
        echo "$ALL_SKIPPED" | jq -r '.[] | "- `" + .id + "` (" + .phase + ")"'
    fi

    if [[ "$TOTAL_UNPLANNED" -gt 0 ]]; then
        echo ""
        echo "### Unplanned Steps (executed but not in plan)"
        echo "$ALL_UNPLANNED" | jq -r '.[] | "- `" + .id + "` (" + .phase + ")"'
    fi
else
    echo "$RESULT"
fi

# Exit code: 0 for perfect, 1 for discrepancies
if [[ "$HAS_DISCREPANCIES" == true ]]; then
    exit 1
else
    exit 0
fi
