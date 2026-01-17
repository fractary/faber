# Engineer Agent Standards

This document defines the standards and best practices for creating engineer agents.

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

## Examples

See these engineer agents for reference:

- `plugins/faber/agents/workflow-engineer.md` - Creates workflows
- `plugins/faber/skills/build/SKILL.md` - FABER build phase
