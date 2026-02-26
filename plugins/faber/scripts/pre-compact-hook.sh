#!/bin/bash
# FABER PreCompact Hook
# Records compaction timestamp in workflow state for session continuity tracking.

set -euo pipefail

INPUT=$(cat)
CWD=$(echo "$INPUT" | jq -r '.cwd // "."')

ACTIVE_RUN_FILE="${CWD}/.fractary/faber/runs/.active-run-id"
[ -f "$ACTIVE_RUN_FILE" ] || exit 0

RUN_ID=$(tr -d '[:space:]' < "$ACTIVE_RUN_FILE")
[ -n "$RUN_ID" ] || exit 0

STATE_FILE=$(find "${CWD}/.fractary/faber/runs/${RUN_ID}" -name "state-*.json" -type f 2>/dev/null | head -1)
[ -n "$STATE_FILE" ] && [ -f "$STATE_FILE" ] || exit 0

STATUS=$(jq -r '.status // ""' < "$STATE_FILE" 2>/dev/null)
[[ "$STATUS" == "in_progress" || "$STATUS" == "paused" || "$STATUS" == "awaiting_feedback" ]] || exit 0

NOW=$(date -u +"%Y-%m-%dT%H:%M:%SZ")

# Record compaction event in state.json
UPDATED=$(jq \
  --arg ts "$NOW" \
  '.context_metadata.last_compaction = $ts
   | .context_metadata.compaction_count = ((.context_metadata.compaction_count // 0) + 1)
   | .updated_at = $ts' \
  "$STATE_FILE" 2>/dev/null) || exit 0

echo "$UPDATED" > "$STATE_FILE"
