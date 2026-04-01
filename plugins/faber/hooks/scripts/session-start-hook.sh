#!/bin/bash
# FABER Session Start Hook
# Detects active FABER workflow after context compaction or session resume
# and injects context instructing Claude to restore critical workflow artifacts.
# Includes continuation note context when available.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "${SCRIPT_DIR}/../lib/session-common.sh"

INPUT=$(cat)
CWD=$(echo "$INPUT" | jq -r '.cwd // "."')

detect_active_run "$CWD" || exit 0

PHASE=$(jq -r '.current_phase // "unknown"' < "$STATE_FILE" 2>/dev/null)
STEP_ID=$(jq -r '.current_step_id // ""' < "$STATE_FILE" 2>/dev/null)
WORK_ID=$(jq -r '.work_id // ""' < "$STATE_FILE" 2>/dev/null)
PLAN_FILE="${CWD}/.fractary/faber/runs/${RUN_ID}/plan.json"

# Extract continuation note fields
WORKING_ON=$(jq -r '.continuation_note.working_on // ""' < "$STATE_FILE" 2>/dev/null)
CONTEXT_HINTS=$(jq -r '.continuation_note.context_hints // ""' < "$STATE_FILE" 2>/dev/null)

# Determine if next step needs heavy artifacts (build/architect phases need specs)
NEEDS_ARTIFACTS="false"
if [[ "$PHASE" == "architect" || "$PHASE" == "build" ]]; then
  NEEDS_ARTIFACTS="true"
fi

# Build minimal recovery context — no session-loader agent needed for normal recovery.
# The orchestrator only needs: where am I (state.json) + what's left (TaskList).
CONTEXT_PARTS="FABER workflow resuming: run=${RUN_ID}, work=#${WORK_ID}, phase=${PHASE}."

if [ -n "$STEP_ID" ]; then
  CONTEXT_PARTS="${CONTEXT_PARTS} Last step: ${STEP_ID}."
fi

if [ -n "$WORKING_ON" ]; then
  CONTEXT_PARTS="${CONTEXT_PARTS} Was working on: ${WORKING_ON}."
fi

if [ -n "$CONTEXT_HINTS" ]; then
  CONTEXT_PARTS="${CONTEXT_PARTS} Context: ${CONTEXT_HINTS}."
fi

CONTEXT_PARTS="${CONTEXT_PARTS} Recovery: (1) Read ${STATE_FILE} to confirm position. (2) TaskList to see pending steps. (3) Continue from next pending step."

if [ "$NEEDS_ARTIFACTS" = "true" ]; then
  CONTEXT_PARTS="${CONTEXT_PARTS} This phase may need spec files — use the fractary-faber-session-manager skill with load --minimal --trigger session_start if the next step requires them."
else
  CONTEXT_PARTS="${CONTEXT_PARTS} No heavy artifact reload needed — proceed directly from TaskList."
fi

# Output additionalContext instructing Claude to restore workflow context
jq -n \
  --arg context "$CONTEXT_PARTS" \
  '{
    hookSpecificOutput: {
      hookEventName: "SessionStart",
      additionalContext: $context
    }
  }'
