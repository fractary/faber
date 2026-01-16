# Architect Agent Validation Rules

Use this checklist to validate architect agent definitions.

## Frontmatter Validation

### Required Fields

- [ ] **MUST have** `name` field
  - Lowercase letters, numbers, and hyphens only
  - Must start with a letter
  - Pattern: `^[a-z][a-z0-9-]*$`

- [ ] **MUST have** `description` field
  - Maximum 200 characters
  - Should describe what it designs

- [ ] **MUST have** `model` field
  - Valid values: `claude-haiku-4-5`, `claude-sonnet-4-5`, `claude-opus-4-5`
  - Recommended: `claude-sonnet-4-5` for architects

- [ ] **MUST have** `tools` field
  - Must be an array
  - Should include `Read`, `Glob`, `Grep` for context gathering
  - Should include `Write` for specification output

### Optional Fields

- [ ] **MAY have** `color` field
  - Valid values: red, orange, yellow, green, blue, purple, pink, gray, cyan

## Structure Validation

### Required Sections

- [ ] **MUST have** `<CONTEXT>` section
  - Defines what the agent designs
  - Describes the design domain
  - Explains the role and responsibility

- [ ] **MUST have** `<CRITICAL_RULES>` section
  - Contains numbered design principles
  - **MUST include** these core rules:
    1. Understand Before Designing
    2. Explore Alternatives
    3. Produce Actionable Specifications
    4. Document Decisions
    5. Stay in Design Mode (no implementation)

- [ ] **MUST have** `<IMPLEMENTATION>` section
  - Step-by-step design workflow
  - **MUST include** these steps:
    - [ ] Gather context
    - [ ] Analyze requirements
    - [ ] Explore solutions
    - [ ] Generate specification
    - [ ] Document decisions

- [ ] **MUST have** `<OUTPUTS>` section
  - Specification format
  - Required sections in output
  - Response format

### Recommended Sections

- [ ] **SHOULD have** `<INPUTS>` section
  - Required parameters
  - Optional parameters
  - Input validation

- [ ] **SHOULD have** `<EXAMPLES>` section
  - Sample specifications
  - Real-world examples

- [ ] **SHOULD have** `<DECISION_FRAMEWORK>` section
  - How to evaluate approaches
  - Trade-off analysis method

- [ ] **SHOULD have** `<COMPLETION_CRITERIA>` section
  - When the design is complete
  - Quality gates

## Implementation Validation

### Context Gathering

- [ ] **MUST** read existing code before designing
- [ ] **MUST** clarify ambiguous requirements
- [ ] **SHOULD** check for existing patterns
- [ ] **SHOULD** identify constraints

### Solution Exploration

- [ ] **MUST** consider multiple approaches for non-trivial problems
- [ ] **MUST** document why alternatives were rejected
- [ ] **SHOULD** include trade-off analysis
- [ ] **SHOULD** assess complexity of each approach

### Specification Quality

- [ ] **MUST** produce actionable specifications
- [ ] **MUST** include acceptance criteria
- [ ] **MUST** identify dependencies
- [ ] **SHOULD** include implementation steps
- [ ] **SHOULD** identify risks with mitigations

### Decision Documentation

- [ ] **MUST** document key decisions
- [ ] **MUST** include rationale for decisions
- [ ] **SHOULD** note assumptions
- [ ] **SHOULD** flag open questions

## Content Validation

### Design Principles

- [ ] **MUST NOT** include implementation code
- [ ] **MUST NOT** skip context gathering
- [ ] **MUST NOT** present only one approach (for non-trivial problems)
- [ ] **SHOULD NOT** make assumptions without noting them

### Documentation Quality

- [ ] **MUST** explain the design domain
- [ ] **MUST** describe expected outputs
- [ ] **SHOULD** provide examples
- [ ] **SHOULD** include completion criteria

## Output Validation

### Specification Structure

- [ ] **MUST** have overview section
- [ ] **MUST** have requirements section
- [ ] **MUST** have design section
- [ ] **MUST** have acceptance criteria
- [ ] **SHOULD** have risks section
- [ ] **SHOULD** have decisions section

### Actionability

- [ ] **MUST** be detailed enough to implement
- [ ] **MUST** have clear, ordered steps
- [ ] **MUST** have testable criteria
- [ ] **SHOULD** identify dependencies

## Validation Severity Legend

| Marker | Meaning | Impact |
|--------|---------|--------|
| **MUST** | Required | Agent will not produce quality designs without this |
| **MUST NOT** | Prohibited | Violates architect principles |
| **SHOULD** | Recommended | Best practice, improves quality |
| **MAY** | Optional | Nice to have, not required |

## Automated Validation

To validate an architect agent programmatically:

```bash
# Check frontmatter
grep -q "^name:" agent.md || echo "Missing: name"
grep -q "^tools:" agent.md || echo "Missing: tools"

# Check required sections
for section in CONTEXT CRITICAL_RULES IMPLEMENTATION OUTPUTS; do
  grep -q "<$section>" agent.md || echo "Missing: <$section>"
done

# Check critical rules
grep -q "Understand Before Designing" agent.md || echo "Missing rule: Understand Before Designing"
grep -q "Explore Alternatives" agent.md || echo "Missing rule: Explore Alternatives"
grep -q "Actionable Specifications" agent.md || echo "Missing rule: Actionable Specifications"
```

## Common Validation Failures

| Issue | Solution |
|-------|----------|
| Missing context gathering step | Add step to read existing code and requirements |
| Only one approach considered | Add exploration of 2-3 alternatives |
| Vague acceptance criteria | Make criteria specific and testable |
| Missing decision rationale | Document why each decision was made |
| Implementation code present | Remove code, describe what to implement instead |
