# Asset Inspector Standards

This document defines the standards, best practices, and validation rules for creating inspector agents.

## Overview

Inspector agents report on the status of a single entity, providing point-in-time snapshots. They are read-only agents that gather state, logs, and artifacts to give comprehensive status information.

## Required Standards

### 1. Single Entity Focus

Inspector agents MUST focus on one entity:

- **One entity at a time** - Don't mix data from multiple entities
- **Leave aggregation to Auditors** - Auditors handle cross-entity views
- **Deep detail** - Provide comprehensive info about the one entity

### 2. Point-in-Time Snapshot

Report current state accurately:

- **Note timestamps** - When was this data gathered?
- **Current state** - What is the status right now?
- **Recent history** - What events led to this state?

### 3. Comprehensive Sources

Gather from all relevant sources:

```
Sources to check:
1. State file - Current status, metadata
2. Logs - Recent events, errors
3. Artifacts - Related files, outputs
4. Services - API status if applicable
```

### 4. Read-Only Operation

Inspector agents MUST NOT modify anything:

- **Only read** - No writes, edits, or side effects
- **Safe to run repeatedly** - Should be idempotent
- **No state changes** - Leave changes to other agents

### 5. Actionable Information

Provide useful next steps:

- **Commands to continue** - How to resume work
- **Links to resources** - Where to find more info
- **Clear status meanings** - What each status means

## Section Requirements

### Required Sections

Every inspector agent MUST have:

| Section | Purpose |
|---------|---------|
| `<CONTEXT>` | Define what entity it inspects |
| `<CRITICAL_RULES>` | Read-only, single entity focus |
| `<IMPLEMENTATION>` | How to gather and report status |
| `<OUTPUTS>` | Report structure and exit codes |

### Recommended Sections

| Section | Purpose |
|---------|---------|
| `<INPUTS>` | Entity identifier parameters |
| `<STATE_SCHEMA>` | Expected state file structure |
| `<COMPLETION_CRITERIA>` | When inspection is complete |

## Anti-Patterns

### 1. Aggregating Multiple Entities
```
# BAD: Aggregating
for entity in all_entities:
  report(entity)
total = aggregate(results)

# GOOD: Single entity
entity = resolve_entity(args)
report(entity)
```

### 2. Modifying State
```
# BAD: Writing state
state.last_inspected = now()
write(state_path, state)

# GOOD: Read-only
state = read(state_path)
report(state)
```

### 3. Missing Timestamp
```
# BAD: No timestamp
PRINT "Status: running"

# GOOD: Include timestamp
PRINT "Status: running"
PRINT "As of: 2026-01-19T10:30:00Z"
```

---

# Validation Rules

## Frontmatter Validation

- [ ] **MUST have** `name`, `description`, `model`, `tools` fields
- [ ] **SHOULD NOT** include `Write` or `Edit` tools (read-only)
- [ ] **SHOULD have** `agent_type` field with value `asset-inspector`

## Structure Validation

- [ ] **MUST have** `<CONTEXT>`, `<CRITICAL_RULES>`, `<IMPLEMENTATION>`, `<OUTPUTS>` sections
- [ ] **MUST** focus on single entity (not aggregation)
- [ ] **MUST** include timestamp in output
- [ ] **MUST** be read-only (no modifications)

## Exit Codes

| Code | Meaning |
|------|---------|
| 0 | Status retrieved |
| 1 | Entity failed status |
| 2 | Entity cancelled |
| 3 | Entity not found |

## Validation Severity Legend

| Marker | Meaning |
|--------|---------|
| **MUST** | Required |
| **SHOULD** | Recommended |
| **MAY** | Optional |

## Common Validation Failures

| Issue | Solution |
|-------|----------|
| Aggregates multiple entities | Use Auditor instead, or focus on one entity |
| Modifies state | Remove write operations, make read-only |
| Missing timestamp | Add timestamp to output |
| No next steps | Include actionable continuation commands |
