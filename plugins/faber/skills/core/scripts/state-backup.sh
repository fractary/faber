#!/usr/bin/env bash
# state-backup.sh - Create timestamped backup of state file
#
# Usage:
#   state-backup.sh --run-id <run-id>
#   state-backup.sh [<state-file>]  # Legacy mode
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

if [ ! -f "$STATE_FILE" ]; then
    exit 0  # No file to backup
fi

BACKUP_DIR="$(dirname "$STATE_FILE")/backups"
mkdir -p "$BACKUP_DIR"

TIMESTAMP=$(date -u +%Y%m%d_%H%M%S)
BACKUP_FILE="$BACKUP_DIR/state_${TIMESTAMP}.json"

cp "$STATE_FILE" "$BACKUP_FILE"
echo "✓ State backed up to: $BACKUP_FILE" >&2
exit 0
