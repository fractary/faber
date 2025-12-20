# SPEC-20251220: app.fractary.com FABER Mode Implementation Plan

## Metadata

| Field | Value |
|-------|-------|
| **Spec ID** | SPEC-20251220-IMPL |
| **Title** | app.fractary.com FABER Mode Implementation Plan |
| **Status** | Ready for Implementation |
| **Created** | 2025-12-20 |
| **Target Project** | app.fractary.com |
| **Estimated Timeline** | 4 weeks (4 sprints) |
| **Related Specs** | SPEC-20251220-app-fractary-com-faber-integration |

## 1. Executive Summary

### 1.1 Objective

Add a new "FABER mode" to app.fractary.com that enables AI-powered workflow automation using Claude Code's orchestration capabilities, while maintaining the existing terminal mode for backward compatibility.

### 1.2 Scope

**In Scope:**
- Add dual-mode session support (terminal/chat)
- Create chat interface for FABER sessions
- Modify container to support both modes
- Add FABER MCP servers to container
- Implement structured message protocol
- Add workflow progress visualization

**Out of Scope:**
- Removing or deprecating terminal mode
- Multi-interface support (GitHub, Slack) - future phase
- Custom FABER workflow definitions - future phase
- Workflow marketplace - future phase

### 1.3 Timeline

```
Week 1: Database + Backend (Sprint 1)
Week 2: Container Changes (Sprint 2)
Week 3: Frontend Chat UI (Sprint 3)
Week 4: Testing + Polish (Sprint 4)
```

### 1.4 Success Criteria

- [ ] Users can select between Terminal and FABER modes
- [ ] Terminal mode continues to work exactly as before (no regressions)
- [ ] FABER mode successfully executes workflows
- [ ] Chat interface displays messages and progress
- [ ] All tests pass
- [ ] Documentation updated

## 2. Architecture Overview

### 2.1 Current Architecture

```
User → Web UI (xterm.js)
  ↓ WebSocket (/api/sessions/{id}/ws)
Backend Proxy
  ↓ WebSocket (ws://{containerIp}:3000)
Container (PTY Server)
  ↓
Bash Shell
```

### 2.2 New Architecture (Dual Mode)

```
User selects mode when creating session:

├─ mode='terminal' (existing):
│  User → xterm.js → WebSocket → PTY Server → Bash
│
└─ mode='chat' (new):
   User → Chat UI → WebSocket → Message Handler → Claude Code (headless)
     ↓
   FABER Workflow:
     - Task tool (spawn agents)
     - TodoWrite (state tracking)
     - MCP servers (workflow orchestration)
     - Events (progress updates)
```

### 2.3 Key Changes

| Component | Change | Impact |
|-----------|--------|--------|
| Database | Add `mode` column to sessions | Low - backward compatible |
| API | Add mode parameter to session creation | Low - optional parameter |
| Container | Add alternate entrypoint for FABER | Medium - new file |
| Docker Image | Add FABER MCP servers | Medium - larger image |
| Frontend | Add mode selector + chat UI | High - new components |
| WebSocket | Support both PTY and structured messages | Medium - protocol detection |

## 3. Sprint 1: Database + Backend (Week 1)

### 3.1 Database Migration

**File:** `src/lib/db/migrations/0003_add_session_mode.sql`

```sql
-- Add mode column to sessions table
ALTER TABLE sessions
ADD COLUMN mode VARCHAR(10)
DEFAULT 'terminal'
CHECK (mode IN ('terminal', 'chat'));

-- Add index for filtering by mode
CREATE INDEX idx_sessions_mode ON sessions(mode);

-- Add work_id for FABER workflows
ALTER TABLE sessions
ADD COLUMN work_id VARCHAR(50);

-- Add index for work_id lookups
CREATE INDEX idx_sessions_work_id ON sessions(work_id) WHERE work_id IS NOT NULL;

-- Add comment
COMMENT ON COLUMN sessions.mode IS 'Session mode: terminal (bash shell) or chat (FABER workflow)';
COMMENT ON COLUMN sessions.work_id IS 'GitHub issue number or work item ID for FABER workflows';
```

**Migration Script:** `npm run db:push` or manual via SQL console

**Rollback:**
```sql
ALTER TABLE sessions DROP COLUMN mode;
ALTER TABLE sessions DROP COLUMN work_id;
DROP INDEX IF EXISTS idx_sessions_mode;
DROP INDEX IF EXISTS idx_sessions_work_id;
```

### 3.2 Schema Updates

**File:** `src/lib/db/schema.ts`

```typescript
// Add enum for session mode
export const sessionModeEnum = pgEnum("session_mode", [
  "terminal",
  "chat",
]);

// Update sessions table
export const sessions = pgTable("sessions", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .references(() => users.id, { onDelete: "cascade" })
    .notNull(),
  repoId: uuid("repo_id")
    .references(() => repos.id, { onDelete: "cascade" })
    .notNull(),
  branch: varchar("branch", { length: 100 }).notNull(),
  mode: sessionModeEnum("mode").default("terminal").notNull(),  // ⭐ New
  workId: varchar("work_id", { length: 50 }),  // ⭐ New (for FABER workflows)
  status: sessionStatusEnum("status").default("pending").notNull(),
  taskArn: varchar("task_arn", { length: 255 }),
  containerIp: varchar("container_ip", { length: 45 }),
  lastActivityAt: timestamp("last_activity_at"),
  startedAt: timestamp("started_at"),
  stoppedAt: timestamp("stopped_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Update type exports
export type Session = typeof sessions.$inferSelect;
export type NewSession = typeof sessions.$inferInsert;
export type SessionMode = "terminal" | "chat";
```

### 3.3 API Route Changes

**File:** `src/app/api/sessions/route.ts`

```typescript
// POST /api/sessions - Create new session
import { z } from "zod";

const createSessionSchema = z.object({
  repoId: z.string().uuid(),
  branch: z.string().min(1).max(100),
  mode: z.enum(["terminal", "chat"]).default("terminal"),  // ⭐ New
  workId: z.string().max(50).optional(),  // ⭐ New (for FABER workflows)
});

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const validated = createSessionSchema.parse(body);

  // Validate mode-specific requirements
  if (validated.mode === "chat" && !validated.workId) {
    return Response.json(
      { error: "workId required for FABER (chat) mode" },
      { status: 400 }
    );
  }

  // Get repository
  const repo = await db.query.repos.findFirst({
    where: and(
      eq(repos.id, validated.repoId),
      eq(repos.userId, session.user.id)
    ),
  });

  if (!repo) {
    return Response.json({ error: "Repository not found" }, { status: 404 });
  }

  // Create session record
  const [newSession] = await db
    .insert(sessions)
    .values({
      userId: session.user.id,
      repoId: validated.repoId,
      branch: validated.branch,
      mode: validated.mode,  // ⭐ New
      workId: validated.workId,  // ⭐ New
      status: "pending",
    })
    .returning();

  // Launch ECS task
  const { taskArn } = await launchSessionTaskAsync({
    sessionId: newSession.id,
    repoUrl: repo.cloneUrl,
    branch: validated.branch,
    userId: session.user.id,
    mode: validated.mode,  // ⭐ New
    workId: validated.workId,  // ⭐ New
    gitUserName: session.user.name || "Fractary Developer",
    gitUserEmail: session.user.email || "developer@fractary.com",
  });

  // Update session with task ARN
  await db
    .update(sessions)
    .set({ taskArn, status: "starting" })
    .where(eq(sessions.id, newSession.id));

  return Response.json({
    ...newSession,
    taskArn,
    status: "starting",
  });
}
```

### 3.4 ECS Client Updates

**File:** `src/lib/aws/ecs-client.ts`

```typescript
export type SessionMode = "terminal" | "chat";

export type LaunchSessionParams = {
  sessionId: string;
  repoUrl: string;
  branch: string;
  userId: string;
  mode: SessionMode;  // ⭐ New
  workId?: string;  // ⭐ New (for FABER workflows)
  gitUserName?: string;
  gitUserEmail?: string;
};

export async function launchSessionTaskAsync(params: LaunchSessionParams): Promise<{
  taskArn: string;
}> {
  validateECSConfig();

  const [githubToken, anthropicApiKey] = await Promise.all([
    getUserGitHubToken(params.userId),
    getUserApiKey(params.userId),
  ]);

  const runCommand = new RunTaskCommand({
    cluster: ECS_CONFIG.cluster,
    taskDefinition: ECS_CONFIG.taskDefinition,
    launchType: "FARGATE",
    networkConfiguration: {
      awsvpcConfiguration: {
        subnets: ECS_CONFIG.subnets,
        securityGroups: ECS_CONFIG.securityGroups,
        assignPublicIp: "ENABLED",
      },
    },
    overrides: {
      containerOverrides: [
        {
          name: "session",
          // ⭐ Select entrypoint based on mode
          command: params.mode === "terminal"
            ? ["/app/entrypoint.sh"]
            : ["/app/faber-entrypoint.sh"],
          environment: [
            { name: "SESSION_ID", value: params.sessionId },
            { name: "REPO_URL", value: params.repoUrl },
            { name: "BRANCH", value: params.branch },
            { name: "MODE", value: params.mode },  // ⭐ New
            { name: "WORK_ID", value: params.workId || "" },  // ⭐ New
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

  if (!runResult.tasks || runResult.tasks.length === 0) {
    const failures = runResult.failures?.[0];
    throw new ECSError(failures?.reason || "Failed to launch task", failures?.arn);
  }

  const taskArn = runResult.tasks[0].taskArn!;
  return { taskArn };
}
```

### 3.5 Testing (Sprint 1)

**Tests to Add:**

1. **Database Migration Test**
```typescript
// src/lib/db/__tests__/schema.test.ts
describe("Sessions schema", () => {
  it("should support mode column with default 'terminal'", async () => {
    const session = await db.insert(sessions).values({
      userId: testUserId,
      repoId: testRepoId,
      branch: "main",
      // mode defaults to 'terminal'
    }).returning();

    expect(session.mode).toBe("terminal");
  });

  it("should support chat mode", async () => {
    const session = await db.insert(sessions).values({
      userId: testUserId,
      repoId: testRepoId,
      branch: "main",
      mode: "chat",
      workId: "123",
    }).returning();

    expect(session.mode).toBe("chat");
    expect(session.workId).toBe("123");
  });
});
```

2. **API Route Test**
```typescript
// src/app/api/sessions/__tests__/route.test.ts
describe("POST /api/sessions", () => {
  it("should create terminal session by default", async () => {
    const response = await POST({
      json: async () => ({
        repoId: testRepoId,
        branch: "main",
      }),
    });

    const data = await response.json();
    expect(data.mode).toBe("terminal");
  });

  it("should create chat session with workId", async () => {
    const response = await POST({
      json: async () => ({
        repoId: testRepoId,
        branch: "main",
        mode: "chat",
        workId: "123",
      }),
    });

    const data = await response.json();
    expect(data.mode).toBe("chat");
    expect(data.workId).toBe("123");
  });

  it("should reject chat mode without workId", async () => {
    const response = await POST({
      json: async () => ({
        repoId: testRepoId,
        branch: "main",
        mode: "chat",
        // Missing workId
      }),
    });

    expect(response.status).toBe(400);
  });
});
```

3. **ECS Client Test**
```typescript
// src/lib/aws/__tests__/ecs-client.test.ts
describe("launchSessionTaskAsync", () => {
  it("should launch terminal session with PTY entrypoint", async () => {
    const result = await launchSessionTaskAsync({
      sessionId: "test-123",
      repoUrl: "https://github.com/test/repo",
      branch: "main",
      userId: "user-123",
      mode: "terminal",
    });

    expect(mockECSClient).toHaveBeenCalledWith(
      expect.objectContaining({
        overrides: expect.objectContaining({
          containerOverrides: expect.arrayContaining([
            expect.objectContaining({
              command: ["/app/entrypoint.sh"],
            }),
          ]),
        }),
      })
    );
  });

  it("should launch chat session with FABER entrypoint", async () => {
    const result = await launchSessionTaskAsync({
      sessionId: "test-456",
      repoUrl: "https://github.com/test/repo",
      branch: "main",
      userId: "user-123",
      mode: "chat",
      workId: "123",
    });

    expect(mockECSClient).toHaveBeenCalledWith(
      expect.objectContaining({
        overrides: expect.objectContaining({
          containerOverrides: expect.arrayContaining([
            expect.objectContaining({
              command: ["/app/faber-entrypoint.sh"],
              environment: expect.arrayContaining([
                { name: "MODE", value: "chat" },
                { name: "WORK_ID", value: "123" },
              ]),
            }),
          ]),
        }),
      })
    );
  });
});
```

**Deliverables (Sprint 1):**
- [x] Database migration applied
- [x] Schema types updated
- [x] API routes support mode parameter
- [x] ECS client supports dual entrypoints
- [x] All tests pass
- [x] No regressions in existing terminal sessions

## 4. Sprint 2: Container Changes (Week 2)

### 4.1 FABER Entrypoint Script

**File:** `docker/faber-entrypoint.sh`

```bash
#!/bin/bash
set -e

echo "[FABER] Starting FABER mode container..."

# Configure git with user's GitHub token
if [ -n "$GITHUB_TOKEN" ]; then
    git config --global credential.helper store
    echo "https://${GITHUB_TOKEN}:x-oauth-basic@github.com" > ~/.git-credentials
fi

# Configure git user
git config --global user.name "${GIT_USER_NAME:-FABER}"
git config --global user.email "${GIT_USER_EMAIL:-faber@fractary.dev}"

# Clone repository
WORK_DIR="/workspace"
if [ -n "$REPO_URL" ]; then
    echo "[FABER] Cloning repository: $REPO_URL"

    if [ -n "$BRANCH" ]; then
        git clone --branch "$BRANCH" "$REPO_URL" /workspace/repo
    else
        git clone "$REPO_URL" /workspace/repo
    fi

    WORK_DIR="/workspace/repo"
    cd "$WORK_DIR"

    # Install dependencies if package.json exists
    if [ -f "package.json" ]; then
        echo "[FABER] Installing dependencies..."
        npm install
    fi
fi

# Configure Claude Code MCP servers
echo "[FABER] Configuring MCP servers..."
mkdir -p /home/developer/.config/claude

cat > /home/developer/.config/claude/mcp.json << 'EOF'
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
        "OPENAI_API_KEY": "${OPENAI_API_KEY:-}",
        "GEMINI_API_KEY": "${GEMINI_API_KEY:-}"
      }
    }
  }
}
EOF

# Create initial message for Claude
INITIAL_MESSAGE="Run FABER workflow for work item #${WORK_ID}"

# Start Claude Code message handler
echo "[FABER] Starting message handler on port 3000..."
cd "$WORK_DIR"
exec node /app/claude-message-handler.js "$INITIAL_MESSAGE"
```

### 4.2 Claude Message Handler

**File:** `docker/claude-message-handler.js`

```javascript
/**
 * Claude Code Message Handler
 * Runs Claude Code headless and provides structured WebSocket protocol
 */

const { spawn } = require('child_process');
const WebSocket = require('ws');
const readline = require('readline');

const PORT = 3000;
const INITIAL_MESSAGE = process.argv[2] || 'Hello';

console.log('[Handler] Starting WebSocket server on port', PORT);
const wss = new WebSocket.Server({ port: PORT });

wss.on('connection', (ws) => {
  console.log('[Handler] Client connected');

  let claudeProcess = null;
  let messageQueue = [];
  let claudeReady = false;

  // Spawn Claude Code headless
  function startClaude() {
    console.log('[Handler] Spawning Claude Code headless...');

    claudeProcess = spawn('claude', ['--headless'], {
      cwd: process.cwd(),
      env: {
        ...process.env,
        ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY,
      },
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    // Handle Claude stdout (responses)
    const rl = readline.createInterface({
      input: claudeProcess.stdout,
      crlfDelay: Infinity,
    });

    rl.on('line', (line) => {
      console.log('[Claude]', line);

      // Send to web UI
      ws.send(JSON.stringify({
        type: 'claude_message',
        content: line,
        timestamp: new Date().toISOString(),
      }));

      // Check for TodoWrite updates
      if (line.includes('TodoWrite') || line.includes('TODO:')) {
        ws.send(JSON.stringify({
          type: 'todo_update',
          content: line,
          timestamp: new Date().toISOString(),
        }));
      }

      // Check for phase transitions
      const phaseMatch = line.match(/phase[_\s](\w+)/i);
      if (phaseMatch) {
        ws.send(JSON.stringify({
          type: 'phase_update',
          phase: phaseMatch[1].toLowerCase(),
          timestamp: new Date().toISOString(),
        }));
      }
    });

    // Handle Claude stderr (errors)
    claudeProcess.stderr.on('data', (data) => {
      const error = data.toString();
      console.error('[Claude Error]', error);

      ws.send(JSON.stringify({
        type: 'error',
        content: error,
        timestamp: new Date().toISOString(),
      }));
    });

    // Handle Claude exit
    claudeProcess.on('exit', (code) => {
      console.log('[Handler] Claude process exited with code', code);

      ws.send(JSON.stringify({
        type: 'workflow_complete',
        exitCode: code,
        timestamp: new Date().toISOString(),
      }));
    });

    // Mark as ready after brief delay
    setTimeout(() => {
      claudeReady = true;
      console.log('[Handler] Claude ready, processing queue...');

      // Send initial message
      sendToClaude(INITIAL_MESSAGE);

      // Process any queued messages
      while (messageQueue.length > 0) {
        const msg = messageQueue.shift();
        sendToClaude(msg);
      }
    }, 2000);
  }

  // Send message to Claude Code
  function sendToClaude(message) {
    if (!claudeProcess || claudeProcess.exitCode !== null) {
      console.error('[Handler] Claude process not available');
      return;
    }

    console.log('[Handler] Sending to Claude:', message);
    claudeProcess.stdin.write(message + '\n');
  }

  // Handle incoming WebSocket messages
  ws.on('message', (data) => {
    let message;
    try {
      message = JSON.parse(data);
    } catch (err) {
      console.error('[Handler] Invalid JSON:', err);
      return;
    }

    console.log('[Handler] Received message:', message.type);

    switch (message.type) {
      case 'user_message':
        if (claudeReady) {
          sendToClaude(message.content);
        } else {
          messageQueue.push(message.content);
        }
        break;

      case 'start_workflow':
        if (claudeReady) {
          sendToClaude(`Run FABER workflow for work item #${message.workId}`);
        } else {
          messageQueue.push(`Run FABER workflow for work item #${message.workId}`);
        }
        break;

      case 'ping':
        ws.send(JSON.stringify({ type: 'pong', timestamp: new Date().toISOString() }));
        break;

      default:
        console.warn('[Handler] Unknown message type:', message.type);
    }
  });

  // Handle WebSocket close
  ws.on('close', () => {
    console.log('[Handler] Client disconnected');
    if (claudeProcess && claudeProcess.exitCode === null) {
      console.log('[Handler] Keeping Claude process alive (auto-reconnect)');
      // Don't kill Claude process - support reconnection
    }
  });

  // Handle WebSocket error
  ws.on('error', (error) => {
    console.error('[Handler] WebSocket error:', error);
  });

  // Start Claude Code
  startClaude();
});

console.log('[Handler] Waiting for connections...');
```

### 4.3 Updated Dockerfile

**File:** `docker/Dockerfile.session`

```dockerfile
# Fractary Session Container
# Supports both Terminal and FABER (chat) modes

FROM ubuntu:22.04

# Prevent interactive prompts during build
ENV DEBIAN_FRONTEND=noninteractive

# Install Node.js 20.x
RUN apt-get update && apt-get install -y \
    curl \
    ca-certificates \
    && curl -fsSL https://deb.nodesource.com/setup_20.x | bash - \
    && apt-get install -y nodejs

# Install system dependencies
RUN apt-get update && apt-get install -y \
    git \
    openssh-client \
    curl \
    python3 \
    python3-pip \
    build-essential \
    tmux \
    && rm -rf /var/lib/apt/lists/*

# Install Claude Code CLI globally
RUN npm install -g @anthropic-ai/claude-code

# Create non-root user
RUN useradd -m -s /bin/bash developer && \
    mkdir -p /workspace /app /mcp-servers && \
    chown -R developer:developer /workspace /app /mcp-servers

# Copy MCP servers (⭐ New for FABER mode)
# These should be built separately and copied in
COPY mcp-servers/fractary-faber /mcp-servers/fractary-faber
COPY mcp-servers/fractary-repo /mcp-servers/fractary-repo
COPY mcp-servers/fractary-work /mcp-servers/fractary-work
COPY mcp-servers/multi-model-router /mcp-servers/multi-model-router

# Install MCP server dependencies
RUN cd /mcp-servers/fractary-faber && npm install --production && \
    cd /mcp-servers/fractary-repo && npm install --production && \
    cd /mcp-servers/fractary-work && npm install --production && \
    cd /mcp-servers/multi-model-router && npm install --production

# Copy supporting files
COPY docker/pty-server.js /app/pty-server.js
COPY docker/entrypoint.sh /app/entrypoint.sh
COPY docker/faber-entrypoint.sh /app/faber-entrypoint.sh  # ⭐ New
COPY docker/claude-message-handler.js /app/claude-message-handler.js  # ⭐ New

# Set executable permissions
RUN chmod +x /app/entrypoint.sh /app/faber-entrypoint.sh && \
    chown -R developer:developer /app /mcp-servers

# Install PTY + WebSocket dependencies for both modes
WORKDIR /app
RUN npm install node-pty ws

USER developer
WORKDIR /workspace

EXPOSE 3000

# Entrypoint will be overridden by ECS task command
# Terminal mode: /app/entrypoint.sh
# FABER mode: /app/faber-entrypoint.sh
ENTRYPOINT ["/app/entrypoint.sh"]
```

### 4.4 Build & Deploy Script

**File:** `scripts/build-and-push.sh`

```bash
#!/bin/bash
set -e

# Configuration
AWS_REGION="${AWS_REGION:-us-east-1}"
AWS_ACCOUNT_ID="${AWS_ACCOUNT_ID}"
ECR_REPO="${ECR_REPO:-app-fractary-com-sessions}"
IMAGE_TAG="${IMAGE_TAG:-latest}"

if [ -z "$AWS_ACCOUNT_ID" ]; then
    echo "Error: AWS_ACCOUNT_ID not set"
    exit 1
fi

ECR_URI="${AWS_ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com/${ECR_REPO}"

echo "Building session container..."

# Build MCP servers first
echo "Building MCP servers..."
cd ../faber/mcp/server
npm install
npm run build
cd -

# Copy MCP servers to docker build context
echo "Copying MCP servers to build context..."
rm -rf docker/mcp-servers
mkdir -p docker/mcp-servers
cp -r ../faber/mcp/server docker/mcp-servers/fractary-faber
# TODO: Add other MCP servers when ready

# Build Docker image
echo "Building Docker image..."
docker build -f docker/Dockerfile.session -t ${ECR_URI}:${IMAGE_TAG} .

# Login to ECR
echo "Logging in to ECR..."
aws ecr get-login-password --region ${AWS_REGION} | \
    docker login --username AWS --password-stdin ${ECR_URI}

# Push image
echo "Pushing image to ECR..."
docker push ${ECR_URI}:${IMAGE_TAG}

echo "Image pushed: ${ECR_URI}:${IMAGE_TAG}"
echo "Update ECS task definition to use this image"
```

### 4.5 Testing (Sprint 2)

**Manual Testing Steps:**

1. **Build Container Locally**
```bash
cd app.fractary.com
./scripts/build-and-push.sh
```

2. **Test Terminal Mode (Regression)**
```bash
# Run container in terminal mode
docker run -it \
  -e GITHUB_TOKEN=your_token \
  -e ANTHROPIC_API_KEY=your_key \
  -e REPO_URL=https://github.com/test/repo \
  -e BRANCH=main \
  -e MODE=terminal \
  --entrypoint /app/entrypoint.sh \
  ${ECR_URI}:latest

# Verify:
# - Container starts
# - Repository clones
# - PTY server runs on port 3000
# - Can connect via WebSocket
```

3. **Test FABER Mode**
```bash
# Run container in FABER mode
docker run -it \
  -e GITHUB_TOKEN=your_token \
  -e ANTHROPIC_API_KEY=your_key \
  -e REPO_URL=https://github.com/test/repo \
  -e BRANCH=main \
  -e MODE=chat \
  -e WORK_ID=123 \
  --entrypoint /app/faber-entrypoint.sh \
  ${ECR_URI}:latest

# Verify:
# - Container starts
# - Repository clones
# - MCP servers configure
# - Claude Code starts headless
# - Message handler runs on port 3000
# - Can send JSON messages via WebSocket
```

4. **Test WebSocket Protocol**
```javascript
// test-websocket.js
const WebSocket = require('ws');

const ws = new WebSocket('ws://localhost:3000');

ws.on('open', () => {
  console.log('Connected');

  // Send test message
  ws.send(JSON.stringify({
    type: 'user_message',
    content: 'Hello Claude!'
  }));
});

ws.on('message', (data) => {
  const message = JSON.parse(data);
  console.log('Received:', message.type, message.content);
});
```

**Deliverables (Sprint 2):**
- [x] FABER entrypoint script works
- [x] Claude message handler works
- [x] MCP servers included in container
- [x] Both modes tested locally
- [x] Docker image pushed to ECR
- [x] ECS task definition updated

## 5. Sprint 3: Frontend Chat UI (Week 3)

### 5.1 Session Creation UI

**File:** `src/components/sessions/create-session-dialog.tsx`

```typescript
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Input } from '@/components/ui/input';
import { Terminal, MessageSquare } from 'lucide-react';

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  repos: Array<{ id: string; name: string; defaultBranch: string }>;
};

export function CreateSessionDialog({ open, onOpenChange, repos }: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState<'terminal' | 'chat'>('terminal');
  const [repoId, setRepoId] = useState('');
  const [branch, setBranch] = useState('main');
  const [workId, setWorkId] = useState('');

  const selectedRepo = repos.find(r => r.id === repoId);

  async function handleCreate() {
    setLoading(true);

    try {
      const response = await fetch('/api/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          repoId,
          branch,
          mode,
          ...(mode === 'chat' && { workId }),
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to create session');
      }

      const session = await response.json();
      router.push(`/session/${session.id}`);
      onOpenChange(false);
    } catch (error) {
      console.error('Error creating session:', error);
      alert(error.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Create New Session</DialogTitle>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Repository Selection */}
          <div className="space-y-2">
            <Label>Repository</Label>
            <select
              value={repoId}
              onChange={(e) => {
                setRepoId(e.target.value);
                const repo = repos.find(r => r.id === e.target.value);
                setBranch(repo?.defaultBranch || 'main');
              }}
              className="w-full p-2 border rounded"
            >
              <option value="">Select a repository...</option>
              {repos.map((repo) => (
                <option key={repo.id} value={repo.id}>
                  {repo.name}
                </option>
              ))}
            </select>
          </div>

          {/* Branch */}
          <div className="space-y-2">
            <Label>Branch</Label>
            <Input
              value={branch}
              onChange={(e) => setBranch(e.target.value)}
              placeholder="main"
            />
          </div>

          {/* Mode Selection */}
          <div className="space-y-3">
            <Label>Session Mode</Label>
            <RadioGroup value={mode} onValueChange={(v) => setMode(v as any)}>
              {/* Terminal Mode */}
              <div className="flex items-start space-x-3 p-4 border rounded-lg cursor-pointer hover:bg-accent">
                <RadioGroupItem value="terminal" id="mode-terminal" />
                <label htmlFor="mode-terminal" className="flex-1 cursor-pointer">
                  <div className="flex items-center gap-2">
                    <Terminal className="h-5 w-5" />
                    <span className="font-medium">Terminal</span>
                  </div>
                  <p className="text-sm text-muted-foreground mt-1">
                    Direct bash access with full terminal control
                  </p>
                </label>
              </div>

              {/* FABER Mode */}
              <div className="flex items-start space-x-3 p-4 border rounded-lg cursor-pointer hover:bg-accent">
                <RadioGroupItem value="chat" id="mode-chat" />
                <label htmlFor="mode-chat" className="flex-1 cursor-pointer">
                  <div className="flex items-center gap-2">
                    <MessageSquare className="h-5 w-5" />
                    <span className="font-medium">FABER (Chat)</span>
                    <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">
                      Beta
                    </span>
                  </div>
                  <p className="text-sm text-muted-foreground mt-1">
                    AI-powered workflow automation with chat interface
                  </p>
                </label>
              </div>
            </RadioGroup>
          </div>

          {/* Work ID (only for FABER mode) */}
          {mode === 'chat' && (
            <div className="space-y-2">
              <Label>
                Work Item ID
                <span className="text-sm text-muted-foreground ml-2">
                  (GitHub issue number)
                </span>
              </Label>
              <Input
                value={workId}
                onChange={(e) => setWorkId(e.target.value)}
                placeholder="123"
                required
              />
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleCreate}
            disabled={!repoId || loading || (mode === 'chat' && !workId)}
          >
            {loading ? 'Creating...' : 'Create Session'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
```

### 5.2 Chat Interface Component

**File:** `src/components/chat/chat-interface.tsx`

```typescript
'use client';

import { useState, useEffect, useRef } from 'react';
import { useChatWebSocket } from '@/hooks/use-chat-websocket';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Send, Loader2 } from 'lucide-react';
import { WorkflowProgress } from './workflow-progress';
import { ChatMessage } from './chat-message';

type Props = {
  sessionId: string;
};

export function ChatInterface({ sessionId }: Props) {
  const {
    messages,
    workflowStatus,
    connectionStatus,
    sendMessage,
  } = useChatWebSocket(sessionId);

  const [input, setInput] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  function handleSend() {
    if (!input.trim()) return;

    sendMessage({
      type: 'user_message',
      content: input,
    });

    setInput('');
  }

  return (
    <div className="h-full flex flex-col bg-background">
      {/* Connection Status */}
      <div className="border-b px-4 py-2 flex items-center gap-2">
        <div className={`h-2 w-2 rounded-full ${
          connectionStatus === 'connected' ? 'bg-green-500' :
          connectionStatus === 'connecting' ? 'bg-yellow-500' :
          'bg-red-500'
        }`} />
        <span className="text-sm text-muted-foreground capitalize">
          {connectionStatus}
        </span>
      </div>

      {/* Workflow Progress */}
      {workflowStatus && (
        <div className="border-b p-4 bg-muted/30">
          <WorkflowProgress status={workflowStatus} />
        </div>
      )}

      {/* Messages */}
      <ScrollArea className="flex-1 p-4">
        <div className="space-y-4 max-w-4xl mx-auto">
          {messages.map((msg, i) => (
            <ChatMessage key={i} message={msg} />
          ))}
          <div ref={messagesEndRef} />
        </div>
      </ScrollArea>

      {/* Input */}
      <div className="border-t p-4">
        <div className="flex gap-2 max-w-4xl mx-auto">
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleSend()}
            placeholder="Send a message..."
            disabled={connectionStatus !== 'connected'}
          />
          <Button
            onClick={handleSend}
            disabled={!input.trim() || connectionStatus !== 'connected'}
          >
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
```

### 5.3 Chat WebSocket Hook

**File:** `src/hooks/use-chat-websocket.ts`

```typescript
'use client';

import { useState, useEffect, useRef, useCallback } from 'react';

type Message = {
  type: 'user_message' | 'claude_message' | 'error' | 'phase_update' | 'todo_update';
  content: string;
  timestamp: string;
  phase?: string;
};

type WorkflowStatus = {
  currentPhase: string | null;
  todos: Array<{
    content: string;
    status: 'pending' | 'in_progress' | 'completed';
  }>;
};

type ConnectionStatus = 'connecting' | 'connected' | 'disconnected' | 'error';

export function useChatWebSocket(sessionId: string) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [workflowStatus, setWorkflowStatus] = useState<WorkflowStatus>({
    currentPhase: null,
    todos: [],
  });
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('connecting');
  const wsRef = useRef<WebSocket | null>(null);

  const connect = useCallback(() => {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.host;
    const url = `${protocol}//${host}/api/sessions/${sessionId}/ws`;

    console.log('[Chat] Connecting to:', url);
    setConnectionStatus('connecting');

    const ws = new WebSocket(url);
    wsRef.current = ws;

    ws.onopen = () => {
      console.log('[Chat] Connected');
      setConnectionStatus('connected');
    };

    ws.onmessage = (event) => {
      const message = JSON.parse(event.data);
      console.log('[Chat] Received:', message);

      // Add to messages
      setMessages(prev => [...prev, message]);

      // Update workflow status
      if (message.type === 'phase_update') {
        setWorkflowStatus(prev => ({
          ...prev,
          currentPhase: message.phase,
        }));
      }

      if (message.type === 'todo_update') {
        // Parse TodoWrite updates from message content
        // This is a simple implementation - you may want more robust parsing
        parseTodoUpdate(message.content);
      }
    };

    ws.onerror = (error) => {
      console.error('[Chat] WebSocket error:', error);
      setConnectionStatus('error');
    };

    ws.onclose = () => {
      console.log('[Chat] Disconnected');
      setConnectionStatus('disconnected');

      // Auto-reconnect after 5 seconds
      setTimeout(() => {
        if (wsRef.current?.readyState !== WebSocket.OPEN) {
          connect();
        }
      }, 5000);
    };
  }, [sessionId]);

  useEffect(() => {
    connect();

    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, [connect]);

  const sendMessage = useCallback((message: any) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(message));
    } else {
      console.error('[Chat] Cannot send message - not connected');
    }
  }, []);

  function parseTodoUpdate(content: string) {
    // Simple parser for TodoWrite updates
    // Look for patterns like "✓ Task completed" or "→ Task in progress"
    // This is a placeholder - implement based on actual TodoWrite format
  }

  return {
    messages,
    workflowStatus,
    connectionStatus,
    sendMessage,
  };
}
```

### 5.4 Session Page Router

**File:** `src/app/(dashboard)/session/[id]/page.tsx`

```typescript
import { notFound } from 'next/navigation';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { sessions } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';
import { Terminal } from '@/components/terminal/terminal';
import { ChatInterface } from '@/components/chat/chat-interface';

type Props = {
  params: { id: string };
};

export default async function SessionPage({ params }: Props) {
  const session = await auth();
  if (!session?.user?.id) {
    return notFound();
  }

  // Get session from database
  const sessionData = await db.query.sessions.findFirst({
    where: and(
      eq(sessions.id, params.id),
      eq(sessions.userId, session.user.id)
    ),
  });

  if (!sessionData) {
    return notFound();
  }

  // Route to appropriate UI based on mode
  if (sessionData.mode === 'terminal') {
    return <Terminal sessionId={params.id} />;
  } else {
    return <ChatInterface sessionId={params.id} />;
  }
}
```

### 5.5 Testing (Sprint 3)

**Component Tests:**

```typescript
// src/components/chat/__tests__/chat-interface.test.tsx
import { render, screen, fireEvent } from '@testing-library/react';
import { ChatInterface } from '../chat-interface';

// Mock WebSocket
global.WebSocket = jest.fn();

describe('ChatInterface', () => {
  it('should render chat interface', () => {
    render(<ChatInterface sessionId="test-123" />);

    expect(screen.getByPlaceholderText('Send a message...')).toBeInTheDocument();
  });

  it('should send message when user presses Enter', () => {
    const { container } = render(<ChatInterface sessionId="test-123" />);

    const input = screen.getByPlaceholderText('Send a message...') as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'Hello' } });
    fireEvent.keyPress(input, { key: 'Enter', code: 'Enter' });

    // Verify WebSocket send was called
    // (requires proper mock setup)
  });
});
```

**Deliverables (Sprint 3):**
- [x] Session creation UI with mode selector
- [x] Chat interface component
- [x] WebSocket hook for chat
- [x] Workflow progress visualization
- [x] Session page routes to correct UI
- [x] Component tests pass

## 6. Sprint 4: Testing & Polish (Week 4)

### 6.1 End-to-End Testing

**Test Plan:**

1. **Terminal Mode (Regression Testing)**
```
Test Case: Create terminal session
Steps:
  1. Log in to app.fractary.com
  2. Click "New Session"
  3. Select "Terminal" mode
  4. Select repository
  5. Click "Create"
  6. Wait for container to start
  7. Verify terminal appears
  8. Type `ls` and verify output
  9. Verify git is configured
  10. Verify repository is cloned

Expected: All steps pass, identical to before
```

2. **FABER Mode (New Feature)**
```
Test Case: Create FABER chat session
Steps:
  1. Log in to app.fractary.com
  2. Click "New Session"
  3. Select "FABER (Chat)" mode
  4. Select repository
  5. Enter work ID (e.g., "123")
  6. Click "Create"
  7. Wait for container to start
  8. Verify chat interface appears
  9. Verify initial workflow message sent
  10. Verify workflow phases appear
  11. Send custom message
  12. Verify response received

Expected: Chat interface works, workflow executes
```

3. **WebSocket Reconnection**
```
Test Case: Network interruption handling
Steps:
  1. Create FABER session
  2. Wait for workflow to start
  3. Disconnect network (DevTools → Offline)
  4. Wait 5 seconds
  5. Reconnect network
  6. Verify auto-reconnection
  7. Verify workflow continues

Expected: Seamless reconnection, no data loss
```

### 6.2 Performance Testing

**Metrics to Measure:**

| Metric | Target | How to Measure |
|--------|--------|----------------|
| Container startup (terminal) | < 30s | CloudWatch Logs timestamp diff |
| Container startup (FABER) | < 60s | CloudWatch Logs timestamp diff |
| WebSocket connection time | < 2s | Browser DevTools Network tab |
| Message latency | < 500ms | Log timestamps (send → receive) |
| Memory usage (terminal) | < 1GB | CloudWatch Container Insights |
| Memory usage (FABER) | < 2GB | CloudWatch Container Insights |

### 6.3 Documentation

**Files to Create/Update:**

1. **User Guide**
```markdown
# docs/USER-GUIDE.md (update)

## Session Modes

### Terminal Mode
- Direct bash shell access
- Full terminal control
- Use for debugging, manual operations

### FABER Mode (Beta)
- AI-powered workflow automation
- Chat interface
- Requires GitHub issue number
- Automatically runs FABER workflow

## Creating a Session

1. Click "New Session"
2. Select your repository
3. Choose a branch
4. Select session mode:
   - **Terminal**: For manual work
   - **FABER**: For automated workflows
5. For FABER mode: Enter GitHub issue number
6. Click "Create Session"
7. Wait 30-60 seconds for container to start

## Using FABER Mode

FABER mode automatically:
1. Clones your repository
2. Fetches the GitHub issue
3. Analyzes requirements
4. Creates a specification
5. Implements the solution
6. Runs tests
7. Creates a pull request

You can interact via chat to:
- Answer clarifying questions
- Provide additional context
- Approve/reject proposed changes
```

2. **Developer Guide**
```markdown
# docs/DEVELOPER-GUIDE.md (new)

## Architecture

### Session Modes

Sessions can run in two modes:

1. **Terminal Mode** (existing)
   - Entrypoint: `/app/entrypoint.sh`
   - Runs: PTY server on port 3000
   - Protocol: PTY (stdin/stdout)
   - UI: xterm.js terminal

2. **FABER Mode** (new)
   - Entrypoint: `/app/faber-entrypoint.sh`
   - Runs: Claude Code headless + message handler
   - Protocol: Structured JSON over WebSocket
   - UI: Chat interface

### Adding a New Session Mode

To add a new session mode:

1. Add mode to enum in `src/lib/db/schema.ts`
2. Create new entrypoint script in `docker/`
3. Update `src/lib/aws/ecs-client.ts` to handle mode
4. Create new frontend component
5. Update session page router

### WebSocket Protocol (FABER Mode)

Messages are JSON objects:

Client → Server:
{
  "type": "user_message" | "start_workflow" | "ping",
  "content": string,
  "workId": string
}

Server → Client:
{
  "type": "claude_message" | "phase_update" | "todo_update" | "error" | "pong",
  "content": string,
  "timestamp": ISO string,
  "phase": string
}
```

3. **Deployment Guide**
```markdown
# docs/DEPLOYMENT.md (update)

## Container Image Updates

After modifying the session container:

1. Build and push new image:
   ```bash
   ./scripts/build-and-push.sh
   ```

2. Update ECS task definition:
   ```bash
   aws ecs register-task-definition \
     --cli-input-json file://task-definition.json
   ```

3. Update ECS service:
   ```bash
   aws ecs update-service \
     --cluster app-fractary-com-test \
     --service web \
     --task-definition app-fractary-com-test-sessions:NEW_VERSION
   ```

4. Monitor deployment:
   ```bash
   aws ecs wait services-stable \
     --cluster app-fractary-com-test \
     --services web
   ```

## Environment Variables

FABER mode requires additional environment variables:

- `MODE`: "terminal" or "chat"
- `WORK_ID`: GitHub issue number (for FABER mode)
- `OPENAI_API_KEY`: For multi-model support (optional)
- `GEMINI_API_KEY`: For multi-model support (optional)
```

### 6.4 Rollout Plan

**Phase 1: Internal Testing (Days 1-2)**
- Deploy to test environment
- Internal team testing
- Bug fixes

**Phase 2: Beta Users (Days 3-5)**
- Enable for 5-10 beta users
- Collect feedback
- Monitor CloudWatch logs
- Iterate on UX

**Phase 3: Gradual Rollout (Days 6-7)**
- Enable for 25% of users
- Monitor metrics
- Scale to 50%, then 100%

### 6.5 Success Criteria (Final)

**Functional:**
- [x] Terminal mode works (no regressions)
- [x] FABER mode creates sessions
- [x] Chat interface receives messages
- [x] Workflow progress displays
- [x] Auto-reconnection works
- [x] Both modes can run concurrently

**Non-Functional:**
- [x] FABER container starts in < 60s
- [x] WebSocket latency < 500ms
- [x] No memory leaks
- [x] CloudWatch logs capture errors
- [x] Cost increase < 30%

**Documentation:**
- [x] User guide updated
- [x] Developer guide created
- [x] Deployment guide updated
- [x] API documentation updated

## 7. Risk Mitigation

| Risk | Mitigation |
|------|-----------|
| FABER mode breaks terminal mode | Separate entrypoints, thorough regression testing |
| Container images too large | Multi-stage builds, optimize MCP servers |
| WebSocket protocol conflicts | Different message formats per mode |
| Claude Code stability issues | Comprehensive error handling, fallback messages |
| User confusion about modes | Clear UI labels, tooltips, documentation |
| Increased costs | Monitor CloudWatch metrics, set alerts |

## 8. Rollback Plan

If critical issues arise:

1. **Immediate Rollback**
```bash
# Revert ECS task definition
aws ecs update-service \
  --cluster app-fractary-com-test \
  --service web \
  --task-definition app-fractary-com-test-sessions:PREVIOUS_VERSION
```

2. **Database Rollback**
```sql
-- Set all FABER sessions to stopped
UPDATE sessions
SET status = 'stopped'
WHERE mode = 'chat' AND status NOT IN ('stopped', 'failed');

-- Remove mode column if needed (breaks FABER but preserves terminal)
ALTER TABLE sessions ALTER COLUMN mode SET DEFAULT 'terminal';
```

3. **Communication**
- Notify beta users via email
- Post status update
- Provide timeline for fix

## 9. Post-Launch Monitoring

**Key Metrics:**

1. **Adoption**
   - % of sessions using FABER mode
   - Time to first FABER session (per user)

2. **Performance**
   - Average container startup time (FABER)
   - WebSocket reconnection rate
   - Message latency (p50, p95, p99)

3. **Cost**
   - ECS task hours (FABER vs. terminal)
   - CloudWatch Logs volume
   - API call costs (Claude, GPT-4, Gemini)

4. **Reliability**
   - Session success rate (FABER)
   - Error rate (by error type)
   - Container crash rate

**Dashboards:**
- CloudWatch Dashboard: Session metrics
- Cost Explorer: Cost by session mode
- Application Logs: Error trends

## 10. Next Steps (Future Phases)

After successful FABER mode launch:

**Phase 5: Multi-Interface Support**
- GitHub webhooks (@faber mentions)
- Slack integration (/faber commands)
- Email triggers

**Phase 6: Workflow Customization**
- Custom FABER workflows
- Workflow templates
- User-defined phases

**Phase 7: Advanced Features**
- Workflow marketplace
- Team collaboration
- Audit logs & compliance

---

**Document Status:** Ready for Implementation
**Last Updated:** 2025-12-20
**Estimated Timeline:** 4 weeks (4 sprints)
**Next Step:** Review with app.fractary.com team, begin Sprint 1
