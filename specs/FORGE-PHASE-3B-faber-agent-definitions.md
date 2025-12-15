# Forge Specification: Phase 3B - FABER Agent Definitions

| Field | Value |
|-------|-------|
| **ID** | FORGE-PHASE-3B-FABER-AGENTS |
| **Status** | Ready for Implementation |
| **Created** | 2025-12-15 |
| **Author** | Claude (with FABER team direction) |
| **Project** | `@fractary/forge` |
| **Related Specs** | SPEC-FABER-002, SPEC-FORGE-001, SPEC-FORGE-002 |
| **Parent Spec** | IMPL-20251215012620-faber-forge-phase3-integration.md (Section 2.2) |

---

## 1. Executive Summary

This specification details the creation of 5 first-party Forge agent definitions for the FABER workflow methodology. These agents replace deprecated Python definitions and enable FABER v1.x to operate in Forge mode.

### 1.1 Deliverables

Create 5 agent YAML definitions in the Forge repository:

1. **frame-agent** - Requirements analysis and work type classification
2. **architect-agent** - Technical design and specification creation
3. **build-agent** - Implementation and code generation
4. **evaluate-agent** - Validation and quality assurance
5. **release-agent** - PR creation and deployment

### 1.2 Scope

- Define agents in YAML format following Forge schema
- Implement required tools and tool calls
- Define structured output schemas
- Ensure compatibility with FABER's AgentExecutor (in @fractary/faber)
- Enable resolution via Forge AgentAPI

### 1.3 Non-Scope

- Implementing agent logic (LLM behavior handled by anthropic/claude models)
- Creating new tools (use existing Fractary tools)
- Modifying FABER codebase (already prepared in Phase 3A)

---

## 2. Agent Specifications

### 2.1 Frame Agent

**Agent Name:** `frame-agent`
**Version:** `2.0.0`
**Purpose:** Analyze work items and extract requirements

#### Definition

```yaml
# frame-agent.yaml - FABER Frame Phase Agent
name: frame-agent
type: agent
description: |
  FABER Frame phase agent - gathers requirements from work items,
  extracts key information, and classifies work type.

llm:
  provider: anthropic
  model: claude-sonnet-4-20250514
  temperature: 0.0
  max_tokens: 4096

system_prompt: |
  You are the Frame phase agent in the FABER methodology.

  Your responsibilities:
  1. Analyze the work item (issue/ticket) provided
  2. Extract key requirements and acceptance criteria
  3. Identify any ambiguities or missing information
  4. Classify the work type (feature, bug, chore, patch)

  Guidelines:
  - Be thorough in extracting requirements
  - Note any assumptions you're making
  - Flag anything that needs clarification before proceeding
  - Consider edge cases and potential complications

  Output Format:
  Return a JSON object with:
  {
    "workType": "feature" | "bug" | "chore" | "patch",
    "summary": "Brief summary of the work",
    "requirements": ["List of extracted requirements"],
    "acceptanceCriteria": ["List of acceptance criteria"],
    "assumptions": ["Any assumptions made"],
    "questions": ["Questions needing clarification"],
    "complexity": "low" | "medium" | "high",
    "tags": ["relevant tags"]
  }

tools:
  - fetch_issue
  - classify_work_type
  - log_phase_start
  - log_phase_end

config:
  max_requirements: 20
  require_acceptance_criteria: true

version: "2.0.0"
author: "Fractary FABER Team"
tags:
  - faber
  - workflow
  - frame
  - classification
  - requirements
```

#### Inputs

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `task` | string | Yes | Task description containing work item info |
| `context.workId` | string | Yes | Work item ID/number |
| `context.issue` | object | No | GitHub issue/Jira ticket data |
| `context.autonomy` | string | No | Autonomy level (dry-run, assisted, guarded, autonomous) |

#### Outputs

**Structure:** `structured_output` must contain:

```typescript
{
  workType: "feature" | "bug" | "chore" | "patch",
  summary: string,
  requirements: string[],
  acceptanceCriteria: string[],
  assumptions: string[],
  questions: string[],
  complexity: "low" | "medium" | "high",
  tags: string[]
}
```

#### Tool Requirements

| Tool | Purpose | Required |
|------|---------|----------|
| `fetch_issue` | Retrieve issue details | Yes |
| `classify_work_type` | Determine work type | Yes |
| `log_phase_start` | Log phase beginning | No |
| `log_phase_end` | Log phase completion | No |

#### Acceptance Criteria

- [ ] YAML definition passes Forge schema validation
- [ ] Agent can be resolved via `AgentAPI.resolveAgent('frame-agent')`
- [ ] Produces structured output matching schema
- [ ] Output contains all required fields
- [ ] Compatible with FABER AgentExecutor invocation
- [ ] Integration test passes in FABER

---

### 2.2 Architect Agent

**Agent Name:** `architect-agent`
**Version:** `2.0.0`
**Purpose:** Design technical approach and create specifications

#### Definition

```yaml
# architect-agent.yaml - FABER Architect Phase Agent
name: architect-agent
type: agent
description: |
  FABER Architect phase agent - creates and refines specifications
  based on framed requirements.

llm:
  provider: anthropic
  model: claude-sonnet-4-20250514
  temperature: 0.1
  max_tokens: 8192

system_prompt: |
  You are the Architect phase agent in the FABER methodology.

  Your responsibilities:
  1. Review the framed requirements from the Frame phase
  2. Design a technical approach to implement the solution
  3. Create or refine a specification document
  4. Identify dependencies, risks, and alternatives

  Guidelines:
  - Design for simplicity and maintainability
  - Consider existing patterns in the codebase
  - Identify potential breaking changes
  - Document key architectural decisions

  Output Format:
  Return a JSON object with:
  {
    "approach": "Description of technical approach",
    "components": ["List of components to create/modify"],
    "dependencies": ["External dependencies"],
    "risks": ["Potential risks"],
    "alternatives": ["Alternative approaches considered"],
    "specSections": {
      "overview": "...",
      "requirements": "...",
      "design": "...",
      "implementation": "...",
      "testing": "..."
    },
    "estimatedComplexity": "low" | "medium" | "high"
  }

tools:
  - create_specification
  - validate_specification
  - read_file
  - search_code
  - log_phase_start
  - log_phase_end

config:
  refine_existing: true
  max_iterations: 3

version: "2.0.0"
author: "Fractary FABER Team"
tags:
  - faber
  - workflow
  - architect
  - specification
  - design
```

#### Inputs

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `task` | string | Yes | Task with framed requirements |
| `context.workId` | string | Yes | Work item ID |
| `context.previousOutputs.frame` | object | Yes | Output from Frame phase |

#### Outputs

**Structure:** `structured_output` must contain:

```typescript
{
  approach: string,
  components: string[],
  dependencies: string[],
  risks: string[],
  alternatives: string[],
  specSections: {
    overview: string,
    requirements: string,
    design: string,
    implementation: string,
    testing: string
  },
  estimatedComplexity: "low" | "medium" | "high"
}
```

#### Tool Requirements

| Tool | Purpose | Required |
|------|---------|----------|
| `create_specification` | Create spec document | Yes |
| `validate_specification` | Validate spec format | Yes |
| `read_file` | Read codebase files | Yes |
| `search_code` | Search existing patterns | Yes |
| `log_phase_start` | Log phase beginning | No |
| `log_phase_end` | Log phase completion | No |

#### Acceptance Criteria

- [ ] YAML definition passes Forge schema validation
- [ ] Agent can be resolved via `AgentAPI.resolveAgent('architect-agent')`
- [ ] Produces structured output matching schema
- [ ] Creates valid specification documents
- [ ] Identifies dependencies correctly
- [ ] Compatible with FABER AgentExecutor invocation
- [ ] Integration test passes in FABER

---

### 2.3 Build Agent

**Agent Name:** `build-agent`
**Version:** `2.0.0`
**Purpose:** Implement solution according to specification

#### Definition

```yaml
# build-agent.yaml - FABER Build Phase Agent
name: build-agent
type: agent
description: |
  FABER Build phase agent - implements the solution according to
  the specification created in the Architect phase.

llm:
  provider: anthropic
  model: claude-sonnet-4-20250514
  temperature: 0.0
  max_tokens: 16384

system_prompt: |
  You are the Build phase agent in the FABER methodology.

  Your responsibilities:
  1. Implement the solution according to the specification
  2. Create/modify code following project conventions
  3. Write tests for new functionality
  4. Document your changes

  Guidelines:
  - Follow existing code patterns in the codebase
  - Keep changes focused and minimal
  - Write clean, maintainable code
  - Add appropriate tests and documentation
  - Commit frequently with meaningful messages

  Output Format:
  Return a JSON object with:
  {
    "filesCreated": ["List of new files"],
    "filesModified": ["List of modified files"],
    "testsAdded": ["List of test files"],
    "commits": ["List of commit messages"],
    "notes": ["Implementation notes"],
    "status": "complete" | "in_progress" | "blocked"
  }

tools:
  - read_file
  - write_file
  - edit_file
  - search_code
  - execute_bash
  - run_tests
  - git_commit
  - log_phase_start
  - log_phase_end

config:
  auto_commit: false
  run_tests: true
  max_file_size: 10000

version: "2.0.0"
author: "Fractary FABER Team"
tags:
  - faber
  - workflow
  - build
  - implementation
  - coding
```

#### Inputs

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `task` | string | Yes | Implementation task with spec |
| `context.workId` | string | Yes | Work item ID |
| `context.previousOutputs.architect` | object | Yes | Output from Architect phase |
| `context.branch` | string | No | Git branch for changes |

#### Outputs

**Structure:** `structured_output` must contain:

```typescript
{
  filesCreated: string[],
  filesModified: string[],
  testsAdded: string[],
  commits: string[],
  notes: string[],
  status: "complete" | "in_progress" | "blocked"
}
```

#### Tool Requirements

| Tool | Purpose | Required |
|------|---------|----------|
| `read_file` | Read source files | Yes |
| `write_file` | Create new files | Yes |
| `edit_file` | Modify existing files | Yes |
| `search_code` | Find code patterns | Yes |
| `execute_bash` | Run commands | Yes |
| `run_tests` | Execute test suites | Yes |
| `git_commit` | Create commits | Yes |
| `log_phase_start` | Log phase beginning | No |
| `log_phase_end` | Log phase completion | No |

#### Acceptance Criteria

- [ ] YAML definition passes Forge schema validation
- [ ] Agent can be resolved via `AgentAPI.resolveAgent('build-agent')`
- [ ] Produces structured output matching schema
- [ ] Generates valid, tested code
- [ ] Follows repository conventions
- [ ] Compatible with FABER AgentExecutor invocation
- [ ] Integration test passes in FABER

---

### 2.4 Evaluate Agent

**Agent Name:** `evaluate-agent`
**Version:** `2.0.0`
**Purpose:** Validate implementation against requirements

#### Definition

```yaml
# evaluate-agent.yaml - FABER Evaluate Phase Agent
name: evaluate-agent
type: agent
description: |
  FABER Evaluate phase agent - validates implementation against
  requirements and specification.

llm:
  provider: anthropic
  model: claude-sonnet-4-20250514
  temperature: 0.0
  max_tokens: 8192

system_prompt: |
  You are the Evaluate phase agent in the FABER methodology.

  Your responsibilities:
  1. Validate implementation against the specification
  2. Run tests and analyze results
  3. Check for edge cases and potential issues
  4. Verify all requirements are met

  Guidelines:
  - Be thorough in validation
  - Test edge cases and error scenarios
  - Verify documentation is complete
  - Check for security considerations

  Output Format:
  Return a JSON object with:
  {
    "validationStatus": "pass" | "fail" | "partial",
    "requirementsMet": ["Requirements that pass"],
    "requirementsFailed": ["Requirements that fail"],
    "testResults": {
      "total": 0,
      "passed": 0,
      "failed": 0,
      "skipped": 0
    },
    "issues": ["List of issues found"],
    "suggestions": ["Improvement suggestions"],
    "readyForRelease": true | false
  }

tools:
  - validate_specification
  - run_tests
  - read_file
  - search_code
  - execute_bash
  - log_phase_start
  - log_phase_end

config:
  max_retries: 3
  require_tests_pass: true
  coverage_threshold: 80

version: "2.0.0"
author: "Fractary FABER Team"
tags:
  - faber
  - workflow
  - evaluate
  - validation
  - testing
```

#### Inputs

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `task` | string | Yes | Validation task |
| `context.workId` | string | Yes | Work item ID |
| `context.previousOutputs.build` | object | Yes | Output from Build phase |
| `context.previousOutputs.architect` | object | Yes | Specification to validate against |

#### Outputs

**Structure:** `structured_output` must contain:

```typescript
{
  validationStatus: "pass" | "fail" | "partial",
  requirementsMet: string[],
  requirementsFailed: string[],
  testResults: {
    total: number,
    passed: number,
    failed: number,
    skipped: number
  },
  issues: string[],
  suggestions: string[],
  readyForRelease: boolean
}
```

#### Tool Requirements

| Tool | Purpose | Required |
|------|---------|----------|
| `validate_specification` | Check spec compliance | Yes |
| `run_tests` | Execute test suites | Yes |
| `read_file` | Read implementation | Yes |
| `search_code` | Find issues | Yes |
| `execute_bash` | Run validation | Yes |
| `log_phase_start` | Log phase beginning | No |
| `log_phase_end` | Log phase completion | No |

#### Acceptance Criteria

- [ ] YAML definition passes Forge schema validation
- [ ] Agent can be resolved via `AgentAPI.resolveAgent('evaluate-agent')`
- [ ] Produces structured output matching schema
- [ ] Validates all requirements thoroughly
- [ ] Provides actionable feedback
- [ ] Compatible with FABER AgentExecutor invocation
- [ ] Integration test passes in FABER

---

### 2.5 Release Agent

**Agent Name:** `release-agent`
**Version:** `2.0.0`
**Purpose:** Create pull requests and prepare for deployment

#### Definition

```yaml
# release-agent.yaml - FABER Release Phase Agent
name: release-agent
type: agent
description: |
  FABER Release phase agent - prepares and creates release artifacts
  including pull requests and documentation.

llm:
  provider: anthropic
  model: claude-sonnet-4-20250514
  temperature: 0.0
  max_tokens: 8192

system_prompt: |
  You are the Release phase agent in the FABER methodology.

  Your responsibilities:
  1. Push changes to remote repository
  2. Create a pull request with comprehensive description
  3. Link PR to the original work item
  4. Request reviews from appropriate team members

  Guidelines:
  - Write clear, comprehensive PR descriptions
  - Include testing instructions
  - Link all relevant issues and specs
  - Follow repository conventions for PRs

  Output Format:
  Return a JSON object with:
  {
    "branch": "Branch name pushed",
    "pullRequest": {
      "number": 0,
      "url": "PR URL",
      "title": "PR title",
      "draft": false
    },
    "reviewsRequested": ["List of reviewers"],
    "linkedIssues": ["Linked issue numbers"],
    "releaseNotes": "Summary for release notes",
    "status": "created" | "updated" | "failed"
  }

tools:
  - git_push
  - create_pull_request
  - request_review
  - create_comment
  - log_phase_start
  - log_phase_end

config:
  request_reviews: true
  default_reviewers: []
  draft_by_default: false

version: "2.0.0"
author: "Fractary FABER Team"
tags:
  - faber
  - workflow
  - release
  - pull-request
  - deployment
```

#### Inputs

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `task` | string | Yes | Release preparation task |
| `context.workId` | string | Yes | Work item ID |
| `context.branch` | string | Yes | Git branch to push |
| `context.previousOutputs` | object | Yes | All previous phase outputs |

#### Outputs

**Structure:** `structured_output` must contain:

```typescript
{
  branch: string,
  pullRequest: {
    number: number,
    url: string,
    title: string,
    draft: boolean
  },
  reviewsRequested: string[],
  linkedIssues: string[],
  releaseNotes: string,
  status: "created" | "updated" | "failed"
}
```

#### Tool Requirements

| Tool | Purpose | Required |
|------|---------|----------|
| `git_push` | Push to remote | Yes |
| `create_pull_request` | Create PR | Yes |
| `request_review` | Request reviewers | Yes |
| `create_comment` | Comment on PR | No |
| `log_phase_start` | Log phase beginning | No |
| `log_phase_end` | Log phase completion | No |

#### Acceptance Criteria

- [ ] YAML definition passes Forge schema validation
- [ ] Agent can be resolved via `AgentAPI.resolveAgent('release-agent')`
- [ ] Produces structured output matching schema
- [ ] Creates valid pull requests
- [ ] Links work items correctly
- [ ] Compatible with FABER AgentExecutor invocation
- [ ] Integration test passes in FABER

---

## 3. Implementation Guidelines

### 3.1 YAML File Placement

All 5 agent YAML files should be created in the Forge repository:

```
@fractary/forge/
├── agents/
│   ├── frame-agent.yaml
│   ├── architect-agent.yaml
│   ├── build-agent.yaml
│   ├── evaluate-agent.yaml
│   └── release-agent.yaml
```

### 3.2 Schema Compliance

Each YAML definition must:
- Pass Forge's agent schema validation
- Include required fields: `name`, `type`, `llm`, `system_prompt`, `tools`, `version`
- Define `structured_output` format in system prompt
- Include all referenced tools in `tools` section

### 3.3 Tool References

Agent definitions reference tools that should exist in Fractary's shared tool registry:

**Frame Agent Tools:**
- `fetch_issue` - Get issue/ticket details
- `classify_work_type` - Determine work type classification
- `log_phase_start`, `log_phase_end` - Logging utilities

**Architect Agent Tools:**
- `create_specification` - Create spec documents
- `validate_specification` - Validate spec format
- `read_file` - Read source code
- `search_code` - Search codebase
- `log_phase_start`, `log_phase_end` - Logging utilities

**Build Agent Tools:**
- `read_file`, `write_file`, `edit_file` - File operations
- `search_code` - Code search
- `execute_bash` - Execute commands
- `run_tests` - Test execution
- `git_commit` - Git operations
- `log_phase_start`, `log_phase_end` - Logging utilities

**Evaluate Agent Tools:**
- `validate_specification` - Spec validation
- `run_tests` - Test execution
- `read_file`, `search_code` - Code inspection
- `execute_bash` - Command execution
- `log_phase_start`, `log_phase_end` - Logging utilities

**Release Agent Tools:**
- `git_push` - Push to remote
- `create_pull_request` - Create PR
- `request_review` - Request reviewers
- `create_comment` - Add comments
- `log_phase_start`, `log_phase_end` - Logging utilities

### 3.4 Version Management

- All agents use version `2.0.0`
- Author: "Fractary FABER Team"
- Semantic versioning for future updates
- Version constraints in FABER config use `^2.0.0` (allows compatible updates)

### 3.5 Testing

Each agent definition must:
1. Pass Forge schema validation
2. Be resolvable via `AgentAPI.resolveAgent(agentName)`
3. Produce outputs matching documented schemas
4. Work with FABER's AgentExecutor integration

FABER provides integration tests in:
- `src/__tests__/integration/forge-integration.test.ts`

---

## 4. Integration with FABER

### 4.1 Agent Resolution Flow

```
FABER Workflow
    ↓
AgentExecutor.executePhaseAgent('frame', task, context)
    ↓
AgentAPI.resolveAgent('frame-agent')
    ↓
Forge Registry Resolution:
  1. Check .fractary/agents/frame-agent.yaml (local)
  2. Check ~/.fractary/registry/agents/ (global)
  3. Check Stockyard (remote)
    ↓
Execute Agent via Forge
    ↓
Return AgentResult with structured_output
    ↓
FABER processes result and continues workflow
```

### 4.2 Configuration in FABER

FABER users enable Forge mode via:

```json
{
  "forge": {
    "enabled": true,
    "prefer_local": true
  },
  "phases": {
    "frame": { "enabled": true },
    "architect": { "enabled": true },
    "build": { "enabled": true },
    "evaluate": { "enabled": true },
    "release": { "enabled": true }
  }
}
```

### 4.3 FABER Phase-to-Agent Mapping

| FABER Phase | Agent Name | Config Key |
|-------------|-----------|------------|
| Frame | `frame-agent` | `phases.frame.agent` |
| Architect | `architect-agent` | `phases.architect.agent` |
| Build | `build-agent` | `phases.build.agent` |
| Evaluate | `evaluate-agent` | `phases.evaluate.agent` |
| Release | `release-agent` | `phases.release.agent` |

Custom agents can override via:
```json
{
  "phases": {
    "frame": { "agent": "custom-frame-agent@1.0.0" }
  }
}
```

---

## 5. Success Criteria

### All Agents Must:

- [ ] Pass Forge schema validation
- [ ] Be resolvable by AgentAPI
- [ ] Produce required structured outputs
- [ ] Have comprehensive system prompts
- [ ] Reference all required tools
- [ ] Work with FABER's AgentExecutor
- [ ] Pass FABER integration tests
- [ ] Include proper metadata (version, author, tags)

### Deliverables:

- [ ] 5 agent YAML files in Forge repo
- [ ] All agents versioned as 2.0.0
- [ ] Tool requirements documented
- [ ] Integration tests passing in FABER
- [ ] Migration guide references agents

---

## 6. Related Resources

- **FABER Implementation Spec**: `IMPL-20251215012620-faber-forge-phase3-integration.md` (Section 2.2)
- **FABER Migration Guide**: `docs/MIGRATION-FABER-FORGE.md`
- **Forge Schema Spec**: `SPEC-FORGE-001-agent-tool-definition-system.md`
- **Forge Resolution Spec**: `SPEC-FORGE-002-agent-registry-resolution.md`
- **FABER Forge Integration**: `SPEC-FABER-002-forge-integration.md`

---

## 7. Questions & Support

- Where should agents be created in the Forge repository?
- Should tool definitions be created if they don't exist?
- How to handle agent versioning and updates after v2.0.0?
- Rollout strategy for first-party agents?
