#!/usr/bin/env bash
#
# validate-plan-step-ids.sh - Validate step_id naming convention in plan.json
#
# Enforces that every step ID in each phase follows the {phase}-{action} convention.
# A step defined under phase "release" must have a step_id starting with "release-".
# Steps with mismatched prefixes cause silent skipping when an orchestrator scans
# remaining work by prefix, which is one root cause of fabrication incidents.
#
# Rule: step.id must start with "{phase_name}-"
# Applies to: pre_steps, steps, and post_steps arrays in every phase.
#
# Usage:
#   validate-plan-step-ids.sh --plan-file <path>
#
# Exit Codes:
#   0 - All step IDs follow the {phase}-{action} convention
#   1 - One or more step IDs violate the convention (outputs diff)
#   2 - Input error (missing args, file not found, bad JSON)
#

set -euo pipefail

PLAN_FILE=""

while [[ $# -gt 0 ]]; do
    case "$1" in
        --plan-file)
            PLAN_FILE="$2"
            shift 2
            ;;
        -h|--help)
            echo "Usage: validate-plan-step-ids.sh --plan-file <path>"
            echo ""
            echo "Validates that every step ID follows the {phase}-{action} convention."
            echo ""
            echo "Options:"
            echo "  --plan-file <path>  Path to plan.json"
            echo ""
            echo "Exit codes:"
            echo "  0 - All step IDs valid"
            echo "  1 - Violations found"
            echo "  2 - Input error"
            exit 0
            ;;
        *)
            echo "Unknown argument: $1" >&2
            exit 2
            ;;
    esac
done

if [[ -z "$PLAN_FILE" ]]; then
    echo '{"status": "error", "message": "Missing --plan-file argument"}' >&2
    exit 2
fi

if [[ ! -f "$PLAN_FILE" ]]; then
    echo "{\"status\": \"error\", \"message\": \"Plan file not found: $PLAN_FILE\"}" >&2
    exit 2
fi

PLAN=$(cat "$PLAN_FILE")
if ! echo "$PLAN" | jq empty 2>/dev/null; then
    echo '{"status": "error", "message": "Plan file is not valid JSON"}' >&2
    exit 2
fi

# Collect violations: steps whose ID does not start with "{phase_name}-"
VIOLATIONS=$(echo "$PLAN" | jq -c '
    [
      .workflow.phases // {} | to_entries[] |
      . as $phase_entry |
      ($phase_entry.value.pre_steps // [] +
       $phase_entry.value.steps // [] +
       $phase_entry.value.post_steps // []) |
      .[] |
      select(.id | startswith($phase_entry.key + "-") | not) |
      {
        step_id: .id,
        phase: $phase_entry.key,
        expected_prefix: ($phase_entry.key + "-"),
        name: (.name // "(unnamed)")
      }
    ]
')

VIOLATION_COUNT=$(echo "$VIOLATIONS" | jq 'length')

if [[ "$VIOLATION_COUNT" -eq 0 ]]; then
    TOTAL=$(echo "$PLAN" | jq '
        [.workflow.phases // {} | to_entries[] |
         (.value.pre_steps // [] + .value.steps // [] + .value.post_steps // []) |
         .[]] | length')
    echo "$VIOLATIONS" | jq \
        --argjson total "$TOTAL" \
        '{status: "pass", message: ("All " + ($total | tostring) + " step IDs follow {phase}-{action} convention"), violations: []}'
    exit 0
else
    echo "$VIOLATIONS" | jq \
        --arg count "$VIOLATION_COUNT" \
        '{status: "fail", message: ($count + " step ID(s) violate the {phase}-{action} naming convention — steps with wrong prefix are silently skipped by prefix-based orchestrators"), violations: .}'
    exit 1
fi
