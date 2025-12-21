# SPEC-20251220: Claude Code Orchestration Implementation Plan

## Metadata

| Field | Value |
|-------|-------|
| **Spec ID** | SPEC-20251220 |
| **Title** | Claude Code Orchestration Implementation Plan |
| **Status** | Draft |
| **Created** | 2025-12-20 |
| **Author** | FABER Team |
| **Related Specs** | SPEC-20251219-claude-code-orchestration-architecture, SPEC-00028-intelligent-guardrails |

## 1. Executive Summary

This specification details the implementation plan for evolving FABER to use Claude Code as the primary orchestrator, as architecturally defined in SPEC-20251219. The plan focuses on building the components that will run inside the session containers launched by app.fractary.com.

### 1.1 What We're Building

**Core Components**:
1. **Multi-model MCP Server** - Enables Claude to delegate specific tasks to GPT-4, Gemini, etc.
2. **PhaseResult Contract** - Standardized output format from phase agents with confidence/risk
3. **Intelligent Guardrails** - Logic to evaluate confidence + risk and decide proceed/escalate
4. **FABER Orchestrator Agent** - Claude Code agent that uses Task tool to spawn phase agents
5. **Phase Agent Definitions** - Agent prompts for Frame, Architect, Build, Evaluate, Release
6. **Docker Runtime Image** - Container with Claude Code + all MCP servers pre-configured
7. **Enhanced FABER MCP Server** - Add guardrail evaluation and phase tracking tools

### 1.2 What We're NOT Building

- Web UI (handled by app.fractary.com)
- Backend workspace manager (handled by app.fractary.com)
- Container orchestration (handled by ECS in app.fractary.com)
- Authentication (handled by app.fractary.com)

## 2. Architecture Overview

### 2.1 How It Fits Together

```
┌─────────────────────────────────────────────────────────────┐
│           app.fractary.com (separate project)               │
│  - Web UI                                                    │
│  - Container orchestration (ECS Fargate)                    │
│  - Session management (database)                            │
└─────────────────────────────────────────────────────────────┘
                          ↓ launches
┌─────────────────────────────────────────────────────────────┐
│           Session Container (what we build)                 │
│  ┌───────────────────────────────────────────────────────┐ │
│  │  Claude Code (Primary Orchestrator)                   │ │
│  │  - Runs FABER Orchestrator Agent                      │ │
│  │  - Uses Task tool to spawn phase agents              │ │
│  │  - Uses TodoWrite for workflow state                  │ │
│  │  - Connects to MCP servers                            │ │
│  └───────────────────────────────────────────────────────┘ │
│                          ↓ via MCP                          │
│  ┌───────────────────────────────────────────────────────┐ │
│  │  MCP Servers (installed in container)                │ │
│  │  ├─ fractary-faber (workflow + events + guardrails)  │ │
│  │  ├─ fractary-repo (git operations)                   │ │
│  │  ├─ fractary-work (issue tracking)                   │ │
│  │  └─ multi-model-router (GPT-4, Gemini routing) ⭐    │ │
│  └───────────────────────────────────────────────────────┘ │
│                          ↓                                  │
│  ┌───────────────────────────────────────────────────────┐ │
│  │  Workspace (/workspace)                               │ │
│  │  ├─ Cloned repository                                 │ │
│  │  ├─ .fractary/runs/{run_id}/                          │ │
│  │  │  ├─ state.json                                     │ │
│  │  │  └─ events.jsonl                                   │ │
│  │  └─ Work artifacts                                    │ │
│  └───────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

### 2.2 Execution Flow

1. **User initiates workflow** (via app.fractary.com web UI)
2. **Container launches** with repository cloned to `/workspace`
3. **Claude Code starts** with initial message: "Run FABER workflow for issue #123"
4. **Orchestrator agent activates** (loaded from `/agents/faber-orchestrator.md`)
5. **Orchestrator uses TodoWrite** to create workflow plan
6. **For each phase**:
   - Orchestrator updates TodoWrite (phase → in_progress)
   - Orchestrator spawns phase agent via Task tool
   - Phase agent executes and returns PhaseResult
   - Orchestrator evaluates via guardrails (confidence + risk)
   - If escalate: AskUserQuestion
   - If proceed: Continue to next phase
   - Orchestrator updates TodoWrite (phase → completed)
7. **Results streamed** back to app.fractary.com via stdout

## 3. Component Specifications

### 3.1 Multi-Model MCP Server

**Location**: `mcp/multi-model-router/`

**Purpose**: Allow Claude to delegate specific tasks to other LLMs

**Tools Exposed**:

```typescript
// Tool 1: Direct invocation
interface InvokeModelTool {
  name: "invoke_model";
  description: "Invoke a specific model directly";
  inputSchema: {
    model: "gpt-4" | "gpt-4-turbo" | "gemini-pro" | "gemini-ultra";
    prompt: string;
    temperature?: number;
    max_tokens?: number;
  };
}

// Tool 2: Smart routing
interface RouteToModelTool {
  name: "route_to_best_model";
  description: "Automatically route to best model for task type";
  inputSchema: {
    task: string;
    task_type: "code_generation" | "code_review" | "search" | "creative_writing" | "analysis";
  };
}

// Tool 3: Consensus
interface GetConsensusTool {
  name: "get_multi_model_consensus";
  description: "Get responses from multiple models and synthesize";
  inputSchema: {
    task: string;
    models: Array<"claude" | "gpt-4" | "gemini-pro">;
  };
}
```

**Implementation**:

```typescript
// mcp/multi-model-router/src/server.ts
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import OpenAI from "openai";
import { GoogleGenerativeAI } from "@google/generative-ai";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const genai = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  if (name === "invoke_model") {
    const { model, prompt, temperature = 0.7, max_tokens = 2000 } = args;

    if (model.startsWith("gpt")) {
      const response = await openai.chat.completions.create({
        model,
        messages: [{ role: "user", content: prompt }],
        temperature,
        max_tokens,
      });
      return {
        content: [{ type: "text", text: response.choices[0].message.content }],
      };
    }

    if (model.startsWith("gemini")) {
      const geminiModel = genai.getGenerativeModel({ model });
      const result = await geminiModel.generateContent(prompt);
      return {
        content: [{ type: "text", text: result.response.text() }],
      };
    }
  }

  if (name === "route_to_best_model") {
    const { task, task_type } = args;

    // Routing logic
    const modelMap = {
      code_generation: "claude",
      code_review: "gpt-4",
      search: "gemini-pro",
      creative_writing: "claude",
      analysis: "gpt-4-turbo",
    };

    const bestModel = modelMap[task_type] || "claude";

    if (bestModel === "claude") {
      return {
        content: [
          {
            type: "text",
            text: "Routing to Claude (you). Please handle this task directly.",
          },
        ],
      };
    }

    // Delegate to other model
    return handleToolCall("invoke_model", {
      model: bestModel,
      prompt: task,
    });
  }

  if (name === "get_multi_model_consensus") {
    const { task, models } = args;
    const responses = await Promise.all(
      models.map((model) =>
        handleToolCall("invoke_model", { model, prompt: task })
      )
    );

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify({
            task,
            responses: responses.map((r, i) => ({
              model: models[i],
              response: r.content[0].text,
            })),
          }),
        },
      ],
    };
  }
});
```

**Configuration**:

```json
// Container: /root/.config/claude/mcp.json
{
  "mcpServers": {
    "multi-model-router": {
      "command": "node",
      "args": ["/mcp-servers/multi-model-router/dist/server.js"],
      "env": {
        "OPENAI_API_KEY": "${OPENAI_API_KEY}",
        "GEMINI_API_KEY": "${GEMINI_API_KEY}"
      }
    }
  }
}
```

### 3.2 PhaseResult Contract

**Location**: `sdk/js/src/types/phase-result.ts`

**Purpose**: Standardized output format from phase agents

```typescript
// sdk/js/src/types/phase-result.ts
export interface PhaseResult {
  /**
   * Execution status
   */
  status: "success" | "failure" | "partial";

  /**
   * Agent's confidence in the result (0.0 - 1.0)
   * - 0.0-0.3: Very low confidence
   * - 0.3-0.5: Low confidence
   * - 0.5-0.7: Medium confidence
   * - 0.7-0.9: High confidence
   * - 0.9-1.0: Very high confidence
   */
  confidence: number;

  /**
   * Risk assessment for proceeding
   * - low: Safe to proceed autonomously
   * - medium: Proceed with notification
   * - high: Escalate for approval
   * - critical: Block and require approval
   */
  risk: "low" | "medium" | "high" | "critical";

  /**
   * Phase-specific output data
   */
  output: {
    [key: string]: any;
  };

  /**
   * Recommended next action
   */
  recommended_next_action: {
    proceed: boolean;
    retry?: boolean;
    retry_reason?: string;
    escalate?: boolean;
    escalate_reason?: string;
    branch_to?: string; // Alternative phase (e.g., "debug")
  };

  /**
   * Artifacts created during phase
   */
  artifacts?: Array<{
    type: "file" | "commit" | "branch" | "pr" | "issue_comment";
    path?: string;
    url?: string;
    description: string;
  }>;

  /**
   * Errors encountered (if any)
   */
  errors?: Array<{
    message: string;
    severity: "warning" | "error" | "critical";
    recoverable: boolean;
  }>;
}

/**
 * Example Frame phase result
 */
export interface FramePhaseResult extends PhaseResult {
  output: {
    problem_understanding: string;
    acceptance_criteria: string[];
    constraints: string[];
    assumptions: string[];
    clarifications_needed?: string[];
  };
}

/**
 * Example Architect phase result
 */
export interface ArchitectPhaseResult extends PhaseResult {
  output: {
    architecture_decision: string;
    files_to_modify: string[];
    files_to_create: string[];
    implementation_plan: Array<{
      step: number;
      description: string;
      estimated_complexity: "low" | "medium" | "high";
    }>;
    technical_risks: string[];
  };
}

/**
 * Example Build phase result
 */
export interface BuildPhaseResult extends PhaseResult {
  output: {
    files_modified: string[];
    files_created: string[];
    tests_added: boolean;
    test_results?: {
      passed: number;
      failed: number;
      skipped: number;
    };
  };
}

/**
 * Example Evaluate phase result
 */
export interface EvaluatePhaseResult extends PhaseResult {
  output: {
    code_quality_score: number; // 0-100
    test_coverage: number; // 0-100
    security_issues: Array<{
      severity: "low" | "medium" | "high" | "critical";
      description: string;
      file: string;
      line?: number;
    }>;
    performance_issues: string[];
    recommendations: string[];
  };
}

/**
 * Example Release phase result
 */
export interface ReleasePhaseResult extends PhaseResult {
  output: {
    branch_created: string;
    commits: Array<{
      sha: string;
      message: string;
    }>;
    pr_created?: {
      number: number;
      url: string;
      title: string;
    };
  };
}
```

### 3.3 Intelligent Guardrails

**Location**: `mcp/server/src/tools/guardrails.ts`

**Purpose**: Evaluate phase results and decide proceed/escalate

```typescript
// mcp/server/src/tools/guardrails.ts
export interface GuardrailDecision {
  action: "proceed" | "escalate" | "block";
  reason: string;
  notify_user: boolean;
  require_approval: boolean;
}

export function evaluateGuardrails(
  phaseResult: PhaseResult,
  autonomyLevel: "dry-run" | "assisted" | "guarded" | "autonomous" = "guarded"
): GuardrailDecision {
  const { confidence, risk, status } = phaseResult;

  // Dry-run mode: never execute
  if (autonomyLevel === "dry-run") {
    return {
      action: "block",
      reason: "Dry-run mode active",
      notify_user: true,
      require_approval: false,
    };
  }

  // Assisted mode: always escalate
  if (autonomyLevel === "assisted") {
    return {
      action: "escalate",
      reason: "Assisted mode requires approval for each step",
      notify_user: true,
      require_approval: true,
    };
  }

  // Critical risk: always escalate
  if (risk === "critical") {
    return {
      action: "escalate",
      reason: `Critical risk identified: ${phaseResult.recommended_next_action.escalate_reason || "Unknown"}`,
      notify_user: true,
      require_approval: true,
    };
  }

  // Failure status: escalate
  if (status === "failure") {
    return {
      action: "escalate",
      reason: "Phase execution failed",
      notify_user: true,
      require_approval: true,
    };
  }

  // Very low confidence: escalate
  if (confidence < 0.5) {
    return {
      action: "escalate",
      reason: `Low confidence (${confidence.toFixed(2)})`,
      notify_user: true,
      require_approval: true,
    };
  }

  // High risk: escalate (even if confident)
  if (risk === "high") {
    return {
      action: "escalate",
      reason: "High risk operation requires approval",
      notify_user: true,
      require_approval: true,
    };
  }

  // Medium risk + medium confidence: proceed with notification
  if (risk === "medium" && confidence >= 0.7) {
    return {
      action: "proceed",
      reason: "Medium risk but high confidence",
      notify_user: true,
      require_approval: false,
    };
  }

  // Medium risk + lower confidence: escalate if guarded mode
  if (risk === "medium" && confidence < 0.7 && autonomyLevel === "guarded") {
    return {
      action: "escalate",
      reason: "Medium risk with moderate confidence",
      notify_user: true,
      require_approval: true,
    };
  }

  // Low risk + high confidence: proceed autonomously
  if (risk === "low" && confidence >= 0.8) {
    return {
      action: "proceed",
      reason: "Low risk and high confidence",
      notify_user: false,
      require_approval: false,
    };
  }

  // Default: escalate for safety
  return {
    action: "escalate",
    reason: "Default guardrail: escalate when uncertain",
    notify_user: true,
    require_approval: true,
  };
}
```

**MCP Tool**:

```typescript
// Add to mcp/server/src/tools/guardrails.ts
export const guardrailsTools = [
  {
    name: "evaluate_guardrails",
    description:
      "Evaluate phase result confidence and risk to determine if workflow should proceed or escalate",
    inputSchema: {
      type: "object",
      properties: {
        phase_result: {
          type: "object",
          description: "PhaseResult object from phase agent execution",
          required: ["status", "confidence", "risk"],
        },
        autonomy_level: {
          type: "string",
          enum: ["dry-run", "assisted", "guarded", "autonomous"],
          default: "guarded",
        },
      },
      required: ["phase_result"],
    },
  },
];

// Handler
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  if (request.params.name === "evaluate_guardrails") {
    const { phase_result, autonomy_level } = request.params.arguments;
    const decision = evaluateGuardrails(phase_result, autonomy_level);

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(decision, null, 2),
        },
      ],
    };
  }
});
```

### 3.4 FABER Orchestrator Agent

**Location**: `agents/faber-orchestrator.md`

**Purpose**: Main orchestrator that runs FABER workflows using Task tool

```markdown
# FABER Orchestrator Agent

You are the FABER workflow orchestrator. Your role is to execute FABER workflows (Frame → Architect → Build → Evaluate → Release) using Claude Code's Task tool to spawn phase agents.

## Your Responsibilities

1. **Parse workflow request** - Extract work ID, repository, and requirements
2. **Create workflow plan** - Use TodoWrite to create 5-phase checklist
3. **Execute phases sequentially** - Spawn phase agents via Task tool
4. **Evaluate guardrails** - Check confidence + risk after each phase
5. **Handle escalations** - Use AskUserQuestion when guardrails require approval
6. **Track progress** - Update TodoWrite and emit events to FABER MCP server

## Execution Pattern

When you receive a workflow request like "Run FABER workflow for issue #123":

### Step 1: Fetch Work Details

```javascript
const issue = await fractary_work_issue_fetch({ issue_id: "123" });
```

### Step 2: Create Workflow Run

```javascript
const run = await fractary_faber_workflow_run({
  work_id: "123",
  autonomy_level: "guarded", // or from user preference
});
```

Extract `run_id` from response.

### Step 3: Create TodoWrite Plan

```javascript
await TodoWrite({
  todos: [
    {
      content: "Frame: Understand requirements and constraints",
      status: "pending",
      activeForm: "Framing requirements",
    },
    {
      content: "Architect: Design implementation approach",
      status: "pending",
      activeForm: "Architecting solution",
    },
    {
      content: "Build: Implement the solution",
      status: "pending",
      activeForm: "Building implementation",
    },
    {
      content: "Evaluate: Validate implementation quality",
      status: "pending",
      activeForm: "Evaluating implementation",
    },
    {
      content: "Release: Create pull request",
      status: "pending",
      activeForm: "Releasing changes",
    },
  ],
});
```

### Step 4: Execute Each Phase

For each phase in ["frame", "architect", "build", "evaluate", "release"]:

#### 4.1 Update TodoWrite

Mark current phase as `in_progress`.

#### 4.2 Emit Phase Start Event

```javascript
await fractary_faber_event_emit({
  run_id: runId,
  type: "phase_started",
  phase: phase,
  metadata: {
    timestamp: new Date().toISOString(),
  },
});
```

#### 4.3 Spawn Phase Agent

```javascript
const result = await Task({
  subagent_type: `fractary-faber:${phase}`,
  description: `Execute ${phase} phase`,
  prompt: `Execute ${phase} phase for work item #123.

Work details:
${JSON.stringify(issue, null, 2)}

${phase === "build" ? `Architecture plan: ${architectureResult.output}` : ""}
${phase === "evaluate" ? `Implementation: ${buildResult.output}` : ""}

Return structured PhaseResult JSON with:
- status: "success" | "failure"
- confidence: 0.0-1.0
- risk: "low" | "medium" | "high" | "critical"
- output: { phase-specific data }
- recommended_next_action: { proceed, retry, escalate }
`,
});
```

#### 4.4 Parse PhaseResult

```javascript
const phaseResult = JSON.parse(result);
```

#### 4.5 Evaluate Guardrails

```javascript
const guardrailDecision = await fractary_faber_evaluate_guardrails({
  phase_result: phaseResult,
  autonomy_level: "guarded",
});
```

#### 4.6 Handle Decision

```javascript
if (guardrailDecision.action === "escalate") {
  const approval = await AskUserQuestion({
    questions: [
      {
        question: `${phase} phase completed with ${phaseResult.confidence} confidence and ${phaseResult.risk} risk. Proceed to next phase?`,
        header: "Approval",
        multiSelect: false,
        options: [
          {
            label: "Approve and continue",
            description: "Proceed to next phase",
          },
          {
            label: "Reject and stop",
            description: "Stop workflow execution",
          },
          {
            label: "View details",
            description: "Show full phase result",
          },
        ],
      },
    ],
  });

  if (approval.answers["0"] !== "Approve and continue") {
    await fractary_faber_event_emit({
      run_id: runId,
      type: "workflow_paused",
      phase: phase,
      metadata: { reason: "User rejected continuation" },
    });
    break; // Stop workflow
  }
}
```

#### 4.7 Update TodoWrite

Mark phase as `completed`.

#### 4.8 Emit Phase Completion Event

```javascript
await fractary_faber_event_emit({
  run_id: runId,
  type: "phase_completed",
  phase: phase,
  metadata: {
    confidence: phaseResult.confidence,
    risk: phaseResult.risk,
    artifacts: phaseResult.artifacts,
  },
});
```

### Step 5: Workflow Completion

After all phases complete:

```javascript
await fractary_faber_event_emit({
  run_id: runId,
  type: "workflow_completed",
  metadata: {
    total_phases: 5,
    success: true,
  },
});
```

## Error Handling

If a phase agent fails:

1. Log error event
2. Check if `recommended_next_action.retry` is true
3. If retry: spawn agent again with error context
4. If no retry: escalate to user

## Tools You Have Available

- **Task** - Spawn phase agents
- **TodoWrite** - Track workflow progress
- **AskUserQuestion** - Get user approval for escalations
- **fractary_faber_workflow_run** - Create workflow run
- **fractary_faber_event_emit** - Log workflow events
- **fractary_faber_evaluate_guardrails** - Evaluate confidence + risk
- **fractary_work_issue_fetch** - Get issue details
- **fractary_repo_** - Git operations (branch, commit, push, PR)

## Success Criteria

- All 5 phases execute successfully
- Guardrails evaluated after each phase
- User notified only when necessary (escalations)
- PR created at end of Release phase
- All events logged to run file
```

### 3.5 Phase Agent Definitions

Phase agents are spawned by the orchestrator via Task tool. They are defined as agent markdown files.

**Location**: `agents/`

#### Frame Agent

**File**: `agents/faber-frame.md`

```markdown
# FABER Frame Phase Agent

You are the Frame phase agent. Your role is to deeply understand the problem before any solution work begins.

## Your Task

Analyze the work item and return a structured PhaseResult with:

1. **Problem Understanding**: Clear articulation of what needs to be done
2. **Acceptance Criteria**: Specific, testable criteria for success
3. **Constraints**: Technical, business, or regulatory limitations
4. **Assumptions**: What you're assuming to be true
5. **Clarifications Needed**: Questions that block progress

## Process

1. Read the issue/work item description thoroughly
2. Review related files in the repository for context
3. Identify any ambiguities or missing information
4. Formulate acceptance criteria
5. Assess your confidence in understanding the problem

## Output Format

Return JSON matching PhaseResult contract:

```json
{
  "status": "success",
  "confidence": 0.85,
  "risk": "low",
  "output": {
    "problem_understanding": "User authentication is failing for OAuth providers...",
    "acceptance_criteria": [
      "OAuth login succeeds for GitHub and Google",
      "Error messages are clear and actionable",
      "Tests added for both providers"
    ],
    "constraints": [
      "Must work with existing session management",
      "Cannot change database schema"
    ],
    "assumptions": [
      "OAuth provider configurations are correct",
      "Issue is client-side, not provider-side"
    ],
    "clarifications_needed": [
      "Should we support Twitter OAuth as well?"
    ]
  },
  "recommended_next_action": {
    "proceed": true,
    "escalate": false
  }
}
```

## Confidence and Risk Guidelines

**Confidence**:
- 0.9-1.0: Problem is crystal clear, acceptance criteria obvious
- 0.7-0.9: Good understanding, minor ambiguities
- 0.5-0.7: Moderate understanding, some clarifications needed
- Below 0.5: Significant ambiguity, recommend escalation

**Risk**:
- low: Straightforward problem with clear solution space
- medium: Some technical complexity or unknowns
- high: Significant complexity, architectural changes, or external dependencies
- critical: Production impact, data migration, or major breaking changes

## Tools Available

- Read - Read repository files for context
- Grep - Search codebase for related code
- Glob - Find files by pattern
- fractary_work_issue_fetch - Get full issue details
- fractary_work_issue_list - Find related issues
```

#### Architect Agent

**File**: `agents/faber-architect.md`

```markdown
# FABER Architect Phase Agent

You are the Architect phase agent. Your role is to design the implementation approach before any code is written.

## Your Task

Based on the Frame phase output, create a detailed implementation plan with:

1. **Architecture Decision**: High-level approach and rationale
2. **Files to Modify/Create**: Specific file paths
3. **Implementation Plan**: Step-by-step breakdown
4. **Technical Risks**: Potential issues and mitigations

## Process

1. Review Frame phase output (problem understanding + acceptance criteria)
2. Explore existing codebase architecture
3. Identify files that need modification
4. Design the implementation approach
5. Break down into sequential steps
6. Assess technical risks

## Output Format

```json
{
  "status": "success",
  "confidence": 0.8,
  "risk": "medium",
  "output": {
    "architecture_decision": "Implement OAuth fix by adding error boundary in auth middleware and improving error messages...",
    "files_to_modify": [
      "src/lib/auth/oauth.ts",
      "src/lib/auth/middleware.ts"
    ],
    "files_to_create": [
      "src/lib/auth/__tests__/oauth.test.ts"
    ],
    "implementation_plan": [
      {
        "step": 1,
        "description": "Add OAuth error type definitions",
        "estimated_complexity": "low"
      },
      {
        "step": 2,
        "description": "Implement error boundary in middleware",
        "estimated_complexity": "medium"
      },
      {
        "step": 3,
        "description": "Add tests for error handling",
        "estimated_complexity": "medium"
      }
    ],
    "technical_risks": [
      "Breaking existing OAuth flows if error handling too aggressive",
      "Test coverage might not catch all edge cases"
    ]
  },
  "recommended_next_action": {
    "proceed": true,
    "escalate": false
  }
}
```

## Confidence and Risk Guidelines

**Confidence**:
- 0.9-1.0: Architecture is proven pattern, low uncertainty
- 0.7-0.9: Good design with some unknowns to resolve during Build
- 0.5-0.7: Uncertain about some architectural choices
- Below 0.5: Multiple competing approaches, unclear best path

**Risk**:
- low: Changes isolated to single module, no breaking changes
- medium: Cross-module changes, some refactoring needed
- high: Architectural changes affecting multiple systems
- critical: Database migrations, API breaking changes, production risk

## Tools Available

- Read - Read existing code to understand patterns
- Grep - Find similar implementations
- Glob - Discover related files
- LSP - Get code definitions and references
- route_to_best_model (via multi-model-router) - Get GPT-4 perspective on architecture
```

#### Build Agent

**File**: `agents/faber-build.md`

```markdown
# FABER Build Phase Agent

You are the Build phase agent. Your role is to implement the solution according to the architecture plan.

## Your Task

Implement the solution by:

1. **Following the architecture plan** from Architect phase
2. **Writing clean, tested code**
3. **Running tests** to verify functionality
4. **Creating commits** with clear messages

## Process

1. Review architecture plan (files to modify/create, implementation steps)
2. Implement changes step-by-step
3. Write tests for new functionality
4. Run tests and fix failures
5. Create git commit(s)

## Output Format

```json
{
  "status": "success",
  "confidence": 0.9,
  "risk": "low",
  "output": {
    "files_modified": [
      "src/lib/auth/oauth.ts",
      "src/lib/auth/middleware.ts"
    ],
    "files_created": [
      "src/lib/auth/__tests__/oauth.test.ts"
    ],
    "tests_added": true,
    "test_results": {
      "passed": 12,
      "failed": 0,
      "skipped": 0
    }
  },
  "artifacts": [
    {
      "type": "commit",
      "description": "Add OAuth error handling",
      "path": "abc123"
    }
  ],
  "recommended_next_action": {
    "proceed": true,
    "escalate": false
  },
  "errors": []
}
```

## Confidence and Risk Guidelines

**Confidence**:
- 0.9-1.0: All tests pass, implementation matches plan exactly
- 0.7-0.9: Tests pass, minor deviations from plan
- 0.5-0.7: Some test failures or implementation challenges
- Below 0.5: Significant issues, implementation incomplete

**Risk**:
- low: All tests pass, no warnings, follows established patterns
- medium: Some test warnings, minor code quality issues
- high: Test failures, potential bugs identified
- critical: Breaking changes, production concerns

## Tools Available

- Read - Read files
- Write - Create new files
- Edit - Modify existing files
- Bash - Run tests, build commands
- Grep/Glob - Find files and code
- fractary_repo_commit_create - Create git commits
```

#### Evaluate Agent

**File**: `agents/faber-evaluate.md`

```markdown
# FABER Evaluate Phase Agent

You are the Evaluate phase agent. Your role is to validate implementation quality before release.

## Your Task

Evaluate the implementation by:

1. **Code Quality Review** - Check for bugs, anti-patterns, style issues
2. **Test Coverage Analysis** - Ensure adequate test coverage
3. **Security Audit** - Identify potential security vulnerabilities
4. **Performance Check** - Flag performance concerns

## Process

1. Review all files modified/created in Build phase
2. Run static analysis tools (linter, type checker)
3. Check test coverage reports
4. Review for security issues (SQL injection, XSS, etc.)
5. Optionally: Use GPT-4 for code review second opinion

## Output Format

```json
{
  "status": "success",
  "confidence": 0.85,
  "risk": "low",
  "output": {
    "code_quality_score": 85,
    "test_coverage": 92,
    "security_issues": [],
    "performance_issues": [],
    "recommendations": [
      "Consider adding error logging for failed OAuth attempts",
      "Add JSDoc comments to exported functions"
    ]
  },
  "recommended_next_action": {
    "proceed": true,
    "escalate": false
  }
}
```

## Using Multi-Model Review

You can invoke GPT-4 for a second opinion:

```javascript
const gpt4Review = await route_to_best_model({
  task: `Review this code for security vulnerabilities and bugs:

${codeContent}

Provide:
1. Security issues (with severity)
2. Potential bugs
3. Code quality concerns`,
  task_type: "code_review"
});
```

## Confidence and Risk Guidelines

**Confidence**:
- 0.9-1.0: Code quality excellent, no issues found
- 0.7-0.9: Minor issues, easily fixable
- 0.5-0.7: Some concerns but not blocking
- Below 0.5: Significant quality issues

**Risk**:
- low: No security issues, good test coverage, follows best practices
- medium: Minor security concerns, decent coverage
- high: Security issues or low test coverage
- critical: Critical security vulnerabilities

## Tools Available

- Read - Read implementation files
- Bash - Run linter, tests, coverage reports
- invoke_model (multi-model-router) - Get GPT-4 code review
```

#### Release Agent

**File**: `agents/faber-release.md`

```markdown
# FABER Release Phase Agent

You are the Release phase agent. Your role is to create a pull request for the implementation.

## Your Task

Release the changes by:

1. **Creating a feature branch** (if not already on one)
2. **Pushing commits** to remote
3. **Creating a pull request** with description
4. **Linking to original issue**

## Process

1. Check current git branch
2. Create feature branch if on main (e.g., `fix/oauth-error-handling`)
3. Push branch to remote
4. Create PR with generated description
5. Link PR to original issue

## Output Format

```json
{
  "status": "success",
  "confidence": 1.0,
  "risk": "low",
  "output": {
    "branch_created": "fix/oauth-error-handling",
    "commits": [
      {
        "sha": "abc123",
        "message": "Add OAuth error handling"
      }
    ],
    "pr_created": {
      "number": 456,
      "url": "https://github.com/org/repo/pull/456",
      "title": "Fix OAuth error handling for GitHub and Google providers"
    }
  },
  "artifacts": [
    {
      "type": "branch",
      "description": "fix/oauth-error-handling"
    },
    {
      "type": "pr",
      "url": "https://github.com/org/repo/pull/456",
      "description": "PR #456"
    }
  ],
  "recommended_next_action": {
    "proceed": true,
    "escalate": false
  }
}
```

## PR Description Template

```markdown
## Summary
<!-- Brief description of changes -->

## Related Issue
Closes #123

## Changes Made
<!-- List of file changes -->

## Testing
<!-- How to test these changes -->

## Screenshots
<!-- If applicable -->

---
🤖 Generated by FABER
```

## Confidence and Risk Guidelines

**Confidence**:
- 1.0: PR created successfully
- 0.7-0.9: PR created but some warnings
- Below 0.7: Issues creating PR

**Risk**:
- low: PR created successfully
- medium: PR created but has conflicts
- high: Push failed or PR creation failed

## Tools Available

- fractary_repo_branch_create - Create git branch
- fractary_repo_commit_list - List commits
- fractary_repo_push - Push to remote
- fractary_repo_pr_create - Create pull request
- fractary_work_issue_update - Update issue status
```

### 3.6 Docker Runtime Image

**Location**: `docker/Dockerfile.session`

**Purpose**: Container image with Claude Code + all MCP servers pre-configured

```dockerfile
# docker/Dockerfile.session
FROM node:20-bookworm-slim

# Install system dependencies
RUN apt-get update && apt-get install -y \
    git \
    curl \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# Install Claude Code CLI globally
RUN npm install -g @anthropic-ai/claude-code@latest

# Create app directory
WORKDIR /app

# Copy MCP servers
COPY mcp/server /mcp-servers/fractary-faber
COPY mcp/multi-model-router /mcp-servers/multi-model-router
# Note: fractary-repo and fractary-work come from separate repos
# These should be git submodules or npm packages

# Install MCP server dependencies
RUN cd /mcp-servers/fractary-faber && npm install --production && npm run build
RUN cd /mcp-servers/multi-model-router && npm install --production && npm run build

# Copy agent definitions
COPY agents /agents

# Configure Claude Code MCP servers
RUN mkdir -p /root/.config/claude
COPY docker/mcp-config.json /root/.config/claude/mcp.json

# Configure git
RUN git config --global user.name "FABER" && \
    git config --global user.email "faber@fractary.dev" && \
    git config --global init.defaultBranch main

# Set up workspace directory
WORKDIR /workspace

# Environment variables (will be overridden by container runtime)
ENV ANTHROPIC_API_KEY=""
ENV OPENAI_API_KEY=""
ENV GEMINI_API_KEY=""
ENV GITHUB_TOKEN=""
ENV WORKSPACE_ID=""
ENV WORK_ID=""
ENV FABER_RUNS_PATH="/workspace/.fractary/runs"

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD node -e "console.log('healthy')" || exit 1

# Default command: run Claude Code headless
CMD ["claude", "--headless"]
```

**MCP Configuration**:

**File**: `docker/mcp-config.json`

```json
{
  "mcpServers": {
    "fractary-faber": {
      "command": "node",
      "args": ["/mcp-servers/fractary-faber/dist/index.js"],
      "env": {
        "FABER_RUNS_PATH": "${FABER_RUNS_PATH}"
      }
    },
    "multi-model-router": {
      "command": "node",
      "args": ["/mcp-servers/multi-model-router/dist/server.js"],
      "env": {
        "OPENAI_API_KEY": "${OPENAI_API_KEY}",
        "GEMINI_API_KEY": "${GEMINI_API_KEY}"
      }
    }
  }
}
```

**Build script**:

**File**: `docker/build.sh`

```bash
#!/bin/bash
set -e

# Build Docker image
docker build -f docker/Dockerfile.session -t fractary/faber-session:latest .

# Tag with version
VERSION=$(node -p "require('./package.json').version")
docker tag fractary/faber-session:latest fractary/faber-session:$VERSION

echo "Built fractary/faber-session:latest and fractary/faber-session:$VERSION"
```

### 3.7 Enhanced FABER MCP Server

**Updates to**: `mcp/server/src/tools/`

Add new tools for guardrails and orchestration support:

```typescript
// mcp/server/src/tools/guardrails.ts
export const guardrailsTools = [
  {
    name: "evaluate_guardrails",
    description:
      "Evaluate phase result confidence and risk to determine proceed/escalate",
    inputSchema: {
      type: "object",
      properties: {
        phase_result: {
          type: "object",
          description: "PhaseResult from phase agent",
        },
        autonomy_level: {
          type: "string",
          enum: ["dry-run", "assisted", "guarded", "autonomous"],
        },
      },
      required: ["phase_result"],
    },
  },
];
```

Update workflow tools to support orchestrator:

```typescript
// mcp/server/src/tools/workflow.ts

// Add new tool: workflow_phase_complete
{
  name: "workflow_phase_complete",
  description: "Mark a workflow phase as complete and store result",
  inputSchema: {
    type: "object",
    properties: {
      run_id: { type: "string" },
      phase: {
        type: "string",
        enum: ["frame", "architect", "build", "evaluate", "release"]
      },
      result: {
        type: "object",
        description: "PhaseResult object"
      }
    },
    required: ["run_id", "phase", "result"]
  }
}
```

## 4. Implementation Roadmap

### Week 1: Foundation

**Goals**: Multi-model MCP server, PhaseResult types, Guardrails logic

- [ ] Create `mcp/multi-model-router/` package
- [ ] Implement OpenAI and Gemini integrations
- [ ] Define PhaseResult TypeScript interfaces in `sdk/js/src/types/`
- [ ] Implement guardrails evaluation logic in `mcp/server/src/tools/guardrails.ts`
- [ ] Add `evaluate_guardrails` MCP tool
- [ ] Unit tests for guardrails logic

### Week 2: Orchestrator & Phase Agents

**Goals**: Orchestrator agent, phase agent definitions

- [ ] Create `agents/faber-orchestrator.md`
- [ ] Create phase agents: `agents/faber-frame.md`, `agents/faber-architect.md`, etc.
- [ ] Test orchestrator manually with Claude Code CLI
- [ ] Verify Task tool spawning works correctly
- [ ] Verify TodoWrite state tracking

### Week 3: Docker Image & Integration

**Goals**: Container image, end-to-end testing

- [ ] Create `docker/Dockerfile.session`
- [ ] Create `docker/mcp-config.json`
- [ ] Build and test Docker image locally
- [ ] Test full workflow inside container
- [ ] Document environment variables and configuration

### Week 4: Testing & Documentation

**Goals**: Comprehensive testing, documentation

- [ ] Integration tests for each phase agent
- [ ] Test guardrails with various confidence/risk combinations
- [ ] Test multi-model routing
- [ ] Update README with new architecture
- [ ] Create developer guide for extending agents
- [ ] Performance testing (workflow completion time)

## 5. Success Criteria

### Functional Requirements

- [ ] Orchestrator spawns phase agents via Task tool
- [ ] Phase agents return structured PhaseResult
- [ ] Guardrails evaluate confidence + risk correctly
- [ ] AskUserQuestion triggered for escalations
- [ ] TodoWrite tracks workflow progress
- [ ] Events logged to FABER MCP server
- [ ] Multi-model routing works (Claude delegates to GPT-4/Gemini)
- [ ] Docker image builds successfully
- [ ] Full workflow completes end-to-end

### Non-Functional Requirements

- [ ] Workflow completion: < 10 minutes for typical issue
- [ ] Container startup: < 30 seconds
- [ ] Phase agent spawn latency: < 5 seconds
- [ ] Memory usage: < 2GB per container
- [ ] All TypeScript code type-checks
- [ ] Test coverage: > 80%

## 6. Testing Strategy

### Unit Tests

- Guardrails logic with various confidence/risk combinations
- PhaseResult validation
- Multi-model router tool invocations

### Integration Tests

- Full FABER workflow (Frame → Release) on sample issue
- Guardrail escalation flow
- Multi-model delegation (Claude → GPT-4 for code review)

### Container Tests

- Docker image builds
- MCP servers start correctly
- Claude Code can connect to all MCP servers
- Environment variables pass through correctly

### End-to-End Tests

- Workflow from app.fractary.com → container → PR created
- Events flow back to app.fractary.com
- User approval via AskUserQuestion

## 7. Migration Path

### Phase 1: Parallel Operation

- Keep existing Python agents operational
- New Claude Code orchestration runs alongside
- Users can choose which to use

### Phase 2: Default to Claude Code

- Claude Code orchestration becomes default
- Python agents deprecated but available

### Phase 3: Python Removal

- Remove Python agent definitions
- Claude Code only

## 8. Open Questions

1. **How do we handle repository cloning in container?**
   - Answer: app.fractary.com clones repo in entrypoint before starting Claude Code

2. **How do we inject work ID into orchestrator?**
   - Answer: Via initial message: "Run FABER workflow for issue #123"

3. **How do we handle streaming events back to web UI?**
   - Answer: Claude Code stdout → WebSocket handler in container → app.fractary.com backend → web UI

4. **What if user wants to pause/resume workflow?**
   - Answer: Use fractary_faber_workflow_pause/resume MCP tools

5. **How do we handle secrets (API keys) in container?**
   - Answer: Injected via environment variables by app.fractary.com (from Secrets Manager)

## 9. References

- [SPEC-20251219: Claude Code Orchestration Architecture](./SPEC-20251219-claude-code-orchestration-architecture.md)
- [SPEC-00028: Intelligent Guardrails](./SPEC-00028-intelligent-guardrails.md)
- [Claude Code Documentation](https://docs.anthropic.com/claude/code)
- [Model Context Protocol Specification](https://spec.modelcontextprotocol.io)

---

**Document Status:** Draft
**Last Updated:** 2025-12-20
**Next Steps:** Begin Week 1 implementation
