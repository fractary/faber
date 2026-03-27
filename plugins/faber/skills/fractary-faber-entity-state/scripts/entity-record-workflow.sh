#!/usr/bin/env bash
# Record workflow completion in entity history
# Usage: entity-record-workflow.sh --type <entity_type> --id <entity_id> --workflow-id <id> \
#        --run-id <id> [--work-id <id>] --started-at <timestamp> --completed-at <timestamp> \
#        --outcome <outcome> --steps <json_array>

set -euo pipefail

# Source locking library
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/lib/entity-validation.sh"
source "$SCRIPT_DIR/lib/entity-lock.sh"

# Trap handler for cleanup on exit
cleanup_on_exit() {
  # Release lock if acquired
  if [ "$LOCK_ACQUIRED" = true ]; then
    release_entity_lock
  fi
  # Clean up temp files
  if [ -n "${HISTORY_FILE:-}" ]; then
    rm -f "${HISTORY_FILE}.tmp" 2>/dev/null || true
  fi
}
trap cleanup_on_exit EXIT INT TERM

# Parse arguments
ENTITY_TYPE=""
ENTITY_ID=""
WORKFLOW_ID=""
RUN_ID=""
WORK_ID=""
STARTED_AT=""
COMPLETED_AT=""
OUTCOME=""
STEPS="[]"

while [[ $# -gt 0 ]]; do
  case $1 in
    --type) ENTITY_TYPE="$2"; shift 2 ;;
    --id) ENTITY_ID="$2"; shift 2 ;;
    --workflow-id) WORKFLOW_ID="$2"; shift 2 ;;
    --run-id) RUN_ID="$2"; shift 2 ;;
    --work-id) WORK_ID="$2"; shift 2 ;;
    --started-at) STARTED_AT="$2"; shift 2 ;;
    --completed-at) COMPLETED_AT="$2"; shift 2 ;;
    --outcome) OUTCOME="$2"; shift 2 ;;
    --steps) STEPS="$2"; shift 2 ;;
    *) echo "ERROR: Unknown argument: $1" >&2; exit 1 ;;
  esac
done

# Validate required arguments
if [ -z "$ENTITY_TYPE" ] || [ -z "$ENTITY_ID" ] || [ -z "$WORKFLOW_ID" ] || \
   [ -z "$RUN_ID" ] || [ -z "$STARTED_AT" ] || [ -z "$OUTCOME" ]; then
  echo "ERROR: Missing required arguments" >&2
  exit 1
fi

# Validate formats using validation library
validate_entity_type "$ENTITY_TYPE" || exit 1
validate_entity_id "$ENTITY_ID" || exit 1

# Compute file path
HISTORY_FILE=".fractary/faber/entities/${ENTITY_TYPE}/${ENTITY_ID}-history.json"

if [ ! -f "$HISTORY_FILE" ]; then
  echo "ERROR: History file not found: $HISTORY_FILE" >&2
  exit 1
fi

# Acquire lock
acquire_entity_lock "$ENTITY_TYPE" "$ENTITY_ID" 30

# Read current history
CURRENT_HISTORY=$(cat "$HISTORY_FILE")

# Create workflow summary entry
WORKFLOW_ENTRY=$(jq -n \
  --arg workflow_id "$WORKFLOW_ID" \
  --arg run_id "$RUN_ID" \
  --arg work_id "$WORK_ID" \
  --arg started_at "$STARTED_AT" \
  --arg completed_at "$COMPLETED_AT" \
  --arg outcome "$OUTCOME" \
  --argjson steps "$STEPS" \
  '{
    workflow_id: $workflow_id,
    run_id: $run_id,
    started_at: $started_at,
    outcome: $outcome,
    steps_executed: $steps
  } +
  (if $work_id != "" then {work_id: $work_id} else {} end) +
  (if $completed_at != "" then {completed_at: $completed_at} else {} end)')

# Append to workflow_summary
UPDATED_HISTORY=$(echo "$CURRENT_HISTORY" | jq \
  --argjson entry "$WORKFLOW_ENTRY" \
  '.workflow_summary += [$entry]')

# Write file atomically
echo "$UPDATED_HISTORY" > "${HISTORY_FILE}.tmp"
mv "${HISTORY_FILE}.tmp" "$HISTORY_FILE"

# Release lock (will be called automatically by trap)

# Output success message
jq -n \
  --arg status "success" \
  --arg operation "record-workflow" \
  --arg type "$ENTITY_TYPE" \
  --arg id "$ENTITY_ID" \
  --arg workflow_id "$WORKFLOW_ID" \
  '{
    status: $status,
    operation: $operation,
    entity_type: $type,
    entity_id: $id,
    workflow_id: $workflow_id
  }'
