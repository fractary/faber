#!/usr/bin/env bash
# Tests for the shell run path rules (lib/run-paths.sh and the fallbacks in
# lib/load-faber-config.sh), which must match the CLI's paths (#253).

source "$(dirname "${BASH_SOURCE[0]}")/lib/test-helpers.sh"

source "$CORE_SCRIPTS/lib/run-paths.sh"

# PATH without any fractary-faber CLI, so the shell fallbacks are used
path_without_cli() {
    local dir out=""
    local IFS=:
    for dir in $PATH; do
        [[ -x "$dir/fractary-faber" ]] && continue
        out="${out:+$out:}$dir"
    done
    echo "$out"
}

test_plan_scoped_run_id_is_split_on_the_last_marker() {
    faber_parse_run_id "my-run-plan-run-2026-10-08T12-00-00Z" || fail "not parsed"
    assert_eq "my-run-plan" "$FABER_PLAN_ID" "plan id"
    assert_eq "2026-10-08T12-00-00Z" "$FABER_RUN_SUFFIX" "run suffix"
    faber_parse_run_id "acme-run-2026-10-08T12-00-00Z-2" || fail "numbered suffix not parsed"
    assert_eq "2026-10-08T12-00-00Z-2" "$FABER_RUN_SUFFIX" "numbered suffix"
}

test_other_run_ids_are_not_plan_scoped() {
    local id
    for id in "org/project/abc" "plan-run-latest" "-run-2026-10-08T12-00-00Z" "acme/2026-10-08T12-00-00Z"; do
        if faber_parse_run_id "$id"; then
            fail "$id parsed as plan-scoped"
        fi
    done
}

test_paths_for_a_plan_scoped_run() {
    assert_eq "$RUNS/acme/state-2026-10-08T12-00-00Z.json" \
        "$(faber_run_state_file "$RUNS" acme-run-2026-10-08T12-00-00Z)" "state file"
    assert_eq "$RUNS/acme/plan.json" "$(faber_run_plan_file "$RUNS" acme-run-2026-10-08T12-00-00Z)" "plan file"
    assert_eq "$RUNS/acme" "$(faber_run_dir "$RUNS" acme-run-2026-10-08T12-00-00Z)" "run dir"
}

test_paths_for_a_legacy_run() {
    assert_eq "$RUNS/org/project/abc/state.json" "$(faber_run_state_file "$RUNS" org/project/abc)" "state file"
    assert_eq "$RUNS/org/project/abc/plan.json" "$(faber_run_plan_file "$RUNS" org/project/abc)" "plan file"
}

test_events_dir_is_the_runs_own() {
    local run_id="acme-run-2026-10-08T12-00-00Z"
    mkdir -p "$RUNS/acme/events"
    assert_eq "" "$(faber_run_events_dir "$RUNS" "$run_id")" "plan-level events are not used"
    mkdir -p "$RUNS/$run_id/events"
    assert_eq "$RUNS/$run_id/events" "$(faber_run_events_dir "$RUNS" "$run_id")" "run-id folder"
    mkdir -p "$RUNS/acme/2026-10-08T12-00-00Z/events"
    assert_eq "$RUNS/acme/2026-10-08T12-00-00Z/events" "$(faber_run_events_dir "$RUNS" "$run_id")" "event tool folder first"
}

test_state_path_fallback_without_cli() {
    local result
    result=$(PATH="$(path_without_cli)" bash -c '
        source "$1" > /dev/null
        command -v fractary-faber > /dev/null && { echo "CLI still on PATH"; exit 1; }
        faber_get_state_path "acme-run-2026-10-08T12-00-00Z"
        faber_get_plan_path "acme-run-2026-10-08T12-00-00Z"
        faber_get_run_dir "acme-run-2026-10-08T12-00-00Z"
        faber_get_state_path "org/project/abc"' _ "$CORE_SCRIPTS/lib/load-faber-config.sh")
    assert_eq "$RUNS/acme/state-2026-10-08T12-00-00Z.json
$RUNS/acme/plan.json
$RUNS/acme
$RUNS/org/project/abc/state.json" "$result" "fallback paths"
}

test_sourcing_config_keeps_caller_arguments_and_stdout() {
    # A sourced copy sees the caller's arguments: it must not shift them away
    # or print the config into the caller's output.
    local output
    output=$(LIB="$CORE_SCRIPTS/lib/load-faber-config.sh" bash -c '
        set -- --run-id acme-run-2026-10-08T12-00-00Z .status
        source "$LIB"
        echo "args: $*"')
    assert_eq "args: --run-id acme-run-2026-10-08T12-00-00Z .status" "$output" "caller arguments and stdout"
}

test_state_read_uses_the_runs_state_file() {
    mkdir -p "$RUNS/acme"
    echo '{"status": "in_progress"}' > "$RUNS/acme/state-2026-10-08T12-00-00Z.json"
    run env PATH="$(path_without_cli)" "$CORE_SCRIPTS/state-read.sh" --run-id acme-run-2026-10-08T12-00-00Z .status
    assert_eq 0 "$STATUS" "exit code"
    assert_eq in_progress "$OUTPUT" "output"
}

run_tests
