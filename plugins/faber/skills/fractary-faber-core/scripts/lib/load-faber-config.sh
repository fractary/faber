#!/usr/bin/env bash
# load-faber-config.sh - Load FABER configuration using the SDK
#
# This script is a thin wrapper around the `fractary-faber config get` CLI command,
# which uses the SDK's config loading logic. This ensures consistency across all tools.
#
# Usage:
#   source load-faber-config.sh
#   # Sets FABER_CONFIG (JSON string) and FABER_CONFIG_PATH and defines the
#   # faber_get_* path functions. When sourced, it reads no arguments, leaves
#   # the caller's arguments alone and writes nothing to stdout.
#
# Or as a standalone script:
#   ./load-faber-config.sh [--project-root <path>] [--key <jq-path>]
#   # Outputs JSON to stdout
#
# Environment Variables:
#   PROJECT_ROOT - Project root directory (auto-detected if not set)
#
# Exit Codes:
#   0 - Success
#   1 - Config not found
#   2 - Config parse error

set -euo pipefail

# A sourced copy shares the caller's arguments, so only parse them, change
# directory and print the config when the file is run as a script.
_FABER_CONFIG_SOURCED=false
if [[ "${BASH_SOURCE[0]}" != "$0" ]]; then
    _FABER_CONFIG_SOURCED=true
fi

# Default values
_PROJECT_ROOT=""
_KEY_PATH=""

if [[ "$_FABER_CONFIG_SOURCED" == false ]]; then
    # Parse arguments
    while [[ $# -gt 0 ]]; do
        case "$1" in
            --project-root)
                _PROJECT_ROOT="$2"
                shift 2
                ;;
            --key)
                _KEY_PATH="$2"
                shift 2
                ;;
            *)
                shift
                ;;
        esac
    done

    # Change to project root if specified
    if [[ -n "$_PROJECT_ROOT" ]]; then
        cd "$_PROJECT_ROOT"
    fi
fi

# Try to use the CLI first (preferred - uses SDK logic)
load_via_cli() {
    if command -v fractary-faber &> /dev/null; then
        if [[ -n "$_KEY_PATH" ]]; then
            fractary-faber config get "$_KEY_PATH" 2>/dev/null
        else
            fractary-faber config get 2>/dev/null
        fi
        return $?
    fi
    return 1
}

# Fallback: Load config directly with Python (for environments without CLI)
load_via_python() {
    python3 - <<'PYTHON_EOF'
import sys
import json
import os
import re

# Find project root
def find_project_root():
    current = os.getcwd()
    while current != '/':
        if os.path.isdir(os.path.join(current, '.fractary')) or os.path.isdir(os.path.join(current, '.git')):
            return current
        current = os.path.dirname(current)
    return os.getcwd()

# Try to import yaml
try:
    import yaml
except ImportError:
    print('{"error": "PyYAML not installed"}', file=sys.stderr)
    sys.exit(2)

def substitute_env_vars(value):
    """Substitute ${VAR} or ${VAR:-default} patterns with environment values"""
    if not isinstance(value, str):
        return value
    def replace(match):
        var_name = match.group(1)
        default = match.group(3) if match.group(2) else None
        env_value = os.environ.get(var_name)
        if env_value is not None:
            return env_value
        if default is not None:
            return default
        return match.group(0)
    return re.sub(r'\$\{([A-Z_][A-Z0-9_]*)(:-([^}]+))?\}', replace, value)

def process_config(obj):
    """Recursively process config to substitute env vars"""
    if isinstance(obj, dict):
        return {k: process_config(v) for k, v in obj.items()}
    elif isinstance(obj, list):
        return [process_config(item) for item in obj]
    elif isinstance(obj, str):
        return substitute_env_vars(obj)
    return obj

project_root = find_project_root()

# Config paths in order of preference
config_paths = [
    os.path.join(project_root, '.fractary', 'config.yaml'),
    os.path.join(project_root, '.fractary', 'faber', 'config.yaml'),
    os.path.join(project_root, '.fractary', 'faber', 'config.json'),
    os.path.join(project_root, '.fractary', 'plugins', 'faber', 'config.yaml'),
    os.path.join(project_root, '.fractary', 'plugins', 'faber', 'config.json'),
]

config = None
for config_path in config_paths:
    if os.path.exists(config_path):
        try:
            with open(config_path, 'r') as f:
                if config_path.endswith('.yaml'):
                    config = yaml.safe_load(f)
                else:
                    config = json.load(f)

            if config:
                config = process_config(config)

                # Normalize structure: ensure faber section exists
                if 'faber' not in config:
                    # This is a faber-specific config, wrap it
                    config = {'faber': config}
                break
        except Exception as e:
            continue

if config is None:
    config = {'faber': {}, 'github': {}, 'work': {}, 'repo': {}, 'logs': {}}

print(json.dumps(config))
PYTHON_EOF
}

# Try CLI first, fall back to Python
FABER_CONFIG=""
if ! FABER_CONFIG=$(load_via_cli 2>/dev/null); then
    FABER_CONFIG=$(load_via_python 2>/dev/null) || FABER_CONFIG='{}'
fi

# Get config path
FABER_CONFIG_PATH=""
if command -v fractary-faber &> /dev/null; then
    FABER_CONFIG_PATH=$(fractary-faber config path 2>/dev/null) || true
fi

# Export for sourcing
export FABER_CONFIG
export FABER_CONFIG_PATH

# Print the config when run as a script
if [[ "$_FABER_CONFIG_SOURCED" == false ]]; then
    # If specific key requested via jq (for backward compatibility)
    if [[ -n "$_KEY_PATH" ]] && [[ -z "$(load_via_cli 2>/dev/null || true)" ]]; then
        # CLI wasn't used, need to extract key with jq
        echo "$FABER_CONFIG" | jq -r "$_KEY_PATH" 2>/dev/null || echo "$FABER_CONFIG"
    else
        echo "$FABER_CONFIG"
    fi
fi

# ============================================================================
# FABER Run Path Functions
# ============================================================================
# These functions resolve FABER run paths via the CLI, falling back to
# run-paths.sh (the same rules, in shell) when the CLI is not installed.
# A plan-scoped run ID ({plan_id}-run-{run_suffix}) keeps its files in
# .fractary/faber/runs/{plan_id}/: plan.json and state-{run_suffix}.json.
# Any other run ID uses .fractary/faber/runs/{run_id}/.
#
# Usage:
#   RUNS_DIR=$(faber_get_runs_dir)
#   RUN_DIR=$(faber_get_run_dir "my-run-id")
#   PLAN_PATH=$(faber_get_plan_path "my-run-id")
#   STATE_PATH=$(faber_get_state_path "my-run-id")
# ============================================================================

source "$(dirname "${BASH_SOURCE[0]}")/run-paths.sh"

# Get the base runs directory path
# Returns absolute path if CLI available, otherwise relative path
faber_get_runs_dir() {
    if command -v fractary-faber &> /dev/null; then
        fractary-faber runs dir 2>/dev/null || echo ".fractary/faber/runs"
    else
        # Fallback to relative path
        echo ".fractary/faber/runs"
    fi
}

# Get the directory path for a specific run
# Arguments:
#   $1 - run_id (required)
faber_get_run_dir() {
    local run_id="$1"
    if [[ -z "$run_id" ]]; then
        echo "Error: run_id is required" >&2
        return 1
    fi

    if command -v fractary-faber &> /dev/null; then
        fractary-faber runs dir "$run_id" 2>/dev/null || faber_run_dir ".fractary/faber/runs" "$run_id"
    else
        # Fallback to relative path
        faber_run_dir ".fractary/faber/runs" "$run_id"
    fi
}

# Get the plan file path for a specific run
# Arguments:
#   $1 - run_id (required)
faber_get_plan_path() {
    local run_id="$1"
    if [[ -z "$run_id" ]]; then
        echo "Error: run_id is required" >&2
        return 1
    fi

    if command -v fractary-faber &> /dev/null; then
        fractary-faber runs plan-path "$run_id" 2>/dev/null || faber_run_plan_file ".fractary/faber/runs" "$run_id"
    else
        # Fallback to relative path
        faber_run_plan_file ".fractary/faber/runs" "$run_id"
    fi
}

# Get the state file path for a specific run
# Arguments:
#   $1 - run_id (required)
# Returns:
#   .fractary/faber/runs/{plan_id}/state-{run_suffix}.json for a plan-scoped
#   run ID ({plan_id}-run-{run_suffix}), otherwise .fractary/faber/runs/{run_id}/state.json
faber_get_state_path() {
    local run_id="$1"
    if [[ -z "$run_id" ]]; then
        echo "Error: run_id is required" >&2
        return 1
    fi

    if command -v fractary-faber &> /dev/null; then
        fractary-faber runs state-path "$run_id" 2>/dev/null || faber_compute_state_path "$run_id"
    else
        # Fallback to computed path
        faber_compute_state_path "$run_id"
    fi
}

# Compute state path from run_id without the CLI (same rules as `runs state-path`)
faber_compute_state_path() {
    faber_run_state_file ".fractary/faber/runs" "$1"
}

# Ensure the run directory exists for a given run_id
# Arguments:
#   $1 - run_id (required)
faber_ensure_run_dir() {
    local run_id="$1"
    if [[ -z "$run_id" ]]; then
        echo "Error: run_id is required" >&2
        return 1
    fi

    local run_dir
    run_dir=$(faber_get_run_dir "$run_id")
    mkdir -p "$run_dir"
    echo "$run_dir"
}

# Export functions for use in sourced scripts
export -f faber_get_runs_dir 2>/dev/null || true
export -f faber_get_run_dir 2>/dev/null || true
export -f faber_get_plan_path 2>/dev/null || true
export -f faber_get_state_path 2>/dev/null || true
export -f faber_ensure_run_dir 2>/dev/null || true
export -f faber_compute_state_path faber_parse_run_id faber_run_dir faber_run_plan_file faber_run_state_file faber_run_events_dir 2>/dev/null || true
export FABER_RUN_ID_MARKER FABER_RUN_SUFFIX_PATTERN
