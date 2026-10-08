#!/usr/bin/env bash
# Query recently updated entities
# Usage: entity-query-recent.sh [--since <timestamp>] [--limit <n>] [--type <entity_type>]

set -euo pipefail

# Source libraries
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/lib/entity-validation.sh"
source "$SCRIPT_DIR/lib/index-update.sh"

# Parse arguments
SINCE=""
LIMIT="100"
FILTER_TYPE=""

while [[ $# -gt 0 ]]; do
  case $1 in
    --since)
      SINCE="$2"
      shift 2
      ;;
    --limit)
      LIMIT="$2"
      shift 2
      ;;
    --type)
      FILTER_TYPE="$2"
      shift 2
      ;;
    *)
      echo "ERROR: Unknown argument: $1" >&2
      echo "Usage: entity-query-recent.sh [--since <timestamp>] [--limit <n>] [--type <entity_type>]" >&2
      exit 1
      ;;
  esac
done

# Validate filter type if provided
if [ -n "$FILTER_TYPE" ]; then
  validate_entity_type "$FILTER_TYPE" || exit 1
fi

# Query recent updates
RESULTS=$(query_recent_updates "$SINCE" "$LIMIT")

# Filter by type if specified
if [ -n "$FILTER_TYPE" ]; then
  RESULTS=$(echo "$RESULTS" | jq \
    --arg type "$FILTER_TYPE" \
    '[.[] | select(.type == $type)]')
fi

# Output results
echo "$RESULTS"
