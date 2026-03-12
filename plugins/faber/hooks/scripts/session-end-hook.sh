#!/bin/bash
# FABER SessionEnd Hook
# Writes a Tier 1 continuation note and records session end in workflow state.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "${SCRIPT_DIR}/../lib/session-common.sh"

INPUT=$(cat)
CWD=$(echo "$INPUT" | jq -r '.cwd // "."')
REASON=$(echo "$INPUT" | jq -r '.reason // "other"')

detect_active_run "$CWD" || exit 0

NOW=$(date -u +"%Y-%m-%dT%H:%M:%SZ")

# Write Tier 1 continuation note (with staleness guard for agent-written notes)
write_continuation_note "$STATE_FILE" "hook:session-end" "session_end"

# Record session end metadata
UPDATED=$(jq \
  --arg ts "$NOW" \
  --arg reason "$REASON" \
  '.sessions.last_session_end = $ts
   | .sessions.last_session_end_reason = $reason
   | .updated_at = $ts' \
  "$STATE_FILE" 2>/dev/null) || exit 0

echo "$UPDATED" > "$STATE_FILE"
