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

# Extract continuation note fields
WORKING_ON=$(jq -r '.continuation_note.working_on // ""' < "$STATE_FILE" 2>/dev/null)
CONTEXT_HINTS=$(jq -r '.continuation_note.context_hints // ""' < "$STATE_FILE" 2>/dev/null)

# Build context string with continuation note if available
CONTEXT_PARTS="FABER workflow context restoration required: Active workflow detected (run: ${RUN_ID}, status: ${STATUS}, phase: ${PHASE})."

if [ -n "$WORKING_ON" ]; then
  CONTEXT_PARTS="${CONTEXT_PARTS} Previous session was working on: ${WORKING_ON}."
fi

if [ -n "$STEP_ID" ]; then
  CONTEXT_PARTS="${CONTEXT_PARTS} Last step: ${STEP_ID}."
fi

if [ -n "$CONTEXT_HINTS" ]; then
  CONTEXT_PARTS="${CONTEXT_PARTS} Context hints: ${CONTEXT_HINTS}."
fi

CONTEXT_PARTS="${CONTEXT_PARTS} Please run /fractary-faber-session-load --trigger session_start now to restore critical workflow state, specifications, and artifacts before continuing."

# Output additionalContext instructing Claude to restore workflow context
jq -n \
  --arg context "$CONTEXT_PARTS" \
  '{
    hookSpecificOutput: {
      hookEventName: "SessionStart",
      additionalContext: $context
    }
  }'
