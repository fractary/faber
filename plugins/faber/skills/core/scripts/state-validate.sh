#!/usr/bin/env bash
# state-validate.sh - Validate state against schema
#
# Usage:
#   state-validate.sh --run-id <run-id>
#   state-validate.sh [<state-file>]  # Legacy mode
#
set -euo pipefail

# Helper: compute state path from run_id
compute_state_path() {
    local run_id="$1"
    local run_marker="-run-"
    if [[ "$run_id" == *"$run_marker"* ]]; then
        local plan_id="${run_id%$run_marker*}"
        local run_suffix="${run_id#*$run_marker}"
        echo ".fractary/faber/runs/$plan_id/state-$run_suffix.json"
    else
        echo ".fractary/faber/runs/$run_id/state.json"
    fi
}

# Parse arguments
if [[ "${1:-}" == "--run-id" ]]; then
    RUN_ID="${2:?Run ID required with --run-id flag}"
    STATE_FILE="$(compute_state_path "$RUN_ID")"
else
    STATE_FILE="${1:-.fractary/faber/state.json}"
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SCHEMA="$(cd "$SCRIPT_DIR/../../.." && pwd)/config/state.schema.json"

if [ ! -f "$STATE_FILE" ]; then
    echo "Error: State file not found: $STATE_FILE" >&2
    exit 1
fi

if ! jq empty "$STATE_FILE" 2>/dev/null; then
    echo "Error: Invalid JSON in state file" >&2
    exit 1
fi

echo "✓ State file is valid"
exit 0
