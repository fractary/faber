#!/usr/bin/env bash
#
# state-update-step.sh - Update a specific step within a phase
#
# Usage:
#   state-update-step.sh <phase> <step_name> <status> [data_json]
#
# Arguments:
#   phase       - Phase name (frame, architect, build, evaluate, release)
#   step_name   - Name of the step to update
#   status      - Step status (pending, in_progress, completed, failed, skipped)
#   data_json   - Optional JSON data to store with step (default: {}). A
#                 skipped step needs a "reason" in it, which is recorded as
#                 the step's reason
#
# Examples:
#   state-update-step.sh build implement in_progress
#   state-update-step.sh build implement completed '{"files_changed": 5}'
#   state-update-step.sh evaluate test failed '{"test_count": 10, "failures": 2}'
#   state-update-step.sh release deploy skipped '{"reason": "User declined the destructive step"}'

set -euo pipefail

# Arguments
PHASE="${1:?Phase name required}"
STEP_NAME="${2:?Step name required}"
STATUS="${3:?Status required}"
DATA_JSON="${4:-"{}"}"

# Resolve paths robustly (works regardless of execution context)
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SKILL_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
FABER_ROOT="$(cd "$SKILL_ROOT/../.." && pwd)"
CORE_SCRIPTS="$FABER_ROOT/skills/fractary-faber-core/scripts"
STATE_FILE=".fractary/faber/state.json"

# Verify core scripts exist
if [ ! -d "$CORE_SCRIPTS" ]; then
    echo "Error: Core scripts not found at: $CORE_SCRIPTS" >&2
    exit 1
fi

# Validate phase
case "$PHASE" in
    frame|architect|build|evaluate|release) ;;
    *)
        echo "Error: Invalid phase: $PHASE" >&2
        exit 1
        ;;
esac

# Validate status
case "$STATUS" in
    pending|in_progress|completed|failed|skipped) ;;
    *)
        echo "Error: Invalid status: $STATUS" >&2
        exit 1
        ;;
esac

# Validate data JSON
if ! echo "$DATA_JSON" | jq empty 2>/dev/null; then
    echo "Error: Invalid JSON in data parameter" >&2
    exit 1
fi

# Check state file exists
if [ ! -f "$STATE_FILE" ]; then
    echo "Error: State file not found: $STATE_FILE" >&2
    exit 1
fi

# Read current state
CURRENT_STATE=$("$CORE_SCRIPTS/state-read.sh" "$STATE_FILE")

# Current timestamp
TIMESTAMP=$(date -u +%Y-%m-%dT%H:%M:%SZ)

# Update step in the phase
# First, ensure the phase has a steps array
# Then find or create the step entry and update it
UPDATED_STATE=$(echo "$CURRENT_STATE" | jq \
    --arg phase "$PHASE" \
    --arg step_name "$STEP_NAME" \
    --arg status "$STATUS" \
    --arg timestamp "$TIMESTAMP" \
    --argjson data "$DATA_JSON" \
    '
    # A skipped step records its reason from the data
    ($data | if type == "object" then .reason else null end) as $reason |

    # Ensure steps array exists for the phase
    if .phases[$phase].steps == null then
        .phases[$phase].steps = []
    else . end |

    # Find step index
    (.phases[$phase].steps | map(.name == $step_name) | index(true)) as $idx |

    if $idx != null then
        # Update existing step
        .phases[$phase].steps[$idx].status = $status |
        .phases[$phase].steps[$idx].updated_at = $timestamp |
        if $status == "in_progress" then
            .phases[$phase].steps[$idx].started_at = $timestamp
        elif $status == "completed" then
            .phases[$phase].steps[$idx].completed_at = $timestamp
        elif $status == "failed" then
            .phases[$phase].steps[$idx].failed_at = $timestamp
        else . end |
        if $data != {} then
            .phases[$phase].steps[$idx].data = $data
        else . end |
        if $status == "skipped" and $reason != null then
            .phases[$phase].steps[$idx].reason = $reason
        else . end
    else
        # Create new step entry
        .phases[$phase].steps += [{
            "name": $step_name,
            "status": $status,
            "started_at": (if $status == "in_progress" then $timestamp else null end),
            "completed_at": (if $status == "completed" then $timestamp else null end),
            "reason": (if $status == "skipped" then $reason else null end),
            "data": (if $data != {} then $data else null end)
        } | with_entries(select(.value != null))]
    end
    ')

# Validate state transition before writing. The guard must run: if the
# validator is missing or cannot run, the update fails instead of skipping it.
VALIDATE_SCRIPT="$FABER_ROOT/skills/fractary-faber-run-manager/scripts/validate-state-transition.sh"

if [[ ! -f "$VALIDATE_SCRIPT" ]]; then
    echo "Error: State transition validator not found: $VALIDATE_SCRIPT" >&2
    exit 1
fi

PROPOSED_FILE=$(mktemp)
printf '%s\n' "$UPDATED_STATE" > "$PROPOSED_FILE"
VALIDATION_EXIT=0
VALIDATION_RESULT=$(bash "$VALIDATE_SCRIPT" --current "$STATE_FILE" --proposed "$PROPOSED_FILE" 2>&1) || VALIDATION_EXIT=$?
rm -f "$PROPOSED_FILE"

if [[ $VALIDATION_EXIT -eq 1 ]]; then
    echo "Error: State transition validation failed:" >&2
    echo "$VALIDATION_RESULT" | jq -r '.violations[]' >&2 2>/dev/null || echo "$VALIDATION_RESULT" >&2
    exit 1
elif [[ $VALIDATION_EXIT -ne 0 ]]; then
    echo "Error: State transition validation could not run: $VALIDATION_RESULT" >&2
    exit 1
fi

# Write validated state
echo "$UPDATED_STATE" | "$CORE_SCRIPTS/state-write.sh" "$STATE_FILE"

echo "Step '$STEP_NAME' in phase '$PHASE' updated to '$STATUS'"
exit 0
