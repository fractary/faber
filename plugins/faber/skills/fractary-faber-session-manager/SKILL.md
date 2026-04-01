---
name: fractary-faber-session-manager
description: Load, save, or clear FABER workflow session context across context boundaries
user-invocable: true
argument-hint: "<load|save|clear> [--work-id <id>] [--run-id <id>] [--minimal] [--reason <reason>]"
allowed-tools:
  - Bash
  - Read
  - Write
  - Glob
  - Skill
---

# FABER Session Manager

Manages workflow session lifecycle — loading artifacts into context, saving continuation notes before compaction/exit, and clearing context at phase boundaries.

## Operations

- **load**: Reload critical artifacts for an active or resuming workflow. Read `docs/load-protocol.md` for detailed instructions.
- **save**: Save session metadata (continuation notes, git state) before session ends or compaction. Read `docs/save-protocol.md` for detailed instructions.
- **clear**: Clear conversation context at phase boundaries for fresh phase starts. Read `docs/clear-protocol.md` for detailed instructions.

## Routing

Parse the first positional argument:
- `load` or `--work-id`/`--run-id` without other operation → load
- `save` or `--reason` present → save
- `clear` or `--phase` present without load/save → clear

## Key Parameters

| Parameter | Operations | Description |
|-----------|-----------|-------------|
| `--work-id <id>` | load | GitHub issue number — finds matching run and fetches issue |
| `--run-id <id>` | load, save | Specific run ID (auto-detects from `.active-run-id` if omitted) |
| `--minimal` | load | Load ONLY state.json + summary, skip heavy artifacts |
| `--trigger <t>` | load | What triggered: `session_start`, `manual`, `phase_start` |
| `--reason <r>` | save | Why saving: `compaction`, `normal`, `manual` |
| `--phase <p>` | clear | Phase being cleared for |
| `--force` | load | Force reload even if recently loaded |
| `--dry-run` | load | Show what would be loaded without loading |

## Active Run Detection

All operations auto-detect the active run via (priority order):
1. Explicit `--run-id` parameter
2. `--work-id` search across state files
3. `.fractary/faber/runs/.active-run-id` file
4. Search for `state.json` files with status `in_progress` or `paused`
