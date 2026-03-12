#!/bin/bash
# FABER PreCompact Hook
# Writes a Tier 1 continuation note and records compaction metadata in workflow state.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "${SCRIPT_DIR}/../lib/session-common.sh"

INPUT=$(cat)
CWD=$(echo "$INPUT" | jq -r '.cwd // "."')

detect_active_run "$CWD" || exit 0

NOW=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
PHASE=$(jq -r '.current_phase // "unknown"' < "$STATE_FILE" 2>/dev/null)
STEP=$(jq -r '.current_step // ""' < "$STATE_FILE" 2>/dev/null)

# Write Tier 1 continuation note (with staleness guard for agent-written notes)
write_continuation_note "$STATE_FILE" "hook:pre-compact" "compaction"

# Record compaction event in context_metadata
UPDATED=$(jq \
  --arg ts "$NOW" \
  --arg phase "$PHASE" \
  --arg step "$STEP" \
  '.context_metadata.last_compaction = $ts
   | .context_metadata.compaction_count = ((.context_metadata.compaction_count // 0) + 1)
   | .context_metadata.compaction_events = ((.context_metadata.compaction_events // []) + [{
       detected_at: $ts,
       phase: $phase,
       step: $step,
       action_taken: "reload_critical_artifacts"
     }])' \
  "$STATE_FILE" 2>/dev/null) || exit 0

echo "$UPDATED" > "$STATE_FILE"
