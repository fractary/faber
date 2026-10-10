#!/usr/bin/env bash
# Tests for merge-workflows.sh: settings a workflow inherits from the
# workflows it extends (#266). Must match the SDK resolver.

source "$(dirname "${BASH_SOURCE[0]}")/lib/test-helpers.sh"

MERGE="$SKILLS/fractary-faber-faber-config/scripts/merge-workflows.sh"
WORKFLOWS=".fractary/faber/workflows"

write_base() {
    mkdir -p "$WORKFLOWS"
    cat > "$WORKFLOWS/base.json" <<'JSON'
{
  "id": "base",
  "phases": {
    "frame": {"enabled": true, "steps": [{"id": "frame-fetch", "name": "Fetch", "prompt": "Fetch"}]},
    "architect": {"enabled": true, "steps": []},
    "build": {"enabled": true, "steps": [], "result_handling": {"on_failure": "/fractary-faber-workflow-debug"}},
    "evaluate": {"enabled": true, "steps": [], "max_retries": 2},
    "release": {"enabled": true, "require_approval": true, "steps": [{"id": "release-merge", "name": "Merge", "prompt": "Merge"}]}
  },
  "autonomy": {"level": "guarded", "pause_before_release": true, "require_approval_for": ["release-merge"]},
  "result_handling": {"on_warning": "continue", "on_failure": "/fractary-faber-workflow-debug"}
}
JSON
}

merged() {
    echo "$OUTPUT" | jq -c "$1"
}

test_child_inherits_gates_retries_and_handlers() {
    write_base
    echo '{"id": "child", "extends": "base", "phases": {}}' > "$WORKFLOWS/child.json"
    run bash "$MERGE" child --project-root .
    assert_eq 0 "$STATUS" "exit code ($ERRORS)"
    assert_eq '{"level":"guarded","pause_before_release":true,"require_approval_for":["release-merge"]}' \
        "$(merged '.workflow.autonomy')" "autonomy"
    assert_eq '{"on_warning":"continue","on_failure":"/fractary-faber-workflow-debug"}' \
        "$(merged '.workflow.result_handling')" "workflow result_handling"
    assert_eq true "$(merged '.workflow.phases.release.require_approval')" "release require_approval"
    assert_eq 2 "$(merged '.workflow.phases.evaluate.max_retries')" "evaluate max_retries"
    assert_eq '{"on_failure":"/fractary-faber-workflow-debug"}' \
        "$(merged '.workflow.phases.build.result_handling')" "build result_handling"
}

test_child_gates_add_to_inherited_gates() {
    write_base
    cat > "$WORKFLOWS/child.json" <<'JSON'
{"id": "child", "extends": "base", "phases": {},
 "autonomy": {"level": "autonomous", "require_approval_for": ["release-deploy", "release-merge"]}}
JSON
    run bash "$MERGE" child --project-root .
    assert_eq 0 "$STATUS" "exit code ($ERRORS)"
    assert_eq '["release-merge","release-deploy"]' "$(merged '.workflow.autonomy.require_approval_for')" "gates"
    assert_eq '"autonomous"' "$(merged '.workflow.autonomy.level')" "level"
    assert_eq true "$(merged '.workflow.autonomy.pause_before_release')" "pause_before_release"
}

test_child_overrides_one_setting_and_keeps_the_rest() {
    write_base
    cat > "$WORKFLOWS/child.json" <<'JSON'
{"id": "child", "extends": "base",
 "phases": {"release": {"require_approval": false}, "evaluate": {"max_retries": 0}},
 "autonomy": {"level": "guarded", "pause_before_release": false},
 "result_handling": {"on_failure": "stop"}}
JSON
    run bash "$MERGE" child --project-root .
    assert_eq 0 "$STATUS" "exit code ($ERRORS)"
    assert_eq false "$(merged '.workflow.autonomy.pause_before_release')" "pause_before_release"
    assert_eq '["release-merge"]' "$(merged '.workflow.autonomy.require_approval_for')" "gates"
    assert_eq '{"on_warning":"continue","on_failure":"stop"}' "$(merged '.workflow.result_handling')" "result_handling"
    assert_eq false "$(merged '.workflow.phases.release.require_approval')" "release require_approval"
    assert_eq 0 "$(merged '.workflow.phases.evaluate.max_retries')" "evaluate max_retries"
}

test_evaluate_defaults_to_three_retries() {
    mkdir -p "$WORKFLOWS"
    echo '{"id": "solo", "phases": {"evaluate": {"enabled": true, "steps": []}}}' > "$WORKFLOWS/solo.json"
    run bash "$MERGE" solo --project-root .
    assert_eq 0 "$STATUS" "exit code ($ERRORS)"
    assert_eq 3 "$(merged '.workflow.phases.evaluate.max_retries')" "evaluate default"
    assert_eq null "$(merged '.workflow.phases.build.max_retries')" "build has none"
    assert_eq null "$(merged '.workflow.autonomy')" "no autonomy"
}

run_tests
