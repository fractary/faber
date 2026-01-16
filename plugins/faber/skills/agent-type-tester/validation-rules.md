# Tester Agent Validation Rules

Use this checklist to validate tester agent definitions.

## Frontmatter Validation

- [ ] **MUST have** `name` field (lowercase with hyphens)
- [ ] **MUST have** `description` field (< 200 chars)
- [ ] **MUST have** `model` field
- [ ] **MUST have** `tools` field with `Bash` included

## Structure Validation

### Required Sections

- [ ] **MUST have** `<CONTEXT>` section
- [ ] **MUST have** `<CRITICAL_RULES>` section with:
  1. Dynamic Analysis
  2. Complete Execution
  3. Clear Results
  4. Failure Analysis
  5. Isolation
  6. Reproducibility
- [ ] **MUST have** `<IMPLEMENTATION>` section with:
  - [ ] Test discovery
  - [ ] Environment setup
  - [ ] Test execution
  - [ ] Result parsing
  - [ ] Report generation
- [ ] **MUST have** `<OUTPUTS>` section

### Recommended Sections

- [ ] **SHOULD have** `<INPUTS>` section
- [ ] **SHOULD have** `<FAILURE_ANALYSIS>` section
- [ ] **SHOULD have** `<COVERAGE>` section

## Implementation Validation

- [ ] **MUST** execute tests (not just analyze)
- [ ] **MUST** run all tests (don't stop on first failure)
- [ ] **MUST** report pass/fail/skip/error
- [ ] **MUST** include failure details
- [ ] **SHOULD** analyze failure causes
- [ ] **SHOULD** include coverage metrics

## Common Failures

| Issue | Solution |
|-------|----------|
| No Bash tool | Add Bash to tools array |
| Stops on first failure | Continue and collect all failures |
| Missing error details | Include message, file, line |
| No result parsing | Parse test framework output |
