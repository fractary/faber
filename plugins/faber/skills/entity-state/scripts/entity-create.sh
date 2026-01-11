#!/usr/bin/env bash
# Create a new entity state file
# Usage: entity-create.sh --type <entity_type> --id <entity_id> --org <organization> --project <project> [--properties <json>] [--tags <tag1,tag2>]

set -euo pipefail

# Source locking library and index update library
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/lib/entity-lock.sh"
source "$SCRIPT_DIR/lib/index-update.sh"

# Parse arguments
ENTITY_TYPE=""
ENTITY_ID=""
ORGANIZATION=""
PROJECT=""
PROPERTIES="{}"
TAGS="[]"

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
    --org)
      ORGANIZATION="$2"
      shift 2
      ;;
    --project)
      PROJECT="$2"
      shift 2
      ;;
    --properties)
      PROPERTIES="$2"
      shift 2
      ;;
    --tags)
      # Convert comma-separated tags to JSON array
      IFS=',' read -ra TAG_ARRAY <<< "$2"
      TAGS=$(printf '%s\n' "${TAG_ARRAY[@]}" | jq -R . | jq -s .)
      shift 2
      ;;
    *)
      echo "ERROR: Unknown argument: $1" >&2
      exit 1
      ;;
  esac
done

# Validate required arguments
if [ -z "$ENTITY_TYPE" ] || [ -z "$ENTITY_ID" ] || [ -z "$ORGANIZATION" ] || [ -z "$PROJECT" ]; then
  echo "ERROR: Missing required arguments" >&2
  echo "Usage: entity-create.sh --type <entity_type> --id <entity_id> --org <organization> --project <project> [--properties <json>] [--tags <tag1,tag2>]" >&2
  exit 1
fi

# Validate entity_type and entity_id format
if ! [[ "$ENTITY_TYPE" =~ ^[a-z][a-z0-9-]*$ ]]; then
  echo "ERROR: Invalid entity_type format: $ENTITY_TYPE (must match ^[a-z][a-z0-9-]*$)" >&2
  exit 1
fi

if ! [[ "$ORGANIZATION" =~ ^[a-z0-9][a-z0-9-]*[a-z0-9]$ ]]; then
  echo "ERROR: Invalid organization format: $ORGANIZATION" >&2
  exit 1
fi

# Compute file paths
ENTITY_DIR=".fractary/faber/entities/${ENTITY_TYPE}"
ENTITY_FILE="${ENTITY_DIR}/${ENTITY_ID}.json"
HISTORY_FILE="${ENTITY_DIR}/${ENTITY_ID}-history.json"

# Check if entity already exists
if [ -f "$ENTITY_FILE" ]; then
  echo "ERROR: Entity already exists: ${ENTITY_TYPE}/${ENTITY_ID}" >&2
  echo "Use entity-update.sh to modify existing entity" >&2
  exit 1
fi

# Create directory if it doesn't exist
mkdir -p "$ENTITY_DIR"

# Acquire lock
acquire_entity_lock "$ENTITY_TYPE" "$ENTITY_ID" 30

# Get current timestamp
TIMESTAMP=$(date -Iseconds)

# Create entity state JSON
ENTITY_STATE=$(jq -n \
  --arg org "$ORGANIZATION" \
  --arg project "$PROJECT" \
  --arg type "$ENTITY_TYPE" \
  --arg id "$ENTITY_ID" \
  --arg timestamp "$TIMESTAMP" \
  --argjson properties "$PROPERTIES" \
  --argjson tags "$TAGS" \
  '{
    organization: $org,
    project: $project,
    entity_type: $type,
    entity_id: $id,
    status: "pending",
    created_at: $timestamp,
    updated_at: $timestamp,
    step_status: {},
    properties: $properties,
    artifacts: [],
    tags: $tags,
    version: 1,
    sync_metadata: {
      last_synced_at: null,
      sync_enabled: false,
      sync_target: null
    }
  }')

# Create entity history JSON
ENTITY_HISTORY=$(jq -n \
  --arg org "$ORGANIZATION" \
  --arg project "$PROJECT" \
  --arg type "$ENTITY_TYPE" \
  --arg id "$ENTITY_ID" \
  '{
    entity_type: $type,
    entity_id: $id,
    organization: $org,
    project: $project,
    step_history: [],
    workflow_summary: []
  }')

# Write files atomically
echo "$ENTITY_STATE" > "${ENTITY_FILE}.tmp"
echo "$ENTITY_HISTORY" > "${HISTORY_FILE}.tmp"

mv "${ENTITY_FILE}.tmp" "$ENTITY_FILE"
mv "${HISTORY_FILE}.tmp" "$HISTORY_FILE"

# Update indices
update_status_index "$ENTITY_TYPE" "$ENTITY_ID" "pending"
update_type_index "$ENTITY_TYPE" "$ENTITY_ID"
update_recent_updates_index "$ENTITY_TYPE" "$ENTITY_ID" "$TIMESTAMP"

# Release lock (will be called automatically by trap)

# Output success message
jq -n \
  --arg status "success" \
  --arg operation "create-entity" \
  --arg type "$ENTITY_TYPE" \
  --arg id "$ENTITY_ID" \
  --arg path "$ENTITY_FILE" \
  --arg history_path "$HISTORY_FILE" \
  '{
    status: $status,
    operation: $operation,
    entity_type: $type,
    entity_id: $id,
    entity_path: $path,
    history_path: $history_path
  }'
