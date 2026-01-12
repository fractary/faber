#!/usr/bin/env bash
# Entity validation library
# Provides functions to validate entity_type, entity_id, and other parameters

# Validate entity_type format
# Returns 0 if valid, 1 if invalid
validate_entity_type() {
  local entity_type="$1"

  if [ -z "$entity_type" ]; then
    echo "ERROR: entity_type cannot be empty" >&2
    return 1
  fi

  if ! [[ "$entity_type" =~ ^[a-z][a-z0-9-]*$ ]]; then
    echo "ERROR: Invalid entity_type format: $entity_type" >&2
    echo "Entity types must start with lowercase letter and contain only lowercase letters, numbers, and hyphens (^[a-z][a-z0-9-]*$)" >&2
    return 1
  fi

  return 0
}

# Validate entity_id format (SECURITY CRITICAL: prevents path traversal)
# Returns 0 if valid, 1 if invalid
validate_entity_id() {
  local entity_id="$1"

  if [ -z "$entity_id" ]; then
    echo "ERROR: entity_id cannot be empty" >&2
    return 1
  fi

  # Only allow alphanumeric, underscore, and hyphen
  if ! [[ "$entity_id" =~ ^[a-zA-Z0-9_-]+$ ]]; then
    echo "ERROR: Invalid entity_id format: $entity_id" >&2
    echo "Entity IDs must contain only alphanumeric characters, underscores, and hyphens (^[a-zA-Z0-9_-]+$)" >&2
    echo "This prevents path traversal attacks." >&2
    return 1
  fi

  # Additional check: cannot be just dots or start with dot
  if [[ "$entity_id" =~ ^\.*$ ]] || [[ "$entity_id" =~ ^\. ]]; then
    echo "ERROR: Invalid entity_id: $entity_id" >&2
    echo "Entity IDs cannot consist only of dots or start with a dot." >&2
    return 1
  fi

  # Check length (reasonable limits)
  if [ ${#entity_id} -gt 255 ]; then
    echo "ERROR: Entity ID too long: $entity_id (max 255 characters)" >&2
    return 1
  fi

  return 0
}

# Validate organization format
# Returns 0 if valid, 1 if invalid
validate_organization() {
  local organization="$1"

  if [ -z "$organization" ]; then
    echo "ERROR: organization cannot be empty" >&2
    return 1
  fi

  if ! [[ "$organization" =~ ^[a-z0-9][a-z0-9-]*[a-z0-9]$ ]]; then
    echo "ERROR: Invalid organization format: $organization" >&2
    echo "Organizations must start and end with alphanumeric, and contain only lowercase letters, numbers, and hyphens" >&2
    return 1
  fi

  return 0
}

# Validate project format
# Returns 0 if valid, 1 if invalid
validate_project() {
  local project="$1"

  if [ -z "$project" ]; then
    echo "ERROR: project cannot be empty" >&2
    return 1
  fi

  # Projects can have more flexible naming than entity_types
  if ! [[ "$project" =~ ^[a-zA-Z0-9_-]+$ ]]; then
    echo "ERROR: Invalid project format: $project" >&2
    echo "Projects must contain only alphanumeric characters, underscores, and hyphens" >&2
    return 1
  fi

  return 0
}

# Validate status value
# Returns 0 if valid, 1 if invalid
validate_status() {
  local status="$1"

  case "$status" in
    pending|in_progress|completed|failed|blocked|skipped|archived)
      return 0
      ;;
    *)
      echo "ERROR: Invalid status: $status" >&2
      echo "Valid values: pending, in_progress, completed, failed, blocked, skipped, archived" >&2
      return 1
      ;;
  esac
}

# Validate execution_status value
# Returns 0 if valid, 1 if invalid
validate_execution_status() {
  local status="$1"

  case "$status" in
    started|in_progress|completed|failed|skipped)
      return 0
      ;;
    *)
      echo "ERROR: Invalid execution_status: $status" >&2
      echo "Valid values: started, in_progress, completed, failed, skipped" >&2
      return 1
      ;;
  esac
}

# Validate outcome_status value
# Returns 0 if valid, 1 if invalid
validate_outcome_status() {
  local status="$1"

  case "$status" in
    success|failure|warning|partial)
      return 0
      ;;
    *)
      echo "ERROR: Invalid outcome_status: $status" >&2
      echo "Valid values: success, failure, warning, partial" >&2
      return 1
      ;;
  esac
}

# Validate phase value
# Returns 0 if valid, 1 if invalid
validate_phase() {
  local phase="$1"

  case "$phase" in
    frame|architect|build|evaluate|release)
      return 0
      ;;
    *)
      echo "ERROR: Invalid phase: $phase" >&2
      echo "Valid values: frame, architect, build, evaluate, release" >&2
      return 1
      ;;
  esac
}
