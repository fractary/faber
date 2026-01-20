# Asset Engineer Standards

This document defines the standards, best practices, and validation rules for creating engineer agents.

## Overview

Engineer agents implement solutions by creating, modifying, or generating artifacts. They execute the build phase of FABER workflows, turning specifications into working implementations.

## Required Standards

### 1. Read Before Write

Engineer agents MUST read existing code before modifying:

- **Read the file** before editing it
- **Understand the context** before making changes
- **Never assume** - verify by reading

### 2. Follow Patterns

Match existing codebase patterns:

```
For each file type, identify:
- Import/module patterns
- Naming conventions (camelCase, snake_case, etc.)
- Error handling patterns
- Logging patterns
- Test patterns
```

### 3. Incremental Changes

Make small, verifiable changes:

- **One logical change** at a time
- **Verify** after each change
- **Don't batch** unrelated changes

### 4. Error Adaptation

Handle errors constructively:

- **Don't give up** on first error
- **Diagnose** the root cause
- **Adapt** the approach
- **Retry** with fix applied

### 5. Quality Focus

Write maintainable code:

- Clean, readable code
- Appropriate comments
- No unnecessary complexity
- Consider testability

## Recommended Patterns

### Context Loading

Load all necessary context before implementing:

```
1. Read specification
   - Requirements
   - Acceptance criteria
   - Implementation steps

2. Research codebase
   - Find similar files
   - Note patterns used
   - Identify utilities

3. Check dependencies
   - Available packages
   - Internal utilities
   - Type definitions
```

### Implementation Loop

Standard implementation pattern:

```
for each step:
  1. Print current step
  2. Make the change
  3. Verify the change
  4. If error:
     a. Diagnose
     b. Fix
     c. Retry
  5. Mark complete
```

### Error Handling Strategy

When encountering errors:

```
Error Types and Actions:

Syntax Error:
  - Read file content
  - Parse error message
  - Identify exact location
  - Apply targeted fix

Test Failure:
  - Read test output
  - Identify failing assertion
  - Check implementation
  - Fix logic

Missing Dependency:
  - Check package.json/requirements
  - Install missing package
  - Retry operation

Build Failure:
  - Read full error output
  - Check for type errors
  - Check for import issues
  - Fix identified problems
```

### Verification Approach

Verify each change:

```
After making a change:
1. Syntax check (if applicable)
2. Type check (if applicable)
3. Lint check
4. Run related tests
5. Build check
```

## Section Requirements

### Required Sections

Every engineer agent MUST have:

| Section | Purpose |
|---------|---------|
| `<CONTEXT>` | Define what the agent implements |
| `<CRITICAL_RULES>` | Implementation principles to follow |
| `<IMPLEMENTATION>` | Step-by-step execution workflow |
| `<OUTPUTS>` | Expected deliverables |

### Recommended Sections

| Section | Purpose |
|---------|---------|
| `<INPUTS>` | Required specifications and parameters |
| `<ERROR_HANDLING>` | How to handle failures |
| `<VALIDATION>` | Quality checks and verification |
| `<COMPLETION_CRITERIA>` | When implementation is done |

## Anti-Patterns

Avoid these common mistakes:

### 1. Writing Without Reading
```
# BAD: Assuming file contents
edit("file.ts", "function old()", "function new()")

# GOOD: Read first
content = read("file.ts")
# Now edit based on actual content
```

### 2. Large Batch Changes
```
# BAD: Multiple unrelated changes
edit("file.ts", change1)
edit("file.ts", change2)
edit("file.ts", change3)
# All at once, no verification

# GOOD: Incremental with verification
edit("file.ts", change1)
verify()
edit("file.ts", change2)
verify()
```

### 3. Giving Up on Errors
```
# BAD: Stop at first error
result = bash("npm test")
if error:
  FAIL "Tests failed"

# GOOD: Diagnose and adapt
result = bash("npm test")
if error:
  diagnosis = analyze_error(result)
  fix = determine_fix(diagnosis)
  apply_fix(fix)
  retry()
```

### 4. Ignoring Patterns
```
# BAD: Using different style than codebase
function myNewFunction() {
  // Different error handling, logging, etc.
}

# GOOD: Match existing patterns
function myNewFunction() {
  // Same error handling, logging, etc.
}
```

### 5. Skipping Verification
```
# BAD: No verification
write("new-file.ts", content)
# Hope it works

# GOOD: Verify after write
write("new-file.ts", content)
bash("npx tsc --noEmit new-file.ts")
bash("npx eslint new-file.ts")
```

## Tool Usage

### Recommended Tool Combinations

| Task | Tools |
|------|-------|
| Read existing code | `Read`, `Glob`, `Grep` |
| Create new files | `Write` |
| Modify existing files | `Read` then `Edit` |
| Run commands | `Bash` |
| Search patterns | `Grep`, `Glob` |

### Tool Best Practices

```
Read:
- Always read before editing
- Read related files for patterns

Write:
- Use for new files only
- Verify content after writing

Edit:
- Use for modifications
- Provide enough context in old_string
- Verify edit applied correctly

Bash:
- Use for commands, builds, tests
- Check exit codes
- Parse output for errors
```

---

# Validation Rules

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

- [ ] **SHOULD have** `agent_type` field
  - Value: `asset-engineer`
  - Links to this template for updates and validation

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

## Quality Checklist

Use this checklist before completing implementation:

- [ ] All specification requirements addressed
- [ ] Code follows existing patterns
- [ ] All tests pass
- [ ] No linting errors
- [ ] No type errors
- [ ] Acceptance criteria verified
- [ ] No regressions introduced
- [ ] Code is clean and maintainable

## Common Validation Failures

| Issue | Solution |
|-------|----------|
| No read-before-write pattern | Add step to read existing files first |
| Missing error handling | Add ERROR_HANDLING section |
| No verification steps | Add verification after each change |
| Missing pattern research | Add step to research existing code |
| No completion criteria | Add COMPLETION_CRITERIA section |

## Examples

See these engineer agents for reference:

- `plugins/faber/agents/workflow-engineer.md` - Creates workflows
- `plugins/faber/skills/build/SKILL.md` - FABER build phase
