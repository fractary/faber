#!/usr/bin/env bash
# Record step execution in entity state and history
# Usage: entity-record-step.sh --type <entity_type> --id <entity_id> --step-id <step_id> \
#        [--step-action <action>] [--step-type <type>] --execution-status <status> \
#        [--outcome-status <status>] --phase <phase> --workflow-id <id> --run-id <id> \
#        [--work-id <id>] [--session-id <id>] [--duration-ms <ms>] [--retry-count <n>]

set -euo pipefail

# Source libraries
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/lib/entity-validation.sh"
source "$SCRIPT_DIR/lib/entity-lock.sh"
source "$SCRIPT_DIR/lib/index-update.sh"

# Parse arguments
ENTITY_TYPE=""
ENTITY_ID=""
STEP_ID=""
STEP_ACTION=""
STEP_TYPE=""
EXECUTION_STATUS=""
OUTCOME_STATUS=""
PHASE=""
WORKFLOW_ID=""
RUN_ID=""
WORK_ID=""
SESSION_ID=""
DURATION_MS="0"
RETRY_COUNT="0"
RETRY_REASON=""
ERROR_MESSAGE=""

while [[ $# -gt 0 ]]; do
  case $1 in
    --type) ENTITY_TYPE="$2"; shift 2 ;;
    --id) ENTITY_ID="$2"; shift 2 ;;
    --step-id) STEP_ID="$2"; shift 2 ;;
    --step-action) STEP_ACTION="$2"; shift 2 ;;
    --step-type) STEP_TYPE="$2"; shift 2 ;;
    --execution-status) EXECUTION_STATUS="$2"; shift 2 ;;
    --outcome-status) OUTCOME_STATUS="$2"; shift 2 ;;
    --phase) PHASE="$2"; shift 2 ;;
    --workflow-id) WORKFLOW_ID="$2"; shift 2 ;;
    --run-id) RUN_ID="$2"; shift 2 ;;
    --work-id) WORK_ID="$2"; shift 2 ;;
    --session-id) SESSION_ID="$2"; shift 2 ;;
    --duration-ms) DURATION_MS="$2"; shift 2 ;;
    --retry-count) RETRY_COUNT="$2"; shift 2 ;;
    --retry-reason) RETRY_REASON="$2"; shift 2 ;;
    --error-message) ERROR_MESSAGE="$2"; shift 2 ;;
    *) echo "ERROR: Unknown argument: $1" >&2; exit 1 ;;
  esac
done

# Validate required arguments
if [ -z "$ENTITY_TYPE" ] || [ -z "$ENTITY_ID" ] || [ -z "$STEP_ID" ] || \
   [ -z "$EXECUTION_STATUS" ] || [ -z "$PHASE" ] || [ -z "$WORKFLOW_ID" ] || [ -z "$RUN_ID" ]; then
  echo "ERROR: Missing required arguments" >&2
  echo "Required: --type, --id, --step-id, --execution-status, --phase, --workflow-id, --run-id" >&2
  exit 1
fi

# Validate formats using validation library
validate_entity_type "$ENTITY_TYPE" || exit 1
validate_entity_id "$ENTITY_ID" || exit 1
validate_execution_status "$EXECUTION_STATUS" || exit 1
validate_phase "$PHASE" || exit 1

# Validate outcome_status if provided
if [ -n "$OUTCOME_STATUS" ]; then
  validate_outcome_status "$OUTCOME_STATUS" || exit 1
fi

# Compute file paths
ENTITY_FILE=".fractary/faber/entities/${ENTITY_TYPE}/${ENTITY_ID}.json"
HISTORY_FILE=".fractary/faber/entities/${ENTITY_TYPE}/${ENTITY_ID}-history.json"

# Check if entity exists
if [ ! -f "$ENTITY_FILE" ]; then
  echo "ERROR: Entity not found: ${ENTITY_TYPE}/${ENTITY_ID}" >&2
  echo "Run entity-create.sh first" >&2
  exit 1
fi

# Acquire lock
acquire_entity_lock "$ENTITY_TYPE" "$ENTITY_ID" 30

# Get current timestamp
TIMESTAMP=$(date -Iseconds)

# Read current state and history
CURRENT_STATE=$(cat "$ENTITY_FILE")
CURRENT_HISTORY=$(cat "$HISTORY_FILE" 2>/dev/null || echo '{"step_history": [], "workflow_summary": []}')

# Update step_status in entity state
STEP_STATUS_ENTRY=$(jq -n \
  --arg step_id "$STEP_ID" \
  --arg step_action "$STEP_ACTION" \
  --arg step_type "$STEP_TYPE" \
  --arg exec_status "$EXECUTION_STATUS" \
  --arg outcome "$OUTCOME_STATUS" \
  --arg phase "$PHASE" \
  --arg timestamp "$TIMESTAMP" \
  --arg workflow_id "$WORKFLOW_ID" \
  --arg run_id "$RUN_ID" \
  --arg work_id "$WORK_ID" \
  --argjson retry_count "$RETRY_COUNT" \
  '{
    step_id: $step_id,
    execution_status: $exec_status,
    phase: $phase,
    last_executed_at: $timestamp,
    last_executed_by: {
      workflow_id: $workflow_id,
      run_id: $run_id,
      work_id: $work_id
    },
    retry_count: $retry_count
  } +
  (if $step_action != "" then {step_action: $step_action} else {} end) +
  (if $step_type != "" then {step_type: $step_type} else {} end) +
  (if $outcome != "" then {outcome_status: $outcome} else {} end)')

# Update or create step_status entry
# Increment execution_count if step already exists
UPDATED_STATE=$(echo "$CURRENT_STATE" | jq \
  --arg step_id "$STEP_ID" \
  --argjson step_entry "$STEP_STATUS_ENTRY" \
  --arg timestamp "$TIMESTAMP" \
  '
  .step_status[$step_id] = (
    if .step_status[$step_id] then
      (.step_status[$step_id] + $step_entry + {execution_count: ((.step_status[$step_id].execution_count // 0) + 1)})
    else
      ($step_entry + {execution_count: 1})
    end
  ) |
  .updated_at = $timestamp |
  .version = (.version + 1)
  ')

# Create history entry
HISTORY_ENTRY=$(jq -n \
  --arg step_id "$STEP_ID" \
  --arg step_action "$STEP_ACTION" \
  --arg step_type "$STEP_TYPE" \
  --arg exec_status "$EXECUTION_STATUS" \
  --arg outcome "$OUTCOME_STATUS" \
  --arg phase "$PHASE" \
  --arg timestamp "$TIMESTAMP" \
  --arg workflow_id "$WORKFLOW_ID" \
  --arg run_id "$RUN_ID" \
  --arg work_id "$WORK_ID" \
  --arg session_id "$SESSION_ID" \
  --argjson duration_ms "$DURATION_MS" \
  --argjson retry_count "$RETRY_COUNT" \
  --arg retry_reason "$RETRY_REASON" \
  --arg error_message "$ERROR_MESSAGE" \
  '{
    step_id: $step_id,
    execution_status: $exec_status,
    phase: $phase,
    executed_at: $timestamp,
    workflow_id: $workflow_id,
    run_id: $run_id,
    duration_ms: $duration_ms,
    retry_count: $retry_count
  } +
  (if $step_action != "" then {step_action: $step_action} else {} end) +
  (if $step_type != "" then {step_type: $step_type} else {} end) +
  (if $outcome != "" then {outcome_status: $outcome} else {} end) +
  (if $work_id != "" then {work_id: $work_id} else {} end) +
  (if $session_id != "" then {session_id: $session_id} else {} end) +
  (if $retry_reason != "" then {retry_reason: $retry_reason} else {} end) +
  (if $error_message != "" then {error_message: $error_message} else {} end)')

# Append to step_history
UPDATED_HISTORY=$(echo "$CURRENT_HISTORY" | jq \
  --argjson entry "$HISTORY_ENTRY" \
  '.step_history += [$entry]')

# Write files atomically
echo "$UPDATED_STATE" > "${ENTITY_FILE}.tmp"
echo "$UPDATED_HISTORY" > "${HISTORY_FILE}.tmp"

mv "${ENTITY_FILE}.tmp" "$ENTITY_FILE"
mv "${HISTORY_FILE}.tmp" "$HISTORY_FILE"

# Update indices
update_recent_updates_index "$ENTITY_TYPE" "$ENTITY_ID" "$TIMESTAMP"
if [ -n "$STEP_ACTION" ]; then
  update_step_action_index "$ENTITY_TYPE" "$ENTITY_ID" "$STEP_ACTION" "$EXECUTION_STATUS"
fi

# Release lock (will be called automatically by trap)

# Output success message
NEW_VERSION=$(echo "$UPDATED_STATE" | jq -r '.version')
EXECUTION_COUNT=$(echo "$UPDATED_STATE" | jq -r ".step_status.\"$STEP_ID\".execution_count")

jq -n \
  --arg status "success" \
  --arg operation "record-step" \
  --arg type "$ENTITY_TYPE" \
  --arg id "$ENTITY_ID" \
  --arg step_id "$STEP_ID" \
  --arg exec_status "$EXECUTION_STATUS" \
  --argjson version "$NEW_VERSION" \
  --argjson exec_count "$EXECUTION_COUNT" \
  '{
    status: $status,
    operation: $operation,
    entity_type: $type,
    entity_id: $id,
    step_id: $step_id,
    execution_status: $exec_status,
    new_version: $version,
    execution_count: $exec_count
  }'
