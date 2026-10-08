#!/usr/bin/env bash
# Tests for verify-plan-adherence.sh, the plan adherence report run after a
# workflow completes (#227).

source "$(dirname "${BASH_SOURCE[0]}")/lib/test-helpers.sh"

ADHERENCE="$RUN_MANAGER_SCRIPTS/verify-plan-adherence.sh"

test_completed_run_is_perfect() {
    make_completed_run
    run "$ADHERENCE" --run-id "$RUN_ID"
    assert_eq 0 "$STATUS" "exit code"
    assert_eq perfect "$(echo "$OUTPUT" | jq -r '.status')" "status"
    assert_eq '{"total_planned":4,"total_executed":4,"total_skipped":0,"total_unplanned":0}' \
        "$(echo "$OUTPUT" | jq -c '.summary')" "summary (disabled evaluate phase excluded)"
}

test_pending_step_is_reported_skipped() {
    make_completed_run
    edit_state '.phases.build.steps["build-commit"].status = "pending"'
    run "$ADHERENCE" --run-id "$RUN_ID"
    assert_eq 1 "$STATUS" "exit code"
    assert_eq '[{"id":"build-commit","phase":"build"}]' "$(echo "$OUTPUT" | jq -c '.skipped_steps')" "skipped_steps"
}

test_unplanned_step_is_reported() {
    make_completed_run
    edit_state '.phases.build.steps["build-extra"] = {"status": "completed"}'
    run "$ADHERENCE" --run-id "$RUN_ID"
    assert_eq 1 "$STATUS" "exit code"
    assert_eq '[{"id":"build-extra","phase":"build"}]' "$(echo "$OUTPUT" | jq -c '.unplanned_steps')" "unplanned_steps"
}

test_array_and_legacy_layouts_count_as_executed() {
    make_completed_run
    edit_state '
        .phases.frame.steps = [{"name": "frame-fetch-issue", "status": "completed"}]
        | .phases.architect.steps = {} | .phases.architect.completed_step_ids = ["architect-spec"]
        | .phases.build.steps = {}
        | .steps = [{"step_id": "build-implement", "phase": "build", "status": "success"},
                    {"step_id": "build-commit", "phase": "build", "status": "success"}]'
    run "$ADHERENCE" --run-id "$RUN_ID"
    assert_eq 0 "$STATUS" "exit code"
    assert_eq 4 "$(echo "$OUTPUT" | jq '.summary.total_executed')" "total_executed"
}

test_markdown_report() {
    make_completed_run
    run "$ADHERENCE" --run-id "$RUN_ID" --format markdown
    assert_eq 0 "$STATUS" "exit code"
    assert_contains "$OUTPUT" "4/4 planned steps executed (perfect adherence)" "result line"
}

test_missing_state_does_not_fall_back_to_another_run() {
    make_completed_run
    run "$ADHERENCE" --run-id "$PLAN_ID-run-2026-10-09T08-00-00Z"
    assert_eq 2 "$STATUS" "exit code"
}

run_tests
