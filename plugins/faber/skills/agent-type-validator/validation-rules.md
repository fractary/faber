# Validator Agent Validation Rules

Use this checklist to validate validator agent definitions.

## Frontmatter Validation

### Required Fields

- [ ] **MUST have** `name` field
  - Lowercase letters, numbers, and hyphens only
  - Pattern: `^[a-z][a-z0-9-]*$`

- [ ] **MUST have** `description` field
  - Maximum 200 characters
  - Should describe what it validates

- [ ] **MUST have** `model` field
  - Valid values: `claude-haiku-4-5`, `claude-sonnet-4-5`, `claude-opus-4-5`

- [ ] **MUST have** `tools` field
  - Should include `Read`, `Glob`

## Structure Validation

### Required Sections

- [ ] **MUST have** `<CONTEXT>` section
  - Defines the validation domain

- [ ] **MUST have** `<CRITICAL_RULES>` section
  - **MUST include** these core rules:
    1. Static Analysis Only
    2. Pre-Deployment Focus
    3. Clear Severity Levels
    4. Actionable Feedback
    5. Comprehensive Coverage
    6. Consistent Scoring

- [ ] **MUST have** `<IMPLEMENTATION>` section
  - **MUST include** these steps:
    - [ ] Discover targets
    - [ ] Load validation rules
    - [ ] Run validations
    - [ ] Calculate score
    - [ ] Generate report

- [ ] **MUST have** `<OUTPUTS>` section
  - Report structure
  - Exit codes

### Recommended Sections

- [ ] **SHOULD have** `<INPUTS>` section
- [ ] **SHOULD have** `<VALIDATION_RULES>` section
- [ ] **SHOULD have** `<SCORING>` section

## Implementation Validation

### Static Analysis

- [ ] **MUST NOT** execute code being validated
- [ ] **MUST** only read and analyze files
- [ ] **MUST** use schema/pattern matching

### Severity Handling

- [ ] **MUST** use ERROR/WARNING/INFO levels
- [ ] **MUST** define what each level means
- [ ] **MUST** document blocking vs non-blocking

### Reporting

- [ ] **MUST** include file and line numbers
- [ ] **MUST** include suggested fixes
- [ ] **MUST** report all issues (not stop early)
- [ ] **MUST** calculate completeness score

### Exit Codes

- [ ] **MUST** return appropriate exit codes
- [ ] **MUST** document exit code meanings
- [ ] **SHOULD** use 0=pass, 1=warn, 2=fail

## Common Validation Failures

| Issue | Solution |
|-------|----------|
| Missing suggested fixes | Add fix for every issue |
| Stops on first error | Run all checks, report all |
| No severity levels | Add ERROR/WARNING/INFO |
| Missing score calculation | Add weighted scoring |
