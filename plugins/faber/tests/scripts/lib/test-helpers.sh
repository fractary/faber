#!/usr/bin/env bash
# test-helpers.sh - Assertions and run fixtures for the plugin script tests
#
# Each test file sources this, defines test_* functions and ends with
# `run_tests`. Every test runs in a fresh temporary project directory.

set -euo pipefail

PLUGIN_ROOT="${FABER_PLUGIN_ROOT:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)}"
SKILLS="$PLUGIN_ROOT/skills"
VERIFIER_SCRIPTS="$SKILLS/fractary-faber-workflow-run-verifier/scripts"
RUN_MANAGER_SCRIPTS="$SKILLS/fractary-faber-run-manager/scripts"
CORE_SCRIPTS="$SKILLS/fractary-faber-core/scripts"
STATE_SCRIPTS="$SKILLS/fractary-faber-faber-state/scripts"

RUNS=".fractary/faber/runs"
PLAN_ID="acme-app-42"
RUN_SUFFIX="2026-10-08T12-00-00Z"
RUN_ID="$PLAN_ID-run-$RUN_SUFFIX"

_FAILURES=0
_CURRENT_TEST=""

fail() {
    echo "    FAIL: $*" >&2
    _FAILURES=$((_FAILURES + 1))
}

assert_eq() {
    local expected="$1" actual="$2" message="$3"
    [[ "$expected" == "$actual" ]] || fail "$message: expected [$expected], got [$actual]"
}

assert_contains() {
    local haystack="$1" needle="$2" message="$3"
    [[ "$haystack" == *"$needle"* ]] || fail "$message: [$needle] not found in [$haystack]"
}

assert_not_contains() {
    local haystack="$1" needle="$2" message="$3"
    [[ "$haystack" != *"$needle"* ]] || fail "$message: [$needle] unexpectedly found in [$haystack]"
}

# Run a command, capturing stdout in OUTPUT, stderr in ERRORS and the exit code in STATUS
run() {
    local err_file
    err_file=$(mktemp)
    set +e
    OUTPUT=$("$@" 2>"$err_file")
    STATUS=$?
    set -e
    ERRORS=$(cat "$err_file")
    rm -f "$err_file"
}

# The detail of one verifier check
check_field() {
    local check="$1" field="$2"
    echo "$OUTPUT" | jq -r --arg c "$check" --arg f "$field" '.checks[] | select(.check == $c) | .[$f]'
}

# Write a completed run of plan acme-app-42 the way the workflow-run skill
# leaves it just before the completion gate: frame, architect and build done
# with events for every step and phase; evaluate and release disabled.
make_completed_run() {
    mkdir -p "$RUNS/$PLAN_ID/$RUN_SUFFIX/events"
    cat > "$RUNS/$PLAN_ID/plan.json" <<'JSON'
{
  "id": "acme-app-42",
  "workflow": {
    "id": "default",
    "inheritance_chain": ["default"],
    "phases": {
      "frame": {"enabled": true, "steps": [{"id": "frame-fetch-issue", "name": "Fetch issue"}]},
      "architect": {"enabled": true, "steps": [{"id": "architect-spec", "name": "Write spec"}]},
      "build": {"enabled": true, "steps": [
        {"id": "build-implement", "name": "Implement"},
        {"id": "build-commit", "name": "Commit"}
      ]},
      "evaluate": {"enabled": false, "steps": [{"id": "evaluate-test", "name": "Test"}]},
      "release": {"enabled": false, "steps": []}
    }
  }
}
JSON
    cat > "$(state_file)" <<JSON
{
  "run_id": "$RUN_ID",
  "plan_id": "$PLAN_ID",
  "status": "in_progress",
  "phases": {
    "frame": {"status": "completed", "steps": {"frame-fetch-issue": {"status": "completed"}}},
    "architect": {"status": "completed", "steps": {"architect-spec": {"status": "completed"}}},
    "build": {"status": "completed", "steps": {
      "build-implement": {"status": "completed"},
      "build-commit": {"status": "completed"}
    }},
    "evaluate": {"status": "skipped", "enabled": false, "steps": {}},
    "release": {"status": "skipped", "enabled": false, "steps": {}}
  },
  "steps_completed": []
}
JSON
    add_event workflow_start '{"type": "workflow_start"}'
    local entry phase step
    for entry in frame:frame-fetch-issue architect:architect-spec build:build-implement build:build-commit; do
        phase="${entry%%:*}"
        step="${entry#*:}"
        add_event step_start "{\"type\": \"step_start\", \"phase\": \"$phase\", \"step\": \"$step\"}"
        add_event step_complete "{\"type\": \"step_complete\", \"phase\": \"$phase\", \"step\": \"$step\", \"status\": \"completed\"}"
    done
    for phase in frame architect build; do
        add_event phase_complete "{\"type\": \"phase_complete\", \"phase\": \"$phase\"}"
    done
}

state_file() {
    echo "$RUNS/$PLAN_ID/state-$RUN_SUFFIX.json"
}

events_dir() {
    echo "$RUNS/$PLAN_ID/$RUN_SUFFIX/events"
}

# Append an event file: add_event <type> <json>
add_event() {
    local dir count
    dir=$(events_dir)
    mkdir -p "$dir"
    count=$(find "$dir" -name '*.json' | wc -l)
    printf '%s\n' "$2" > "$dir/$(printf '%03d' $((count + 1)))-$1.json"
}

# Remove the step_complete event for a step: remove_step_event <step>
remove_step_event() {
    local file
    for file in "$(events_dir)"/*-step_complete.json; do
        if [[ "$(jq -r '.step' "$file")" == "$1" ]]; then
            rm -f "$file"
        fi
    done
}

# Apply a jq filter to the state file in place: edit_state <filter>
edit_state() {
    local tmp
    tmp=$(mktemp)
    jq "$1" "$(state_file)" > "$tmp"
    mv "$tmp" "$(state_file)"
}

run_tests() {
    local test_fn test_dir failures_before code total=0 failed=0
    for test_fn in $(declare -F | awk '{print $3}' | grep '^test_' | sort); do
        total=$((total + 1))
        failures_before=$_FAILURES
        test_dir=$(mktemp -d)
        # Run the test in a subshell with errexit on: an unexpected failing
        # command ends the test as failed. (A subshell tested with && or ||
        # would silently ignore errexit, so test the exit code afterwards.)
        set +e
        (
            set -e
            cd "$test_dir"
            "$test_fn"
            exit "$_FAILURES"
        ) > "$test_dir.log" 2>&1
        code=$?
        set -e
        if [[ $code -ne 0 ]]; then
            failed=$((failed + 1))
            echo "  not ok - $test_fn"
            sed 's/^/  /' "$test_dir.log"
        else
            echo "  ok - $test_fn"
        fi
        rm -rf "$test_dir" "$test_dir.log"
        _FAILURES=$failures_before
    done
    echo "  $((total - failed))/$total passed"
    [[ $failed -eq 0 ]]
}
