#!/usr/bin/env bash
#
# config-init.sh - DEPRECATED - Use /fractary-faber:config-init command instead
#
# This script is DEPRECATED as of v2.3.0. FABER configuration is now stored
# in the 'faber:' section of .fractary/config.yaml (unified config format).
#
# The /fractary-faber:config-init command handles:
# - Interactive setup with auto-detection
# - Unified YAML config at .fractary/config.yaml
# - Proper gitignore management
# - Backup and rollback support
#
# Usage (DEPRECATED):
#   config-init.sh [--template minimal|standard|enterprise] [--output <path>] [--force]
#
# Exit codes:
#   0 - Success
#   1 - Error
#   2 - File already exists (unless --force)
#   3 - Deprecated script warning

set -euo pipefail

# DEPRECATION WARNING
echo "WARNING: config-init.sh is DEPRECATED"
echo ""
echo "FABER configuration has moved to .fractary/config.yaml (faber: section)"
echo "Please use the /fractary-faber:config-init command instead."
echo ""
echo "If you need to proceed anyway (not recommended), use --force flag."
echo ""

# Check for --force to allow deprecated usage
if [[ ! " $* " =~ " --force " ]]; then
    echo "Aborting. Use /fractary-faber:config-init for proper setup."
    exit 3
fi

echo "Proceeding with DEPRECATED behavior (--force specified)..."
echo ""

# Script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
FABER_ROOT="$(cd "$SCRIPT_DIR/../../.." && pwd)"
TEMPLATES_DIR="$FABER_ROOT/config/templates"
WORKFLOWS_DIR="$FABER_ROOT/config/workflows"
# DEPRECATED: .fractary/faber/config.json is no longer used
# FABER config is now stored in the 'faber:' section of .fractary/config.yaml
# This script is DEPRECATED - use /fractary-faber:config-init command instead
DEFAULT_OUTPUT=".fractary/config.yaml"

# Defaults
TEMPLATE="standard"
OUTPUT="$DEFAULT_OUTPUT"
FORCE=false

# Parse arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --template)
            TEMPLATE="$2"
            shift 2
            ;;
        --output)
            OUTPUT="$2"
            shift 2
            ;;
        --force)
            FORCE=true
            shift
            ;;
        *)
            echo "Unknown option: $1"
            echo "Usage: config-init.sh [--template minimal|standard|enterprise] [--output <path>] [--force]"
            exit 1
            ;;
    esac
done

# Validate template
case "$TEMPLATE" in
    minimal|standard|enterprise)
        ;;
    *)
        echo "Error: Invalid template '$TEMPLATE'. Must be: minimal, standard, or enterprise"
        exit 1
        ;;
esac

TEMPLATE_FILE="$TEMPLATES_DIR/$TEMPLATE.json"

# Check if template exists
if [ ! -f "$TEMPLATE_FILE" ]; then
    echo "Error: Template file not found: $TEMPLATE_FILE"
    exit 1
fi

# Check if output file exists
if [ -f "$OUTPUT" ] && [ "$FORCE" = false ]; then
    echo "Error: Configuration file already exists: $OUTPUT"
    echo "Use --force to overwrite"
    exit 2
fi

# Create output directory
OUTPUT_DIR=$(dirname "$OUTPUT")
mkdir -p "$OUTPUT_DIR"

# Copy template to output
cp "$TEMPLATE_FILE" "$OUTPUT"

# Create workflows directory and copy workflow templates
WORKFLOWS_OUTPUT_DIR="$OUTPUT_DIR/workflows"
mkdir -p "$WORKFLOWS_OUTPUT_DIR"

# Copy workflow templates if they exist
if [ -d "$WORKFLOWS_DIR" ]; then
    for workflow_file in "$WORKFLOWS_DIR"/*.json; do
        if [ -f "$workflow_file" ]; then
            workflow_basename=$(basename "$workflow_file")
            cp "$workflow_file" "$WORKFLOWS_OUTPUT_DIR/$workflow_basename"
            echo "  ✓ Copied workflow: $workflow_basename"
        fi
    done
fi

echo ""
echo "✓ FABER configuration initialized"
echo "  Template: $TEMPLATE"
echo "  Config: $OUTPUT"
echo "  Workflows: $WORKFLOWS_OUTPUT_DIR/"
echo ""
echo "Created files:"
echo "  - $OUTPUT"
echo "  - $WORKFLOWS_OUTPUT_DIR/default.json"
echo "  - $WORKFLOWS_OUTPUT_DIR/hotfix.json"
echo ""
echo "Next steps:"
echo "  1. Review and customize: $OUTPUT"
echo "  2. Customize workflows: $WORKFLOWS_OUTPUT_DIR/default.json"
echo "  3. Validate configuration: /fractary-faber:audit"
echo "  4. Run FABER workflow: /fractary-faber:run <issue-number>"

exit 0
