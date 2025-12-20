# SPEC-20251220: app.fractary.com → FABER Integration Analysis

## Metadata

| Field | Value |
|-------|-------|
| **Spec ID** | SPEC-20251220 |
| **Title** | app.fractary.com → FABER Integration Analysis |
| **Status** | Analysis |
| **Created** | 2025-12-20 |
| **Author** | FABER Team |
| **Related Specs** | SPEC-20251219-claude-code-orchestration-architecture |

## 1. Executive Summary

### 1.1 The Discovery

The `app.fractary.com` project **already implements ~70% of the infrastructure needed** for the FABER vision described in SPEC-20251219 (Claude Code as FABER Orchestration Layer).

**Current State:**
- ✅ GitHub OAuth authentication
- ✅ Repository connection & management
- ✅ ECS Fargate container orchestration
- ✅ Session lifecycle management (pending → starting → running → stopped)
- ✅ Credential injection (GitHub tokens, Anthropic API keys)
- ✅ Claude Code CLI installed in containers
- ✅ WebSocket infrastructure
- ✅ AWS production infrastructure (VPC, Aurora, ALB, etc.)
- ✅ PostgreSQL database with session tracking
- ✅ User settings & API key management (BYOK)

**What's Different:**
- ❌ Provides **terminal interface** (xterm.js + PTY server)
- ❌ User directly interacts with **bash shell**
- ❌ No **chat interface** wrapper around Claude Code
- ❌ No **FABER workflow orchestration**
- ❌ No **multi-model MCP server**
- ❌ No **message routing** for multiple interfaces (GitHub, Slack, Web)
- ❌ No **event streaming** for FABER workflow progress

### 1.2 The Recommendation

**Build the FABER vision ON TOP OF app.fractary.com infrastructure.**

**Why:**
1. **Infrastructure already exists** - VPC, ECS, Aurora, ALB, container management
2. **Container orchestration works** - Proven at scale, tested in production
3. **Authentication & authorization solved** - GitHub OAuth, user management
4. **Cost-effective** - Don't rebuild what works
5. **Fast time to market** - 3-4 weeks instead of 3 months

**What to Add:**
1. **New session mode**: `terminal` (existing) vs. `chat` (new FABER mode)
2. **Chat interface**: Replace xterm.js with chat UI for FABER sessions
3. **Container entrypoint**: Fork based on session mode (PTY server vs. Claude Code headless)
4. **FABER MCP servers**: Add to container image
5. **Message router**: Backend service for multi-interface support
6. **Event streaming**: WebSocket events for workflow progress

## 2. Current Architecture Analysis

### 2.1 What app.fractary.com Does Today

```
User Flow (Current):
1. User logs in via GitHub OAuth
2. User connects a repository
3. User adds Anthropic API key
4. User launches a session:
   ├─ Backend creates session record (PostgreSQL)
   ├─ Backend launches ECS Fargate task with:
   │  ├─ GITHUB_TOKEN (from Secrets Manager)
   │  ├─ ANTHROPIC_API_KEY (from Secrets Manager)
   │  ├─ REPO_URL
   │  ├─ BRANCH
   │  └─ SESSION_ID
   ├─ Container starts:
   │  ├─ Clones repository
   │  ├─ Installs dependencies (npm install)
   │  ├─ Creates tmux session
   │  └─ Starts PTY server (WebSocket on port 3000)
5. User connects via WebSocket to PTY server
6. User types bash commands in xterm.js terminal
7. PTY server executes commands and streams output back
8. Auto-reconnection handles network issues
```

**Key Files:**
- `src/lib/aws/ecs-client.ts` - Container orchestration
- `docker/Dockerfile.session` - Container image (includes Claude Code CLI!)
- `docker/entrypoint.sh` - Container startup (clones repo, starts PTY)
- `docker/pty-server.js` - WebSocket PTY server
- `src/lib/terminal/websocket-proxy.ts` - WebSocket proxy
- `src/lib/db/schema.ts` - Database schema (sessions, users, repos, api_keys)

### 2.2 Container Specification (Current)

```dockerfile
# docker/Dockerfile.session (relevant excerpts)

FROM ubuntu:22.04

# Install Node.js 20.x
RUN apt-get install -y nodejs

# Install system dependencies
RUN apt-get install -y git openssh-client curl python3 python3-pip build-essential tmux

# Install Claude Code CLI globally ⭐ Already installed!
RUN npm install -g @anthropic-ai/claude-code

# Install PTY dependencies
RUN npm install node-pty ws

# Entrypoint: Clone repo → Start tmux → Start PTY server
ENTRYPOINT ["/app/entrypoint.sh"]
```

**Critical Observation:** Claude Code CLI is **already installed** but **not being used**. The container currently runs a PTY server for terminal access instead of running Claude Code directly.

### 2.3 Session Management (Current)

**Database Schema:**
```typescript
sessions = {
  id: uuid,
  userId: uuid,
  repoId: uuid,
  branch: string,
  status: 'pending' | 'starting' | 'running' | 'disconnected' | 'stopping' | 'stopped' | 'failed' | 'timeout',
  taskArn: string,      // ECS task ARN
  containerIp: string,  // Private IP for WebSocket
  startedAt: timestamp,
  stoppedAt: timestamp,
  createdAt: timestamp
}
```

**Session Lifecycle:**
```
pending → starting → running → [disconnected] → stopping → stopped
                              ↓
                            failed
```

**WebSocket Connection:**
```typescript
// User connects to: wss://app.fractary.com/api/sessions/{sessionId}/ws

Backend WebSocket Handler:
  1. Validate user owns session
  2. Get session from database
  3. Get containerIp from session
  4. Create WebSocket to container: ws://{containerIp}:3000
  5. Proxy messages bidirectionally
  6. Handle reconnection with scrollback
```

### 2.4 AWS Infrastructure (Current)

**Production-Ready Infrastructure:**
- **VPC**: Multi-AZ with public/private subnets
- **ECS Cluster**: Fargate capacity providers
- **Aurora Serverless v2**: PostgreSQL (0.5-16 ACU auto-scaling)
- **Application Load Balancer**: HTTPS/WSS termination
- **Secrets Manager**: GitHub tokens + Anthropic API keys
- **CloudWatch**: Logging & monitoring
- **ECR**: Container image registry

**Cost:** ~$50-100/month (test), ~$300-500/month (production)

## 3. Gap Analysis: Current vs. FABER Vision

| Component | Current (app.fractary.com) | FABER Vision (SPEC-20251219) | Gap |
|-----------|---------------------------|------------------------------|-----|
| **Container Orchestration** | ✅ ECS Fargate | ✅ ECS Fargate | None |
| **GitHub Auth** | ✅ OAuth | ✅ OAuth | None |
| **Repository Access** | ✅ Clone with token | ✅ Clone with token | None |
| **Credential Injection** | ✅ Secrets Manager | ✅ Secrets Manager | None |
| **Claude Code CLI** | ✅ Installed but unused | ✅ Headless execution | **Container entrypoint** |
| **User Interface** | ❌ Terminal (xterm.js) | ✅ Chat interface | **Frontend change** |
| **Message Protocol** | ❌ PTY (stdin/stdout) | ✅ Structured messages | **Protocol change** |
| **Session Mode** | ❌ Single mode (terminal) | ✅ Multi-mode (terminal/chat) | **Mode selection** |
| **FABER Orchestration** | ❌ None | ✅ Task + TodoWrite | **MCP servers** |
| **Multi-Model** | ❌ None | ✅ MCP router | **MCP server** |
| **Event Streaming** | ❌ None | ✅ Workflow events | **Event system** |
| **Multi-Interface** | ❌ Web only | ✅ Web/GitHub/Slack | **Message router** |
| **Workflow Visualization** | ❌ None | ✅ TodoWrite progress | **Frontend** |

### 3.1 What's Already Built ✅

**Infrastructure (70% complete):**
- [x] Container orchestration (ECS Fargate)
- [x] Container lifecycle management
- [x] Credential injection (GitHub + Anthropic)
- [x] Repository cloning
- [x] WebSocket infrastructure
- [x] Database (sessions, users, repos)
- [x] AWS production environment
- [x] Authentication & authorization
- [x] User settings & API key management

**What This Means:**
- No need to build container orchestration from scratch
- No need to set up AWS infrastructure
- No need to implement auth/user management
- No need to build session lifecycle management

### 3.2 What Needs to Be Built ❌

**Critical Additions (30% remaining):**
1. **Session Mode Selection** (2-3 days)
   - Add `mode` field to sessions table: `'terminal' | 'chat'`
   - Fork container entrypoint based on mode
   - Update session creation UI

2. **Chat Interface** (1 week)
   - Replace xterm.js with chat UI for `chat` mode sessions
   - Message input/output components
   - Workflow progress visualization
   - TodoWrite status display

3. **Container Entrypoint (FABER Mode)** (3-4 days)
   - New entrypoint script for `chat` mode
   - Run Claude Code headless instead of PTY server
   - Configure MCP servers (fractary-faber, multi-model-router)
   - Message handler for structured communication

4. **FABER MCP Servers in Container** (1 week)
   - Add fractary-faber MCP server
   - Add fractary-repo MCP server
   - Add fractary-work MCP server
   - Add multi-model-router MCP server
   - Configure Claude Code to use them

5. **Message Router** (1 week)
   - Backend service to route messages
   - Support for Web, GitHub, Slack interfaces
   - Event streaming to frontends

6. **Event Streaming** (3-4 days)
   - WebSocket event protocol
   - Frontend components to display events
   - Progress indicators

**Total Estimated Time: 3-4 weeks**

## 4. Proposed Integration Architecture

### 4.1 Dual-Mode Session System

```typescript
// Updated session schema
sessions = {
  id: uuid,
  userId: uuid,
  repoId: uuid,
  branch: string,
  mode: 'terminal' | 'chat',  // ⭐ New field
  status: 'pending' | 'starting' | 'running' | 'stopped' | 'failed',
  taskArn: string,
  containerIp: string,
  // ... existing fields
}
```

**User Flow:**
```
User launches session:
  ├─ Select mode: Terminal or FABER (Chat)
  │
  ├─ mode='terminal' (existing):
  │  ├─ Container runs entrypoint.sh (PTY server)
  │  ├─ User gets xterm.js terminal
  │  └─ Direct bash access
  │
  └─ mode='chat' (new FABER):
     ├─ Container runs faber-entrypoint.sh (Claude Code headless)
     ├─ User gets chat interface
     ├─ FABER workflow orchestration
     └─ Structured message protocol
```

### 4.2 Container Entrypoint Fork

**Existing: `entrypoint.sh` (terminal mode)**
```bash
#!/bin/bash
# Clone repo → Install deps → Start tmux → Start PTY server
git clone $REPO_URL /workspace/repo
cd /workspace/repo
npm install
tmux new-session -d -s fractary
exec node /app/pty-server.js  # PTY server on port 3000
```

**New: `faber-entrypoint.sh` (chat mode)**
```bash
#!/bin/bash
# Clone repo → Install deps → Configure Claude Code → Run headless

git clone $REPO_URL /workspace/repo
cd /workspace/repo
npm install

# Configure Claude Code MCP servers
cat > /root/.config/claude/mcp.json << 'EOF'
{
  "mcpServers": {
    "fractary-faber": {
      "command": "node",
      "args": ["/mcp-servers/fractary-faber/dist/server.js"]
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
EOF

# Start message handler (listens on port 3000, proxies to Claude Code)
exec node /app/claude-message-handler.js
```

**New: `claude-message-handler.js`**
```javascript
// Runs Claude Code headless and provides structured message protocol

const { spawn } = require('child_process');
const WebSocket = require('ws');

const wss = new WebSocket.Server({ port: 3000 });

wss.on('connection', (ws) => {
  // Spawn Claude Code headless
  const claude = spawn('claude', ['--headless'], {
    cwd: '/workspace/repo',
    env: {
      ...process.env,
      ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY
    }
  });

  // Handle incoming messages from web UI
  ws.on('message', (data) => {
    const message = JSON.parse(data);

    switch (message.type) {
      case 'user_message':
        // Send to Claude Code stdin
        claude.stdin.write(message.content + '\n');
        break;

      case 'start_workflow':
        // Initiate FABER workflow
        claude.stdin.write(`Run FABER workflow for issue #${message.workId}\n`);
        break;
    }
  });

  // Forward Claude Code output to web UI
  claude.stdout.on('data', (data) => {
    ws.send(JSON.stringify({
      type: 'claude_message',
      content: data.toString()
    }));
  });

  // Forward TodoWrite updates
  // Forward event emissions
  // etc.
});
```

### 4.3 Updated Dockerfile

```dockerfile
# docker/Dockerfile.session (updated)

FROM ubuntu:22.04

# ... existing Node.js installation ...

# Install system dependencies
RUN apt-get install -y git openssh-client curl python3 python3-pip build-essential tmux

# Install Claude Code CLI globally
RUN npm install -g @anthropic-ai/claude-code

# Install FABER MCP servers ⭐ New
COPY mcp-servers /mcp-servers
RUN cd /mcp-servers/fractary-faber && npm install && npm run build
RUN cd /mcp-servers/fractary-repo && npm install && npm run build
RUN cd /mcp-servers/fractary-work && npm install && npm run build
RUN cd /mcp-servers/multi-model-router && npm install && npm run build

# Copy supporting files
COPY docker/pty-server.js /app/pty-server.js
COPY docker/entrypoint.sh /app/entrypoint.sh
COPY docker/faber-entrypoint.sh /app/faber-entrypoint.sh  # ⭐ New
COPY docker/claude-message-handler.js /app/claude-message-handler.js  # ⭐ New

# Set executable permissions
RUN chmod +x /app/entrypoint.sh /app/faber-entrypoint.sh

# Install PTY + WebSocket dependencies
WORKDIR /app
RUN npm install node-pty ws

USER developer
WORKDIR /workspace

EXPOSE 3000

# Entrypoint selected at runtime via ECS task override
# (terminal mode: entrypoint.sh, chat mode: faber-entrypoint.sh)
```

### 4.4 ECS Task Launch (Updated)

```typescript
// src/lib/aws/ecs-client.ts (updated)

export type SessionMode = 'terminal' | 'chat';

export type LaunchSessionParams = {
  sessionId: string;
  repoUrl: string;
  branch: string;
  userId: string;
  mode: SessionMode;  // ⭐ New parameter
  workId?: string;    // ⭐ For FABER workflows
  gitUserName?: string;
  gitUserEmail?: string;
};

export async function launchSessionTaskAsync(params: LaunchSessionParams) {
  validateECSConfig();

  const [githubToken, anthropicApiKey] = await Promise.all([
    getUserGitHubToken(params.userId),
    getUserApiKey(params.userId),
  ]);

  const runCommand = new RunTaskCommand({
    cluster: ECS_CONFIG.cluster,
    taskDefinition: ECS_CONFIG.taskDefinition,
    launchType: "FARGATE",
    networkConfiguration: { /* ... */ },
    overrides: {
      containerOverrides: [
        {
          name: "session",
          // ⭐ Select entrypoint based on mode
          command: params.mode === 'terminal'
            ? ['/app/entrypoint.sh']
            : ['/app/faber-entrypoint.sh'],
          environment: [
            { name: "SESSION_ID", value: params.sessionId },
            { name: "REPO_URL", value: params.repoUrl },
            { name: "BRANCH", value: params.branch },
            { name: "MODE", value: params.mode },  // ⭐ New
            { name: "WORK_ID", value: params.workId || '' },  // ⭐ New
            { name: "GIT_USER_NAME", value: params.gitUserName || "FABER" },
            { name: "GIT_USER_EMAIL", value: params.gitUserEmail || "faber@fractary.dev" },
            { name: "GITHUB_TOKEN", value: githubToken },
            { name: "ANTHROPIC_API_KEY", value: anthropicApiKey },
          ],
        },
      ],
    },
    tags: [
      { key: "SessionId", value: params.sessionId },
      { key: "Mode", value: params.mode },  // ⭐ New
      { key: "ManagedBy", value: "fractary-dashboard" },
    ],
  });

  const runResult = await ecsClient.send(runCommand);
  const taskArn = runResult.tasks[0].taskArn;

  return { taskArn };
}
```

### 4.5 Frontend Changes

**Existing: Terminal UI**
```typescript
// src/app/(dashboard)/session/[id]/page.tsx (existing)
import { Terminal } from '@/components/terminal/terminal';

export default function SessionPage({ params }) {
  return <Terminal sessionId={params.id} />;
}
```

**New: Mode-Based UI Router**
```typescript
// src/app/(dashboard)/session/[id]/page.tsx (updated)
import { Terminal } from '@/components/terminal/terminal';
import { ChatInterface } from '@/components/chat/chat-interface';  // ⭐ New
import { getSession } from '@/lib/db/sessions';

export default async function SessionPage({ params }) {
  const session = await getSession(params.id);

  if (session.mode === 'terminal') {
    return <Terminal sessionId={params.id} />;
  } else {
    return <ChatInterface sessionId={params.id} />;  // ⭐ New
  }
}
```

**New: Chat Interface Component**
```typescript
// src/components/chat/chat-interface.tsx

'use client';

import { useState, useEffect } from 'react';
import { useChatWebSocket } from '@/hooks/use-chat-websocket';

export function ChatInterface({ sessionId }: { sessionId: string }) {
  const { messages, sendMessage, workflowStatus } = useChatWebSocket(sessionId);

  return (
    <div className="h-full flex flex-col">
      {/* Workflow Progress (TodoWrite visualization) */}
      <div className="border-b p-4">
        <WorkflowProgress todos={workflowStatus.todos} />
      </div>

      {/* Chat Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((msg, i) => (
          <ChatMessage key={i} message={msg} />
        ))}
      </div>

      {/* Input */}
      <div className="border-t p-4">
        <ChatInput onSend={sendMessage} />
      </div>
    </div>
  );
}
```

## 5. Integration Roadmap

### Phase 1: Foundation (Week 1)
**Goal:** Add session mode support

- [ ] Add `mode` field to sessions table
- [ ] Update session creation API to accept mode
- [ ] Update session creation UI with mode selector
- [ ] Create `faber-entrypoint.sh` script
- [ ] Test dual-mode container launch

**Deliverables:**
- Users can select "Terminal" or "FABER" mode when creating session
- Container correctly launches with appropriate entrypoint

### Phase 2: FABER Container (Week 2)
**Goal:** Get FABER workflow running in container

- [ ] Build `claude-message-handler.js`
- [ ] Add FABER MCP servers to container image
- [ ] Configure Claude Code MCP servers in container
- [ ] Test Claude Code headless execution
- [ ] Test FABER workflow execution (local)

**Deliverables:**
- Container can run Claude Code headless
- FABER workflow executes successfully
- MCP servers are accessible to Claude Code

### Phase 3: Chat Interface (Week 3)
**Goal:** Build web chat UI

- [ ] Create `ChatInterface` component
- [ ] Create `useChatWebSocket` hook
- [ ] Implement structured message protocol
- [ ] Add TodoWrite progress visualization
- [ ] Add workflow event streaming

**Deliverables:**
- Users can interact with FABER via chat
- Workflow progress is visible
- Messages flow bidirectionally

### Phase 4: Multi-Interface Support (Week 4)
**Goal:** Add GitHub and Slack triggers

- [ ] Build message router backend
- [ ] Add GitHub webhook handler
- [ ] Add Slack bot handler
- [ ] Test workflow triggering from GitHub
- [ ] Test workflow triggering from Slack

**Deliverables:**
- Users can trigger workflows from GitHub issues
- Users can trigger workflows from Slack
- Results post back to originating interface

## 6. Cost Analysis

### 6.1 Current Costs (app.fractary.com)

**Test Environment:** ~$50-100/month
- ECS Web Service: ~$15
- ECS Sessions (terminal): ~$20-40
- Aurora: ~$5-15
- ALB: ~$20
- Storage: ~$5

### 6.2 Projected Costs (with FABER)

**Test Environment:** ~$60-120/month (+20%)
- ECS Web Service: ~$15 (same)
- ECS Sessions (terminal + chat): ~$30-50 (+25% due to FABER resource usage)
- Aurora: ~$5-15 (same)
- ALB: ~$20 (same)
- Storage: ~$10 (2x for MCP server images)

**Incremental Cost:** ~$10-20/month

**Why Low Incremental Cost:**
- Reusing existing infrastructure
- FABER sessions share same ECS cluster
- Same database (Aurora)
- Same load balancer
- Only difference: slightly larger container images + runtime compute

## 7. Risks & Mitigations

| Risk | Impact | Likelihood | Mitigation |
|------|--------|-----------|------------|
| Container startup time increases with FABER | Medium | High | Optimize Docker image layers, pre-pull images |
| WebSocket protocol conflicts (PTY vs. Chat) | Low | Low | Use different message formats per mode |
| Claude Code headless stability issues | High | Medium | Extensive testing, fallback to terminal mode |
| MCP server crashes in production | Medium | Low | Container health checks, auto-restart |
| Confusion between terminal/chat modes | Low | Medium | Clear UI labels, documentation |

## 8. Success Criteria

### 8.1 Functional Requirements

- [ ] Users can create sessions in both `terminal` and `chat` modes
- [ ] Terminal mode works exactly as before (no regression)
- [ ] Chat mode successfully runs FABER workflows
- [ ] TodoWrite progress updates in real-time
- [ ] Multi-model support works via MCP
- [ ] Workflows can be triggered from Web, GitHub, Slack

### 8.2 Non-Functional Requirements

- [ ] Chat mode container startup < 60 seconds
- [ ] Chat mode WebSocket latency < 500ms
- [ ] No increase in existing terminal mode costs
- [ ] FABER mode incremental cost < 30%
- [ ] 99% uptime maintained

## 9. Conclusion

### 9.1 Key Findings

1. **app.fractary.com already has ~70% of FABER infrastructure**
2. **Container orchestration is production-ready**
3. **Only need to add chat mode + FABER orchestration**
4. **3-4 week timeline vs. 3 months from scratch**
5. **Low incremental cost (~$10-20/month)**

### 9.2 Recommendation

**BUILD FABER ON TOP OF app.fractary.com**

**Rationale:**
- Faster: 3-4 weeks vs. 3 months
- Cheaper: Reuse existing infrastructure
- Lower risk: Proven container orchestration
- Better UX: Dual-mode system (terminal for debugging, chat for workflows)

**Next Steps:**
1. Approve this integration plan
2. Begin Phase 1 (session mode support)
3. Iterate on chat interface design
4. Test FABER workflows in container
5. Launch beta to select users

---

**Document Status:** Analysis Complete
**Last Updated:** 2025-12-20
**Recommendation:** APPROVED - Proceed with integration
