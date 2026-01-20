# Project Auditor Standards

This document defines the standards, best practices, and validation rules for creating auditor agents.

## Overview

Auditor agents aggregate status across multiple entities to provide project-wide dashboards and health views. They differ from Inspectors by focusing on cross-entity aggregation rather than single-entity details.

## Required Standards

### 1. Cross-Entity Scope

Auditor agents MUST work across multiple entities:

- **Aggregate** - Combine data from many entities
- **System-wide view** - Show the big picture
- **Leave details to Inspectors** - Don't deep-dive into single entities

### 2. Summary Focus

Emphasize aggregated information:

- **Counts and distributions** - How many in each state?
- **Percentages** - What proportion is healthy?
- **Outliers** - What stands out?

### 3. Efficient Discovery

Handle large numbers of entities:

- **Glob patterns** - Efficiently find all entities
- **Filtering** - Support narrowing scope
- **Pagination** - Handle very large sets

### 4. Consistent Metrics

Use the same metrics across all entities:

- **Standard definitions** - What does "healthy" mean?
- **Comparable values** - Can compare entity A to entity B
- **Documented metrics** - Users understand what they're seeing

### 5. Read-Only Operation

Auditor agents MUST NOT modify anything:

- **Only read** - No writes, edits, or side effects
- **Safe to run repeatedly** - Can run on schedule
- **No state changes** - Leave changes to other agents

### 6. Actionable Recommendations

Provide guidance based on findings:

- **Prioritized issues** - What needs attention first?
- **Specific actions** - How to fix problems
- **Trends** - Is it getting better or worse?

## Section Requirements

### Required Sections

Every auditor agent MUST have:

| Section | Purpose |
|---------|---------|
| `<CONTEXT>` | Define what it audits across the project |
| `<CRITICAL_RULES>` | Cross-entity focus, read-only |
| `<IMPLEMENTATION>` | Discovery, aggregation, reporting |
| `<OUTPUTS>` | Dashboard structure and exit codes |

### Recommended Sections

| Section | Purpose |
|---------|---------|
| `<INPUTS>` | Filter and scope parameters |
| `<METRICS>` | Definition of each metric |
| `<COMPLETION_CRITERIA>` | When audit is complete |

## Anti-Patterns

### 1. Single Entity Focus
```
# BAD: Deep dive into one entity
entity = get_entity(id)
show_all_details(entity)

# GOOD: Aggregate across all
entities = discover_all()
summary = aggregate(entities)
highlight_issues(summary)
```

### 2. Modifying State
```
# BAD: Writing audit results
for entity in entities:
  entity.last_audited = now()
  save(entity)

# GOOD: Read-only report
summary = aggregate(entities)
report(summary)
```

### 3. Missing Recommendations
```
# BAD: Just numbers
PRINT "Critical: 5"
PRINT "Warning: 10"

# GOOD: Include recommendations
PRINT "Critical: 5"
PRINT "Warning: 10"
PRINT "Recommendations:"
PRINT "1. Address critical issue in entity X"
PRINT "2. Review warnings in category Y"
```

---

# Validation Rules

## Frontmatter Validation

- [ ] **MUST have** `name`, `description`, `model`, `tools` fields
- [ ] **SHOULD include** `Glob` tool for discovery
- [ ] **SHOULD NOT** include `Write` or `Edit` tools (read-only)
- [ ] **SHOULD have** `agent_type` field with value `project-auditor`

## Structure Validation

- [ ] **MUST have** `<CONTEXT>`, `<CRITICAL_RULES>`, `<IMPLEMENTATION>`, `<OUTPUTS>` sections
- [ ] **MUST** aggregate across multiple entities (not single entity)
- [ ] **MUST** provide summary metrics
- [ ] **MUST** be read-only (no modifications)

## Exit Codes

| Code | Meaning |
|------|---------|
| 0 | Audit complete, all healthy |
| 1 | Audit complete, warnings present |
| 2 | Audit complete, critical issues |
| 3 | Audit failed |

## Validation Severity Legend

| Marker | Meaning |
|--------|---------|
| **MUST** | Required |
| **SHOULD** | Recommended |
| **MAY** | Optional |

## Common Validation Failures

| Issue | Solution |
|-------|----------|
| Single entity focus | Use Inspector instead, or aggregate across all entities |
| Modifies state | Remove write operations, make read-only |
| No aggregation | Add summary metrics and counts |
| Missing recommendations | Include actionable recommendations based on findings |
