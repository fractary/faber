#!/usr/bin/env bash
# Tests for validate-state-integrity.sh: every completion the state claims
# must be backed by an event in the run's own event log (#245).

source "$(dirname "${BASH_SOURCE[0]}")/lib/test-helpers.sh"

INTEGRITY="$VERIFIER_SCRIPTS/validate-state-integrity.sh"

test_completed_run_passes() {
    make_completed_run
    run "$INTEGRITY" --run-id "$RUN_ID"
    assert_eq 0 "$STATUS" "exit code"
    assert_eq 4 "$(echo "$OUTPUT" | jq '.validated_steps')" "validated_steps"
    assert_eq "$(events_dir)" "$(echo "$OUTPUT" | jq -r '.events_dir')" "events_dir"
}

test_step_claim_without_event_fails() {
    make_completed_run
    remove_step_event architect-spec
    run "$INTEGRITY" --run-id "$RUN_ID"
    assert_eq 1 "$STATUS" "exit code"
    assert_contains "$(echo "$OUTPUT" | jq -c '.discrepancies')" 'architect-spec' "discrepancies"
}

test_event_for_another_phase_does_not_count() {
    make_completed_run
    remove_step_event architect-spec
    add_event step_complete '{"type": "step_complete", "phase": "build", "step": "architect-spec"}'
    run "$INTEGRITY" --run-id "$RUN_ID"
    assert_eq 1 "$STATUS" "exit code"
}

test_older_event_fields_are_accepted() {
    make_completed_run
    remove_step_event frame-fetch-issue
    remove_step_event architect-spec
    add_event step_complete '{"type": "step_complete", "phase": "frame", "step_id": "frame-fetch-issue"}'
    add_event step_complete '{"type": "step_complete", "metadata": {"phase": "architect", "step_id": "architect-spec"}}'
    run "$INTEGRITY" --run-id "$RUN_ID"
    assert_eq 0 "$STATUS" "exit code"
}

test_completed_phase_without_event_fails() {
    make_completed_run
    rm -f "$(events_dir)"/*-phase_complete.json
    run "$INTEGRITY" --run-id "$RUN_ID"
    assert_eq 1 "$STATUS" "exit code"
    assert_contains "$(echo "$OUTPUT" | jq -c '.discrepancies')" 'Phase \"frame\"' "discrepancies"
}

test_legacy_root_steps_are_checked() {
    make_completed_run
    edit_state '.steps = [{"step_id": "build-legacy", "phase": "build", "status": "success"}]'
    run "$INTEGRITY" --run-id "$RUN_ID"
    assert_eq 1 "$STATUS" "exit code"
    assert_contains "$(echo "$OUTPUT" | jq -c '.discrepancies')" 'build-legacy' "discrepancies"
}

test_events_of_other_runs_are_not_used() {
    make_completed_run
    # Move this run's events to the plan-level folder that several runs share
    mkdir -p "$RUNS/$PLAN_ID/events"
    mv "$(events_dir)"/*.json "$RUNS/$PLAN_ID/events/"
    run "$INTEGRITY" --run-id "$RUN_ID"
    assert_eq 1 "$STATUS" "exit code"
    assert_eq 0 "$(echo "$OUTPUT" | jq '.validated_steps')" "validated_steps"
}

run_tests
