#!/usr/bin/env bash
# Entity locking utilities for concurrency control
# Provides functions for acquiring and releasing locks on entity files

set -euo pipefail

# Global variables
LOCK_ACQUIRED=false
LOCK_FILE=""
LOCK_TIMEOUT=30  # seconds
LOCK_MAX_AGE=300  # 5 minutes

# Acquire exclusive lock on entity
# Usage: acquire_entity_lock <entity_type> <entity_id> [timeout]
acquire_entity_lock() {
  local entity_type="$1"
  local entity_id="$2"
  local timeout="${3:-$LOCK_TIMEOUT}"

  # Compute lock file path
  LOCK_FILE=".fractary/faber/entities/${entity_type}/${entity_id}.lock"

  local start_time=$(date +%s)
  local pid=$$

  while true; do
    # Try to create lock directory atomically
    if mkdir "$LOCK_FILE" 2>/dev/null; then
      # Lock acquired
      echo "$pid" > "$LOCK_FILE/pid"
      echo "$(date -Iseconds)" > "$LOCK_FILE/acquired_at"
      echo "$(hostname)" > "$LOCK_FILE/hostname"
      LOCK_ACQUIRED=true
      return 0
    fi

    # Lock already exists - check if it's stale
    if [ -d "$LOCK_FILE" ]; then
      # Check if lock holder process is still running
      if [ -f "$LOCK_FILE/pid" ]; then
        local lock_pid=$(cat "$LOCK_FILE/pid" 2>/dev/null || echo "")

        if [ -n "$lock_pid" ]; then
          # Check if process is still running
          if ! ps -p "$lock_pid" > /dev/null 2>&1; then
            echo "WARNING: Removing stale lock (process $lock_pid dead)" >&2
            rm -rf "$LOCK_FILE"
            continue
          fi
        fi
      fi

      # Check lock age
      if [ -f "$LOCK_FILE/acquired_at" ]; then
        local lock_time=$(cat "$LOCK_FILE/acquired_at" 2>/dev/null || echo "")

        if [ -n "$lock_time" ]; then
          local lock_age=$(( $(date +%s) - $(date -d "$lock_time" +%s 2>/dev/null || echo "0") ))

          if [ "$lock_age" -gt "$LOCK_MAX_AGE" ]; then
            echo "WARNING: Removing orphaned lock (age: ${lock_age}s > ${LOCK_MAX_AGE}s)" >&2
            rm -rf "$LOCK_FILE"
            continue
          fi
        fi
      fi
    fi

    # Check timeout
    local elapsed=$(( $(date +%s) - start_time ))
    if [ "$elapsed" -ge "$timeout" ]; then
      echo "ERROR: Failed to acquire lock on ${entity_type}/${entity_id} after ${timeout}s" >&2

      # Show lock holder info if available
      if [ -f "$LOCK_FILE/pid" ]; then
        local lock_pid=$(cat "$LOCK_FILE/pid" 2>/dev/null || echo "unknown")
        local lock_host=$(cat "$LOCK_FILE/hostname" 2>/dev/null || echo "unknown")
        local lock_time=$(cat "$LOCK_FILE/acquired_at" 2>/dev/null || echo "unknown")
        echo "ERROR: Lock held by PID $lock_pid on $lock_host since $lock_time" >&2
      fi

      return 1
    fi

    # Wait and retry
    sleep 0.5
  done
}

# Release lock on entity
# Usage: release_entity_lock
release_entity_lock() {
  if [ "$LOCK_ACQUIRED" = true ] && [ -n "$LOCK_FILE" ] && [ -d "$LOCK_FILE" ]; then
    # Verify we still own the lock
    if [ -f "$LOCK_FILE/pid" ]; then
      local lock_pid=$(cat "$LOCK_FILE/pid" 2>/dev/null || echo "")
      if [ "$lock_pid" = "$$" ]; then
        rm -rf "$LOCK_FILE"
        LOCK_ACQUIRED=false
        return 0
      else
        echo "WARNING: Lock owned by different process (expected $$, got $lock_pid)" >&2
        return 1
      fi
    fi

    # Lock file exists but no PID - remove it anyway
    rm -rf "$LOCK_FILE"
    LOCK_ACQUIRED=false
  fi
}

# Trap to ensure lock is released on exit
trap release_entity_lock EXIT INT TERM

# Check if lock is currently held
# Usage: is_lock_held
is_lock_held() {
  [ "$LOCK_ACQUIRED" = true ]
}

# Get lock holder info
# Usage: get_lock_holder <entity_type> <entity_id>
get_lock_holder() {
  local entity_type="$1"
  local entity_id="$2"
  local lock_file=".fractary/faber/entities/${entity_type}/${entity_id}.lock"

  if [ -d "$lock_file" ]; then
    local pid=$(cat "$lock_file/pid" 2>/dev/null || echo "unknown")
    local hostname=$(cat "$lock_file/hostname" 2>/dev/null || echo "unknown")
    local acquired_at=$(cat "$lock_file/acquired_at" 2>/dev/null || echo "unknown")

    echo "Lock held by PID $pid on $hostname since $acquired_at"
    return 0
  else
    echo "No lock held"
    return 1
  fi
}

# Export functions
export -f acquire_entity_lock
export -f release_entity_lock
export -f is_lock_held
export -f get_lock_holder
