# Engineer Validator Agent Standards

This document defines the standards and best practices for creating engineer validator agents.

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

## Recommended Patterns

### Static Analysis Configuration

#### TypeScript/JavaScript
```bash
# Lint
npm run lint
# or: npx eslint . --format json

# Type check
npx tsc --noEmit

# Security
npm audit
```

#### Python
```bash
# Lint
ruff check . --output-format json
# or: pylint --output-format=json

# Type check
mypy . --json

# Security
bandit -r . -f json
```

#### Go
```bash
# Lint + type check
go vet ./...
golangci-lint run --out-format json

# Security
gosec ./...
```

### Test Execution Configuration

#### Jest (JavaScript/TypeScript)
```bash
npm test -- --coverage --json --outputFile=results.json
```

#### Pytest (Python)
```bash
pytest --cov --cov-report=json --json-report
```

#### Go Test
```bash
go test -v -cover -coverprofile=coverage.out ./...
go tool cover -func=coverage.out
```

### Coverage Thresholds

Recommended minimum thresholds:

| Metric | Minimum | Target |
|--------|---------|--------|
| Statements | 80% | 90% |
| Branches | 70% | 85% |
| Functions | 80% | 90% |
| Lines | 80% | 90% |

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

### 4. Vague Error Reports
```
# BAD: Unclear error
"Test failed"

# GOOD: Detailed error
"test_user_login FAILED
  at src/auth.test.ts:42
  Expected: 200
  Received: 401
  Cause: Missing auth header
  Fix: Add Authorization header to request"
```

## Report Format

Standard engineer validation report:

```
Engineer Validation Report
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Implementation: {path}
Validates: asset-engineer output

STATIC ANALYSIS
───────────────
Linting: {PASS|FAIL}
  Errors: {count}
  Warnings: {count}

  ❌ ERRORS
    ✗ [file:line] {message}
      Rule: {rule}
      Fix: {suggestion}

Type Checking: {PASS|FAIL}
  Errors: {count}

  ❌ ERRORS
    ✗ [file:line] {message}
      Fix: {suggestion}

Security Scan: {PASS|FAIL}
  Vulnerabilities: {count}

TEST EXECUTION
──────────────
Tests: {passed}/{total} ({percentage}%)
Time: {duration}

✅ PASSED ({count})
  ✓ test_name (time)

❌ FAILED ({count})
  ✗ test_name
    Error: {message}
    at {file}:{line}
    Expected: {expected}
    Received: {actual}

COVERAGE
────────
Overall: {percentage}% (threshold: {threshold}%)
  Statements: {stmt}%
  Branches:   {branch}%
  Functions:  {func}%
  Lines:      {line}%

Uncovered:
  - {file}:{lines}

BUILD
─────
Status: {PASS|FAIL}
Artifacts: {list}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Result: {PASS|FAIL}
{summary}
```

## Exit Codes

| Code | Meaning | Description |
|------|---------|-------------|
| 0 | Pass | All checks passed |
| 1 | Warn | Warnings only (e.g., low coverage) |
| 2 | Fail | Errors present |
| 3 | Not Found | Source files not found |
| 4 | Build Fail | Build failed |

## Examples

See these engineer validator agents for reference:

- Example agents implementing this pattern will be in `plugins/faber/agents/`
