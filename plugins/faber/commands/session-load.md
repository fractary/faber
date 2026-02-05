---
name: fractary-faber:session-load
description: Reload critical artifacts for active workflow - delegates to fractary-faber:session-manager agent
allowed-tools: Task(fractary-faber:session-manager)
model: claude-haiku-4-5
argument-hint: '[--work-id <id>] [--run-id <id>] [--trigger <trigger>] [--artifacts <list>] [--force] [--dry-run]'
---

Use **Task** tool with `fractary-faber:session-manager` agent to reload critical workflow artifacts with provided arguments.

**Arguments:**
| Option | Description |
|--------|-------------|
| `--work-id <id>` | GitHub issue number to load. Finds matching workflow run by work_id and fetches the GitHub issue with all comments into context. |
| `--run-id <id>` | Explicit workflow run ID to reload. If omitted, auto-detects from `.active-run-id` file. |
| `--trigger <trigger>` | What triggered this reload: `session_start`, `manual`, `phase_start`. Default: `manual` |
| `--artifacts <list>` | Comma-separated list of specific artifact IDs to load |
| `--force` | Force reload even if recently loaded |
| `--dry-run` | Show what would be loaded without actually loading |

```
Task(
  subagent_type="fractary-faber:session-manager",
  description="Reload critical artifacts for active workflow",
  prompt="Session load operation: $ARGUMENTS"
)
```
