#!/usr/bin/env bash
# Index maintenance library for entity state
# Maintains indices for fast queries: by-status, by-type, by-step-action, recent-updates

set -euo pipefail

# Index directory
INDEX_DIR=".fractary/faber/entities/_indices"
INDEX_LOCK_FILE=""
INDEX_LOCK_ACQUIRED=false

# Trap to release lock on exit
release_index_lock_on_exit() {
  if [ "$INDEX_LOCK_ACQUIRED" = true ]; then
    release_index_lock
  fi
}
trap release_index_lock_on_exit EXIT INT TERM

# Acquire index lock (shorter timeout than entity lock - 5 seconds)
acquire_index_lock() {
  local lock_file="$INDEX_DIR/.index.lock"
  INDEX_LOCK_FILE="$lock_file"

  local start_time=$(date +%s)
  local timeout=5

  while true; do
    if mkdir "$lock_file" 2>/dev/null; then
      echo "$$" > "$lock_file/pid"
      date -Iseconds > "$lock_file/time" 2>/dev/null || date > "$lock_file/time"
      INDEX_LOCK_ACQUIRED=true
      return 0
    fi

    # Check if lock is stale
    if [ -f "$lock_file/pid" ]; then
      local lock_pid=$(cat "$lock_file/pid" 2>/dev/null || echo "")
      if [ -n "$lock_pid" ] && ! ps -p "$lock_pid" > /dev/null 2>&1; then
        # Process dead, remove stale lock
        rm -rf "$lock_file" 2>/dev/null || true
        continue
      fi
    fi

    # Check timeout
    if [ $(( $(date +%s) - start_time )) -ge $timeout ]; then
      echo "WARNING: Index lock timeout after ${timeout}s, proceeding anyway" >&2
      return 1
    fi

    sleep 0.1
  done
}

# Release index lock
release_index_lock() {
  if [ "$INDEX_LOCK_ACQUIRED" = true ] && [ -n "$INDEX_LOCK_FILE" ]; then
    rm -rf "$INDEX_LOCK_FILE" 2>/dev/null || true
    INDEX_LOCK_ACQUIRED=false
  fi
}

# Ensure index directory exists
ensure_index_dir() {
  mkdir -p "$INDEX_DIR"
}

# Initialize empty index if it doesn't exist
init_index_if_missing() {
  local index_file="$1"
  if [ ! -f "$index_file" ]; then
    echo "{}" > "$index_file"
  fi
}

# Atomic write helper for index files
# Usage: atomic_index_write <index_file> <content>
atomic_index_write() {
  local index_file="$1"
  local content="$2"
  local temp_file="${index_file}.tmp.$$"

  # Write to temp file
  if ! echo "$content" > "$temp_file"; then
    echo "ERROR: Failed to write temp index file: $temp_file" >&2
    rm -f "$temp_file" 2>/dev/null || true
    return 1
  fi

  # Atomic move
  if ! mv "$temp_file" "$index_file"; then
    echo "ERROR: Failed to atomically update index file: $index_file" >&2
    rm -f "$temp_file" 2>/dev/null || true
    return 1
  fi

  return 0
}

# Update by-status index
# Adds entity_id to the list for a given status
update_status_index() {
  local entity_type="$1"
  local entity_id="$2"
  local status="$3"
  local old_status="${4:-}"

  ensure_index_dir
  local index_file="$INDEX_DIR/by-status.json"
  init_index_if_missing "$index_file"

  # Acquire lock
  acquire_index_lock || echo "WARNING: Proceeding without index lock" >&2

  # Create entity key
  local entity_key="${entity_type}/${entity_id}"

  # Read current index
  local current=$(cat "$index_file")

  # If old_status provided, remove from old status list
  if [ -n "$old_status" ] && [ "$old_status" != "$status" ]; then
    current=$(echo "$current" | jq \
      --arg old_status "$old_status" \
      --arg entity_key "$entity_key" \
      'if .[$old_status] then .[$old_status] = (.[$old_status] | map(select(. != $entity_key))) else . end')
  fi

  # Add to new status list
  local updated=$(echo "$current" | jq \
    --arg status "$status" \
    --arg entity_key "$entity_key" \
    '.[$status] = ((.[$status] // []) + [$entity_key] | unique)')

  # Atomic write
  atomic_index_write "$index_file" "$updated" || {
    echo "WARNING: Failed to update status index for ${entity_type}/${entity_id}" >&2
    release_index_lock
    return 1
  }

  release_index_lock
  return 0
}

# Update by-type index
# Tracks all entities of a given type
update_type_index() {
  local entity_type="$1"
  local entity_id="$2"

  ensure_index_dir
  local index_file="$INDEX_DIR/by-type.json"
  init_index_if_missing "$index_file"

  local entity_key="${entity_type}/${entity_id}"

  # Add to type list
  local updated=$(cat "$index_file" | jq \
    --arg type "$entity_type" \
    --arg entity_key "$entity_key" \
    '.[$type] = ((.[$type] // []) + [$entity_key] | unique)')

  echo "$updated" > "$index_file"
}

# Update by-step-action index
# Tracks entities that have a specific step_action in their step_status
update_step_action_index() {
  local entity_type="$1"
  local entity_id="$2"
  local step_action="$3"
  local execution_status="${4:-}"

  ensure_index_dir
  local index_file="$INDEX_DIR/by-step-action.json"
  init_index_if_missing "$index_file"

  local entity_key="${entity_type}/${entity_id}"

  if [ -n "$execution_status" ]; then
    # Add to step_action#execution_status list
    local action_status_key="${step_action}#${execution_status}"
    local updated=$(cat "$index_file" | jq \
      --arg key "$action_status_key" \
      --arg entity_key "$entity_key" \
      '.[$key] = ((.[$key] // []) + [$entity_key] | unique)')
    echo "$updated" > "$index_file"
  else
    # Add to step_action list (any status)
    local updated=$(cat "$index_file" | jq \
      --arg action "$step_action" \
      --arg entity_key "$entity_key" \
      '.[$action] = ((.[$action] // []) + [$entity_key] | unique)')
    echo "$updated" > "$index_file"
  fi
}

# Update recent-updates index
# Maintains sorted list of recently updated entities (last 1000)
update_recent_updates_index() {
  local entity_type="$1"
  local entity_id="$2"
  local updated_at="$3"

  ensure_index_dir
  local index_file="$INDEX_DIR/recent-updates.json"

  if [ ! -f "$index_file" ]; then
    echo "[]" > "$index_file"
  fi

  local entity_key="${entity_type}/${entity_id}"

  # Remove existing entry for this entity (if any)
  local without_entity=$(cat "$index_file" | jq \
    --arg entity_key "$entity_key" \
    'map(select(.entity != $entity_key))')

  # Add new entry
  local with_new=$(echo "$without_entity" | jq \
    --arg entity_key "$entity_key" \
    --arg updated_at "$updated_at" \
    --arg type "$entity_type" \
    --arg id "$entity_id" \
    '. + [{entity: $entity_key, type: $type, id: $id, updated_at: $updated_at}]')

  # Sort by updated_at descending and keep last 1000
  local sorted=$(echo "$with_new" | jq \
    'sort_by(.updated_at) | reverse | .[0:1000]')

  echo "$sorted" > "$index_file"
}

# Rebuild all indices from scratch
# Scans all entity files and rebuilds indices
rebuild_all_indices() {
  ensure_index_dir

  echo "Rebuilding all indices..." >&2

  # Initialize empty indices
  echo "{}" > "$INDEX_DIR/by-status.json"
  echo "{}" > "$INDEX_DIR/by-type.json"
  echo "{}" > "$INDEX_DIR/by-step-action.json"
  echo "[]" > "$INDEX_DIR/recent-updates.json"

  local count=0

  # Find all entity files (not history files)
  while IFS= read -r entity_file; do
    # Skip if no files found
    [ -f "$entity_file" ] || continue

    # Extract entity_type and entity_id from path
    # Path format: .fractary/faber/entities/{type}/{id}.json
    local relative_path="${entity_file#.fractary/faber/entities/}"
    local entity_type=$(dirname "$relative_path")
    local filename=$(basename "$relative_path")
    local entity_id="${filename%.json}"

    # Skip history files
    [[ "$entity_id" == *"-history" ]] && continue

    # Read entity state
    local state=$(cat "$entity_file" 2>/dev/null || echo "{}")

    # Extract fields
    local status=$(echo "$state" | jq -r '.status // "unknown"')
    local updated_at=$(echo "$state" | jq -r '.updated_at // ""')

    # Update indices
    update_status_index "$entity_type" "$entity_id" "$status"
    update_type_index "$entity_type" "$entity_id"
    update_recent_updates_index "$entity_type" "$entity_id" "$updated_at"

    # Update step_action indices
    local step_actions=$(echo "$state" | jq -r '.step_status | to_entries[] | select(.value.step_action != null and .value.step_action != "") | "\(.value.step_action)#\(.value.execution_status)"')
    while IFS='#' read -r step_action execution_status; do
      [ -n "$step_action" ] && update_step_action_index "$entity_type" "$entity_id" "$step_action" "$execution_status"
    done <<< "$step_actions"

    count=$((count + 1))
  done < <(find .fractary/faber/entities -name "*.json" -not -name "*-history.json" -type f 2>/dev/null || true)

  echo "Rebuilt indices for $count entities" >&2
}

# Remove entity from all indices
remove_from_indices() {
  local entity_type="$1"
  local entity_id="$2"

  ensure_index_dir
  local entity_key="${entity_type}/${entity_id}"

  # Remove from by-status
  if [ -f "$INDEX_DIR/by-status.json" ]; then
    local updated=$(cat "$INDEX_DIR/by-status.json" | jq \
      --arg entity_key "$entity_key" \
      'with_entries(.value = (.value | map(select(. != $entity_key))))')
    echo "$updated" > "$INDEX_DIR/by-status.json"
  fi

  # Remove from by-type
  if [ -f "$INDEX_DIR/by-type.json" ]; then
    local updated=$(cat "$INDEX_DIR/by-type.json" | jq \
      --arg entity_key "$entity_key" \
      'with_entries(.value = (.value | map(select(. != $entity_key))))')
    echo "$updated" > "$INDEX_DIR/by-type.json"
  fi

  # Remove from by-step-action
  if [ -f "$INDEX_DIR/by-step-action.json" ]; then
    local updated=$(cat "$INDEX_DIR/by-step-action.json" | jq \
      --arg entity_key "$entity_key" \
      'with_entries(.value = (.value | map(select(. != $entity_key))))')
    echo "$updated" > "$INDEX_DIR/by-step-action.json"
  fi

  # Remove from recent-updates
  if [ -f "$INDEX_DIR/recent-updates.json" ]; then
    local updated=$(cat "$INDEX_DIR/recent-updates.json" | jq \
      --arg entity_key "$entity_key" \
      'map(select(.entity != $entity_key))')
    echo "$updated" > "$INDEX_DIR/recent-updates.json"
  fi
}

# Query by status
query_by_status() {
  local status="$1"
  ensure_index_dir
  local index_file="$INDEX_DIR/by-status.json"

  if [ ! -f "$index_file" ]; then
    echo "[]"
    return
  fi

  cat "$index_file" | jq -r \
    --arg status "$status" \
    '.[$status] // [] | .[]'
}

# Query by type
query_by_type() {
  local entity_type="$1"
  ensure_index_dir
  local index_file="$INDEX_DIR/by-type.json"

  if [ ! -f "$index_file" ]; then
    echo "[]"
    return
  fi

  cat "$index_file" | jq -r \
    --arg type "$entity_type" \
    '.[$type] // [] | .[]'
}

# Query by step action
query_by_step_action() {
  local step_action="$1"
  local execution_status="${2:-}"

  ensure_index_dir
  local index_file="$INDEX_DIR/by-step-action.json"

  if [ ! -f "$index_file" ]; then
    echo "[]"
    return
  fi

  if [ -n "$execution_status" ]; then
    local key="${step_action}#${execution_status}"
    cat "$index_file" | jq -r \
      --arg key "$key" \
      '.[$key] // [] | .[]'
  else
    cat "$index_file" | jq -r \
      --arg action "$step_action" \
      '.[$action] // [] | .[]'
  fi
}

# Query recent updates
query_recent_updates() {
  local since="${1:-}"
  local limit="${2:-100}"

  ensure_index_dir
  local index_file="$INDEX_DIR/recent-updates.json"

  if [ ! -f "$index_file" ]; then
    echo "[]"
    return
  fi

  if [ -n "$since" ]; then
    cat "$index_file" | jq \
      --arg since "$since" \
      --argjson limit "$limit" \
      '[.[] | select(.updated_at > $since)] | .[0:$limit]'
  else
    cat "$index_file" | jq \
      --argjson limit "$limit" \
      '.[0:$limit]'
  fi
}
