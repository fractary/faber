#!/usr/bin/env bash
# Tests for the state transition guard (#244): validate-state-transition.sh
# and the state update scripts that must run it.

source "$(dirname "${BASH_SOURCE[0]}")/lib/test-helpers.sh"

VALIDATE="$RUN_MANAGER_SCRIPTS/validate-state-transition.sh"

write_state() {
    printf '%s\n' "$2" > "$1"
}

test_one_completion_per_update_is_allowed() {
    write_state current.json '{"status": "in_progress", "phases": {"build": {"steps": {"a": {"status": "pending"}, "b": {"status": "pending"}}}}}'
    run "$VALIDATE" --current current.json --proposed-json \
        '{"status": "in_progress", "phases": {"build": {"steps": {"a": {"status": "completed"}, "b": {"status": "pending"}}}}}'
    assert_eq 0 "$STATUS" "exit code"
}

test_two_completions_in_one_update_are_rejected() {
    write_state current.json '{"status": "in_progress", "phases": {"build": {"steps": {"a": {"status": "pending"}, "b": {"status": "pending"}}}}}'
    run "$VALIDATE" --current current.json --proposed-json \
        '{"status": "in_progress", "phases": {"build": {"steps": {"a": {"status": "completed"}, "b": {"status": "completed"}}}}}'
    assert_eq 1 "$STATUS" "exit code"
    assert_contains "$OUTPUT" "Cannot advance more than 1 step" "violation"
}

test_two_completions_in_array_layout_are_rejected() {
    write_state current.json '{"status": "in_progress", "phases": {"build": {"steps": []}}}'
    run "$VALIDATE" --current current.json --proposed-json \
        '{"status": "in_progress", "phases": {"build": {"steps": [{"name": "a", "status": "completed"}, {"name": "b", "status": "completed"}]}}}'
    assert_eq 1 "$STATUS" "exit code"
}

test_completed_workflow_needs_enabled_phases_done() {
    write_state current.json '{"status": "in_progress", "phases": {"build": {"status": "in_progress"}, "release": {"status": "pending", "enabled": false}}}'
    run "$VALIDATE" --current current.json --proposed-json \
        '{"status": "completed", "phases": {"build": {"status": "in_progress"}, "release": {"status": "pending", "enabled": false}}}'
    assert_eq 1 "$STATUS" "exit code with build in progress"
    assert_contains "$OUTPUT" "phases not completed: build" "violation"
    assert_not_contains "$OUTPUT" "release" "disabled phase"

    run "$VALIDATE" --current current.json --proposed-json \
        '{"status": "completed", "phases": {"build": {"status": "completed"}, "release": {"status": "pending", "enabled": false}}}'
    assert_eq 0 "$STATUS" "exit code with build completed"
}

# Copy the skills the state scripts need, so a test can remove the validator
copy_skills() {
    mkdir -p plugin/skills
    cp -r "$SKILLS/fractary-faber-core" "$SKILLS/fractary-faber-faber-state" "$SKILLS/fractary-faber-run-manager" plugin/skills/
}

test_step_update_fails_when_validator_is_missing() {
    copy_skills
    rm plugin/skills/fractary-faber-run-manager/scripts/validate-state-transition.sh
    mkdir -p .fractary/faber
    write_state .fractary/faber/state.json '{"status": "in_progress", "phases": {"build": {"status": "in_progress"}}}'
    local before
    before=$(cat .fractary/faber/state.json)
    run plugin/skills/fractary-faber-faber-state/scripts/state-update-step.sh build implement completed
    assert_eq 1 "$STATUS" "exit code"
    assert_contains "$ERRORS" "validator not found" "error"
    assert_eq "$before" "$(cat .fractary/faber/state.json)" "state unchanged"
}

test_phase_update_fails_when_validator_is_missing() {
    copy_skills
    rm plugin/skills/fractary-faber-run-manager/scripts/validate-state-transition.sh
    mkdir -p .fractary/faber
    write_state .fractary/faber/state.json '{"status": "in_progress", "phases": {"build": {"status": "in_progress"}}}'
    run plugin/skills/fractary-faber-core/scripts/state-update-phase.sh build completed
    assert_eq 1 "$STATUS" "exit code"
    assert_contains "$ERRORS" "validator not found" "error"
}

test_step_update_runs_the_guard() {
    mkdir -p .fractary/faber
    write_state .fractary/faber/state.json '{"status": "in_progress", "phases": {"build": {"status": "in_progress"}}}'
    run "$STATE_SCRIPTS/state-update-step.sh" build implement completed
    assert_eq 0 "$STATUS" "exit code"
    assert_eq completed "$(jq -r '.phases.build.steps[] | select(.name == "implement") | .status' .fractary/faber/state.json)" "step status"
    assert_eq 1 "$(jq -s 'length' .fractary/faber/state.json)" "state holds one JSON document"
}

run_tests
