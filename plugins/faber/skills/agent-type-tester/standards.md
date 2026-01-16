# Tester Agent Standards

This document defines the standards and best practices for creating tester agents.

## Overview

Tester agents execute tests and verify runtime behavior through dynamic analysis. They run test suites, parse results, and report comprehensive test outcomes.

## Required Standards

### 1. Dynamic Analysis

Testers MUST actually execute code:

- **Run the tests** - Not just analyze test files
- **Verify behavior** - Check actual runtime results
- **Complement validators** - Validators do static, testers do dynamic

### 2. Complete Execution

Run all relevant tests:

- **Don't stop early** - Run all tests even if some fail
- **Report everything** - Pass, fail, skip, error
- **Track totals** - Show what was run

### 3. Clear Results

Report results clearly:

| Status | Meaning |
|--------|---------|
| PASS | Test executed successfully |
| FAIL | Test assertion failed |
| SKIP | Test was skipped |
| ERROR | Test couldn't execute |

### 4. Failure Analysis

Help diagnose failures:

- Error message and stack trace
- File and line number
- Likely cause analysis
- Suggested fix

### 5. Isolation

Keep tests independent:

- Each test should stand alone
- Clean up after tests
- Note any shared state issues

## Recommended Patterns

### Test Discovery

Find tests systematically:

```
Common test patterns:
- **/*.test.{ts,js}
- **/*.spec.{ts,js}
- **/test_*.py
- **/*_test.go
```

### Result Parsing

Parse common output formats:

```
JSON output (preferred):
- Jest: --json
- pytest: --json-report
- Go: -json

TAP format:
- Standard test output format

Custom parsing:
- Match pass/fail patterns
- Extract error messages
```

### Coverage Integration

Include coverage when available:

```
Coverage metrics:
- Statements: % of statements executed
- Branches: % of branches taken
- Functions: % of functions called
- Lines: % of lines executed
```

## Section Requirements

### Required Sections

| Section | Purpose |
|---------|---------|
| `<CONTEXT>` | Define test domain |
| `<CRITICAL_RULES>` | Testing principles |
| `<IMPLEMENTATION>` | Test workflow |
| `<OUTPUTS>` | Report format |

### Recommended Sections

| Section | Purpose |
|---------|---------|
| `<INPUTS>` | Test targets and options |
| `<FAILURE_ANALYSIS>` | How to analyze failures |
| `<COVERAGE>` | Coverage metrics |

## Anti-Patterns

### 1. Static-Only Analysis
```
# BAD: Just analyze files
ast = parse(test_file)
check(ast)

# GOOD: Execute tests
result = bash("npm test")
```

### 2. Stopping on First Failure
```
# BAD
if test.failed:
  EXIT 1

# GOOD
failures = []
for test in tests:
  if test.failed:
    failures.append(test)
report(failures)
```

### 3. Missing Error Details
```
# BAD
PRINT "Test failed"

# GOOD
PRINT "Test failed: {test.name}"
PRINT "  Error: {test.error}"
PRINT "  at {test.file}:{test.line}"
```

## Exit Codes

| Code | Meaning |
|------|---------|
| 0 | All tests passed |
| 1 | Some tests failed |
| 2 | Execution error |
