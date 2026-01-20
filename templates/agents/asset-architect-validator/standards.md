# Asset Architect Validator Standards

This document defines the standards, best practices, and validation rules for creating architect validator agents.

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

---

# Validation Rules

## Frontmatter Validation

### Required Fields

- [ ] **MUST have** `name` field
  - MUST end with `-validator`
  - Pattern: `^[a-z][a-z0-9-]*-validator$`

- [ ] **MUST have** `description` field
  - Should mention "validates" and "specification"

- [ ] **MUST have** `model` field
  - Recommended: `claude-sonnet-4-5`

- [ ] **MUST have** `tools` field
  - Should include `Read`, `Glob`, `Grep` for static analysis
  - Should NOT include `Bash` (static analysis only)

### Optional Fields

- [ ] **MAY have** `color` field
- [ ] **SHOULD have** `agent_type` field with value `asset-architect-validator`

## Structure Validation

### Validates Section

- [ ] **MUST specify** `Agent: asset-architect`
- [ ] **MUST specify** artifact type

### Quality Checks

- [ ] **MUST define** measurability criteria
- [ ] **MUST define** testability criteria
- [ ] **MUST include** list of vague terms to flag
- [ ] **MUST include** suggested replacements

### Scoring

- [ ] **MUST have** total of 100 points
- [ ] **MUST have** weighted categories
- [ ] **MUST have** pass threshold defined (typically 80)

## Implementation Validation

### Static Analysis Only

- [ ] **MUST NOT** execute code
- [ ] **MUST NOT** run tests
- [ ] **MUST NOT** use Bash tool
- [ ] **MUST** only read and analyze specification files

## Validation Severity Legend

| Marker | Meaning | Impact |
|--------|---------|--------|
| **MUST** | Required | Validator will not function correctly without this |
| **MUST NOT** | Prohibited | Violates validator principles |
| **SHOULD** | Recommended | Best practice, improves quality |
| **MAY** | Optional | Nice to have, not required |

## Exit Codes

| Code | Meaning | Description |
|------|---------|-------------|
| 0 | Pass | Specification is valid and ready |
| 1 | Warn | Has warnings but can proceed |
| 2 | Fail | Has errors, not ready |
| 3 | Not Found | Specification not found |

## Common Validation Failures

| Issue | Solution |
|-------|----------|
| Missing VALIDATES section | Add section specifying `Agent: asset-architect` |
| Bash tool included | Remove Bash - use only Read, Glob, Grep |
| No pass threshold defined | Add pass threshold in SCORING section |
| Vague feedback in report | Make feedback specific with suggestions |
| Missing ambiguity checks | Add list of vague terms to detect |
