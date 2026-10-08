#!/usr/bin/env bash
# Tests for verify-workflow-completion.sh, the completion gate the
# workflow-run skill runs before marking a run completed (#244, #245).

source "$(dirname "${BASH_SOURCE[0]}")/lib/test-helpers.sh"

VERIFY="$VERIFIER_SCRIPTS/verify-workflow-completion.sh"

test_completed_run_passes_before_workflow_complete_event() {
    make_completed_run
    run "$VERIFY" --run-id "$RUN_ID"
    assert_eq 0 "$STATUS" "exit code"
    assert_eq pass "$(echo "$OUTPUT" | jq -r '.status')" "status"
    assert_eq pass "$(check_field event_state_integrity status)" "event_state_integrity"
    assert_eq pass "$(check_field phases_complete status)" "phases_complete"
    assert_eq "4/4 steps completed" "$(check_field step_count detail)" "step_count detail"
    assert_eq pass "$(check_field step_id_prefix_convention status)" "step_id_prefix_convention"
    assert_eq pass "$(check_field workflow_complete_event status)" "workflow_complete_event"
}

test_pending_step_fails_and_names_the_step() {
    make_completed_run
    edit_state '.phases.build.status = "in_progress" | .phases.build.steps["build-commit"].status = "pending"'
    remove_step_event build-commit
    run "$VERIFY" --run-id "$RUN_ID"
    assert_eq 1 "$STATUS" "exit code"
    assert_eq fail "$(check_field step_count status)" "step_count"
    assert_contains "$(check_field step_count detail)" "build:build-commit" "step_count detail"
    assert_contains "$(check_field phases_complete detail)" "build" "phases_complete detail"
}

test_step_not_in_plan_fails() {
    make_completed_run
    edit_state '.phases.build.steps["build-extra"] = {"status": "completed"}'
    add_event step_complete '{"type": "step_complete", "phase": "build", "step": "build-extra"}'
    run "$VERIFY" --run-id "$RUN_ID"
    assert_eq 1 "$STATUS" "exit code"
    assert_contains "$(check_field step_count detail)" "build:build-extra" "step_count detail"
}

test_completion_claim_without_event_fails() {
    make_completed_run
    remove_step_event build-commit
    run "$VERIFY" --run-id "$RUN_ID"
    assert_eq 1 "$STATUS" "exit code"
    assert_eq fail "$(check_field event_state_integrity status)" "event_state_integrity"
    assert_contains "$(echo "$OUTPUT" | jq -c '.checks[] | select(.check == "event_state_integrity") | .discrepancies')" \
        "build-commit" "discrepancies"
}

test_completed_state_requires_workflow_complete_event() {
    make_completed_run
    edit_state '.status = "completed"'
    run "$VERIFY" --run-id "$RUN_ID"
    assert_eq 1 "$STATUS" "exit code without the event"
    assert_eq fail "$(check_field workflow_complete_event status)" "workflow_complete_event without the event"

    add_event workflow_complete '{"type": "workflow_complete"}'
    run "$VERIFY" --run-id "$RUN_ID"
    assert_eq 0 "$STATUS" "exit code with the event"
}

test_disabled_phase_with_pending_steps_is_not_required() {
    make_completed_run
    edit_state '.phases.evaluate = {"status": "pending", "steps": {"evaluate-test": {"status": "pending"}}}'
    run "$VERIFY" --run-id "$RUN_ID"
    assert_eq 0 "$STATUS" "exit code"
}

test_array_step_layout_passes() {
    make_completed_run
    edit_state '.phases |= with_entries(.value.steps |= (if type == "object" then [to_entries[] | {name: .key, status: .value.status}] else . end))'
    run "$VERIFY" --run-id "$RUN_ID"
    assert_eq 0 "$STATUS" "exit code"
    assert_eq "4/4 steps completed" "$(check_field step_count detail)" "step_count detail"
}

test_legacy_run_layout_passes() {
    make_completed_run
    local legacy="org-app-legacy"
    mkdir -p "$RUNS/$legacy"
    cp "$RUNS/$PLAN_ID/plan.json" "$RUNS/$legacy/plan.json"
    cp "$(state_file)" "$RUNS/$legacy/state.json"
    cp -r "$(events_dir)" "$RUNS/$legacy/events"
    run "$VERIFY" --run-id "$legacy"
    assert_eq 0 "$STATUS" "exit code"
}

test_missing_state_does_not_fall_back_to_another_run() {
    make_completed_run
    run "$VERIFY" --run-id "$PLAN_ID-run-2026-10-09T08-00-00Z"
    assert_eq 2 "$STATUS" "exit code"
    assert_contains "$ERRORS" "State file not found" "error"
}

test_plan_id_containing_run_marker() {
    make_completed_run
    local plan="my-run-plan"
    mkdir -p "$RUNS/$plan"
    mv "$RUNS/$PLAN_ID/plan.json" "$RUNS/$plan/plan.json"
    mv "$(state_file)" "$RUNS/$plan/state-$RUN_SUFFIX.json"
    mv "$RUNS/$PLAN_ID/$RUN_SUFFIX" "$RUNS/$plan/$RUN_SUFFIX"
    run "$VERIFY" --run-id "$plan-run-$RUN_SUFFIX"
    assert_eq 0 "$STATUS" "exit code"
}

run_tests
