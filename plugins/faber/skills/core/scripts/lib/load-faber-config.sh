#!/usr/bin/env bash
# load-faber-config.sh - Load FABER configuration from unified .fractary/config.yaml
#
# This script loads the FABER configuration section from the unified config file.
# It supports fallback to legacy config paths for backward compatibility.
#
# Usage:
#   source load-faber-config.sh [--project-root <path>]
#   # Sets FABER_CONFIG (JSON string) and FABER_CONFIG_PATH
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

# Default values
_PROJECT_ROOT=""
_KEY_PATH=""

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

# Find project root by looking for .fractary or .git
find_project_root() {
    local dir="${1:-$(pwd)}"

    while [[ "$dir" != "/" ]]; do
        if [[ -d "$dir/.fractary" ]] || [[ -d "$dir/.git" ]]; then
            echo "$dir"
            return 0
        fi
        dir=$(dirname "$dir")
    done

    # Fallback to current directory
    pwd
}

# Determine project root
if [[ -n "$_PROJECT_ROOT" ]]; then
    PROJECT_ROOT="$_PROJECT_ROOT"
elif [[ -n "${PROJECT_ROOT:-}" ]]; then
    PROJECT_ROOT="$PROJECT_ROOT"
else
    PROJECT_ROOT=$(find_project_root)
fi

# Config paths in order of preference
UNIFIED_CONFIG="$PROJECT_ROOT/.fractary/config.yaml"
NEW_FABER_CONFIG_YAML="$PROJECT_ROOT/.fractary/faber/config.yaml"
NEW_FABER_CONFIG_JSON="$PROJECT_ROOT/.fractary/faber/config.json"
LEGACY_CONFIG_YAML="$PROJECT_ROOT/.fractary/plugins/faber/config.yaml"
LEGACY_CONFIG_JSON="$PROJECT_ROOT/.fractary/plugins/faber/config.json"

# Load unified config and extract faber section
load_unified_config() {
    local config_path="$1"

    if [[ ! -f "$config_path" ]]; then
        return 1
    fi

    # Use Python to parse YAML and extract faber section as JSON
    python3 - "$config_path" <<'PYTHON_EOF' 2>/dev/null
import sys
import json
import os
import re

try:
    import yaml
except ImportError:
    # Try to use PyYAML or ruamel.yaml
    print('{"error": "PyYAML not installed"}', file=sys.stderr)
    sys.exit(2)

config_path = sys.argv[1]

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
        return match.group(0)  # Keep original if not found

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

try:
    with open(config_path, 'r') as f:
        config = yaml.safe_load(f)

    if not config:
        print('{}')
        sys.exit(0)

    # Process env var substitution
    config = process_config(config)

    # Extract faber section, merging with relevant top-level configs
    faber_config = config.get('faber', {})

    # Include relevant top-level sections that faber needs
    result = {
        'faber': faber_config,
        'github': config.get('github', {}),
        'work': config.get('work', {}),
        'repo': config.get('repo', {}),
        'logs': config.get('logs', {}),
    }

    # Output as JSON
    print(json.dumps(result, separators=(',', ':')))
    sys.exit(0)

except FileNotFoundError:
    print('{"error": "Config file not found"}', file=sys.stderr)
    sys.exit(1)
except yaml.YAMLError as e:
    print(f'{{"error": "YAML parse error: {e}"}}', file=sys.stderr)
    sys.exit(2)
except Exception as e:
    print(f'{{"error": "{e}"}}', file=sys.stderr)
    sys.exit(2)
PYTHON_EOF
}

# Load legacy config (JSON or YAML in old locations)
load_legacy_config() {
    local config_path="$1"
    local format="${2:-auto}"

    if [[ ! -f "$config_path" ]]; then
        return 1
    fi

    # Emit deprecation warning to stderr
    echo "Warning: Using deprecated config location: $config_path" >&2
    echo "Run 'fractary-faber migrate' to move to .fractary/config.yaml" >&2

    if [[ "$format" == "json" ]] || [[ "$config_path" == *.json ]]; then
        # JSON format - wrap in faber section for consistency
        local json_content
        json_content=$(cat "$config_path")
        echo "{\"faber\": $json_content}"
    else
        # YAML format - use Python to convert
        python3 - "$config_path" <<'PYTHON_EOF' 2>/dev/null
import sys
import json

try:
    import yaml
except ImportError:
    print('{"error": "PyYAML not installed"}', file=sys.stderr)
    sys.exit(2)

try:
    with open(sys.argv[1], 'r') as f:
        config = yaml.safe_load(f)
    # Wrap in faber section for consistency
    print(json.dumps({"faber": config or {}}, separators=(',', ':')))
except Exception as e:
    print(f'{{"error": "{e}"}}', file=sys.stderr)
    sys.exit(2)
PYTHON_EOF
    fi
}

# Try to load config in order of preference
FABER_CONFIG=""
FABER_CONFIG_PATH=""

# 1. Try unified config (.fractary/config.yaml)
if [[ -f "$UNIFIED_CONFIG" ]]; then
    FABER_CONFIG=$(load_unified_config "$UNIFIED_CONFIG") && {
        FABER_CONFIG_PATH="$UNIFIED_CONFIG"
    }
fi

# 2. Try new faber-specific config (.fractary/faber/config.yaml or .json)
if [[ -z "$FABER_CONFIG" ]] && [[ -f "$NEW_FABER_CONFIG_YAML" ]]; then
    FABER_CONFIG=$(load_legacy_config "$NEW_FABER_CONFIG_YAML" "yaml") && {
        FABER_CONFIG_PATH="$NEW_FABER_CONFIG_YAML"
    }
fi

if [[ -z "$FABER_CONFIG" ]] && [[ -f "$NEW_FABER_CONFIG_JSON" ]]; then
    FABER_CONFIG=$(load_legacy_config "$NEW_FABER_CONFIG_JSON" "json") && {
        FABER_CONFIG_PATH="$NEW_FABER_CONFIG_JSON"
    }
fi

# 3. Try legacy config (.fractary/plugins/faber/config.yaml or .json)
if [[ -z "$FABER_CONFIG" ]] && [[ -f "$LEGACY_CONFIG_YAML" ]]; then
    FABER_CONFIG=$(load_legacy_config "$LEGACY_CONFIG_YAML" "yaml") && {
        FABER_CONFIG_PATH="$LEGACY_CONFIG_YAML"
    }
fi

if [[ -z "$FABER_CONFIG" ]] && [[ -f "$LEGACY_CONFIG_JSON" ]]; then
    FABER_CONFIG=$(load_legacy_config "$LEGACY_CONFIG_JSON" "json") && {
        FABER_CONFIG_PATH="$LEGACY_CONFIG_JSON"
    }
fi

# Handle no config found
if [[ -z "$FABER_CONFIG" ]]; then
    # Return empty config with defaults
    FABER_CONFIG='{"faber":{},"github":{},"work":{},"repo":{},"logs":{}}'
    FABER_CONFIG_PATH=""
fi

# Export for sourcing
export FABER_CONFIG
export FABER_CONFIG_PATH
export PROJECT_ROOT

# If specific key requested, extract it
if [[ -n "$_KEY_PATH" ]]; then
    echo "$FABER_CONFIG" | jq -r "$_KEY_PATH"
else
    # Output full config
    echo "$FABER_CONFIG"
fi
