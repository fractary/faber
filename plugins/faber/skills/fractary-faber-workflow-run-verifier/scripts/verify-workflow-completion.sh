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
#   4. Step ID prefix convention (all steps follow {phase}-{action} naming)
#   5. workflow_complete event exists once the state records the workflow as completed
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
            echo "  4. Step ID prefix convention ({phase}-{action} naming)"
            echo "  5. workflow_complete event exists (once state says completed)"
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

RUN_PATHS_LIB="$SCRIPT_DIR/../../fractary-faber-core/scripts/lib/run-paths.sh"
if [[ ! -f "$RUN_PATHS_LIB" ]]; then
    echo '{"status": "error", "message": "run-paths.sh not found: '"$RUN_PATHS_LIB"'"}' >&2
    exit 2
fi
source "$RUN_PATHS_LIB"

# Resolve the run's files the way the CLI does: a plan-scoped run ID keeps the
# plan and one state file per run in the plan's folder, and its events in
# {plan_id}/{run_suffix}/events. The state must be this run's: never fall back
# to another run's state.
STATE_FILE=$(faber_run_state_file "$BASE_PATH" "$RUN_ID")
PLAN_FILE=$(faber_run_plan_file "$BASE_PATH" "$RUN_ID")
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

CHECKS="[]"
ALL_PASSED=true

# ============================================================
# Check 1: Event-State Cross-Validation
# ============================================================
INTEGRITY_SCRIPT="$SCRIPT_DIR/validate-state-integrity.sh"
if [[ -f "$INTEGRITY_SCRIPT" ]]; then
    INTEGRITY_RESULT=$(bash "$INTEGRITY_SCRIPT" --run-id "$RUN_ID" --base-path "$BASE_PATH" 2>/dev/null) || true
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
        '. + [{"check": "event_state_integrity", "status": "fail", "detail": "validate-state-integrity.sh not found"}]')
fi

PLAN_VALID=false
if [[ -f "$PLAN_FILE" ]] && jq empty "$PLAN_FILE" 2>/dev/null; then
    PLAN_VALID=true
fi

# ============================================================
# Check 2: All Enabled Phases Completed or Skipped
# ============================================================
# Required phases come from the plan (every phase not disabled), or from the
# state when there is no plan. The workflow-run skill does not mark disabled
# phases in state, so the plan is the reliable source.
if [[ "$PLAN_VALID" == true ]]; then
    REQUIRED_PHASES=$(jq -c '[.workflow.phases // {} | to_entries[] | select(.value.enabled != false) | .key]' "$PLAN_FILE")
else
    REQUIRED_PHASES=$(echo "$STATE" | jq -c '[.phases // {} | to_entries[] | select(.value.enabled != false) | .key]')
fi
INCOMPLETE_PHASES=$(echo "$STATE" | jq -r --argjson required "$REQUIRED_PHASES" '
    [$required[] as $p | (.phases[$p].status // "pending") as $s |
     select($s != "completed" and $s != "skipped") | $p] | join(", ")')

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
if [[ "$PLAN_VALID" == true ]]; then
    # Expected steps: every step of every enabled phase in the plan (the plan's
    # steps already include merged pre/post steps; parallel groups expanded).
    # A step is done when the state records it completed, succeeded or skipped.
    # States keep steps in .phases[].steps (keyed by ID, or as an array) or, in
    # older runs, in completed_step_ids or a root .steps array.
    STEP_REPORT=$(jq -n --slurpfile plan "$PLAN_FILE" --slurpfile state "$STATE_FILE" '
        def step_ids($phase):
            ($phase.steps // [])
            | map(if type == "object" and has("steps_parallel") then .steps_parallel[] else . end)
            | map(.id // .name);
        def status_of($s; $ph; $id):
            ($s.phases[$ph].steps // null) as $steps
            | (if ($steps | type) == "object" then $steps[$id].status
               elif ($steps | type) == "array" then ([$steps[] | select((.id // .name) == $id) | .status] | last)
               else null end)
              // (if (($s.phases[$ph].completed_step_ids // []) | index($id)) != null then "completed" else null end)
              // ([($s.steps // [])[] | select((.step_id // .id) == $id and ((.phase // $ph) == $ph)) | .status] | last);
        def executed($s):
            [($s.phases // {}) | to_entries[] | .key as $ph | (.value.steps // null) |
                if type == "object" then to_entries[] | select(.value.status == "completed" or .value.status == "success") | {phase: $ph, id: .key}
                elif type == "array" then .[] | select(.status == "completed" or .status == "success") | {phase: $ph, id: (.id // .name)}
                else empty end]
            + [($s.phases // {}) | to_entries[] | .key as $ph | (.value.completed_step_ids // [])[] | {phase: $ph, id: .}]
            + [($s.steps // [])[] | select(.status == "success") | {phase: .phase, id: (.step_id // .id)}];
        ($plan[0]) as $p | ($state[0]) as $s
        | [($p.workflow.phases // {}) | to_entries[] | select(.value.enabled != false)
           | .key as $ph | step_ids(.value)[] | {phase: $ph, id: .}] as $expected
        | [$expected[] | select((status_of($s; .phase; .id) // "") as $st
                                | $st == "completed" or $st == "success" or $st == "skipped")] as $done
        | (executed($s) | unique) as $executed
        | {expected: ($expected | length),
           claimed: ($done | length),
           missing: [$expected[] | select(. as $e | ($done | index($e)) == null) | "\(.phase):\(.id)"],
           extra: [$executed[] | select(. as $x | ($expected | index($x)) == null) | "\(.phase):\(.id)"]}')

    EXPECTED_STEPS=$(echo "$STEP_REPORT" | jq '.expected')
    CLAIMED_STEPS=$(echo "$STEP_REPORT" | jq '.claimed')
    MISSING_STEPS=$(echo "$STEP_REPORT" | jq -r '.missing | join(", ")')
    EXTRA_STEPS=$(echo "$STEP_REPORT" | jq -r '.extra | join(", ")')

    if [[ -n "$EXTRA_STEPS" ]]; then
        ALL_PASSED=false
        CHECKS=$(echo "$CHECKS" | jq --arg x "$EXTRA_STEPS" \
            '. + [{"check": "step_count", "status": "fail", "detail": ("Steps recorded as completed that the plan does not contain: " + $x + " - possible fabrication")}]')
    elif [[ "$EXPECTED_STEPS" -eq 0 ]]; then
        CHECKS=$(echo "$CHECKS" | jq \
            '. + [{"check": "step_count", "status": "warn", "detail": "Could not determine expected step count from plan"}]')
    elif [[ "$CLAIMED_STEPS" -eq "$EXPECTED_STEPS" ]]; then
        CHECKS=$(echo "$CHECKS" | jq --argjson e "$EXPECTED_STEPS" --argjson c "$CLAIMED_STEPS" \
            '. + [{"check": "step_count", "status": "pass", "detail": (($c | tostring) + "/" + ($e | tostring) + " steps completed")}]')
    else
        ALL_PASSED=false
        CHECKS=$(echo "$CHECKS" | jq --argjson e "$EXPECTED_STEPS" --argjson c "$CLAIMED_STEPS" --arg m "$MISSING_STEPS" \
            '. + [{"check": "step_count", "status": "fail", "detail": ("Only " + ($c | tostring) + "/" + ($e | tostring) + " steps completed; not done: " + $m)}]')
    fi
elif [[ -f "$PLAN_FILE" ]]; then
    CHECKS=$(echo "$CHECKS" | jq \
        '. + [{"check": "step_count", "status": "warn", "detail": "Plan file is not valid JSON"}]')
else
    CHECKS=$(echo "$CHECKS" | jq \
        '. + [{"check": "step_count", "status": "warn", "detail": "Plan file not found - cannot verify step count"}]')
fi

# ============================================================
# Check 4: Step ID Prefix Convention (all steps follow {phase}-{action})
# ============================================================
PREFIX_SCRIPT="$SCRIPT_DIR/../../fractary-faber-run-manager/scripts/validate-plan-step-ids.sh"
if [[ -f "$PLAN_FILE" && -f "$PREFIX_SCRIPT" ]]; then
    PREFIX_RESULT=$(bash "$PREFIX_SCRIPT" --plan-file "$PLAN_FILE" 2>/dev/null) || true
    PREFIX_STATUS=$(echo "$PREFIX_RESULT" | jq -r '.status // "error"')

    if [[ "$PREFIX_STATUS" == "pass" ]]; then
        CHECKS=$(echo "$CHECKS" | jq \
            '. + [{"check": "step_id_prefix_convention", "status": "pass", "detail": "All step IDs follow {phase}-{action} convention"}]')
    elif [[ "$PREFIX_STATUS" == "fail" ]]; then
        VIOLATIONS=$(echo "$PREFIX_RESULT" | jq -c '.violations // []')
        ALL_PASSED=false
        CHECKS=$(echo "$CHECKS" | jq --argjson v "$VIOLATIONS" \
            '. + [{"check": "step_id_prefix_convention", "status": "fail", "detail": "Step IDs violate {phase}-{action} convention — steps may have been silently skipped", "violations": $v}]')
    else
        CHECKS=$(echo "$CHECKS" | jq \
            '. + [{"check": "step_id_prefix_convention", "status": "warn", "detail": "Step ID prefix validation returned error or unknown status"}]')
    fi
elif [[ ! -f "$PLAN_FILE" ]]; then
    CHECKS=$(echo "$CHECKS" | jq \
        '. + [{"check": "step_id_prefix_convention", "status": "warn", "detail": "Plan file not found — cannot validate step ID prefixes"}]')
else
    CHECKS=$(echo "$CHECKS" | jq \
        '. + [{"check": "step_id_prefix_convention", "status": "warn", "detail": "validate-plan-step-ids.sh not found"}]')
fi

# ============================================================
# Check 5: workflow_complete Event Exists
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
WORKFLOW_STATUS=$(echo "$STATE" | jq -r '.status // "unknown"')

# The run emits workflow_complete only after this check passes, so the event is
# required only once the state records the workflow as completed (an audit of
# a finished run). Before then, its absence is expected.
if [[ "$WORKFLOW_COMPLETE_COUNT" -gt 0 ]]; then
    CHECKS=$(echo "$CHECKS" | jq \
        '. + [{"check": "workflow_complete_event", "status": "pass", "detail": "workflow_complete event found"}]')
elif [[ "$WORKFLOW_STATUS" == "completed" ]]; then
    ALL_PASSED=false
    CHECKS=$(echo "$CHECKS" | jq \
        '. + [{"check": "workflow_complete_event", "status": "fail", "detail": "State records the workflow as completed but no workflow_complete event found in event log"}]')
else
    CHECKS=$(echo "$CHECKS" | jq \
        '. + [{"check": "workflow_complete_event", "status": "pass", "detail": "Not expected yet: workflow_complete is emitted after this check passes"}]')
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
