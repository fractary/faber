# Architect Validator Agent Standards

This document defines the standards and best practices for creating architect validator agents.

## Overview

Architect Validator agents verify that specifications produced by architect agents are complete, well-structured, and ready for engineer implementation. They perform static analysis only - checking structure, completeness, and quality without executing any code.

## Required Standards

### 1. Verify Architect Output

Architect Validators MUST target architect agent output:

- **Validate specifications** - Design documents, specs, requirements docs
- **Not code** - Leave code validation to engineer validators
- **Not runtime behavior** - Static analysis only

### 2. Static Analysis Only

All validation is structural and semantic:

- **Structure checks** - Required sections present
- **Schema compliance** - Follows expected format
- **Completeness** - All required information included
- **Quality** - Criteria are measurable and testable

### 3. Completeness Validation

Every specification MUST be checked for completeness:

| Check | Description |
|-------|-------------|
| Required sections | All mandatory sections present |
| Acceptance criteria | Every requirement has testable criteria |
| Dependencies | All dependencies identified |
| Edge cases | Error handling documented |

### 4. Acceptance Criteria Quality

Criteria MUST be:

- **Measurable** - Contains numbers, not adjectives
- **Testable** - Can verify pass/fail objectively
- **Specific** - No ambiguous language

```
# BAD: Vague criteria
- "Should be fast"
- "Handle errors gracefully"

# GOOD: Measurable criteria
- "Response time < 200ms for 95th percentile"
- "Return 404 with error message for missing resources"
```

### 5. Check for Ambiguity

Flag problematic language:

| Vague Term | Better Alternative |
|------------|-------------------|
| "should" | "MUST" or "SHOULD" (RFC 2119) |
| "probably" | Remove or be specific |
| "etc." | List all items explicitly |
| "as needed" | Define specific triggers |
| "appropriate" | Define the criteria |

### 6. Verify Traceability

Requirements should be traceable:

- **Unique IDs** - Every requirement has an ID (e.g., REQ-001)
- **Source link** - Link to source issue or user story
- **Dependencies** - Explicit dependency mapping

### 7. Score Objectively

Use consistent scoring methodology:

```
Scoring (100 points total):
- Required sections present: 40 points
- Acceptance criteria quality: 30 points
- Requirement traceability: 15 points
- Ambiguity-free language: 15 points

Pass threshold: 80 points
```

## Recommended Patterns

### Section Checklist

Track required sections systematically:

```markdown
## Required Sections Checklist
- [ ] Overview/Summary (10 pts)
- [ ] Requirements (15 pts)
- [ ] Acceptance Criteria (15 pts)
- [ ] Scope (in/out) (10 pts)
- [ ] Dependencies (10 pts)
- [ ] Implementation Steps (10 pts)
- [ ] Risks and Mitigations (10 pts)
- [ ] Decisions (10 pts)
- [ ] Open Questions (5 pts)
- [ ] References (5 pts)
```

### Quality Scoring Matrix

```
| Criterion | Weight | Score | Weighted |
|-----------|--------|-------|----------|
| Sections  | 40%    | 8/10  | 32       |
| Criteria  | 30%    | 7/10  | 21       |
| Tracing   | 15%    | 9/10  | 13.5     |
| Clarity   | 15%    | 6/10  | 9        |
| TOTAL     | 100%   |       | 75.5     |
```

### Gap Identification

Report gaps with specific asks:

```
Gap: Missing error handling specification
Location: Requirements section
Ask: Add requirements for:
  - Network timeout handling
  - Invalid input validation
  - Concurrent access conflicts
Priority: High
```

## Section Requirements

### Required Sections

Every architect validator MUST have:

| Section | Purpose |
|---------|---------|
| `<CONTEXT>` | Define the specification domain |
| `<VALIDATES>` | Must specify `Agent: asset-architect` |
| `<REQUIRED_SECTIONS>` | Sections that must be present in specs |
| `<QUALITY_CHECKS>` | What makes a good specification |
| `<SCORING>` | How completeness is calculated |

### Recommended Sections

| Section | Purpose |
|---------|---------|
| `<INPUTS>` | Specification file location |
| `<AMBIGUITY_CHECKS>` | Language quality checks |
| `<TRACEABILITY>` | Requirement linking rules |
| `<REPORT_FORMAT>` | Validation report structure |

## Anti-Patterns

### 1. Validating Code Instead of Specs
```
# BAD: Checking code
run_linter(source_code)

# GOOD: Checking specification
check_sections(specification)
```

### 2. Missing Specific Feedback
```
# BAD: Vague feedback
"Specification is incomplete"

# GOOD: Specific feedback
"Missing 'Dependencies' section. Add a section listing:
- External APIs required
- Database dependencies
- Third-party libraries"
```

### 3. Pass/Fail Without Score
```
# BAD: Binary result
"Specification: FAIL"

# GOOD: Scored result
"Specification: 72/100 (NEEDS WORK)
- Sections: 35/40
- Criteria: 20/30
- Tracing: 10/15
- Clarity: 7/15"
```

### 4. Ignoring Ambiguity
```
# BAD: Accepting vague language
"Requirements look fine"

# GOOD: Flagging ambiguity
"Line 42: 'should probably' - Use 'MUST' or 'SHOULD' (RFC 2119)"
```

## Report Format

Standard validation report structure:

```
Specification Validation Report
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Specification: {path}
Validates: asset-architect output
Completeness Score: {score}/100

REQUIRED SECTIONS
─────────────────
✅ Present ({count})
  ✓ Section name

❌ Missing ({count})
  ✗ Section name
    → What to add

ACCEPTANCE CRITERIA QUALITY
───────────────────────────
Score: {score}/100

✅ Good Criteria ({count})
  ✓ REQ-001: "..." - Measurable

⚠️  Needs Improvement ({count})
  ! REQ-002: "..." - Issue
    → How to fix

TRACEABILITY
────────────
Requirements with IDs: {count}/{total}
Requirements linked to issues: {count}/{total}

AMBIGUITY CHECK
───────────────
⚠️  Vague Language Found ({count})
  ! Line X: "term" → Suggestion

GAPS IDENTIFIED
───────────────
1. Gap description
2. Gap description

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Verdict: {READY|NOT READY} for implementation
```

## Exit Codes

| Code | Meaning | Description |
|------|---------|-------------|
| 0 | Pass | Specification is valid and ready |
| 1 | Warn | Has warnings but can proceed |
| 2 | Fail | Has errors, not ready |
| 3 | Not Found | Specification not found |

## Examples

See these architect validator agents for reference:

- Example agents implementing this pattern will be in `plugins/faber/agents/`
