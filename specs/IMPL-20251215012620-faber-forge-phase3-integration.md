# Implementation Spec: FABER-Forge Phase 3 Integration

| Field | Value |
|-------|-------|
| **ID** | IMPL-20251215012620 |
| **Status** | Ready for Implementation |
| **Created** | 2025-12-15 |
| **Author** | Claude (with human direction) |
| **Project** | `@fractary/faber` |
| **Related Specs** | SPEC-FABER-002, SPEC-FORGE-001, SPEC-FORGE-002, MIGRATION-SUMMARY |
| **Phase** | Phase 3: Migration |

---

## 1. Executive Summary

This implementation specification details the concrete steps to integrate `@fractary/forge` into `@fractary/faber`, deprecate legacy Python agent/tool definitions, and migrate built-in FABER agents to YAML definitions managed by Forge.

### 1.1 Objectives

1. **Integrate Forge AgentAPI** into FABER's TypeScript workflow engine
2. **Deprecate Python definitions** (`/python/faber/definitions/` and `/python/faber/agents/`)
3. **Convert 5 built-in agents** from Python to YAML definitions
4. **Enable dual-mode support** for gradual migration
5. **Remove legacy code** in preparation for v2.0

### 1.2 Current State

| Component | Status | Location |
|-----------|--------|----------|
| `@fractary/forge` dependency | ✅ Installed | `package.json` v1.1.1 |
| Forge AgentAPI | ✅ Implemented | `@fractary/forge/definitions` |
| Forge ToolAPI | ✅ Implemented | `@fractary/forge/definitions` |
| FABER workflow engine | ⚠️ No Forge integration | `/src/workflow/faber.ts` |
| Python definitions | ❌ Needs deprecation | `/python/faber/definitions/` |
| Python agents | ❌ Needs conversion | `/python/faber/agents/` |

---

## 2. Implementation Tasks

### 2.1 Phase 3A: Forge Integration (Week 1-2)

#### Task 1: Create AgentExecutor Class

**File:** `/src/workflow/agent-executor.ts`

**Purpose:** Bridge between FABER workflow and Forge's AgentAPI

```typescript
/**
 * @fractary/faber - Agent Executor
 *
 * Bridges FABER workflow with Forge's AgentAPI for agent resolution and execution.
 */

import { AgentAPI, ExecutableAgentInterface, AgentResult } from '@fractary/forge';
import { PhaseContext } from './types';
import { WorkflowError } from '../errors';

export interface ForgeConfig {
  enabled: boolean;
  prefer_local: boolean;
}

export interface AgentExecutorConfig {
  forge?: ForgeConfig;
}

/**
 * Maps FABER phases to Forge agent names
 */
const PHASE_AGENT_MAP: Record<string, string> = {
  frame: 'frame-agent',
  architect: 'architect-agent',
  build: 'build-agent',
  evaluate: 'evaluate-agent',
  release: 'release-agent',
};

export class AgentExecutor {
  private forge?: AgentAPI;
  private useLegacy: boolean;
  private agentCache: Map<string, ExecutableAgentInterface> = new Map();

  constructor(config?: AgentExecutorConfig) {
    this.useLegacy = !config?.forge?.enabled;

    if (!this.useLegacy) {
      this.forge = new AgentAPI(config?.forge);
    }
  }

  /**
   * Get agent name for a FABER phase
   */
  getAgentNameForPhase(phaseName: string): string {
    return PHASE_AGENT_MAP[phaseName] || `${phaseName}-agent`;
  }

  /**
   * Check if using Forge mode
   */
  isForgeEnabled(): boolean {
    return !this.useLegacy;
  }

  /**
   * Execute a phase agent
   */
  async executePhaseAgent(
    phaseName: string,
    task: string,
    context: PhaseContext
  ): Promise<AgentResult> {
    if (this.useLegacy) {
      return this.executeLegacyPhase(phaseName, task, context);
    }

    return this.executeForgeAgent(phaseName, task, context);
  }

  /**
   * Execute using Forge agent
   */
  private async executeForgeAgent(
    phaseName: string,
    task: string,
    context: PhaseContext
  ): Promise<AgentResult> {
    const agentName = this.getAgentNameForPhase(phaseName);

    try {
      // Check cache first
      let agent = this.agentCache.get(agentName);

      if (!agent) {
        // Resolve agent from Forge
        agent = await this.forge!.resolveAgent(agentName);
        this.agentCache.set(agentName, agent);
      }

      // Invoke agent with task and context
      return await agent.invoke(task, {
        workflowId: context.workflowId,
        workId: context.workId,
        phase: context.phase,
        autonomy: context.autonomy,
        issue: context.issue,
        spec: context.spec,
        branch: context.branch,
        previousOutputs: context.previousOutputs,
      });
    } catch (error) {
      if (error instanceof Error && error.name === 'AgentNotFoundError') {
        throw new WorkflowError(
          `Agent '${agentName}' not found. ` +
          `Run 'forge install ${agentName}' or check your .fractary/agents/ directory.`,
          { phase: phaseName, agent: agentName }
        );
      }
      throw error;
    }
  }

  /**
   * Execute using legacy hardcoded logic (fallback)
   */
  private async executeLegacyPhase(
    phaseName: string,
    task: string,
    context: PhaseContext
  ): Promise<AgentResult> {
    // Return structured result matching Forge format
    // This preserves backward compatibility during migration
    return {
      output: `Legacy phase execution: ${phaseName}`,
      messages: [],
      metadata: {
        legacy: true,
        phase: phaseName,
      },
    };
  }

  /**
   * Clear agent cache
   */
  clearCache(): void {
    this.agentCache.clear();
  }

  /**
   * Health check for all phase agents
   */
  async healthCheck(): Promise<{
    healthy: boolean;
    phases: Record<string, { healthy: boolean; error?: string }>;
  }> {
    if (this.useLegacy) {
      return { healthy: true, phases: {} };
    }

    const phases = Object.keys(PHASE_AGENT_MAP);
    const results: Record<string, { healthy: boolean; error?: string }> = {};
    let allHealthy = true;

    for (const phase of phases) {
      const agentName = PHASE_AGENT_MAP[phase];
      try {
        const check = await this.forge!.healthCheck(agentName);
        results[phase] = { healthy: check.healthy };
        if (!check.healthy) allHealthy = false;
      } catch (error) {
        results[phase] = {
          healthy: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        };
        allHealthy = false;
      }
    }

    return { healthy: allHealthy, phases: results };
  }
}
```

**Acceptance Criteria:**
- [ ] AgentExecutor class created
- [ ] Forge mode resolves agents correctly
- [ ] Legacy mode fallback works
- [ ] Agent caching implemented
- [ ] Health check method works
- [ ] Unit tests pass

---

#### Task 2: Update WorkflowConfig Types

**File:** `/src/types.ts`

**Changes to add:**

```typescript
/**
 * Forge configuration for workflow
 */
export interface ForgeWorkflowConfig {
  /** Enable Forge agent resolution (default: true in v2.0) */
  enabled: boolean;
  /** Prefer project-local agents over global (default: true) */
  prefer_local: boolean;
}

/**
 * Phase configuration with optional agent override
 */
export interface PhaseConfig {
  enabled: boolean;
  /** Override default agent for this phase (e.g., "my-custom-frame-agent@1.0.0") */
  agent?: string;
  // ... existing phase-specific options
}

export interface WorkflowConfig {
  autonomy: AutonomyLevel;
  phases: {
    frame: PhaseConfig & { /* existing */ };
    architect: PhaseConfig & { refineSpec: boolean };
    build: PhaseConfig & { /* existing */ };
    evaluate: PhaseConfig & { maxRetries: number };
    release: PhaseConfig & { requestReviews: boolean; reviewers: string[] };
  };
  hooks?: WorkflowHooks;
  /** Forge integration configuration */
  forge?: ForgeWorkflowConfig;
}
```

**Acceptance Criteria:**
- [ ] ForgeWorkflowConfig type defined
- [ ] PhaseConfig updated with agent override
- [ ] WorkflowConfig updated with forge property
- [ ] Types exported from index.ts
- [ ] TypeScript compilation passes

---

#### Task 3: Integrate AgentExecutor into FaberWorkflow

**File:** `/src/workflow/faber.ts`

**Changes:**

```typescript
// Add import
import { AgentExecutor, AgentExecutorConfig } from './agent-executor';

// Update defaultConfig
const defaultConfig: WorkflowConfig = {
  autonomy: 'assisted',
  phases: {
    frame: { enabled: true },
    architect: { enabled: true, refineSpec: true },
    build: { enabled: true },
    evaluate: { enabled: true, maxRetries: 3 },
    release: { enabled: true, requestReviews: true, reviewers: [] },
  },
  // NEW: Enable Forge by default
  forge: {
    enabled: true,
    prefer_local: true,
  },
};

export class FaberWorkflow {
  // Add new property
  private agentExecutor: AgentExecutor;

  constructor(options?: { config?: Partial<WorkflowConfig> }) {
    // ... existing initialization

    // Initialize AgentExecutor
    this.agentExecutor = new AgentExecutor({
      forge: this.config.forge,
    });
  }

  // Update runPhase to use AgentExecutor when Forge is enabled
  private async runPhase(phase: FaberPhase, context: PhaseContext): Promise<PhaseHandlerResult> {
    // Check if Forge mode is enabled
    if (this.agentExecutor.isForgeEnabled()) {
      return this.runPhaseWithForge(phase, context);
    }

    // Legacy mode - use hardcoded logic
    switch (phase) {
      case 'frame':
        return this.runFramePhase(context);
      // ... other phases
    }
  }

  /**
   * Run phase using Forge agent
   */
  private async runPhaseWithForge(
    phase: FaberPhase,
    context: PhaseContext
  ): Promise<PhaseHandlerResult> {
    // Get custom agent name if specified in phase config
    const phaseConfig = this.config.phases[phase];
    const customAgent = phaseConfig?.agent;

    // Build task description based on phase
    const task = this.buildPhaseTask(phase, context);

    try {
      const result = await this.agentExecutor.executePhaseAgent(
        customAgent || phase,  // Use custom agent or phase name
        task,
        context
      );

      // Convert Forge result to FABER result
      return {
        status: 'completed',
        outputs: {
          agentOutput: result.output,
          structured: result.structured_output,
          usage: result.usage,
          ...this.extractPhaseOutputs(phase, result),
        },
      };
    } catch (error) {
      return {
        status: 'failed',
        error: error instanceof Error ? error.message : 'Agent execution failed',
      };
    }
  }

  /**
   * Build task description for phase agent
   */
  private buildPhaseTask(phase: FaberPhase, context: PhaseContext): string {
    switch (phase) {
      case 'frame':
        return `Analyze and frame the requirements for work item ${context.workId}. ` +
          `Issue: ${JSON.stringify(context.issue)}`;
      case 'architect':
        return `Create or refine the specification for work item ${context.workId}. ` +
          `Previous frame output: ${JSON.stringify(context.previousOutputs.frame)}`;
      case 'build':
        return `Implement the solution for work item ${context.workId}. ` +
          `Spec: ${JSON.stringify(context.previousOutputs.architect)}`;
      case 'evaluate':
        return `Validate the implementation against requirements for ${context.workId}. ` +
          `Build output: ${JSON.stringify(context.previousOutputs.build)}`;
      case 'release':
        return `Prepare release artifacts for work item ${context.workId}. ` +
          `Evaluation: ${JSON.stringify(context.previousOutputs.evaluate)}`;
      default:
        return `Execute ${phase} phase for work item ${context.workId}`;
    }
  }

  /**
   * Extract phase-specific outputs from agent result
   */
  private extractPhaseOutputs(
    phase: FaberPhase,
    result: AgentResult
  ): Record<string, unknown> {
    // Parse structured output or extract from text
    if (result.structured_output) {
      return result.structured_output;
    }

    // Default extraction based on phase
    return {};
  }
}
```

**Acceptance Criteria:**
- [ ] AgentExecutor integrated into FaberWorkflow
- [ ] Forge mode uses agent execution
- [ ] Legacy mode preserved for backward compatibility
- [ ] Phase tasks properly formatted
- [ ] Agent results converted to FABER format
- [ ] Integration tests pass

---

#### Task 4: Export AgentExecutor from Workflow Module

**File:** `/src/workflow/index.ts`

**Update:**

```typescript
/**
 * @fractary/faber - Workflow Module
 */

export { FaberWorkflow } from './faber';
export { AgentExecutor } from './agent-executor';
export type { AgentExecutorConfig, ForgeConfig } from './agent-executor';
export * from './types';
```

**Acceptance Criteria:**
- [ ] AgentExecutor exported
- [ ] Types exported
- [ ] No breaking changes to existing exports

---

### 2.2 Phase 3B: Agent Conversion (Week 2-3)

#### Task 5: Convert Frame Agent to YAML

**Source:** `/python/faber/agents/frame.py`
**Target:** `.fractary/agents/frame-agent.yaml` (in Forge first-party package)

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

**Acceptance Criteria:**
- [ ] YAML definition valid
- [ ] Passes Forge schema validation
- [ ] Can be resolved by AgentAPI
- [ ] Produces expected output format
- [ ] Integration test passes

---

#### Task 6: Convert Architect Agent to YAML

**Target:** `.fractary/agents/architect-agent.yaml`

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

---

#### Task 7: Convert Build Agent to YAML

**Target:** `.fractary/agents/build-agent.yaml`

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

---

#### Task 8: Convert Evaluate Agent to YAML

**Target:** `.fractary/agents/evaluate-agent.yaml`

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

---

#### Task 9: Convert Release Agent to YAML

**Target:** `.fractary/agents/release-agent.yaml`

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

**Acceptance Criteria for All Agent Conversions:**
- [ ] All 5 agents converted to YAML
- [ ] All YAML files pass Forge validation
- [ ] All agents can be resolved by AgentAPI
- [ ] Integration tests pass for all phases
- [ ] Output formats documented

---

### 2.3 Phase 3C: Deprecation (Week 3-4)

#### Task 10: Add Deprecation Warnings to Python Code

**File:** `/python/faber/definitions/__init__.py`

```python
"""
FABER Definition System - DEPRECATED

WARNING: This module is deprecated and will be removed in FABER v2.0.
Agent and tool definitions are now managed by @fractary/forge.

Migration Guide:
- Agent definitions: Use YAML format in .fractary/agents/
- Tool definitions: Use YAML format in .fractary/tools/
- Resolution: Use @fractary/forge AgentAPI and ToolAPI

See: https://github.com/fractary/faber/docs/MIGRATION.md
"""

import warnings

warnings.warn(
    "faber.definitions is deprecated and will be removed in v2.0. "
    "Agent and tool definitions are now managed by @fractary/forge. "
    "See migration guide: https://github.com/fractary/faber/docs/MIGRATION.md",
    DeprecationWarning,
    stacklevel=2
)

# Existing exports (for backward compatibility during migration)
from .schemas import AgentDefinition, ToolDefinition
from .api import AgentAPI, ToolAPI
from .registry import DefinitionRegistry
from .agent_factory import AgentFactory
from .tool_executor import ToolExecutor
from .converters import LangChainConverter
```

**File:** `/python/faber/agents/__init__.py`

```python
"""
FABER Built-in Agents - DEPRECATED

WARNING: These agents are deprecated and will be removed in FABER v2.0.
Built-in agents are now first-party Forge packages.

Migration:
1. Run: forge install frame-agent architect-agent build-agent evaluate-agent release-agent
2. Update workflow config to use forge.enabled: true
3. Remove references to faber.agents

See: https://github.com/fractary/faber/docs/MIGRATION.md
"""

import warnings

warnings.warn(
    "faber.agents is deprecated and will be removed in v2.0. "
    "Built-in agents are now managed by @fractary/forge. "
    "Run 'forge install frame-agent' to migrate.",
    DeprecationWarning,
    stacklevel=2
)

# Existing exports (for backward compatibility)
from .base import BaseAgent
from .frame import FrameAgent
from .architect import ArchitectAgent
from .build import BuildAgent
from .evaluate import EvaluateAgent
from .release import ReleaseAgent
```

**Acceptance Criteria:**
- [ ] Deprecation warnings added to all Python modules
- [ ] Warnings include migration instructions
- [ ] Existing code still works (backward compatible)
- [ ] Warnings appear when modules are imported

---

#### Task 11: Create Migration Guide

**File:** `/docs/MIGRATION-FABER-FORGE.md`

Create comprehensive migration documentation covering:
1. What's changing and why
2. Step-by-step migration instructions
3. Configuration changes needed
4. FAQ and troubleshooting

**Acceptance Criteria:**
- [ ] Migration guide created
- [ ] All changes documented
- [ ] Examples provided
- [ ] FAQ section included

---

#### Task 12: Update README with Deprecation Notice

**File:** `/README.md`

Add prominent deprecation notice about Python definitions moving to Forge.

**Acceptance Criteria:**
- [ ] README updated
- [ ] Deprecation notice visible
- [ ] Links to migration guide

---

### 2.4 Phase 3D: Cleanup (Week 4+)

#### Task 13: Remove Python Definitions (Post-Migration)

**IMPORTANT:** Only execute after:
- All agents converted and tested
- Forge integration fully tested
- Major version bump approved

**Files to Remove:**
```
python/faber/definitions/
├── __init__.py
├── schemas.py
├── api.py
├── registry.py
├── agent_factory.py
├── tool_executor.py
├── converters.py
└── README.md

python/faber/agents/
├── frame.py
├── architect.py
├── build.py
├── evaluate.py
├── release.py
└── base.py (keep if used elsewhere)
```

**Acceptance Criteria:**
- [ ] All files removed
- [ ] No remaining references
- [ ] Tests pass
- [ ] v2.0.0 version bump

---

## 3. Testing Strategy

### 3.1 Unit Tests

| Test File | Coverage |
|-----------|----------|
| `agent-executor.test.ts` | AgentExecutor class |
| `faber.test.ts` | Updated workflow tests |
| `types.test.ts` | Type definitions |

### 3.2 Integration Tests

| Test | Description |
|------|-------------|
| `forge-integration.test.ts` | End-to-end Forge integration |
| `dual-mode.test.ts` | Legacy vs Forge mode switching |
| `agent-resolution.test.ts` | All 5 phase agents |

### 3.3 End-to-End Tests

| Test | Description |
|------|-------------|
| `complete-workflow.test.ts` | Full FABER workflow with Forge |
| `migration-path.test.ts` | Verify migration steps work |

---

## 4. Configuration Changes

### 4.1 New Default Configuration

```json
{
  "forge": {
    "enabled": true,
    "prefer_local": true
  },
  "phases": {
    "frame": {
      "enabled": true,
      "agent": "frame-agent@^2.0.0"
    },
    "architect": {
      "enabled": true,
      "refineSpec": true,
      "agent": "architect-agent@^2.0.0"
    },
    "build": {
      "enabled": true,
      "agent": "build-agent@^2.0.0"
    },
    "evaluate": {
      "enabled": true,
      "maxRetries": 3,
      "agent": "evaluate-agent@^2.0.0"
    },
    "release": {
      "enabled": true,
      "requestReviews": true,
      "reviewers": [],
      "agent": "release-agent@^2.0.0"
    }
  }
}
```

### 4.2 Backward Compatible Configuration

For users who want to stay on legacy mode temporarily:

```json
{
  "forge": {
    "enabled": false
  }
}
```

---

## 5. Success Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| Performance overhead | < 5% | Workflow execution time |
| Test coverage | > 90% | Integration code coverage |
| Zero regressions | 100% | Existing tests pass |
| Agent resolution | < 200ms | Cold start time |
| Agent resolution (cached) | < 10ms | Warm cache time |

---

## 6. Timeline

| Week | Focus | Deliverables |
|------|-------|--------------|
| Week 1 | Tasks 1-4 | AgentExecutor, types, integration |
| Week 2 | Tasks 5-9 | All 5 agent YAML conversions |
| Week 3 | Tasks 10-12 | Deprecation, documentation |
| Week 4 | Task 13 | Final cleanup, v2.0 prep |

---

## 7. Risks and Mitigations

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| Agent resolution performance | Medium | Medium | Implement caching |
| Breaking existing workflows | Low | High | Dual-mode support |
| Missing agent functionality | Medium | Medium | Thorough testing |
| User confusion | Medium | Low | Clear documentation |

---

## 8. Open Questions

1. **Python SDK Future**: Should FABER's Python SDK also integrate with Forge's Python bindings (if created)?
2. **Agent Versioning**: How to handle version constraints in phase config?
3. **Custom Agents**: How do users create and register custom phase agents?
4. **Hot Reload**: Should agent updates be hot-reloadable during workflow?

---

## 9. Appendix

### A. File Locations Summary

| Component | Current Location | Target Location |
|-----------|-----------------|-----------------|
| AgentExecutor | (new) | `/src/workflow/agent-executor.ts` |
| Type updates | `/src/types.ts` | `/src/types.ts` |
| FaberWorkflow | `/src/workflow/faber.ts` | `/src/workflow/faber.ts` |
| Frame Agent | `/python/faber/agents/frame.py` | Forge: `frame-agent.yaml` |
| Architect Agent | `/python/faber/agents/architect.py` | Forge: `architect-agent.yaml` |
| Build Agent | `/python/faber/agents/build.py` | Forge: `build-agent.yaml` |
| Evaluate Agent | `/python/faber/agents/evaluate.py` | Forge: `evaluate-agent.yaml` |
| Release Agent | `/python/faber/agents/release.py` | Forge: `release-agent.yaml` |
| Python Definitions | `/python/faber/definitions/` | DEPRECATED → Removed |

### B. Dependencies

```json
{
  "dependencies": {
    "@fractary/forge": "^1.1.1"
  }
}
```

### C. Related Documents

- [SPEC-FABER-002: Forge Integration Interface](./SPEC-FABER-002-forge-integration.md)
- [SPEC-FORGE-001: Agent & Tool Definition System](./SPEC-FORGE-001-agent-tool-definition-system.md)
- [SPEC-FORGE-002: Agent Registry & Resolution](./SPEC-FORGE-002-agent-registry-resolution.md)
- [MIGRATION-SUMMARY: Cross-Project Migration Guide](./MIGRATION-SUMMARY.md)
