#!/usr/bin/env bash
# Query entities by step action and execution status
# Usage: entity-query-step.sh --step-action <action> [--execution-status <status>] [--limit <n>]

set -euo pipefail

# Source libraries
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/lib/entity-validation.sh"
source "$SCRIPT_DIR/lib/index-update.sh"

# Parse arguments
STEP_ACTION=""
EXECUTION_STATUS=""
LIMIT="100"

while [[ $# -gt 0 ]]; do
  case $1 in
    --step-action)
      STEP_ACTION="$2"
      shift 2
      ;;
    --execution-status)
      EXECUTION_STATUS="$2"
      shift 2
      ;;
    --limit)
      LIMIT="$2"
      shift 2
      ;;
    *)
      echo "ERROR: Unknown argument: $1" >&2
      echo "Usage: entity-query-step.sh --step-action <action> [--execution-status <status>] [--limit <n>]" >&2
      exit 1
      ;;
  esac
done

# Validate required arguments
if [ -z "$STEP_ACTION" ]; then
  echo "ERROR: Missing required argument: --step-action" >&2
  exit 1
fi

# Validate execution_status if provided
if [ -n "$EXECUTION_STATUS" ]; then
  validate_execution_status "$EXECUTION_STATUS" || exit 1
fi

# Query by step action
ENTITY_KEYS=$(query_by_step_action "$STEP_ACTION" "$EXECUTION_STATUS")

# Convert entity keys to full entity objects
RESULTS="[]"
COUNT=0

while IFS= read -r entity_key; do
  [ -z "$entity_key" ] && continue
  [ "$COUNT" -ge "$LIMIT" ] && break

  # Parse entity_key (format: type/id)
  ENTITY_TYPE=$(dirname "$entity_key")
  ENTITY_ID=$(basename "$entity_key")

  # Read entity state
  ENTITY_FILE=".fractary/faber/entities/${ENTITY_TYPE}/${ENTITY_ID}.json"
  if [ -f "$ENTITY_FILE" ]; then
    ENTITY_STATE=$(cat "$ENTITY_FILE" 2>/dev/null || echo "{}")
    RESULTS=$(echo "$RESULTS" | jq --argjson entity "$ENTITY_STATE" '. + [$entity]')
    COUNT=$((COUNT + 1))
  fi
done <<< "$ENTITY_KEYS"

# Output results
echo "$RESULTS"
