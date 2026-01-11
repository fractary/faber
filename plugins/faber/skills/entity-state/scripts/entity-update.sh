#!/usr/bin/env bash
# Update entity state file
# Usage: entity-update.sh --type <entity_type> --id <entity_id> [--status <status>] [--properties <json>] [--artifacts <json>] [--version <expected_version>]

set -euo pipefail

# Source locking library and index update library
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/lib/entity-lock.sh"
source "$SCRIPT_DIR/lib/index-update.sh"

# Parse arguments
ENTITY_TYPE=""
ENTITY_ID=""
NEW_STATUS=""
PROPERTIES=""
ARTIFACTS=""
EXPECTED_VERSION=""
ADD_TAGS=""

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
    --status)
      NEW_STATUS="$2"
      shift 2
      ;;
    --properties)
      PROPERTIES="$2"
      shift 2
      ;;
    --artifacts)
      ARTIFACTS="$2"
      shift 2
      ;;
    --version)
      EXPECTED_VERSION="$2"
      shift 2
      ;;
    --add-tags)
      ADD_TAGS="$2"
      shift 2
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
  echo "Usage: entity-update.sh --type <entity_type> --id <entity_id> [--status <status>] [--properties <json>] [--artifacts <json>]" >&2
  exit 1
fi

# Compute file path
ENTITY_FILE=".fractary/faber/entities/${ENTITY_TYPE}/${ENTITY_ID}.json"

# Check if entity exists
if [ ! -f "$ENTITY_FILE" ]; then
  echo "ERROR: Entity not found: ${ENTITY_TYPE}/${ENTITY_ID}" >&2
  jq -n \
    --arg status "error" \
    --arg message "Entity not found: ${ENTITY_TYPE}/${ENTITY_ID}" \
    '{status: $status, message: $message}'
  exit 1
fi

# Acquire lock
acquire_entity_lock "$ENTITY_TYPE" "$ENTITY_ID" 30

# Read current state
CURRENT_STATE=$(cat "$ENTITY_FILE")
CURRENT_VERSION=$(echo "$CURRENT_STATE" | jq -r '.version')
OLD_STATUS=$(echo "$CURRENT_STATE" | jq -r '.status')

# Check version if specified (optimistic concurrency control)
if [ -n "$EXPECTED_VERSION" ] && [ "$CURRENT_VERSION" != "$EXPECTED_VERSION" ]; then
  release_entity_lock
  echo "ERROR: Version conflict (expected: $EXPECTED_VERSION, found: $CURRENT_VERSION)" >&2
  jq -n \
    --arg status "conflict" \
    --arg message "Entity was modified by another process" \
    --argjson expected "$EXPECTED_VERSION" \
    --argjson found "$CURRENT_VERSION" \
    '{status: $status, message: $message, expected_version: $expected, current_version: $found}'
  exit 1
fi

# Build update JSON
TIMESTAMP=$(date -Iseconds)
NEW_VERSION=$((CURRENT_VERSION + 1))

# Start with current state
UPDATED_STATE="$CURRENT_STATE"

# Update status if provided
if [ -n "$NEW_STATUS" ]; then
  UPDATED_STATE=$(echo "$UPDATED_STATE" | jq \
    --arg status "$NEW_STATUS" \
    '.status = $status')
fi

# Merge properties if provided
if [ -n "$PROPERTIES" ]; then
  UPDATED_STATE=$(echo "$UPDATED_STATE" | jq \
    --argjson props "$PROPERTIES" \
    '.properties = (.properties + $props)')
fi

# Append artifacts if provided
if [ -n "$ARTIFACTS" ]; then
  UPDATED_STATE=$(echo "$UPDATED_STATE" | jq \
    --argjson artifacts "$ARTIFACTS" \
    '.artifacts += $artifacts')
fi

# Add tags if provided
if [ -n "$ADD_TAGS" ]; then
  # Convert comma-separated tags to JSON array
  IFS=',' read -ra TAG_ARRAY <<< "$ADD_TAGS"
  NEW_TAGS=$(printf '%s\n' "${TAG_ARRAY[@]}" | jq -R . | jq -s .)

  UPDATED_STATE=$(echo "$UPDATED_STATE" | jq \
    --argjson new_tags "$NEW_TAGS" \
    '.tags = (.tags + $new_tags | unique)')
fi

# Update version and timestamp
UPDATED_STATE=$(echo "$UPDATED_STATE" | jq \
  --arg timestamp "$TIMESTAMP" \
  --argjson version "$NEW_VERSION" \
  '.updated_at = $timestamp | .version = $version')

# Write atomically
echo "$UPDATED_STATE" > "${ENTITY_FILE}.tmp"
mv "${ENTITY_FILE}.tmp" "$ENTITY_FILE"

# Update indices
if [ -n "$NEW_STATUS" ]; then
  update_status_index "$ENTITY_TYPE" "$ENTITY_ID" "$NEW_STATUS" "$OLD_STATUS"
fi
update_recent_updates_index "$ENTITY_TYPE" "$ENTITY_ID" "$TIMESTAMP"

# Release lock (will be called automatically by trap)

# Output success message
jq -n \
  --arg status "success" \
  --arg operation "update-entity" \
  --arg type "$ENTITY_TYPE" \
  --arg id "$ENTITY_ID" \
  --argjson version "$NEW_VERSION" \
  '{
    status: $status,
    operation: $operation,
    entity_type: $type,
    entity_id: $id,
    new_version: $version
  }'
