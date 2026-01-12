#!/usr/bin/env bash
# Read entity state file
# Usage: entity-read.sh --type <entity_type> --id <entity_id> [--query <jq_query>] [--include-history]

set -euo pipefail

# Source validation library
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/lib/entity-validation.sh"

# Parse arguments
ENTITY_TYPE=""
ENTITY_ID=""
JQ_QUERY="."
INCLUDE_HISTORY=false

while [[ $# -gt 0 ]]; do
  case $1 in
    --type)
      ENTITY_TYPE="$2"
      shift 2
      ;;
    --id)
      ENTITY_ID="$2"
      shift 2
      ;;
    --query)
      JQ_QUERY="$2"
      shift 2
      ;;
    --include-history)
      INCLUDE_HISTORY=true
      shift
      ;;
    *)
      echo "ERROR: Unknown argument: $1" >&2
      exit 1
      ;;
  esac
done

# Validate required arguments
if [ -z "$ENTITY_TYPE" ] || [ -z "$ENTITY_ID" ]; then
  echo "ERROR: Missing required arguments" >&2
  echo "Usage: entity-read.sh --type <entity_type> --id <entity_id> [--query <jq_query>] [--include-history]" >&2
  exit 1
fi

# Validate formats using validation library
validate_entity_type "$ENTITY_TYPE" || exit 1
validate_entity_id "$ENTITY_ID" || exit 1

# Compute file paths
ENTITY_FILE=".fractary/faber/entities/${ENTITY_TYPE}/${ENTITY_ID}.json"
HISTORY_FILE=".fractary/faber/entities/${ENTITY_TYPE}/${ENTITY_ID}-history.json"

# Check if entity exists
if [ ! -f "$ENTITY_FILE" ]; then
  echo "ERROR: Entity not found: ${ENTITY_TYPE}/${ENTITY_ID}" >&2
  jq -n \
    --arg status "error" \
    --arg message "Entity not found: ${ENTITY_TYPE}/${ENTITY_ID}" \
    '{status: $status, message: $message}'
  exit 1
fi

# Read entity state
ENTITY_STATE=$(cat "$ENTITY_FILE")

if [ "$INCLUDE_HISTORY" = true ] && [ -f "$HISTORY_FILE" ]; then
  # Merge entity state with history
  ENTITY_HISTORY=$(cat "$HISTORY_FILE")

  MERGED=$(jq -n \
    --argjson state "$ENTITY_STATE" \
    --argjson history "$ENTITY_HISTORY" \
    '$state + {step_history: $history.step_history, workflow_summary: $history.workflow_summary}')

  echo "$MERGED" | jq "$JQ_QUERY"
else
  # Return entity state only
  echo "$ENTITY_STATE" | jq "$JQ_QUERY"
fi
