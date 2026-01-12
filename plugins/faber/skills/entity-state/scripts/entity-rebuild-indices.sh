#!/usr/bin/env bash
# Rebuild all entity indices from scratch
# Usage: entity-rebuild-indices.sh [--force]

set -euo pipefail

# Source index library
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/lib/index-update.sh"

# Parse arguments
FORCE=false

while [[ $# -gt 0 ]]; do
  case $1 in
    --force)
      FORCE=true
      shift
      ;;
    *)
      echo "ERROR: Unknown argument: $1" >&2
      echo "Usage: entity-rebuild-indices.sh [--force]" >&2
      exit 1
      ;;
  esac
done

# Check if entity directory exists
if [ ! -d ".fractary/faber/entities" ]; then
  echo "ERROR: Entity directory not found: .fractary/faber/entities" >&2
  echo "No entities to index." >&2
  exit 1
fi

# Warn if not forced
if [ "$FORCE" != "true" ]; then
  echo "WARNING: This will rebuild all indices from scratch." >&2
  echo "Any custom index data will be lost." >&2
  echo "Run with --force to proceed." >&2
  exit 0
fi

# Rebuild indices
rebuild_all_indices

# Output success message
jq -n \
  --arg status "success" \
  --arg operation "rebuild-indices" \
  '{
    status: $status,
    operation: $operation,
    message: "All indices rebuilt successfully"
  }'
