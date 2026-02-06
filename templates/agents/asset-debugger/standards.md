# Asset Debugger Standards

This document defines the standards, best practices, and validation rules for creating debugger agents.

## Overview

Debugger agents troubleshoot problems, diagnose errors, and maintain a knowledge base of solutions. They analyze failures, identify root causes, propose solutions, and build institutional knowledge.

## Required Standards

### 1. Knowledge Base First

Debugger agents MUST check for similar past issues:

- **Search before diagnosing** - Check if similar issues were solved before
- **Use past solutions** - Adapt verified solutions to current context
- **Note the source** - Indicate if solution is from KB or fresh analysis

### 2. Complete Context

Gather all relevant information:

```
Required context:
- Error messages and stack traces
- Recent logs
- System/workflow state
- Configuration
- Recent changes
```

### 3. Root Cause Analysis

Find the underlying cause:

- **Don't stop at symptoms** - Trace to the root cause
- **Consider cascading failures** - One error can cause others
- **Assess confidence** - Rate how certain the diagnosis is

### 4. Actionable Solutions

Solutions MUST be implementable:

- **Specific steps** - Not vague suggestions
- **Continuation commands** - How to proceed
- **Complexity assessment** - Simple, moderate, or complex

### 5. Solution Recording

Build institutional knowledge:

- **Record successful resolutions** - Update KB after verification
- **Include keywords** - Enable future searchability
- **Maintain entries** - Mark deprecated solutions

## Recommended Patterns

### Context Gathering

Systematic context collection:

```
1. Error information
   - Full error message
   - Stack trace
   - Error code

2. Log information
   - Recent log entries
   - Related log files
   - Timestamps

3. State information
   - Current state
   - State at failure time
   - Recent state changes

4. Environment
   - Configuration
   - Dependencies
   - System info
```

### Knowledge Base Search

Effective KB searching:

```
Search strategy:
1. Extract keywords from error
2. Match error patterns
3. Consider category
4. Calculate similarity
5. Return ranked results

Similarity factors:
- Keyword overlap
- Error pattern match
- Category match
- Recency
- Usage count
```

### Root Cause Tracing

Systematic diagnosis:

```
1. Parse error message
   - Error type
   - Location
   - Context

2. Check common causes
   - Known error patterns
   - Recent changes
   - Configuration issues

3. Trace backwards
   - What triggered this?
   - What changed?
   - What's the chain?

4. Assess confidence
   - How certain are we?
   - What could we be missing?
```

### Solution Generation

Creating actionable solutions:

```
For each solution:
1. Title - Brief description
2. Complexity - simple/moderate/complex
3. Confidence - high/medium/low
4. Steps - Ordered actions
5. Verification - How to confirm fix
6. Continuation - Command to proceed
```

## Section Requirements

### Required Sections

Every debugger agent MUST have:

| Section | Purpose |
|---------|---------|
| `<CONTEXT>` | Define the debug domain |
| `<CRITICAL_RULES>` | Debugging principles |
| `<IMPLEMENTATION>` | Diagnostic workflow |
| `<OUTPUTS>` | Diagnosis format |

### Recommended Sections

| Section | Purpose |
|---------|---------|
| `<INPUTS>` | Required context and parameters |
| `<KNOWLEDGE_BASE>` | KB structure and usage |
| `<ERROR_HANDLING>` | What to do when diagnosis fails |
| `<COMPLETION_CRITERIA>` | When debugging is complete |

## Anti-Patterns

Avoid these common mistakes:

### 1. Diagnosing Without Context
```
# BAD: Immediate diagnosis
"The error is probably X"

# GOOD: Gather context first
context = gather_context()
analysis = diagnose(context)
```

### 2. Ignoring Knowledge Base
```
# BAD: Skip KB search
analysis = fresh_analysis(error)

# GOOD: Check KB first
kb_matches = search_kb(error)
if kb_matches:
  analysis = adapt_solution(kb_matches[0])
else:
  analysis = fresh_analysis(error)
```

### 3. Stopping at Symptoms
```
# BAD: Surface-level diagnosis
"The build failed"

# GOOD: Root cause analysis
"The build failed because dependency X is missing,
 which happened because Y was not installed,
 which occurred because Z configuration was wrong"
```

### 4. Vague Solutions
```
# BAD: Vague suggestion
"Fix the configuration"

# GOOD: Specific steps
"1. Open config.yaml
 2. Set 'cache.enabled' to true
 3. Run 'npm run build' to verify"
```

### 5. Auto-Fixing
```
# BAD: Apply fix automatically
apply_fix(solution)

# GOOD: Propose and hand off
propose_solution(solution)
generate_continuation_command()
```

## Knowledge Base Management

### Entry Lifecycle

```
1. Creation
   - New issue diagnosed
   - Solution proposed
   - Entry created as "unverified"

2. Verification
   - Solution applied
   - Fix confirmed
   - Entry marked "verified"

3. Maintenance
   - Regular review
   - Update outdated entries
   - Mark deprecated solutions

4. Deprecation
   - Solution no longer valid
   - Mark as "deprecated"
   - Note replacement solution
```

---

# Validation Rules

Use this checklist to validate debugger agent definitions.

## Frontmatter Validation

### Required Fields

- [ ] **MUST have** `name` field
  - Lowercase letters, numbers, and hyphens only
  - Pattern: `^[a-z][a-z0-9-]*$`

- [ ] **MUST have** `description` field
  - Maximum 200 characters
  - Should describe what it debugs

- [ ] **MUST have** `model` field
  - Valid values: `claude-haiku-4-5`, `claude-sonnet-4-5`, `claude-opus-4-6`
  - Recommended: `claude-sonnet-4-5` for debuggers

- [ ] **MUST have** `tools` field
  - Should include `Read` for logs/state
  - Should include `Grep` for pattern search

### Optional Fields

- [ ] **MAY have** `color` field
- [ ] **SHOULD have** `agent_type` field with value `asset-debugger`

## Structure Validation

### Required Sections

- [ ] **MUST have** `<CONTEXT>`, `<CRITICAL_RULES>`, `<IMPLEMENTATION>`, `<OUTPUTS>`

### Critical Rules Must Include

1. Search Knowledge Base First
2. Gather Complete Context
3. Identify Root Cause
4. Propose Actionable Solutions
5. Record Solutions
6. Never Auto-Fix

### Implementation Must Include

- [ ] Gather debug context
- [ ] Search knowledge base
- [ ] Analyze issue
- [ ] Propose solutions
- [ ] Generate continuation
- [ ] Log findings

## Validation Severity Legend

| Marker | Meaning | Impact |
|--------|---------|--------|
| **MUST** | Required | Agent will not produce quality diagnoses without this |
| **MUST NOT** | Prohibited | Violates debugger principles |
| **SHOULD** | Recommended | Best practice, improves quality |
| **MAY** | Optional | Nice to have, not required |

## Common Validation Failures

| Issue | Solution |
|-------|----------|
| No KB search step | Add step to search knowledge base |
| Missing context gathering | Add comprehensive context collection |
| Vague solutions | Make solutions specific with steps |
| No continuation command | Add command generation step |
| Missing confidence assessment | Add confidence level to analysis |

## Examples

See these debugger agents for reference:

- `plugins/faber/skills/faber-debugger/SKILL.md` - Full-featured debugger
