# Architect Validator Agent Validation Rules

Use this checklist to validate architect validator agent definitions.

## Frontmatter Validation

### Required Fields

- [ ] **MUST have** `name` field
  - Lowercase letters, numbers, and hyphens only
  - MUST end with `-validator`
  - Pattern: `^[a-z][a-z0-9-]*-validator$`

- [ ] **MUST have** `description` field
  - Maximum 200 characters
  - Should mention "validates" and "specification" or "spec"

- [ ] **MUST have** `model` field
  - Valid values: `claude-haiku-4-5`, `claude-sonnet-4-5`, `claude-opus-4-5`
  - Recommended: `claude-sonnet-4-5`

- [ ] **MUST have** `tools` field
  - Must be an array
  - Should include `Read`, `Glob`, `Grep` for static analysis
  - Should NOT include `Bash` (static analysis only)

### Optional Fields

- [ ] **MAY have** `color` field
  - Valid values: red, orange, yellow, green, blue, purple, pink, gray, cyan

## Structure Validation

### Required Sections

- [ ] **MUST have** `<CONTEXT>` section
  - Defines what specifications it validates
  - Describes the validation domain
  - Explains role as independent quality gate

- [ ] **MUST have** `<VALIDATES>` section
  - **MUST specify** `Agent: asset-architect`
  - **MUST specify** `Artifact:` description

- [ ] **MUST have** `<REQUIRED_SECTIONS>` section
  - Lists sections that must be present in specs
  - Includes weights for scoring
  - Provides descriptions of each section

- [ ] **MUST have** `<QUALITY_CHECKS>` section
  - Defines acceptance criteria quality standards
  - Includes ambiguity detection rules
  - Includes traceability requirements

- [ ] **MUST have** `<SCORING>` section
  - Defines scoring methodology
  - Specifies pass threshold (typically 80)
  - Lists verdict thresholds

### Recommended Sections

- [ ] **SHOULD have** `<INPUTS>` section
  - Specification file path parameter
  - Optional parameters

- [ ] **SHOULD have** `<IMPLEMENTATION>` section
  - Step-by-step validation workflow
  - Scoring calculations

- [ ] **SHOULD have** `<REPORT_FORMAT>` section
  - Standard report structure
  - All validation categories

- [ ] **SHOULD have** `<COMPLETION_CRITERIA>` section
  - When validation is complete
  - Quality gates

## Validates Section Validation

- [ ] **MUST specify** `Agent: asset-architect`
  - Architect validators only validate architect output
  - Not engineer output (use engineer-validator)
  - Not code (static spec analysis only)

- [ ] **MUST specify** artifact type
  - Example: "FABER specification document"
  - Example: "API design specification"

## Quality Checks Validation

### Acceptance Criteria Standards

- [ ] **MUST define** measurability criteria
- [ ] **MUST define** testability criteria
- [ ] **MUST define** specificity criteria
- [ ] **SHOULD include** good and bad examples

### Ambiguity Detection

- [ ] **MUST include** list of vague terms to flag
- [ ] **MUST include** suggested replacements
- [ ] **SHOULD include** RFC 2119 reference

### Traceability Standards

- [ ] **MUST check** requirement IDs present
- [ ] **SHOULD check** source links present
- [ ] **SHOULD check** dependencies documented

## Scoring Validation

### Scoring Methodology

- [ ] **MUST have** total of 100 points
- [ ] **MUST have** weighted categories
- [ ] **MUST have** pass threshold defined

### Recommended Weights

| Category | Recommended Weight |
|----------|-------------------|
| Required Sections | 30-40% |
| Acceptance Criteria | 25-35% |
| Traceability | 10-20% |
| Clarity | 10-20% |

### Verdict Thresholds

- [ ] **MUST define** READY threshold (typically >= 80)
- [ ] **MUST define** NEEDS WORK range (typically 60-79)
- [ ] **MUST define** NOT READY threshold (typically < 60)

## Implementation Validation

### Static Analysis Only

- [ ] **MUST NOT** execute code
- [ ] **MUST NOT** run tests
- [ ] **MUST NOT** use Bash tool
- [ ] **MUST** only read and analyze specification files

### Validation Steps

- [ ] **MUST** load specification file
- [ ] **MUST** check required sections
- [ ] **MUST** validate acceptance criteria
- [ ] **MUST** check traceability
- [ ] **MUST** detect ambiguity
- [ ] **MUST** calculate score
- [ ] **MUST** generate report

## Report Validation

### Required Report Sections

- [ ] **MUST include** completeness score
- [ ] **MUST include** section checklist
- [ ] **MUST include** criteria quality assessment
- [ ] **MUST include** traceability check
- [ ] **MUST include** ambiguity check
- [ ] **MUST include** gaps identified
- [ ] **MUST include** verdict

### Report Quality

- [ ] **MUST** provide actionable feedback for each issue
- [ ] **MUST** include specific suggestions for fixes
- [ ] **MUST** prioritize issues by severity

## Content Validation

### Validator Principles

- [ ] **MUST NOT** modify specifications
- [ ] **MUST NOT** implement fixes
- [ ] **MUST** only report issues
- [ ] **MUST** provide specific feedback

### Independence

- [ ] **MUST** validate independently of architect agent
- [ ] **MUST** apply consistent standards
- [ ] **MUST** be reproducible

## Validation Severity Legend

| Marker | Meaning | Impact |
|--------|---------|--------|
| **MUST** | Required | Validator will not function correctly without this |
| **MUST NOT** | Prohibited | Violates validator principles |
| **SHOULD** | Recommended | Best practice, improves quality |
| **MAY** | Optional | Nice to have, not required |

## Automated Validation

To validate an architect validator agent programmatically:

```bash
# Check frontmatter
grep -q "^name:.*-validator" agent.md || echo "Missing: name ending with -validator"
grep -qv "Bash" agent.md || echo "Warning: Bash tool found (should be static only)"

# Check required sections
for section in CONTEXT VALIDATES REQUIRED_SECTIONS QUALITY_CHECKS SCORING; do
  grep -q "<$section>" agent.md || echo "Missing: <$section>"
done

# Check validates section
grep -q "Agent: asset-architect" agent.md || echo "Missing: Agent: asset-architect"
```

## Common Validation Failures

| Issue | Solution |
|-------|----------|
| Missing VALIDATES section | Add section specifying `Agent: asset-architect` |
| Bash tool included | Remove Bash - use only Read, Glob, Grep |
| No pass threshold defined | Add pass threshold in SCORING section |
| Vague feedback in report | Make feedback specific with suggestions |
| Missing ambiguity checks | Add list of vague terms to detect |
