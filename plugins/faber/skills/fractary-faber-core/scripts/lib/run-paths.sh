#!/usr/bin/env bash
# run-paths.sh - Resolve a FABER run's files from its run ID without the CLI
#
# Mirrors parseRunId, getRunDir and getStatePath in sdk/js/src/paths.ts, so the
# shell tools and the CLI agree on where a run's files are.
#
# A plan-scoped run ID ({plan_id}-run-{run_suffix}, where the suffix is a UTC
# timestamp such as 2026-10-08T12-00-00Z) keeps its files in the plan's folder:
#
#   {runs_dir}/{plan_id}/plan.json
#   {runs_dir}/{plan_id}/state-{run_suffix}.json
#   {runs_dir}/{plan_id}/{run_suffix}/events/    (written by the event tool)
#
# The ID is split on the last "-run-", so plan IDs may contain "-run-". Any
# other run ID keeps plan.json, state.json and events/ in {runs_dir}/{run_id}/.
#
# Usage:
#   source run-paths.sh
#   if faber_parse_run_id "$RUN_ID"; then echo "$FABER_PLAN_ID $FABER_RUN_SUFFIX"; fi
#   STATE_FILE=$(faber_run_state_file "$RUNS_DIR" "$RUN_ID")
#   PLAN_FILE=$(faber_run_plan_file "$RUNS_DIR" "$RUN_ID")
#   EVENTS_DIR=$(faber_run_events_dir "$RUNS_DIR" "$RUN_ID")   # empty if none exists

FABER_RUN_ID_MARKER="-run-"
FABER_RUN_SUFFIX_PATTERN='^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}-[0-9]{2}-[0-9]{2}Z(-[0-9]+)?$'

# Split a plan-scoped run ID. Sets FABER_PLAN_ID and FABER_RUN_SUFFIX and
# returns 0, or clears them and returns 1 when the ID is not plan-scoped.
# Call it as a condition so a non-zero return does not trip `set -e`.
faber_parse_run_id() {
    local run_id="$1"
    FABER_PLAN_ID=""
    FABER_RUN_SUFFIX=""
    [[ "$run_id" == *"$FABER_RUN_ID_MARKER"* ]] || return 1

    local plan_id="${run_id%"$FABER_RUN_ID_MARKER"*}"
    local run_suffix="${run_id##*"$FABER_RUN_ID_MARKER"}"
    [[ -n "$plan_id" && "$run_suffix" =~ $FABER_RUN_SUFFIX_PATTERN ]] || return 1

    FABER_PLAN_ID="$plan_id"
    FABER_RUN_SUFFIX="$run_suffix"
}

# Print the folder holding the run's plan (and, for plan-scoped IDs, its state).
faber_run_dir() {
    local runs_dir="$1" run_id="$2"
    if faber_parse_run_id "$run_id"; then
        echo "$runs_dir/$FABER_PLAN_ID"
    else
        echo "$runs_dir/$run_id"
    fi
}

# Print the run's plan file path.
faber_run_plan_file() {
    echo "$(faber_run_dir "$1" "$2")/plan.json"
}

# Print the run's state file path.
faber_run_state_file() {
    local runs_dir="$1" run_id="$2"
    if faber_parse_run_id "$run_id"; then
        echo "$runs_dir/$FABER_PLAN_ID/state-$FABER_RUN_SUFFIX.json"
    else
        echo "$runs_dir/$run_id/state.json"
    fi
}

# Print the run's events directory: the first location that exists, or nothing.
# Only this run's own folders are considered, never another run's events.
faber_run_events_dir() {
    local runs_dir="$1" run_id="$2" candidate
    local -a candidates
    if faber_parse_run_id "$run_id"; then
        candidates=("$runs_dir/$FABER_PLAN_ID/$FABER_RUN_SUFFIX/events" "$runs_dir/$run_id/events")
    else
        candidates=("$runs_dir/$run_id/events")
    fi
    for candidate in "${candidates[@]}"; do
        if [[ -d "$candidate" ]]; then
            echo "$candidate"
            return 0
        fi
    done
    return 0
}
