#!/usr/bin/env bash
# List entities with filters
# Usage: entity-list.sh --type <entity_type> [--status <status>] [--step-action <action>] [--execution-status <status>] [--limit <n>]

set -euo pipefail

# Source validation library
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/lib/entity-validation.sh"

# Parse arguments
ENTITY_TYPE=""
FILTER_STATUS=""
FILTER_STEP_ACTION=""
FILTER_EXECUTION_STATUS=""
LIMIT="100"

while [[ $# -gt 0 ]]; do
  case $1 in
    --type) ENTITY_TYPE="$2"; shift 2 ;;
    --status) FILTER_STATUS="$2"; shift 2 ;;
    --step-action) FILTER_STEP_ACTION="$2"; shift 2 ;;
    --execution-status) FILTER_EXECUTION_STATUS="$2"; shift 2 ;;
    --limit) LIMIT="$2"; shift 2 ;;
    *) echo "ERROR: Unknown argument: $1" >&2; exit 1 ;;
  esac
done

# Validate required arguments
if [ -z "$ENTITY_TYPE" ]; then
  echo "ERROR: Missing required argument: --type" >&2
  exit 1
fi

# Validate formats using validation library
validate_entity_type "$ENTITY_TYPE" || exit 1

# Validate filter values if provided
if [ -n "$FILTER_STATUS" ]; then
  validate_status "$FILTER_STATUS" || exit 1
fi
if [ -n "$FILTER_EXECUTION_STATUS" ]; then
  validate_execution_status "$FILTER_EXECUTION_STATUS" || exit 1
fi

# Compute entity directory
ENTITY_DIR=".fractary/faber/entities/${ENTITY_TYPE}"

if [ ! -d "$ENTITY_DIR" ]; then
  echo "[]"
  exit 0
fi

# Build jq filter
JQ_FILTER='.'

if [ -n "$FILTER_STATUS" ]; then
  JQ_FILTER="$JQ_FILTER | select(.status == \"$FILTER_STATUS\")"
fi

if [ -n "$FILTER_STEP_ACTION" ]; then
  if [ -n "$FILTER_EXECUTION_STATUS" ]; then
    JQ_FILTER="$JQ_FILTER | select(.step_status | to_entries[] | select(.value.step_action == \"$FILTER_STEP_ACTION\" and .value.execution_status == \"$FILTER_EXECUTION_STATUS\"))"
  else
    JQ_FILTER="$JQ_FILTER | select(.step_status | to_entries[] | select(.value.step_action == \"$FILTER_STEP_ACTION\"))"
  fi
fi

# List all entity files
RESULTS=$(find "$ENTITY_DIR" -name "*.json" -not -name "*-history.json" -type f | \
  head -n "$LIMIT" | \
  while read -r file; do
    cat "$file" 2>/dev/null || echo "{}"
  done | \
  jq -s "[.[] | $JQ_FILTER] | sort_by(.updated_at) | reverse")

echo "$RESULTS"
