#!/bin/bash
# FABER SessionEnd Hook
# Records session end timestamp in workflow state for session history tracking.

set -euo pipefail

INPUT=$(cat)
CWD=$(echo "$INPUT" | jq -r '.cwd // "."')
REASON=$(echo "$INPUT" | jq -r '.reason // "other"')

ACTIVE_RUN_FILE="${CWD}/.fractary/faber/runs/.active-run-id"
[ -f "$ACTIVE_RUN_FILE" ] || exit 0

RUN_ID=$(tr -d '[:space:]' < "$ACTIVE_RUN_FILE")
[ -n "$RUN_ID" ] || exit 0

STATE_FILE=$(find "${CWD}/.fractary/faber/runs/${RUN_ID}" -name "state-*.json" -type f 2>/dev/null | head -1)
[ -n "$STATE_FILE" ] && [ -f "$STATE_FILE" ] || exit 0

STATUS=$(jq -r '.status // ""' < "$STATE_FILE" 2>/dev/null)
[[ "$STATUS" == "in_progress" || "$STATUS" == "paused" || "$STATUS" == "awaiting_feedback" ]] || exit 0

NOW=$(date -u +"%Y-%m-%dT%H:%M:%SZ")

UPDATED=$(jq \
  --arg ts "$NOW" \
  --arg reason "$REASON" \
  '.sessions.last_session_end = $ts
   | .sessions.last_session_end_reason = $reason
   | .updated_at = $ts' \
  "$STATE_FILE" 2>/dev/null) || exit 0

echo "$UPDATED" > "$STATE_FILE"
