# FABER MCP Server

A unified MCP (Model Context Protocol) server that provides complete FABER workflow orchestration and event logging capabilities. This server exposes 10 MCP tools for workflow control, state management, and event tracking, enabling AI agents to interact with the FABER workflow framework.

## Features

### Workflow Orchestration (6 Tools)
- **workflow_run**: Execute complete FABER workflows (Frame → Architect → Build → Evaluate → Release)
- **workflow_status**: Query workflow progress and current state
- **workflow_resume**: Resume paused workflows from where they left off
- **workflow_pause**: Pause running workflows for later resumption
- **workflow_recover**: Recover failed workflows from checkpoints or specific phases
- **workflow_cleanup**: Clean up old completed/failed workflow state files

### Event Logging (4 Tools)
- **event_emit**: Log workflow events with rich metadata, artifacts, and error tracking
- **run_get**: Retrieve run details and current state
- **run_list**: Query and list workflow runs with filtering
- **events_consolidate**: Export events to JSONL format for archival or analysis

### MCP Resources
- `faber://runs` - List all workflow runs
- `faber://runs/{run_id}` - Get run details
- `faber://runs/{run_id}/events` - Get run event log

## Prerequisites

- Node.js >= 18.0.0
- npm or yarn

## Installation

### From Workspace (Development)

```bash
# From repository root
npm install
npm run build -w mcp/server
```

### From npm (Production)

```bash
npm install @fractary/faber-mcp
```

## Configuration

The server uses environment variables for configuration:

| Variable | Default | Description |
|----------|---------|-------------|
| `FABER_RUNS_PATH` | `.fractary/faber/runs` | Base path for run storage |

## Usage

### Starting the Server

```bash
# Production (requires build)
npm start

# Development (with tsx)
npm run dev

# From workspace
npm run start -w mcp/server
```

The server communicates via stdio, making it suitable for integration with MCP clients.

### MCP Client Configuration

Add to your MCP client configuration (e.g., `~/.config/claude/mcp.json`):

```json
{
  "mcpServers": {
    "fractary-faber": {
      "command": "node",
      "args": ["/path/to/faber/mcp/server/dist/server.js"],
      "env": {
        "FABER_RUNS_PATH": ".fractary/faber/runs"
      }
    }
  }
}
```

### Using the Binary

```json
{
  "mcpServers": {
    "fractary-faber": {
      "command": "fractary-faber-mcp",
      "env": {
        "FABER_RUNS_PATH": ".fractary/faber/runs"
      }
    }
  }
}
```

## Tools Reference

### Workflow Tools

#### fractary_faber_workflow_run

Run a complete FABER workflow for a work item.

**Parameters:**
| Name | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `work_id` | string | Yes | - | Work item ID to process (e.g., "123" for issue #123) |
| `autonomy` | string | No | "assisted" | Autonomy level: dry-run, assisted, guarded, autonomous |
| `config` | object | No | - | Optional workflow configuration overrides |

**Example:**
```json
{
  "work_id": "123",
  "autonomy": "assisted",
  "config": {
    "phases": {
      "build": {
        "skip_tests": false
      }
    }
  }
}
```

#### fractary_faber_workflow_status

Get workflow status and progress.

**Parameters:**
| Name | Type | Required | Description |
|------|------|----------|-------------|
| `workflow_id` | string | No* | Workflow ID to check (e.g., "WF-abc123") |
| `work_id` | string | No* | Work item ID to find active workflow for |

*At least one of `workflow_id` or `work_id` must be provided.

**Example:**
```json
{
  "work_id": "123"
}
```

#### fractary_faber_workflow_resume

Resume a paused workflow.

**Parameters:**
| Name | Type | Required | Description |
|------|------|----------|-------------|
| `workflow_id` | string | Yes | Workflow ID to resume |

**Example:**
```json
{
  "workflow_id": "WF-abc123"
}
```

#### fractary_faber_workflow_pause

Pause a running workflow.

**Parameters:**
| Name | Type | Required | Description |
|------|------|----------|-------------|
| `workflow_id` | string | Yes | Workflow ID to pause |

**Example:**
```json
{
  "workflow_id": "WF-abc123"
}
```

#### fractary_faber_workflow_recover

Recover a failed workflow from a checkpoint or specific phase.

**Parameters:**
| Name | Type | Required | Description |
|------|------|----------|-------------|
| `workflow_id` | string | Yes | Workflow ID to recover |
| `checkpoint_id` | string | No | Optional checkpoint ID to recover from |
| `from_phase` | string | No | Optional phase to restart from (frame, architect, build, evaluate, release) |
| `skip_phases` | array | No | Phases to skip during recovery |

**Example:**
```json
{
  "workflow_id": "WF-abc123",
  "from_phase": "build"
}
```

#### fractary_faber_workflow_cleanup

Clean up old completed/failed workflow state files.

**Parameters:**
| Name | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `max_age_days` | number | No | 30 | Delete workflows older than this many days |

**Example:**
```json
{
  "max_age_days": 60
}
```

### Event Tools

#### fractary_faber_event_emit

Emit a workflow event to a FABER run.

**Parameters:**
| Name | Type | Required | Description |
|------|------|----------|-------------|
| `run_id` | string | Yes | Full run identifier (org/project/uuid) |
| `type` | string | Yes | Event type (see Event Types below) |
| `phase` | string | No | Current workflow phase |
| `step` | string | No | Current step within phase |
| `status` | string | No | Event status (started, completed, failed, skipped) |
| `message` | string | No | Human-readable description |
| `metadata` | object | No | Additional structured metadata |
| `artifacts` | array | No | Artifact references |
| `error` | object | No | Error details if status is "failed" |
| `agent_id` | string | No | Agent that emitted the event |

**Example:**
```json
{
  "run_id": "fractary/faber/550e8400-e29b-41d4-a716-446655440000",
  "type": "phase_started",
  "phase": "build",
  "status": "started",
  "message": "Starting build phase"
}
```

#### fractary_faber_run_get

Retrieve run details and current state.

**Parameters:**
| Name | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `run_id` | string | Yes | - | Full run identifier |
| `include_events` | boolean | No | false | Include event log in response |

**Example:**
```json
{
  "run_id": "fractary/faber/550e8400-e29b-41d4-a716-446655440000",
  "include_events": true
}
```

#### fractary_faber_run_list

Query and list workflow runs.

**Parameters:**
| Name | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `limit` | number | No | 50 | Maximum number of runs to return |
| `status` | string | No | - | Filter by run status |
| `work_id` | string | No | - | Filter by work item ID |
| `since` | string | No | - | Filter runs created after this ISO timestamp |

**Example:**
```json
{
  "limit": 10,
  "status": "running"
}
```

#### fractary_faber_events_consolidate

Export events to JSONL format.

**Parameters:**
| Name | Type | Required | Description |
|------|------|----------|-------------|
| `run_id` | string | Yes | Full run identifier |
| `output_path` | string | No | Optional output file path (defaults to run directory) |

**Example:**
```json
{
  "run_id": "fractary/faber/550e8400-e29b-41d4-a716-446655440000"
}
```

## Event Types

The following event types are supported:

### Workflow Control
- `workflow_started` - Workflow execution began
- `workflow_completed` - Workflow finished successfully
- `workflow_failed` - Workflow terminated with error
- `workflow_paused` - Workflow paused by user
- `workflow_resumed` - Workflow resumed from pause

### Phase Events
- `phase_started` - FABER phase began (frame, architect, build, evaluate, release)
- `phase_completed` - Phase finished successfully
- `phase_failed` - Phase terminated with error
- `phase_skipped` - Phase skipped due to configuration

### Step Events
- `step_started` - Individual step began
- `step_completed` - Step finished successfully
- `step_failed` - Step terminated with error

### Integration Events
- `work_created` - Work item created in tracker
- `work_updated` - Work item updated
- `branch_created` - Git branch created
- `commit_created` - Git commit created
- `pr_created` - Pull request created
- `pr_updated` - Pull request updated
- `pr_merged` - Pull request merged

### Agent Events
- `agent_started` - AI agent began execution
- `agent_completed` - Agent finished successfully
- `agent_failed` - Agent terminated with error
- `tool_called` - MCP tool invoked
- `prompt_sent` - Prompt sent to LLM
- `prompt_received` - Response received from LLM

### Artifact Events
- `artifact_created` - File or output artifact created
- `artifact_updated` - Artifact modified
- `spec_created` - Specification document created
- `spec_updated` - Specification modified

### Error Events
- `error` - General error occurred
- `validation_failed` - Input validation failed
- `timeout` - Operation timed out
- `retry` - Operation being retried

## Data Structure

### Run State

```typescript
interface RunState {
  run_id: string;          // org/project/uuid
  work_id: string;         // Work item ID
  status: "pending" | "running" | "completed" | "failed" | "paused";
  start_time: string;      // ISO timestamp
  end_time?: string;       // ISO timestamp
  current_phase?: string;  // frame, architect, build, evaluate, release
  metadata: {
    project: string;
    organization: string;
    workflow_type: string;
    autonomy: string;
  };
  artifacts?: Array<{
    type: string;
    path: string;
    created_at: string;
  }>;
}
```

### Event Structure

```typescript
interface FaberEvent {
  event_id: string;        // Monotonic integer
  run_id: string;          // org/project/uuid
  timestamp: string;       // ISO timestamp
  type: string;            // Event type (see Event Types)
  phase?: string;          // Workflow phase
  step?: string;           // Step within phase
  status?: string;         // started, completed, failed, skipped
  message?: string;        // Human-readable description
  metadata?: Record<string, unknown>;
  artifacts?: Array<{
    type: string;
    path: string;
  }>;
  error?: {
    code: string;
    message: string;
    stack?: string;
  };
  agent_id?: string;       // Agent identifier
}
```

## Migration from Event Gateway

If you're migrating from `@fractary/faber-event-gateway`, note the following changes:

### Tool Name Changes

| Old Name | New Name |
|----------|----------|
| `emit_event` | `fractary_faber_event_emit` |
| `get_run` | `fractary_faber_run_get` |
| `list_runs` | `fractary_faber_run_list` |
| `consolidate_events` | `fractary_faber_events_consolidate` |

### Package Name

- Old: `@fractary/faber-event-gateway`
- New: `@fractary/faber-mcp`

### Server Name

- Old: `faber-event-gateway`
- New: `fractary-faber`

### Behavior Changes

- All existing event tools retain the same functionality
- 6 new workflow orchestration tools added
- Resource URIs unchanged: `faber://runs/*`

## Development

### Build

```bash
npm run build
```

### Watch Mode

```bash
npm run watch
```

### Type Checking

```bash
npm run typecheck
```

### Testing

```bash
npm test
npm run test:watch
npm run test:coverage
```

### Linting

```bash
npm run lint
```

## Architecture

```
┌─────────────────────────────────────┐
│     MCP Client (Claude Code, etc)   │
└─────────────────────────────────────┘
                 │
                 │ MCP Protocol (stdio)
                 ▼
┌─────────────────────────────────────┐
│      @fractary/faber-mcp            │
│  ┌────────────┬─────────────────┐  │
│  │ workflow.ts│   events.ts     │  │
│  │ (6 tools)  │   (4 tools)     │  │
│  └────────────┴─────────────────┘  │
│  ┌─────────────────────────────┐   │
│  │  backends/local-files.ts    │   │
│  │  (atomic operations)        │   │
│  └─────────────────────────────┘   │
└─────────────────────────────────────┘
                 │
                 │ SDK imports
                 ▼
┌─────────────────────────────────────┐
│        @fractary/faber SDK          │
│  FaberWorkflow │ StateManager       │
└─────────────────────────────────────┘
```

## Concurrency Safety

The MCP server implements atomic operations for event ID generation to prevent race conditions when multiple agents emit events concurrently. This is achieved through:

1. **Atomic File Operations**: Event IDs are generated using atomic file reads with retry logic
2. **Directory-Level Locking**: State updates use temporary files with atomic renames
3. **Safe Metadata Updates**: Run metadata is updated via atomic read-modify-write cycles

## License

MIT

## Contributing

See the main [FABER repository](https://github.com/fractary/faber) for contribution guidelines.

## Support

- **Issues**: https://github.com/fractary/faber/issues
- **Documentation**: https://fractary.dev/docs/faber
- **MCP Protocol**: https://spec.modelcontextprotocol.io
