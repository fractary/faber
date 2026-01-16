# Validator Agent Standards

This document defines the standards and best practices for creating validator agents.

## Overview

Validator agents perform pre-deployment static analysis to ensure artifacts meet quality standards. They check schemas, run linting, verify compliance, and report issues with clear severity levels.

## Required Standards

### 1. Static Analysis Only

Validators MUST only perform static analysis:

- **No code execution** - Don't run the code being validated
- **File inspection** - Read and analyze files
- **Schema checking** - Validate against schemas
- **Pattern matching** - Check for required/prohibited patterns

### 2. Pre-Deployment Timing

Validators run BEFORE deployment:

- **Early detection** - Catch issues before they reach production
- **Quality gates** - Block releases with critical issues
- **CI/CD integration** - Designed for pipeline use

### 3. Severity Classification

Clear severity levels:

| Severity | Meaning | Action |
|----------|---------|--------|
| ERROR | Critical issue | MUST fix, blocks release |
| WARNING | Important issue | SHOULD fix, doesn't block |
| INFO | Suggestion | MAY fix, optional |

### 4. Actionable Feedback

Every issue needs remediation:

```
Issue format:
- File and line number
- Clear description
- WHY it's an issue
- Suggested fix
- Example of correct form
```

### 5. Comprehensive Coverage

Check everything:

- Don't stop on first error
- Run all checks
- Report complete results
- Note skipped checks if any

## Recommended Patterns

### Validation Check Structure

Define checks systematically:

```json
{
  "id": "unique-id",
  "name": "Human-readable name",
  "description": "What this checks",
  "severity": "error|warning|info",
  "weight": 10,
  "check": "validation logic",
  "fix_template": "How to fix"
}
```

### Scoring Methodology

Weighted scoring approach:

```
1. Assign weights to each check
   - Critical checks: 10 points
   - Important checks: 5 points
   - Minor checks: 2 points

2. Calculate base score
   score = (passed_weight / total_weight) * 100

3. Apply penalties
   - Per error: -5 points
   - Per warning: -2 points

4. Final score = max(0, base - penalties)

5. Thresholds
   - 100%: Perfect
   - 80-99%: Good (warnings only)
   - 50-79%: Needs attention
   - <50%: Critical issues
```

### Report Format

Standard report structure:

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
{Title} Validation Report
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Target: {target_description}
Score: {score}/100

✅ PASSED ({count})
  ✓ {check_name}

❌ ERRORS ({count})
  ✗ [{file}:{line}] {message}
    Fix: {suggested_fix}

⚠️  WARNINGS ({count})
  ! [{file}:{line}] {message}
    Fix: {suggested_fix}

ℹ️  INFO ({count})
  → {suggestion}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
{status_message}
```

## Section Requirements

### Required Sections

| Section | Purpose |
|---------|---------|
| `<CONTEXT>` | Define validation domain |
| `<CRITICAL_RULES>` | Validation principles |
| `<IMPLEMENTATION>` | Validation workflow |
| `<OUTPUTS>` | Report format |

### Recommended Sections

| Section | Purpose |
|---------|---------|
| `<INPUTS>` | What to validate |
| `<VALIDATION_RULES>` | Specific checks |
| `<SCORING>` | Score calculation |
| `<COMPLETION_CRITERIA>` | When validation is complete |

## Anti-Patterns

### 1. Running Code
```
# BAD: Executing the code
result = execute(code)
check(result)

# GOOD: Static analysis
ast = parse(code)
check(ast)
```

### 2. Missing Fixes
```
# BAD: Issue without fix
PRINT "Error: Missing field 'name'"

# GOOD: Issue with fix
PRINT "Error: Missing field 'name'"
PRINT "  Fix: Add 'name: your-name' to config"
```

### 3. Stopping Early
```
# BAD: Stop on first error
if error:
  EXIT 1

# GOOD: Check everything
errors = []
for check in checks:
  if not check.passes:
    errors.append(check.error)
report(errors)
```

### 4. Vague Severity
```
# BAD: Unclear severity
PRINT "Issue found"

# GOOD: Clear severity
PRINT "ERROR: {issue}"  # Must fix
PRINT "WARNING: {issue}"  # Should fix
```

## Exit Code Standards

| Code | Meaning | Description |
|------|---------|-------------|
| 0 | Pass | All checks passed |
| 1 | Warn | Warnings present, no errors |
| 2 | Fail | Errors present |
| 3 | Not Found | Target not found |
| 4 | Config Error | Validation config error |

## Examples

See these validator agents for reference:

- `plugins/faber/agents/workflow-auditor.md` - Workflow validation
