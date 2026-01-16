# Engineer Validator Agent Validation Rules

Use this checklist to validate engineer validator agent definitions.

## Frontmatter Validation

### Required Fields

- [ ] **MUST have** `name` field
  - Lowercase letters, numbers, and hyphens only
  - MUST end with `-validator`
  - Pattern: `^[a-z][a-z0-9-]*-validator$`

- [ ] **MUST have** `description` field
  - Maximum 200 characters
  - Should mention "validates" and "implementation" or "code"

- [ ] **MUST have** `model` field
  - Valid values: `claude-haiku-4-5`, `claude-sonnet-4-5`, `claude-opus-4-5`
  - Recommended: `claude-sonnet-4-5`

- [ ] **MUST have** `tools` field
  - Must be an array
  - **MUST include** `Bash` for running tests and linters
  - Should include `Read`, `Glob`, `Grep` for file analysis

### Optional Fields

- [ ] **MAY have** `color` field
  - Valid values: red, orange, yellow, green, blue, purple, pink, gray, cyan

## Structure Validation

### Required Sections

- [ ] **MUST have** `<CONTEXT>` section
  - Defines what implementations it validates
  - Describes the validation domain (language/framework)
  - Explains role as independent quality gate

- [ ] **MUST have** `<VALIDATES>` section
  - **MUST specify** `Agent: asset-engineer`
  - **MUST specify** `Artifact:` description

- [ ] **MUST have** `<IMPLEMENTATION>` section
  - **MUST include** static analysis steps
  - **MUST include** dynamic analysis steps
  - **MUST include** coverage checking
  - **MUST include** build verification

- [ ] **MUST have** `<THRESHOLDS>` section
  - Defines pass/fail criteria
  - Specifies lint error threshold (typically 0)
  - Specifies type error threshold (typically 0)
  - Specifies test pass rate (typically 100%)
  - Specifies coverage threshold (typically 80%)

### Recommended Sections

- [ ] **SHOULD have** `<INPUTS>` section
  - Source file patterns
  - Test file patterns
  - Configuration paths

- [ ] **SHOULD have** `<TOOLS>` section
  - Lint command and parser
  - Type check command and parser
  - Test command and parser
  - Build command

- [ ] **SHOULD have** `<REPORT_FORMAT>` section
  - Standard report structure
  - All validation categories

- [ ] **SHOULD have** `<COMPLETION_CRITERIA>` section
  - When validation is complete
  - Quality gates

## Validates Section Validation

- [ ] **MUST specify** `Agent: asset-engineer`
  - Engineer validators only validate engineer output
  - Not specifications (use architect-validator)
  - Must execute code/tests

- [ ] **MUST specify** artifact type
  - Example: "TypeScript code implementation"
  - Example: "Python modules"

## Implementation Validation

### Static Analysis (Required)

- [ ] **MUST include** linting step
  - Run appropriate linter for language
  - Parse and report errors
  - Include rule name and fix suggestion

- [ ] **MUST include** type checking step
  - Run type checker (TypeScript, mypy, etc.)
  - Parse and report type errors
  - Include fix suggestions

- [ ] **SHOULD include** security scanning
  - Run security scanner (npm audit, bandit, etc.)
  - Report vulnerabilities

### Dynamic Analysis (Required)

- [ ] **MUST include** test execution
  - Run test suite
  - Parse test results
  - Report pass/fail/skip counts
  - Include failure details

- [ ] **MUST include** coverage checking
  - Calculate coverage percentage
  - Compare to threshold
  - Report uncovered lines

### Build Verification (Required)

- [ ] **MUST verify** build success
  - Run build command
  - Check exit code
  - Verify artifacts exist

## Thresholds Validation

### Required Thresholds

- [ ] **MUST define** lint error threshold
  - Typically: 0 (any error = fail)

- [ ] **MUST define** type error threshold
  - Typically: 0 (any error = fail)

- [ ] **MUST define** test pass rate
  - Typically: 100% (any failure = fail)

- [ ] **MUST define** coverage threshold
  - Typically: 80% (below = warn)

### Threshold Values

| Threshold | Typical Value | Action if Exceeded |
|-----------|--------------|-------------------|
| Lint errors | 0 | FAIL |
| Type errors | 0 | FAIL |
| Test failures | 0 | FAIL |
| Coverage minimum | 80% | WARN |

## Report Validation

### Required Report Sections

- [ ] **MUST include** static analysis results
  - Lint status and errors
  - Type check status and errors
  - Security scan results

- [ ] **MUST include** test results
  - Pass/fail/skip counts
  - Duration
  - Failed test details

- [ ] **MUST include** coverage report
  - Overall percentage
  - Statement/branch/function/line breakdown
  - Uncovered locations

- [ ] **MUST include** build status
  - Success/failure
  - Artifact list

- [ ] **MUST include** overall verdict
  - PASS/WARN/FAIL
  - Summary message

### Report Quality

- [ ] **MUST** include file and line for every error
- [ ] **MUST** include error messages
- [ ] **SHOULD** include suggested fixes
- [ ] **SHOULD** include stack traces for test failures

## Content Validation

### Validator Principles

- [ ] **MUST NOT** modify code
- [ ] **MUST NOT** skip test execution
- [ ] **MUST NOT** ignore coverage
- [ ] **MUST** report all issues found

### Tool Requirements

- [ ] **MUST** use Bash tool for execution
- [ ] **MUST** parse tool output correctly
- [ ] **SHOULD** use JSON output formats when available

## Exit Code Validation

- [ ] **MUST define** exit codes

| Code | Meaning |
|------|---------|
| 0 | All checks passed |
| 1 | Warnings only |
| 2 | Errors present |
| 3 | Files not found |
| 4 | Build failed |

## Validation Severity Legend

| Marker | Meaning | Impact |
|--------|---------|--------|
| **MUST** | Required | Validator will not function correctly without this |
| **MUST NOT** | Prohibited | Violates validator principles |
| **SHOULD** | Recommended | Best practice, improves quality |
| **MAY** | Optional | Nice to have, not required |

## Automated Validation

To validate an engineer validator agent programmatically:

```bash
# Check frontmatter
grep -q "^name:.*-validator" agent.md || echo "Missing: name ending with -validator"
grep -q "Bash" agent.md || echo "Missing: Bash tool (required for tests)"

# Check required sections
for section in CONTEXT VALIDATES IMPLEMENTATION THRESHOLDS; do
  grep -q "<$section>" agent.md || echo "Missing: <$section>"
done

# Check validates section
grep -q "Agent: asset-engineer" agent.md || echo "Missing: Agent: asset-engineer"

# Check implementation has both modes
grep -q "Static\|Lint\|Type" agent.md || echo "Missing: Static analysis"
grep -q "Test\|Dynamic" agent.md || echo "Missing: Dynamic analysis"
grep -q "Coverage" agent.md || echo "Missing: Coverage check"
grep -q "Build" agent.md || echo "Missing: Build verification"
```

## Common Validation Failures

| Issue | Solution |
|-------|----------|
| Missing Bash tool | Add Bash to tools - required for test execution |
| Missing VALIDATES section | Add section specifying `Agent: asset-engineer` |
| No test execution | Add dynamic analysis with test command |
| No coverage check | Add coverage threshold and verification |
| No build verification | Add build step and artifact check |
| Vague error reports | Include file, line, message, and fix suggestion |
