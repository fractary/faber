# Inspector Agent Standards

This document defines the standards and best practices for creating inspector agents.

## Overview

Inspector agents report on the status of a single entity at a point in time. They provide snapshot views by gathering information from state, logs, and artifacts.

## Required Standards

### 1. Single Entity Focus

Inspectors report on ONE entity:

- **One at a time** - Don't combine multiple entities
- **Clear identification** - Know exactly what's being inspected
- **Auditors for aggregation** - Leave cross-entity views to auditors

### 2. Point-in-Time Snapshot

Report current state:

- **Timestamp the snapshot** - Note when status was checked
- **Include recent history** - Show recent events for context
- **Current state is primary** - Focus on NOW

### 3. Comprehensive Sources

Gather from multiple sources:

- State files/databases
- Recent log entries
- Related artifacts
- Service status (if applicable)

### 4. Clear Status Values

Use consistent terminology:

| Status | Icon | Meaning |
|--------|------|---------|
| in_progress | 🔄 | Currently executing |
| paused | ⏸️ | Temporarily stopped |
| completed | ✅ | Finished successfully |
| failed | ❌ | Finished with errors |
| cancelled | 🚫 | Manually stopped |

### 5. Non-Modifying

Inspectors MUST NOT change state:

- Read-only operations
- No side effects
- Safe to run repeatedly

## Recommended Patterns

### Status Report Structure

Standard sections:

```
1. Header
   - Entity ID
   - Status (with icon)
   - Timestamps

2. Progress
   - Current phase/step
   - Completion percentage
   - Phase breakdown

3. Recent Events
   - Last N events
   - Relative timestamps

4. Artifacts
   - Related files
   - Links/references

5. Next Steps
   - Recommended actions
   - Commands to run
```

### Time Formatting

Use relative and absolute times:

```
Recent (< 1 hour): "5 minutes ago"
Today: "2 hours ago (14:30)"
Older: "3 days ago (2026-01-13 09:15)"
```

### Next Steps by Status

Tailor recommendations:

| Status | Next Step |
|--------|-----------|
| in_progress | "Continue: {command}" |
| paused | "Resume: {command}" |
| failed | "Debug: {command}" |
| completed | "Done. View results: {path}" |

## Section Requirements

### Required Sections

| Section | Purpose |
|---------|---------|
| `<CONTEXT>` | Define inspection domain |
| `<CRITICAL_RULES>` | Inspection principles |
| `<IMPLEMENTATION>` | Status gathering workflow |
| `<OUTPUTS>` | Report format |

### Recommended Sections

| Section | Purpose |
|---------|---------|
| `<INPUTS>` | Entity identifier |
| `<STATUS_VALUES>` | Defined statuses |
| `<ARTIFACTS>` | What to check |

## Anti-Patterns

### 1. Aggregating Multiple Entities
```
# BAD
for entity in all_entities:
  report(entity)

# GOOD (use auditor instead)
entity = resolve_single_entity(id)
report(entity)
```

### 2. Modifying State
```
# BAD
state.last_checked = now()
write(state)

# GOOD
state = read(state_path)
report(state)
```

### 3. Missing Timestamp
```
# BAD
PRINT "Status: {status}"

# GOOD
PRINT "Status: {status}"
PRINT "As of: {now()}"
```

## Examples

See these inspector agents for reference:

- `plugins/faber/agents/workflow-status.md` - Workflow inspector
