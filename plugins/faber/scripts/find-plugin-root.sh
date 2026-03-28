#!/bin/bash
# find-plugin-root.sh - Locate the fractary/faber package root across runtimes
#
# SOURCE this file; do not execute it directly.
#
# Works in:
#   - Claude Code  (~/.claude/plugins/marketplaces/fractary-faber/)
#   - Pi           (~/.pi/agent/git/github.com/fractary/faber/)
#   - Pi (project) (.pi/git/github.com/fractary/faber/)
#   - Local dev    (any checkout of the fractary/faber repo)
#
# After sourcing, the following are available:
#   FRACTARY_PACKAGE_ROOT  - absolute path to this repo's root
#   FRACTARY_PLUGINS_DIR   - $FRACTARY_PACKAGE_ROOT/plugins
#
# Cross-repo lookup function:
#   fractary_sibling_root <repo-name>
#     Outputs the absolute path to a sibling repo (e.g. "faber-cloud") and
#     returns 0. Returns 1 if not found. Tries both pi naming (faber-cloud)
#     and Claude marketplace naming (fractary-faber-cloud) conventions.
#
# Sourcing from different script locations:
#   From plugins/faber/skills/*/scripts/  →  ../../../scripts/find-plugin-root.sh
#   From plugins/faber/skills/*/scripts/lib/  →  ../../../../scripts/find-plugin-root.sh
#   From plugins/faber/hooks/scripts/  →  ../../scripts/find-plugin-root.sh
#   From plugins/faber/scripts/  →  ./find-plugin-root.sh
#
# Override:
#   Set FRACTARY_PACKAGE_ROOT before sourcing to skip auto-detection.

# Guard against double-sourcing
if [[ -n "${_FRACTARY_FIND_PLUGIN_ROOT_LOADED:-}" ]]; then
    return 0
fi
_FRACTARY_FIND_PLUGIN_ROOT_LOADED=1

# ── Auto-detect FRACTARY_PACKAGE_ROOT ────────────────────────────────────────
if [[ -z "${FRACTARY_PACKAGE_ROOT:-}" ]]; then
    # This file lives at plugins/faber/scripts/find-plugin-root.sh.
    # Repo root is always 3 levels up from this file's directory.
    _FPR_SELF_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
    FRACTARY_PACKAGE_ROOT="$(cd "${_FPR_SELF_DIR}/../../.." && pwd)"
    unset _FPR_SELF_DIR
fi

FRACTARY_PLUGINS_DIR="${FRACTARY_PACKAGE_ROOT}/plugins"

export FRACTARY_PACKAGE_ROOT FRACTARY_PLUGINS_DIR

# ── Cross-repo sibling lookup ─────────────────────────────────────────────────
# Tries naming conventions for both pi (repo name) and Claude (fractary-<repo>).
# Usage: path=$(fractary_sibling_root "faber-cloud") || echo "not found"
fractary_sibling_root() {
    local repo_name="$1"
    local parent_dir
    parent_dir="$(cd "${FRACTARY_PACKAGE_ROOT}/.." && pwd)"

    # Explicit env var override (escape hatch)
    # e.g. FRACTARY_FABER_CLOUD_ROOT=/custom/path
    local env_var
    env_var="FRACTARY_$(echo "${repo_name}" | tr '[:lower:]-' '[:upper:]_')_ROOT"
    if [[ -n "${!env_var:-}" ]] && [[ -d "${!env_var}" ]]; then
        echo "${!env_var}"
        return 0
    fi

    # Pi convention: parent/<repo-name>/
    if [[ -d "${parent_dir}/${repo_name}" ]]; then
        echo "${parent_dir}/${repo_name}"
        return 0
    fi

    # Claude marketplace convention: parent/fractary-<repo-name>/
    if [[ -d "${parent_dir}/fractary-${repo_name}" ]]; then
        echo "${parent_dir}/fractary-${repo_name}"
        return 0
    fi

    return 1
}
export -f fractary_sibling_root
