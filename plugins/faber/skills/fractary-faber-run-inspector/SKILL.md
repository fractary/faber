---
name: fractary-faber-run-inspector
description: Display comprehensive FABER workflow run status with state, logs, timing, and artifacts
user-invocable: true
argument-hint: "[<work-id|run-id>] [--logs <n>] [--timing] [--verbose] [--json]"
allowed-tools:
  - Bash
  - Read
  - Glob
  - Skill
---

# FABER Run Inspector

Displays comprehensive workflow run status by combining current state, historical logs, artifacts, and phase timing into a clear status dashboard.

## Parameters

| Parameter | Description |
|-----------|-------------|
| `<work-id\|run-id>` | Work item ID or run ID (auto-detects active run if omitted) |
| `--logs <n>` | Number of recent log entries (default: 10) |
| `--state-only` | Show only current state, skip log queries |
| `--timing` | Show phase timing breakdown |
| `--verbose` | Show all information |
| `--json` | Output in JSON format |

## Algorithm

Read `docs/inspect-protocol.md` for the full step-by-step protocol including:
- Run detection (by work_id, run_id, or active-run-id file)
- State loading and parsing from `.fractary/faber/runs/{run_id}/state.json`
- Log querying via `fractary-logs-search` skill
- Phase timing calculation
- Human-readable and JSON output formatting
- Error display and next-step suggestions

## Status Icons

| Status | Icon |
|--------|------|
| `in_progress` | In Progress |
| `paused` | Paused |
| `completed` | Completed |
| `failed` | Failed |
| `cancelled` | Cancelled |

## Exit Codes

| Code | Meaning |
|------|---------|
| 0 | Success (in_progress, paused, or completed) |
| 1 | Workflow run failed |
| 2 | Workflow run cancelled |
| 3 | No active run found |
