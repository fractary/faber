# Debugger Agent Validation Rules

Use this checklist to validate debugger agent definitions.

## Frontmatter Validation

### Required Fields

- [ ] **MUST have** `name` field
  - Lowercase letters, numbers, and hyphens only
  - Must start with a letter
  - Pattern: `^[a-z][a-z0-9-]*$`

- [ ] **MUST have** `description` field
  - Maximum 200 characters
  - Should describe what it debugs

- [ ] **MUST have** `model` field
  - Valid values: `claude-haiku-4-5`, `claude-sonnet-4-5`, `claude-opus-4-5`
  - Recommended: `claude-sonnet-4-5` for debuggers

- [ ] **MUST have** `tools` field
  - Must be an array
  - Should include `Read` for logs/state
  - Should include `Grep` for pattern search

### Optional Fields

- [ ] **MAY have** `color` field
  - Valid values: red, orange, yellow, green, blue, purple, pink, gray, cyan

## Structure Validation

### Required Sections

- [ ] **MUST have** `<CONTEXT>` section
  - Defines what the agent debugs
  - Describes the debug domain
  - Explains knowledge base integration

- [ ] **MUST have** `<CRITICAL_RULES>` section
  - Contains numbered debugging principles
  - **MUST include** these core rules:
    1. Search Knowledge Base First
    2. Gather Complete Context
    3. Identify Root Cause
    4. Propose Actionable Solutions
    5. Record Solutions
    6. Never Auto-Fix

- [ ] **MUST have** `<IMPLEMENTATION>` section
  - Step-by-step diagnostic workflow
  - **MUST include** these steps:
    - [ ] Gather debug context
    - [ ] Search knowledge base
    - [ ] Analyze issue
    - [ ] Propose solutions
    - [ ] Generate continuation
    - [ ] Log findings

- [ ] **MUST have** `<OUTPUTS>` section
  - Diagnosis format
  - Response structure
  - Error output format

### Recommended Sections

- [ ] **SHOULD have** `<INPUTS>` section
  - Required context parameters
  - Optional parameters

- [ ] **SHOULD have** `<KNOWLEDGE_BASE>` section
  - KB structure
  - Entry format
  - Search strategy

- [ ] **SHOULD have** `<ERROR_HANDLING>` section
  - Graceful degradation
  - What to do when diagnosis fails

- [ ] **SHOULD have** `<COMPLETION_CRITERIA>` section
  - When debugging is complete

## Implementation Validation

### Context Gathering

- [ ] **MUST** gather error messages
- [ ] **MUST** gather relevant logs
- [ ] **MUST** gather current state
- [ ] **SHOULD** gather configuration
- [ ] **SHOULD** gather recent changes

### Knowledge Base

- [ ] **MUST** search KB before diagnosing
- [ ] **MUST** indicate solution source (KB vs fresh)
- [ ] **SHOULD** record successful resolutions
- [ ] **SHOULD** support KB unavailability gracefully

### Analysis

- [ ] **MUST** identify root cause (not just symptoms)
- [ ] **MUST** assess confidence level
- [ ] **SHOULD** consider cascading failures
- [ ] **SHOULD** note contributing factors

### Solutions

- [ ] **MUST** be specific and actionable
- [ ] **MUST** include steps
- [ ] **MUST** include continuation command
- [ ] **SHOULD** assess complexity
- [ ] **SHOULD** include verification method

## Content Validation

### Debugging Principles

- [ ] **MUST NOT** auto-fix problems
- [ ] **MUST NOT** diagnose with partial information
- [ ] **MUST NOT** stop at symptoms
- [ ] **SHOULD NOT** ignore knowledge base

### Documentation Quality

- [ ] **MUST** explain the debug domain
- [ ] **MUST** describe output format
- [ ] **SHOULD** include KB structure
- [ ] **SHOULD** document error handling

## Output Validation

### Diagnosis Structure

- [ ] **MUST** include root cause
- [ ] **MUST** include proposed solutions
- [ ] **MUST** include confidence level
- [ ] **SHOULD** include KB match info
- [ ] **SHOULD** include continuation command

### Response Format

- [ ] **MUST** return structured JSON
- [ ] **MUST** include status field
- [ ] **MUST** include message field
- [ ] **SHOULD** include details object

## Validation Severity Legend

| Marker | Meaning | Impact |
|--------|---------|--------|
| **MUST** | Required | Agent will not produce quality diagnoses without this |
| **MUST NOT** | Prohibited | Violates debugger principles |
| **SHOULD** | Recommended | Best practice, improves quality |
| **MAY** | Optional | Nice to have, not required |

## Automated Validation

To validate a debugger agent programmatically:

```bash
# Check frontmatter
grep -q "^name:" agent.md || echo "Missing: name"
grep -q "^tools:" agent.md || echo "Missing: tools"

# Check required sections
for section in CONTEXT CRITICAL_RULES IMPLEMENTATION OUTPUTS; do
  grep -q "<$section>" agent.md || echo "Missing: <$section>"
done

# Check critical rules
grep -q "Search Knowledge Base" agent.md || echo "Missing rule: Search KB First"
grep -q "Gather Complete Context" agent.md || echo "Missing rule: Gather Context"
grep -q "Root Cause" agent.md || echo "Missing rule: Identify Root Cause"
```

## Common Validation Failures

| Issue | Solution |
|-------|----------|
| No KB search step | Add step to search knowledge base |
| Missing context gathering | Add comprehensive context collection |
| Vague solutions | Make solutions specific with steps |
| No continuation command | Add command generation step |
| Missing confidence assessment | Add confidence level to analysis |
