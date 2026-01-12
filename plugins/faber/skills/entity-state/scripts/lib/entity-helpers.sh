#!/usr/bin/env bash
# Helper functions for entity state tracking in FABER workflows
# Used by faber-manager agent to implement entity tracking operations

set -euo pipefail

# Get organization from fractary-core:repo plugin
# Returns organization name or empty string if not available
get_organization_from_repo_plugin() {
  # Check if fractary-core:repo plugin is installed and has organization configured
  local repo_config=".fractary/repo/config.json"

  if [ -f "$repo_config" ]; then
    local org=$(jq -r '.organization // empty' "$repo_config" 2>/dev/null || echo "")
    if [ -n "$org" ] && [ "$org" != "null" ]; then
      echo "$org"
      return 0
    fi
  fi

  return 1
}

# Extract organization from git remote URL
# Supports GitHub, GitLab, Bitbucket patterns
# Examples:
#   git@github.com:fractary/faber.git -> fractary
#   https://github.com/fractary/faber.git -> fractary
extract_org_from_git_remote() {
  # Get remote URL (try origin first, then any remote)
  local remote_url=$(git remote get-url origin 2>/dev/null || git remote get-url $(git remote | head -n1) 2>/dev/null || echo "")

  if [ -z "$remote_url" ]; then
    return 1
  fi

  # Extract organization from URL patterns
  # SSH format: git@github.com:org/repo.git
  if [[ "$remote_url" =~ git@[^:]+:([^/]+)/ ]]; then
    echo "${BASH_REMATCH[1]}"
    return 0
  fi

  # HTTPS format: https://github.com/org/repo.git
  if [[ "$remote_url" =~ https?://[^/]+/([^/]+)/ ]]; then
    echo "${BASH_REMATCH[1]}"
    return 0
  fi

  return 1
}

# Get project name from git repository
# Returns the repository name (basename of git directory)
get_project_name_from_git() {
  # Try to get from git config first
  local project=$(git config --get fractary.project 2>/dev/null || echo "")

  if [ -n "$project" ]; then
    echo "$project"
    return 0
  fi

  # Fallback: use repository name
  local repo_name=$(basename "$(git rev-parse --show-toplevel 2>/dev/null || pwd)" 2>/dev/null || echo "")

  if [ -n "$repo_name" ]; then
    echo "$repo_name"
    return 0
  fi

  return 1
}

# Extract project from run_id
# run_id format: org/project/uuid or project/uuid
# Returns project name
extract_project_from_run_id() {
  local run_id="$1"

  if [ -z "$run_id" ]; then
    return 1
  fi

  # Split by / and get second-to-last component
  # org/project/uuid -> project
  # project/uuid -> project
  local parts=(${run_id//\// })
  local count=${#parts[@]}

  if [ $count -ge 2 ]; then
    echo "${parts[$((count-2))]}"
    return 0
  fi

  return 1
}

# Map workflow result to outcome_status
# Input: result object with status and optional error fields
# Output: outcome_status (success, failure, warning, partial)
map_result_to_outcome() {
  local result_json="$1"

  # Extract status from result
  local status=$(echo "$result_json" | jq -r '.status // empty')

  if [ -z "$status" ]; then
    echo "failure"
    return 0
  fi

  case "$status" in
    "completed")
      # Check if there were warnings or partial completion
      local has_warnings=$(echo "$result_json" | jq -r '.warnings // [] | length > 0')
      local is_partial=$(echo "$result_json" | jq -r '.partial // false')

      if [ "$is_partial" = "true" ]; then
        echo "partial"
      elif [ "$has_warnings" = "true" ]; then
        echo "warning"
      else
        echo "success"
      fi
      ;;
    "failed"|"error")
      echo "failure"
      ;;
    "skipped")
      # Skipped steps are generally considered successful (intentional skip)
      echo "success"
      ;;
    *)
      # Unknown status treated as failure
      echo "failure"
      ;;
  esac

  return 0
}

# Calculate overall entity status from step_status object
# Rules:
#   - Any step in_progress -> entity status = "in_progress"
#   - All steps completed -> entity status = "completed"
#   - Any critical step failed -> entity status = "failed"
#   - No steps executed -> entity status = "pending"
calculate_entity_status() {
  local step_status_json="$1"

  # Count steps by execution_status
  local total_steps=$(echo "$step_status_json" | jq '. | length')
  local in_progress=$(echo "$step_status_json" | jq '[.[] | select(.execution_status == "in_progress")] | length')
  local completed=$(echo "$step_status_json" | jq '[.[] | select(.execution_status == "completed")] | length')
  local failed=$(echo "$step_status_json" | jq '[.[] | select(.execution_status == "failed")] | length')
  local started=$(echo "$step_status_json" | jq '[.[] | select(.execution_status == "started")] | length')

  # No steps executed
  if [ "$total_steps" -eq 0 ]; then
    echo "pending"
    return 0
  fi

  # Any step in progress or started
  if [ "$in_progress" -gt 0 ] || [ "$started" -gt 0 ]; then
    echo "in_progress"
    return 0
  fi

  # Any step failed (critical failure)
  if [ "$failed" -gt 0 ]; then
    echo "failed"
    return 0
  fi

  # All steps completed
  if [ "$completed" -eq "$total_steps" ]; then
    echo "completed"
    return 0
  fi

  # Mixed state (some skipped, some completed) - consider in progress
  echo "in_progress"
  return 0
}

# Extract artifacts from workflow state based on artifact mapping
# Input: state_json, artifact_mapping (JSON object mapping state paths to artifact types)
# Output: JSON array of artifacts
# Example artifact_mapping:
# {
#   "spec_path": "file",
#   "pr_url": "url",
#   "deployment_endpoint": "url"
# }
extract_artifacts_from_state() {
  local state_json="$1"
  local artifact_mapping="$2"
  local current_step="${3:-unknown}"
  local current_run="${4:-unknown}"

  # Initialize empty artifacts array
  local artifacts="[]"

  # Iterate through artifact mapping
  while IFS='=' read -r state_path artifact_type; do
    # Extract value from state using jq path
    local value=$(echo "$state_json" | jq -r ".$state_path // empty" 2>/dev/null || echo "")

    if [ -n "$value" ] && [ "$value" != "null" ]; then
      # Create artifact object
      local artifact=$(jq -n \
        --arg type "$artifact_type" \
        --arg path "$value" \
        --arg created_by_step "$current_step" \
        --arg created_by_run "$current_run" \
        --arg created_at "$(date -Iseconds)" \
        '{
          type: $type,
          path: $path,
          created_at: $created_at,
          created_by_step: $created_by_step,
          created_by_run: $created_by_run
        }')

      # Append to artifacts array
      artifacts=$(echo "$artifacts" | jq --argjson artifact "$artifact" '. + [$artifact]')
    fi
  done < <(echo "$artifact_mapping" | jq -r 'to_entries | .[] | "\(.key)=\(.value)"')

  # Return artifacts array
  echo "$artifacts"
  return 0
}

# Combine organization extraction with fallbacks
# Returns organization name or "unknown" if all methods fail
get_organization() {
  local org=""

  # Try repo plugin first
  org=$(get_organization_from_repo_plugin 2>/dev/null || echo "")
  if [ -n "$org" ]; then
    echo "$org"
    return 0
  fi

  # Fallback to git remote
  org=$(extract_org_from_git_remote 2>/dev/null || echo "")
  if [ -n "$org" ]; then
    echo "$org"
    return 0
  fi

  # Last resort: use "unknown"
  echo "unknown"
  return 0
}

# Combine project extraction with fallbacks
# Returns project name or "unknown" if all methods fail
get_project() {
  local run_id="${1:-}"
  local project=""

  # Try git first
  project=$(get_project_name_from_git 2>/dev/null || echo "")
  if [ -n "$project" ]; then
    echo "$project"
    return 0
  fi

  # Fallback to run_id
  if [ -n "$run_id" ]; then
    project=$(extract_project_from_run_id "$run_id" 2>/dev/null || echo "")
    if [ -n "$project" ]; then
      echo "$project"
      return 0
    fi
  fi

  # Last resort: use "unknown"
  echo "unknown"
  return 0
}
