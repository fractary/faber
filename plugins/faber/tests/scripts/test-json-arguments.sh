#!/usr/bin/env bash
# Tests for scripts that take an optional JSON argument. They defaulted it with
# "${N:-{}}", which appends a stray "}" whenever the argument is given.

source "$(dirname "${BASH_SOURCE[0]}")/lib/test-helpers.sh"

test_step_update_stores_data() {
    mkdir -p .fractary/faber
    echo '{"status": "in_progress", "phases": {"build": {"status": "in_progress"}}}' > .fractary/faber/state.json
    run "$STATE_SCRIPTS/state-update-step.sh" build implement in_progress '{"files_changed": 5}'
    assert_eq 0 "$STATUS" "exit code"
    assert_eq 5 "$(jq '.phases.build.steps[0].data.files_changed' .fractary/faber/state.json)" "stored data"
}

test_phase_update_stores_data() {
    mkdir -p .fractary/faber
    echo '{"status": "in_progress", "phases": {"frame": {"status": "pending"}}}' > .fractary/faber/state.json
    run "$CORE_SCRIPTS/state-update-phase.sh" frame in_progress '{"branch": "feat/1"}'
    assert_eq 0 "$STATUS" "exit code"
    assert_eq "feat/1" "$(jq -r '.phases.frame.data.branch' .fractary/faber/state.json)" "stored data"
}

test_hook_receives_context() {
    mkdir -p .fractary/faber/hooks
    echo "# Hook" > .fractary/faber/hooks/doc.md
    run "$CORE_SCRIPTS/hook-execute.sh" '{"type": "document", "path": ".fractary/faber/hooks/doc.md"}' '{"work_id": "123"}'
    assert_eq 0 "$STATUS" "exit code"
    assert_contains "$OUTPUT" '"work_id": "123"' "context in output"
}

run_tests
