# Asset Engineer Validator Standards

This document defines the standards, best practices, and validation rules for creating engineer validator agents.

## Overview

Engineer Validator agents verify that code implementations produced by engineer agents are correct, well-tested, and meet quality standards. They perform both static analysis (linting, type checking) and dynamic analysis (test execution, coverage checking).

## Required Standards

### 1. Verify Engineer Output

Engineer Validators MUST target engineer agent output:

- **Validate code** - Source files, implementations
- **Not specifications** - Leave spec validation to architect validators
- **Execute tests** - Dynamic analysis required

### 2. Both Static and Dynamic Analysis

MUST perform both types of validation:

| Mode | Tools | Purpose |
|------|-------|---------|
| Static | Linters, type checkers | Catch syntax, style, type errors |
| Dynamic | Test runners | Verify runtime behavior |

Static analysis alone is insufficient for validating implementations.

### 3. Clear Pass/Fail Criteria

Define explicit thresholds:

```
Pass Criteria:
- Lint errors: 0
- Type errors: 0
- Test pass rate: 100%
- Coverage: >= 80% (configurable)
- Build: Success
```

### 4. Coverage Enforcement

MUST check and report coverage:

- **Minimum threshold** - Typically 80%
- **Report uncovered lines** - Show what's not tested
- **Flag regressions** - Coverage should not decrease

### 5. Build Verification

MUST verify build success:

- **Compilation** - Code compiles without errors
- **Bundling** - Output artifacts are generated
- **Artifacts exist** - Expected files are present

### 6. Actionable Feedback

Every error MUST include:

- **File path** - Where the error is
- **Line number** - Exact location
- **Error message** - What's wrong
- **Suggested fix** - How to resolve (when possible)

## Section Requirements

### Required Sections

Every engineer validator MUST have:

| Section | Purpose |
|---------|---------|
| `<CONTEXT>` | Define the implementation domain |
| `<VALIDATES>` | Must specify `Agent: asset-engineer` |
| `<IMPLEMENTATION>` | Static and dynamic validation steps |
| `<THRESHOLDS>` | Pass/fail criteria |

### Recommended Sections

| Section | Purpose |
|---------|---------|
| `<INPUTS>` | Source and test locations |
| `<TOOLS>` | Specific linters/testers used |
| `<REPORT_FORMAT>` | Validation report structure |
| `<COMPLETION_CRITERIA>` | When validation is complete |

## Anti-Patterns

### 1. Static Only Validation
```
# BAD: Only linting
run_linter()
report_results()
# Missing test execution!

# GOOD: Both static and dynamic
run_linter()
run_type_checker()
run_tests()
check_coverage()
report_results()
```

### 2. Ignoring Coverage
```
# BAD: Tests pass, done
if tests_pass:
  return SUCCESS

# GOOD: Check coverage too
if tests_pass and coverage >= threshold:
  return SUCCESS
```

### 3. No Build Verification
```
# BAD: Skip build check
run_tests()

# GOOD: Verify build
run_build()
verify_artifacts_exist()
run_tests()
```

---

# Validation Rules

## Frontmatter Validation

### Required Fields

- [ ] **MUST have** `name` field
  - MUST end with `-validator`
  - Pattern: `^[a-z][a-z0-9-]*-validator$`

- [ ] **MUST have** `description` field
  - Should mention "validates" and "code/implementation"

- [ ] **MUST have** `model` field
  - Recommended: `claude-sonnet-4-5`

- [ ] **MUST have** `tools` field
  - **MUST include** `Bash` (for running tests/linters)
  - Should include `Read`, `Glob`, `Grep`

### Optional Fields

- [ ] **MAY have** `color` field
- [ ] **SHOULD have** `agent_type` field with value `asset-engineer-validator`

## Structure Validation

### Validates Section

- [ ] **MUST specify** `Agent: asset-engineer`
- [ ] **MUST specify** artifact type (code, implementation)

### Implementation

- [ ] **MUST** run static analysis (lint, type check)
- [ ] **MUST** run dynamic analysis (tests)
- [ ] **MUST** check coverage
- [ ] **MUST** verify build

### Thresholds

- [ ] **MUST** define lint error threshold (typically 0)
- [ ] **MUST** define type error threshold (typically 0)
- [ ] **MUST** define test pass rate threshold (typically 100%)
- [ ] **MUST** define coverage threshold (typically 80%)

## Exit Codes

| Code | Meaning | Description |
|------|---------|-------------|
| 0 | Pass | All checks passed |
| 1 | Warn | Warnings only (e.g., low coverage) |
| 2 | Fail | Errors present |
| 3 | Not Found | Source files not found |
| 4 | Build Fail | Build failed |

## Validation Severity Legend

| Marker | Meaning | Impact |
|--------|---------|--------|
| **MUST** | Required | Validator will not function correctly without this |
| **MUST NOT** | Prohibited | Violates validator principles |
| **SHOULD** | Recommended | Best practice, improves quality |
| **MAY** | Optional | Nice to have, not required |

## Common Validation Failures

| Issue | Solution |
|-------|----------|
| Missing Bash tool | Add Bash - required for running tests/linters |
| Static analysis only | Add test execution step |
| No coverage check | Add coverage threshold and reporting |
| No build verification | Add build step with artifact verification |
| Vague error reports | Include file, line, and suggested fix for each error |
