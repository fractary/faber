# Engineer Agent Validation Rules

Use this checklist to validate engineer agent definitions.

## Frontmatter Validation

### Required Fields

- [ ] **MUST have** `name` field
  - Lowercase letters, numbers, and hyphens only
  - Must start with a letter
  - Pattern: `^[a-z][a-z0-9-]*$`

- [ ] **MUST have** `description` field
  - Maximum 200 characters
  - Should describe what it implements

- [ ] **MUST have** `model` field
  - Valid values: `claude-haiku-4-5`, `claude-sonnet-4-5`, `claude-opus-4-5`
  - Recommended: `claude-sonnet-4-5` for engineers

- [ ] **MUST have** `tools` field
  - Must be an array
  - Should include `Read` (for reading before writing)
  - Should include file modification tools (`Write`, `Edit`)
  - Should include `Bash` for running commands

### Optional Fields

- [ ] **MAY have** `color` field
  - Valid values: red, orange, yellow, green, blue, purple, pink, gray, cyan

## Structure Validation

### Required Sections

- [ ] **MUST have** `<CONTEXT>` section
  - Defines what the agent implements
  - Describes the implementation domain
  - Explains the role and responsibility

- [ ] **MUST have** `<CRITICAL_RULES>` section
  - Contains numbered implementation principles
  - **MUST include** these core rules:
    1. Read Before Writing
    2. Follow Existing Patterns
    3. Incremental Changes
    4. Adapt When Blocked
    5. Quality Over Speed
    6. Validate Results

- [ ] **MUST have** `<IMPLEMENTATION>` section
  - Step-by-step execution workflow
  - **MUST include** these steps:
    - [ ] Load context/specification
    - [ ] Research existing patterns
    - [ ] Implement incrementally
    - [ ] Handle errors
    - [ ] Validate results

- [ ] **MUST have** `<OUTPUTS>` section
  - Expected deliverables
  - Response format

### Recommended Sections

- [ ] **SHOULD have** `<INPUTS>` section
  - Required specifications
  - Parameters

- [ ] **SHOULD have** `<ERROR_HANDLING>` section
  - Error categories
  - Adaptation strategies

- [ ] **SHOULD have** `<VALIDATION>` section
  - Quality checks
  - Verification steps

- [ ] **SHOULD have** `<COMPLETION_CRITERIA>` section
  - When implementation is done
  - Quality gates

## Implementation Validation

### Code Quality

- [ ] **MUST** read files before modifying
- [ ] **MUST** follow existing patterns
- [ ] **MUST** make incremental changes
- [ ] **MUST** verify after each change
- [ ] **SHOULD** handle errors adaptively

### Tool Usage

- [ ] **MUST** use `Read` before `Edit`
- [ ] **MUST** check `Bash` exit codes
- [ ] **SHOULD** use `Grep`/`Glob` for pattern research
- [ ] **SHOULD** verify writes with subsequent reads

### Error Handling

- [ ] **MUST** have error handling strategy
- [ ] **MUST** support error adaptation
- [ ] **SHOULD** categorize error types
- [ ] **SHOULD** include retry logic

## Content Validation

### Implementation Principles

- [ ] **MUST NOT** write without reading first
- [ ] **MUST NOT** make large unverified changes
- [ ] **MUST NOT** give up on first error
- [ ] **SHOULD NOT** skip verification steps

### Documentation Quality

- [ ] **MUST** explain what is implemented
- [ ] **MUST** describe expected outputs
- [ ] **SHOULD** provide error handling guidance
- [ ] **SHOULD** include completion criteria

## Output Validation

### Deliverables

- [ ] **MUST** define expected outputs
- [ ] **MUST** specify response format
- [ ] **SHOULD** include success indicators
- [ ] **SHOULD** include error indicators

### Quality Gates

- [ ] **MUST** verify tests pass
- [ ] **MUST** verify linting passes
- [ ] **SHOULD** verify acceptance criteria
- [ ] **SHOULD** check for regressions

## Validation Severity Legend

| Marker | Meaning | Impact |
|--------|---------|--------|
| **MUST** | Required | Agent will not produce quality implementations without this |
| **MUST NOT** | Prohibited | Violates engineer principles |
| **SHOULD** | Recommended | Best practice, improves quality |
| **MAY** | Optional | Nice to have, not required |

## Automated Validation

To validate an engineer agent programmatically:

```bash
# Check frontmatter
grep -q "^name:" agent.md || echo "Missing: name"
grep -q "^tools:" agent.md || echo "Missing: tools"

# Check required sections
for section in CONTEXT CRITICAL_RULES IMPLEMENTATION OUTPUTS; do
  grep -q "<$section>" agent.md || echo "Missing: <$section>"
done

# Check critical rules
grep -q "Read Before Writing" agent.md || echo "Missing rule: Read Before Writing"
grep -q "Follow.*Patterns" agent.md || echo "Missing rule: Follow Patterns"
grep -q "Incremental" agent.md || echo "Missing rule: Incremental Changes"
```

## Common Validation Failures

| Issue | Solution |
|-------|----------|
| No read-before-write pattern | Add step to read existing files first |
| Missing error handling | Add ERROR_HANDLING section |
| No verification steps | Add verification after each change |
| Missing pattern research | Add step to research existing code |
| No completion criteria | Add COMPLETION_CRITERIA section |
