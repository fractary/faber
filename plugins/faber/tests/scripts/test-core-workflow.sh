#!/usr/bin/env bash
# Tests for the core workflow, core.json. Every workflow that extends
# faber@fractary-faber:core inherits its steps (#269).

source "$(dirname "${BASH_SOURCE[0]}")/lib/test-helpers.sh"

CORE="$PLUGIN_ROOT/.fractary/faber/workflows/core.json"

# Skills core.json may name. Checked against fractary/core, fractary/codex and
# this plugin on 2026-10-10. Add a skill only after checking that it exists.
KNOWN_SKILLS=(
    fractary-codex-sync
    fractary-core-env-switcher
    fractary-faber-session-manager
    fractary-repo-branch-forward
    fractary-repo-commit-push
    fractary-repo-commit-push-pr
    fractary-repo-pr-merge
    fractary-repo-pr-reviewer
    fractary-work-issue-comment
)

prompts() {
    jq -r '.phases[] | (.pre_steps // [], .steps // [], .post_steps // []) | .[] | .prompt // empty' "$CORE"
}

test_prompts_name_only_known_skills() {
    local name
    while read -r name; do
        [[ " ${KNOWN_SKILLS[*]} " == *" $name "* ]] || fail "core.json names an unknown skill: $name"
    done < <(prompts | grep -oE 'Use the [a-z0-9-]+ skill' | awk '{print $3}' | sort -u)
}

test_prompts_use_only_placeholders_both_runtimes_fill() {
    # workflow-execute fills {work_id}, {run_id}, {phase} and {step_id}; the
    # workflow-run skill fills {work_id}, {plan_id} and {run_id}.
    local placeholder
    while read -r placeholder; do
        case "$placeholder" in
            '{work_id}'|'{run_id}') ;;
            *) fail "core.json uses $placeholder, which a runtime leaves as literal text" ;;
        esac
    done < <(prompts | grep -oE '\{[a-z_]+\}' | sort -u)
}

run_tests
