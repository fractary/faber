# SPEC-20251219: Claude Code as FABER Orchestration Layer

## Metadata

| Field | Value |
|-------|-------|
| **Spec ID** | SPEC-20251219 |
| **Title** | Claude Code as FABER Orchestration Layer |
| **Status** | Draft |
| **Created** | 2025-12-19 |
| **Author** | FABER Team |
| **Related Specs** | SPEC-00025, SPEC-00028, SPEC-20251217-faber-mcp-server |

## 1. Executive Summary

### 1.1 Summary

This specification defines the architecture for FABER that uses **Claude Code as the primary orchestration layer** rather than LangGraph or other external orchestration frameworks. This decision is based on the realization that Claude Code already provides all necessary orchestration primitives (Task tool for sub-agent spawning, TodoWrite for state machines, MCP for extensibility) and can be run headless in containerized environments, similar to how GitHub's `@claude` integration and Claude Code web work.

### 1.2 Key Architectural Decisions

1. **Claude Code is the orchestrator** - Not just a CLI tool, but the workflow engine
2. **Headless/containerized execution** - Run Claude Code in containers without terminal UI
3. **Multi-model via MCP** - Add GPT-4, Gemini, etc. through MCP server routing
4. **Interface-agnostic backend** - Wrap Claude Code with web/Slack/GitHub interfaces
5. **No LangGraph dependency** - Simpler, faster, native to Claude ecosystem

### 1.3 Problem Statement

Previous FABER architecture proposals (SPEC-00025) relied on LangGraph for workflow orchestration, which introduced:
- External dependencies (LangGraph, LangChain, Deep Agents)
- Complexity in integration and maintenance
- 2-3 month implementation timeline
- Dependency on Python-centric ecosystem
- Lock-in to LangChain observability (LangSmith)

Meanwhile, Claude Code already provides:
- Task tool (sub-agent spawning with permission management)
- TodoWrite (state machine tracking)
- MCP client (extensibility via Model Context Protocol)
- Battle-tested in production (@claude GitHub integration, Claude Code web)
- Can run headless in containers

### 1.4 Goals

1. **Leverage Claude Code's orchestration capabilities** for FABER workflows
2. **Enable headless/containerized execution** to support web/API/integrations
3. **Add multi-model support** via MCP server without changing core architecture
4. **Build user-friendly interfaces** (web, Slack, GitHub) that wrap Claude Code
5. **Ship faster** - weeks instead of months by using existing infrastructure

### 1.5 Non-Goals

1. Replacing Claude Code with custom orchestration
2. Building a new LLM orchestration framework
3. Supporting non-containerized distributed execution (initially)
4. Real-time collaboration on single workspace (initially)

## 2. How Claude Code Orchestration Works in Production

### 2.1 GitHub Integration (@claude)

**User Experience:**
```
User comments "@claude fix this bug" in GitHub issue
  ↓
Minutes later, @claude responds with analysis
  ↓
Creates branch, commits fixes, opens PR
```

**Behind the Scenes:**
```
GitHub webhook → Anthropic backend service
  ↓
Backend allocates workspace (container/VM)
  ↓
Clones repo to /workspace
  ↓
Spins up Claude Code instance (headless)
  ↓
Passes issue context as initial message
  ↓
Claude Code executes with full tool access:
  - Read files
  - Edit code
  - Run tests
  - Create commits
  - Open PR
  ↓
Results posted back to GitHub via API
```

**Key Insights:**
- Claude Code runs **headless** (no terminal UI)
- Fully **containerized** (isolated workspace per issue)
- **Automated** (no human in the loop after trigger)
- **Bidirectional** (GitHub → Claude Code → GitHub)

### 2.2 Claude Code Web

**User Experience:**
```
User opens web.claude.ai/code
  ↓
Types message in web interface
  ↓
Sees Claude's responses stream in real-time
  ↓
Can execute code, modify files, run commands
```

**Behind the Scenes:**
```
Web UI ←→ Backend API ←→ Claude Code Instance
  │
  ├─ User sends message via WebSocket
  ├─ Backend forwards to Claude Code stdin
  ├─ Claude Code processes and responds via stdout
  └─ Backend streams response to Web UI
```

**Key Insights:**
- Claude Code is **process-based** (stdin/stdout communication)
- Web UI is a **frontend wrapper** around Claude Code
- **Real-time streaming** via WebSocket
- **Session management** by backend (one instance per session)

### 2.3 How Claude Code Can Run Headless

Claude Code is fundamentally a **Node.js CLI process** that can run without human interaction:

```bash
# Standard CLI usage (interactive)
claude

# Headless usage (programmatic)
claude --headless

# With initial message
claude --message "Run FABER workflow for issue #123"

# With configuration
claude --config /path/to/config.json
```

**Process Communication:**
```typescript
import { spawn } from 'child_process';

const claudeProcess = spawn('claude', ['--headless'], {
  cwd: '/workspace',
  env: {
    ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY
  }
});

// Send messages to Claude Code
claudeProcess.stdin.write('Your prompt here\n');

// Receive responses from Claude Code
claudeProcess.stdout.on('data', (data) => {
  console.log('Claude:', data.toString());
});

// Handle errors
claudeProcess.stderr.on('data', (data) => {
  console.error('Error:', data.toString());
});
```

## 3. FABER Architecture with Claude Code Orchestration

### 3.1 High-Level Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                 User Interfaces (Multi-Channel)             │
│  ┌──────────┬──────────┬──────────┬──────────────────────┐ │
│  │   Web    │  Slack   │  GitHub  │  VS Code Extension   │ │
│  │    UI    │   Bot    │ @faber   │   (future)           │ │
│  └──────────┴──────────┴──────────┴──────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
                         ↓
┌─────────────────────────────────────────────────────────────┐
│              FABER Backend Service (Node.js)                │
│  ┌───────────────────────────────────────────────────────┐ │
│  │  Workspace Manager                                     │ │
│  │  - Allocates Claude Code instances (containers)       │ │
│  │  - Routes messages to/from interfaces                 │ │
│  │  - Manages authentication & permissions               │ │
│  │  - Handles event streaming                            │ │
│  └───────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
                         ↓
┌─────────────────────────────────────────────────────────────┐
│      Claude Code Instances (Docker Containers/VMs)          │
│  ┌───────────────────────────────────────────────────────┐ │
│  │  Workspace: Issue #123                                │ │
│  │  ┌─────────────────────────────────────────────────┐ │ │
│  │  │ Claude Code (Orchestrator)                       │ │ │
│  │  │  ├─ Task tool (spawn FABER phase agents)        │ │ │
│  │  │  ├─ TodoWrite (workflow state machine)          │ │ │
│  │  │  ├─ File tools (Read, Write, Edit)              │ │ │
│  │  │  ├─ Git tools (branch, commit, push)            │ │ │
│  │  │  └─ MCP client (connects to MCP servers)        │ │ │
│  │  └─────────────────────────────────────────────────┘ │ │
│  │                      ↓                                 │ │
│  │  ┌─────────────────────────────────────────────────┐ │ │
│  │  │ MCP Servers (Model Context Protocol)            │ │ │
│  │  │  ├─ fractary-faber (workflow state/events)      │ │ │
│  │  │  ├─ fractary-repo (Git/PR operations)           │ │ │
│  │  │  ├─ fractary-work (Issue tracking)              │ │ │
│  │  │  └─ multi-model-router ⭐ (GPT-4, Gemini, etc.) │ │ │
│  │  └─────────────────────────────────────────────────┘ │ │
│  └───────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

### 3.2 Component Breakdown

#### Layer 1: User Interfaces

**Purpose:** Provide accessible entry points for non-technical users

**Components:**
- **Web UI** - React/Next.js frontend with real-time updates
- **Slack Bot** - `/faber` commands and @faber mentions
- **GitHub Integration** - `@faber` comments in issues/PRs
- **VS Code Extension** - IDE-native workflow triggering (future)

**Communication:** WebSocket (web), Slack API, GitHub webhooks

#### Layer 2: FABER Backend Service

**Purpose:** Manage Claude Code instances and route communications

**Key Responsibilities:**
```typescript
interface FaberBackend {
  // Workspace lifecycle
  createWorkspace(workId: string, config: WorkspaceConfig): Promise<Workspace>;
  destroyWorkspace(workspaceId: string): Promise<void>;
  listWorkspaces(): Promise<Workspace[]>;

  // Message routing
  sendMessage(workspaceId: string, message: string): Promise<void>;
  subscribeToMessages(workspaceId: string, handler: MessageHandler): void;

  // Event handling
  onWorkflowEvent(workspaceId: string, handler: EventHandler): void;

  // Authentication & permissions
  authenticateUser(token: string): Promise<User>;
  authorizeWorkspaceAccess(user: User, workspaceId: string): Promise<boolean>;
}
```

**Technology Stack:**
- Node.js/TypeScript (Express or Fastify)
- Docker API (for container management)
- WebSocket server (for real-time communication)
- PostgreSQL (for workspace metadata)
- Redis (for session management)

#### Layer 3: Claude Code Instances (Containers)

**Purpose:** Execute FABER workflows in isolated environments

**Container Specifications:**
```dockerfile
FROM node:18

# Install Claude Code CLI
RUN npm install -g @anthropic-ai/claude-code

# Install FABER MCP servers
COPY mcp-servers /mcp-servers
RUN cd /mcp-servers/fractary-faber && npm install
RUN cd /mcp-servers/fractary-repo && npm install
RUN cd /mcp-servers/fractary-work && npm install
RUN cd /mcp-servers/multi-model-router && npm install

# Configure Claude Code MCP servers
COPY config/mcp.json /root/.config/claude/mcp.json

# Set up workspace
WORKDIR /workspace
RUN git config --global user.name "FABER"
RUN git config --global user.email "faber@fractary.dev"

# Environment variables
ENV ANTHROPIC_API_KEY=""
ENV WORKSPACE_ID=""
ENV WORK_ID=""

# Run Claude Code headless
CMD ["claude", "--headless"]
```

**MCP Configuration:**
```json
{
  "mcpServers": {
    "fractary-faber": {
      "command": "node",
      "args": ["/mcp-servers/fractary-faber/dist/server.js"],
      "env": {
        "FABER_RUNS_PATH": "/workspace/.fractary/runs"
      }
    },
    "fractary-repo": {
      "command": "node",
      "args": ["/mcp-servers/fractary-repo/dist/server.js"]
    },
    "fractary-work": {
      "command": "node",
      "args": ["/mcp-servers/fractary-work/dist/server.js"]
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

## 4. Multi-Model Support via MCP

### 4.1 Architecture Rationale

Rather than using LangGraph's multi-model routing, FABER achieves multi-model support through an **MCP server that wraps other LLM APIs**. This approach:

- ✅ Keeps Claude Code as the orchestrator (what it's best at)
- ✅ Allows other models for specific tasks (code review, creative writing, etc.)
- ✅ Maintains a single, simple architecture
- ✅ No LangGraph/LangChain dependency

### 4.2 Multi-Model MCP Server - Tool Definitions

The multi-model MCP server exposes these tools to Claude Code:

1. **invoke_gpt4** - Direct GPT-4 invocation for different perspective
2. **invoke_gemini** - Direct Gemini invocation for Google knowledge
3. **route_to_best_model** - Smart routing based on task type
4. **get_multi_model_consensus** - Get responses from multiple models

See full implementation in the FABER monorepo under `mcp-servers/multi-model-router/`.

### 4.3 Usage Examples

#### Example 1: Evaluate Phase with GPT-4 Code Review

```typescript
// Inside FABER Evaluate agent (running in Claude Code)

// Claude orchestrates, but uses GPT-4 for code review
const gptReview = await invoke_gpt4({
  prompt: `Review this code for potential bugs and security issues:

${codeContent}

Provide:
1. Specific issues found (with line numbers)
2. Severity rating (critical, high, medium, low)
3. Suggested fixes`,
  temperature: 0.3
});

const evaluation = {
  status: 'completed',
  confidence: 0.85,
  risk: 'low',
  output: {
    claude_analysis: myAnalysis,
    gpt4_review: gptReview,
    final_verdict: 'GO'
  }
};
```

#### Example 2: Smart Model Routing

```typescript
// Claude Code automatically routes to best model

// For code generation: Claude
const implementation = await route_to_best_model({
  task: 'Implement authentication middleware',
  task_type: 'code_generation'
});

// For code review: GPT-4
const review = await route_to_best_model({
  task: 'Review authentication middleware for security',
  task_type: 'code_review'
});

// For factual research: Gemini
const research = await route_to_best_model({
  task: 'Latest OAuth 2.0 best practices?',
  task_type: 'search'
});
```

## 5. FABER Workflow Execution Pattern

### 5.1 Workflow Controller (Claude Code)

When Claude Code receives "Run FABER workflow for issue #123":

```typescript
// 1. Fetch issue details
const issue = await fractary_work_issue_fetch({ issue_id: "123" });

// 2. Create TodoWrite plan
await TodoWrite({
  todos: [
    { content: "Frame: Understand requirements", status: "pending", activeForm: "Framing" },
    { content: "Architect: Create specification", status: "pending", activeForm: "Architecting" },
    { content: "Build: Implement solution", status: "pending", activeForm: "Building" },
    { content: "Evaluate: Validate implementation", status: "pending", activeForm: "Evaluating" },
    { content: "Release: Create pull request", status: "pending", activeForm: "Releasing" }
  ]
});

// 3. Execute each phase
for (const phase of ["frame", "architect", "build", "evaluate", "release"]) {
  // Update todo to in_progress
  await TodoWrite({ /* update status */ });

  // Emit phase start event
  await fractary_faber_event_emit({
    run_id: runId,
    type: "phase_started",
    phase: phase
  });

  // Spawn phase agent via Task tool
  const result = await Task({
    subagent_type: `fractary-faber:${phase}`,
    description: `Execute ${phase} phase`,
    prompt: `Execute ${phase} for issue #123. Return structured PhaseResult.`
  });

  // Parse result and apply intelligent guardrails
  const phaseResult = JSON.parse(result);
  const decision = evaluateGuardrails(phaseResult.confidence, phaseResult.risk);

  if (decision.escalate) {
    const approval = await AskUserQuestion({ /* ... */ });
    if (!approval) break;
  }

  // Update todo to completed
  await TodoWrite({ /* mark completed */ });

  // Emit phase completion
  await fractary_faber_event_emit({
    run_id: runId,
    type: "phase_completed",
    phase: phase
  });
}
```

### 5.2 Phase Agent Result Contract

Each phase agent returns this structure:

```typescript
interface PhaseResult {
  status: "success" | "failure";
  confidence: number;  // 0.0 - 1.0
  risk: "low" | "medium" | "high" | "critical";
  output: {
    [key: string]: any;  // Phase-specific outputs
  };
  recommended_next_action: {
    proceed: boolean;
    retry?: boolean;
    escalate?: boolean;
    branch_to?: string;  // e.g., "debug"
  };
}
```

### 5.3 Intelligent Guardrails

```typescript
function evaluateGuardrails(confidence: number, risk: string): GuardrailDecision {
  // High confidence + Low risk = proceed
  if (confidence >= 0.8 && risk === "low") {
    return { proceed: true, escalate: false };
  }

  // Low confidence OR Critical risk = escalate
  if (confidence < 0.5 || risk === "critical") {
    return { proceed: false, escalate: true };
  }

  // Medium cases = proceed with notification
  return { proceed: true, escalate: false, notify: true };
}
```

## 6. Comparison: Claude Code vs. LangGraph

| Aspect | Claude Code | LangGraph |
|--------|-------------|-----------|
| **Orchestration** | Task + TodoWrite | StateGraph |
| **Dependencies** | None (native) | LangGraph + LangChain |
| **Time to Ship** | 2-4 weeks | 2-3 months |
| **Multi-model** | Via MCP ✅ | Native ✅ |
| **Production-Ready** | ✅ (@claude uses it) | ⚠️ Custom setup |
| **Portability** | Claude Code only | Runs anywhere |
| **Complexity** | Low | High |
| **Cost** | Lower | Higher (LangSmith) |

## 7. Implementation Roadmap

### Phase 1: Core Infrastructure (Week 1-2)
- [ ] Docker runtime image
- [ ] Workspace Manager
- [ ] Message Router
- [ ] Multi-model MCP server
- [ ] Web UI adapter

### Phase 2: FABER Integration (Week 3-4)
- [ ] Phase Result contract
- [ ] Intelligent guardrails
- [ ] TodoWrite state machine
- [ ] Phase agents

### Phase 3: Additional Interfaces (Week 5-6)
- [ ] GitHub adapter
- [ ] Slack adapter
- [ ] Authentication

### Phase 4: Production Hardening (Week 7-8)
- [ ] Error handling
- [ ] Monitoring
- [ ] Load testing
- [ ] Documentation

## 8. Success Criteria

### Functional
- [ ] Trigger workflow from web/Slack/GitHub
- [ ] Claude Code orchestrates via Task tool
- [ ] TodoWrite tracks progress
- [ ] Intelligent guardrails work
- [ ] Multi-model support via MCP
- [ ] Events flow correctly

### Non-Functional
- [ ] < 10 min workflow completion
- [ ] 10+ concurrent workflows
- [ ] 99% uptime
- [ ] < 500ms message latency

## 9. References

- [Claude Code Documentation](https://docs.anthropic.com/claude/code)
- [Model Context Protocol](https://spec.modelcontextprotocol.io)
- [SPEC-00028: Intelligent Guardrails](./SPEC-00028-intelligent-guardrails.md)
- [SPEC-20251217: FABER MCP Server](./SPEC-20251217-faber-mcp-server.md)

---

**Document Status:** Draft
**Last Updated:** 2025-12-19
**Next Review:** After Phase 1 implementation
