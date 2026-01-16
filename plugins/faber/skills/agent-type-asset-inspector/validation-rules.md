# Inspector Agent Validation Rules

Use this checklist to validate inspector agent definitions.

## Frontmatter Validation

- [ ] **MUST have** `name` field (lowercase with hyphens)
- [ ] **MUST have** `description` field (< 200 chars)
- [ ] **MUST have** `model` field
- [ ] **MUST have** `tools` field with `Read` included

## Structure Validation

### Required Sections

- [ ] **MUST have** `<CONTEXT>` section
- [ ] **MUST have** `<CRITICAL_RULES>` section with:
  1. Single Entity Focus
  2. Point-in-Time Snapshot
  3. Comprehensive Sources
  4. Clear Status Indicators
  5. Actionable Information
  6. Non-Modifying
- [ ] **MUST have** `<IMPLEMENTATION>` section with:
  - [ ] Target resolution
  - [ ] State loading
  - [ ] Log querying
  - [ ] Artifact checking
  - [ ] Report generation
- [ ] **MUST have** `<OUTPUTS>` section

### Recommended Sections

- [ ] **SHOULD have** `<INPUTS>` section
- [ ] **SHOULD have** `<STATUS_VALUES>` section
- [ ] **SHOULD have** `<ARTIFACTS>` section

## Implementation Validation

- [ ] **MUST** focus on single entity
- [ ] **MUST** include timestamp
- [ ] **MUST** be non-modifying (read-only)
- [ ] **MUST** use clear status indicators
- [ ] **SHOULD** include recent events
- [ ] **SHOULD** include next steps

## Common Failures

| Issue | Solution |
|-------|----------|
| Aggregates multiple entities | Focus on single entity |
| No timestamp | Add "as of" timestamp |
| Modifies state | Remove write operations |
| Missing next steps | Add actionable recommendations |
