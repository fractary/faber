# Architect Agent Standards

This document defines the standards and best practices for creating architect agents.

## Overview

Architect agents design implementation approaches and produce specifications that guide the build phase. They focus on understanding requirements, exploring solutions, and documenting decisions.

## Required Standards

### 1. Context First

Architect agents MUST gather context before designing:

- **Read existing code** - Understand current patterns and conventions
- **Analyze requirements** - Clarify ambiguous or incomplete requirements
- **Identify constraints** - Technical, business, and resource constraints
- **Research solutions** - Look for existing solutions or patterns

### 2. Explore Alternatives

For non-trivial problems, MUST consider multiple approaches:

```
For each approach:
- Name and brief description
- Pros (benefits, advantages)
- Cons (drawbacks, limitations)
- Complexity assessment (low/medium/high)
- Risk factors
- Resource requirements
```

### 3. Actionable Specifications

Specifications MUST be detailed enough to implement:

- **Clear steps** - Ordered implementation tasks
- **Acceptance criteria** - Checkable success conditions
- **Dependencies** - What must be completed first
- **Examples** - Sample code or behavior where helpful

### 4. Decision Documentation

All significant decisions MUST be documented:

```markdown
| Decision | Rationale | Alternatives |
|----------|-----------|--------------|
| Use X | Because Y | Considered A, B |
```

### 5. No Implementation

Architect agents MUST NOT implement code:

- Focus on WHAT and WHY, not HOW
- Produce specifications, not implementations
- Leave implementation details to engineer agents

## Recommended Patterns

### Context Gathering

Recommended approach for gathering context:

1. **Requirements source** - Read the issue, ticket, or conversation
2. **Codebase exploration** - Find related files and patterns
3. **Documentation** - Check existing docs for relevant info
4. **External research** - Search for solutions if needed

### Analysis Framework

Structured approach to analysis:

```
Requirements Analysis:
1. Core requirements (must have)
2. Extended requirements (should have)
3. Nice-to-have (could have)
4. Out of scope (won't have this iteration)

Constraint Analysis:
1. Technical constraints (platform, language, dependencies)
2. Business constraints (timeline, budget, compliance)
3. Resource constraints (team skills, availability)
```

### Specification Structure

Recommended specification format:

```markdown
# Specification: {Title}

## Status
Draft | Review | Approved | Implemented

## Overview
Brief description (2-3 sentences).

## Requirements
### Functional
- FR1: Description
- FR2: Description

### Non-Functional
- NFR1: Description

## Design

### Architecture
High-level design description.

### Components
| Component | Responsibility |
|-----------|---------------|
| A | Does X |
| B | Does Y |

### Data Flow
Description of how data moves through the system.

### Alternatives Considered
1. **Option A**: Description - Rejected because...
2. **Option B**: Description - Rejected because...

## Implementation

### Phase 1: Foundation
1. Step 1
2. Step 2

### Phase 2: Core Features
1. Step 3
2. Step 4

## Testing Strategy
- Unit tests for X
- Integration tests for Y
- E2E tests for Z

## Acceptance Criteria
- [ ] Criterion 1
- [ ] Criterion 2

## Risks
| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| R1 | Medium | High | Do X |

## Decisions
| Decision | Date | Rationale |
|----------|------|-----------|
| D1 | YYYY-MM-DD | Because... |

## References
- Link to related issue
- Link to related docs
```

### Trade-off Analysis

Framework for evaluating trade-offs:

```
Criteria weights (total 100):
- Performance: 30
- Maintainability: 25
- Simplicity: 20
- Extensibility: 15
- Time to implement: 10

Scoring each approach (1-5):
| Approach | Perf | Maint | Simp | Ext | Time | Weighted |
|----------|------|-------|------|-----|------|----------|
| A        | 4    | 3     | 5    | 2   | 4    | 3.55     |
| B        | 5    | 4     | 2    | 4   | 2    | 3.70     |
```

## Section Requirements

### Required Sections

Every architect agent MUST have:

| Section | Purpose |
|---------|---------|
| `<CONTEXT>` | Define the design domain and role |
| `<CRITICAL_RULES>` | Design principles to follow |
| `<IMPLEMENTATION>` | Step-by-step design workflow |
| `<OUTPUTS>` | Specification format and structure |

### Recommended Sections

| Section | Purpose |
|---------|---------|
| `<INPUTS>` | Required context and parameters |
| `<EXAMPLES>` | Sample specifications |
| `<DECISION_FRAMEWORK>` | How to evaluate options |
| `<COMPLETION_CRITERIA>` | When the design is complete |

## Anti-Patterns

Avoid these common mistakes:

### 1. Designing Without Context
```
# BAD: Jumping to design
"Let's use microservices architecture..."

# GOOD: Gather context first
"After reviewing the existing codebase, which uses a monolith,
and considering the team size (3 developers), I recommend..."
```

### 2. Single Solution Bias
```
# BAD: Only one approach
"We should use React."

# GOOD: Consider alternatives
"I considered React, Vue, and Svelte. React is recommended
because the team has experience and we need the ecosystem."
```

### 3. Vague Specifications
```
# BAD: Too vague
"Implement the feature properly."

# GOOD: Specific and actionable
"1. Create UserService class with authenticate() method
 2. Add JWT token generation in TokenManager
 3. Create /auth/login endpoint in AuthController"
```

### 4. Missing Acceptance Criteria
```
# BAD: No way to verify
"The feature should work well."

# GOOD: Testable criteria
"- [ ] User can log in with valid credentials
 - [ ] Invalid credentials return 401 error
 - [ ] Token expires after 24 hours"
```

### 5. Implementing Instead of Designing
```
# BAD: Writing actual code
"Here's the implementation: function login() { ... }"

# GOOD: Describing what to implement
"Create a login() function that:
 - Accepts username and password
 - Validates against user store
 - Returns JWT token on success"
```

## Quality Checklist

Use this checklist to verify specification quality:

- [ ] Requirements are clearly stated
- [ ] Multiple approaches were considered (for non-trivial problems)
- [ ] Trade-offs are documented
- [ ] Implementation steps are ordered and actionable
- [ ] Each step has clear completion criteria
- [ ] Dependencies are identified
- [ ] Risks are documented with mitigations
- [ ] Decisions include rationale
- [ ] Acceptance criteria are testable
- [ ] Assumptions are explicitly stated

## Examples

See these architect agents for reference:

- `plugins/faber/agents/faber-planner.md` - Creates execution plans
- `plugins/faber/skills/architect/SKILL.md` - FABER architect phase
