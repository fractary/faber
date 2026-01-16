# Auditor Agent Validation Rules

Use this checklist to validate auditor agent definitions.

## Frontmatter Validation

- [ ] **MUST have** `name` field (lowercase with hyphens)
- [ ] **MUST have** `description` field (< 200 chars)
- [ ] **MUST have** `model` field
- [ ] **MUST have** `tools` field with `Read` and `Glob` included

## Structure Validation

### Required Sections

- [ ] **MUST have** `<CONTEXT>` section
- [ ] **MUST have** `<CRITICAL_RULES>` section with:
  1. Cross-Entity Scope
  2. Summary Focus
  3. Efficient Discovery
  4. Consistent Metrics
  5. Actionable Insights
  6. Non-Modifying
- [ ] **MUST have** `<IMPLEMENTATION>` section with:
  - [ ] Entity discovery
  - [ ] Data gathering
  - [ ] Aggregation
  - [ ] Dashboard generation
- [ ] **MUST have** `<OUTPUTS>` section

### Recommended Sections

- [ ] **SHOULD have** `<INPUTS>` section (filters)
- [ ] **SHOULD have** `<METRICS>` section
- [ ] **SHOULD have** `<GROUPINGS>` section

## Implementation Validation

- [ ] **MUST** aggregate multiple entities
- [ ] **MUST** provide summary statistics
- [ ] **MUST** be non-modifying (read-only)
- [ ] **MUST** highlight issues
- [ ] **SHOULD** include breakdown tables
- [ ] **SHOULD** include recommendations
- [ ] **SHOULD** support filtering

## Common Failures

| Issue | Solution |
|-------|----------|
| Single entity focus | Change to multi-entity aggregation |
| No summary stats | Add counts, percentages, scores |
| Missing issue highlighting | Separate critical/warning issues |
| No recommendations | Add actionable suggestions |
