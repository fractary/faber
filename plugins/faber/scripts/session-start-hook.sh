#!/bin/bash
# FABER Session Start Hook
# Detects active FABER workflow after context compaction or session resume
# and injects context instructing Claude to restore critical workflow artifacts.

set -euo pipefail

INPUT=$(cat)
CWD=$(echo "$INPUT" | jq -r '.cwd // "."')

# Check for active run ID file
ACTIVE_RUN_FILE="${CWD}/.fractary/faber/runs/.active-run-id"
if [ ! -f "$ACTIVE_RUN_FILE" ]; then
  exit 0
fi

RUN_ID=$(tr -d '[:space:]' < "$ACTIVE_RUN_FILE")
if [ -z "$RUN_ID" ]; then
  exit 0
fi

# Find the state file for this run
STATE_FILE=$(find "${CWD}/.fractary/faber/runs/${RUN_ID}" -name "state-*.json" -type f 2>/dev/null | head -1)
if [ -z "$STATE_FILE" ] || [ ! -f "$STATE_FILE" ]; then
  exit 0
fi

# Check if workflow is in an active status
STATUS=$(jq -r '.status // ""' < "$STATE_FILE" 2>/dev/null)
if [[ "$STATUS" != "in_progress" && "$STATUS" != "paused" && "$STATUS" != "awaiting_feedback" ]]; then
  exit 0
fi

PHASE=$(jq -r '.current_phase // "unknown"' < "$STATE_FILE" 2>/dev/null)

# Output additionalContext instructing Claude to restore workflow context
jq -n \
  --arg run_id "$RUN_ID" \
  --arg status "$STATUS" \
  --arg phase "$PHASE" \
  '{
    hookSpecificOutput: {
      hookEventName: "SessionStart",
      additionalContext: ("FABER workflow context restoration required: Active workflow detected (run: " + $run_id + ", status: " + $status + ", phase: " + $phase + "). Context may have been lost due to compaction or session resume. Please run /fractary-faber:session-load --trigger session_start now to restore critical workflow state, specifications, and artifacts before continuing.")
    }
  }'
