# Auditor Agent Standards

This document defines the standards and best practices for creating auditor agents.

## Overview

Auditor agents aggregate information across multiple entities to create dashboard views. They complement Inspector agents (single entity) by providing the big picture.

## Required Standards

### 1. Cross-Entity Scope

Auditors aggregate MULTIPLE entities:

- **System-wide view** - Cover all relevant entities
- **Aggregation focus** - Summarize, don't detail each
- **Inspectors for details** - Link to inspectors for single entities

### 2. Summary Metrics

Emphasize aggregate data:

```
Key metrics:
- Total count
- Distribution by status
- Percentage breakdowns
- Averages and ranges
- Outliers and issues
```

### 3. Efficient Discovery

Handle large numbers of entities:

- **Pattern-based discovery** - Use glob patterns
- **Lazy loading** - Load data as needed
- **Pagination** - Support limiting results
- **Filtering** - Filter before aggregation

### 4. Consistent Measurement

Apply same metrics everywhere:

- Document metric definitions
- Use standard calculations
- Enable fair comparisons
- Note any special cases

### 5. Non-Modifying

Audits are read-only:

- No side effects
- Safe to run repeatedly
- Can be automated/scheduled

## Recommended Patterns

### Dashboard Layout

Standard sections:

```
1. Summary
   - Total counts
   - Health distribution
   - Overall score

2. Breakdown
   - By category
   - By status
   - By other dimensions

3. Issues
   - Critical (must address)
   - Warnings (should address)

4. Trends (if historical data)
   - Direction indicators
   - Change percentages

5. Recommendations
   - Prioritized actions
   - Commands to run
```

### Health Scoring

Calculate overall health:

```
Score components:
- Base: % healthy entities
- Penalties: per critical (-10), per warning (-2)
- Bonuses: above thresholds (+5)

Score = max(0, base - penalties + bonuses)

Thresholds:
- 90-100: Excellent (green)
- 70-89:  Good (yellow)
- 50-69:  Fair (orange)
- 0-49:   Poor (red)
```

### Breakdown Tables

Format for comparison:

```
| Category | Total | ✅ | ⚠️ | ❌ | Score |
|----------|-------|----|----|----| ------|
| A        | 20    | 18 | 2  | 0  | 95    |
| B        | 15    | 10 | 3  | 2  | 70    |
| Total    | 35    | 28 | 5  | 2  | 85    |
```

## Section Requirements

### Required Sections

| Section | Purpose |
|---------|---------|
| `<CONTEXT>` | Define audit domain |
| `<CRITICAL_RULES>` | Auditing principles |
| `<IMPLEMENTATION>` | Aggregation workflow |
| `<OUTPUTS>` | Dashboard format |

### Recommended Sections

| Section | Purpose |
|---------|---------|
| `<INPUTS>` | Filter options |
| `<METRICS>` | What is measured |
| `<GROUPINGS>` | How data is organized |

## Anti-Patterns

### 1. Detailing Each Entity
```
# BAD
for entity in entities:
  print_full_details(entity)

# GOOD
summary = aggregate(entities)
print_summary(summary)
print_issues(filter(entities, has_issues))
```

### 2. Missing Aggregation
```
# BAD
PRINT "Entity 1: OK"
PRINT "Entity 2: OK"
PRINT "Entity 3: Warning"

# GOOD
PRINT "Total: 3"
PRINT "Healthy: 2 (67%)"
PRINT "Warning: 1 (33%)"
```

### 3. No Issue Highlighting
```
# BAD
print_all_equally(entities)

# GOOD
print_summary(entities)
highlight_critical(filter(entities, is_critical))
highlight_warnings(filter(entities, has_warning))
```

## Examples

See these auditor agents for reference:

- `plugins/faber/agents/workflow-auditor.md` - Workflow validation auditor
