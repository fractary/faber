---
spec_id: SPEC-20251217-faber-mcp-server
title: "FABER MCP Server - Expose SDK via Model Context Protocol"
type: feature
status: draft
created: 2025-12-17
author: Claude (with human direction)
validated: false
related:
  - SPEC-00026-distributed-plugin-architecture.md
  - SPEC-00023-faber-sdk.md
  - SPEC-20251217-faber-cli-migration.md
changelog:
  - date: 2025-12-17
    type: refinement
    summary: "Major scope refinement - removed non-faber tools (work, repo, spec, logs) that belong to fractary/core. Merged event gateway functionality. Focused on FABER workflow orchestration tools only."
---

# Feature Specification: FABER MCP Server

**Type**: Feature
**Status**: Draft
**Created**: 2025-12-17
**Related Spec**: [SPEC-00026: Distributed Plugin Architecture](./SPEC-00026-distributed-plugin-architecture.md)

## 1. Summary

Create an MCP (Model Context Protocol) server package (`@fractary/faber-mcp`) that exposes **FABER-specific workflow orchestration functionality** as MCP tools. This enables universal tool access across Claude Code, LangChain, n8n, and any MCP-compatible client.

**Important Scope Clarification**: This MCP server exposes **only FABER workflow orchestration tools** (run, status, resume, pause, recover, cleanup, event logging). General primitives like work, repo, spec, logs, docs, file, and status belong to the `fractary/core` project and will be exposed via `@fractary/core-mcp` (separate package).

The MCP server will also incorporate the existing Event Gateway functionality from `/plugins/faber/mcp-server/` (faber-event-gateway), consolidating all FABER MCP capabilities into a single server.

## 2. Background & Motivation

### 2.1 Current State

- **CLI Package** (`@fractary/faber-cli`) exists in `/cli/` - exposes FABER workflow commands
- **SDK Package** (`@fractary/faber`) exists in `/sdk/js/` - FABER workflow orchestration (FaberWorkflow, StateManager, AgentExecutor)
- **Event Gateway** exists in `/plugins/faber/mcp-server/` - MCP server for workflow event logging (emit_event, get_run, list_runs, consolidate_events)
- **No unified MCP server** for exposing all FABER functionality

**SDK Module Analysis** (what's actually FABER-specific):
- `workflow/` - FaberWorkflow orchestration (FABER-specific) ✅
- `state/` - StateManager for workflow persistence (FABER-specific) ✅
- `work/` - WorkManager (general primitive, moving to fractary/core) ❌
- `repo/` - RepoManager (general primitive, moving to fractary/core) ❌
- `spec/` - SpecManager (general primitive, moving to fractary/core) ❌
- `logs/` - LogManager (general primitive, moving to fractary/core) ❌
- `storage/` - StorageManager (general primitive, moving to fractary/core) ❌

### 2.2 Gap Analysis

Per SPEC-00026 Section 3.11, every SDK should expose an MCP server:

> "Every SDK includes an MCP server to expose its functionality as tools."

The FABER SDK currently has:
- An Event Gateway MCP server (incomplete - event logging only)
- No MCP exposure for workflow orchestration (run, status, resume, pause)
- Event Gateway incorrectly located in `/plugins/` instead of `/mcp/server/`

### 2.3 Value Proposition

| Feature | CLI | MCP Server |
|---------|-----|------------|
| Workflow status check | 500ms | 80ms |
| Run workflow (setup) | 2000ms | 400ms |
| Emit event | 300ms | 50ms |
| List runs | 400ms | 70ms |

## 3. Requirements

### 3.1 Functional Requirements

#### FR1: MCP Server Package
- **FR1.1**: Create new package `@fractary/faber-mcp` in `/mcp/server/`
- **FR1.2**: Package must be a workspace member of the monorepo
- **FR1.3**: Binary name must be `fractary-faber-mcp`
- **FR1.4**: Server must use `@modelcontextprotocol/sdk` for MCP implementation
- **FR1.5**: Migrate existing Event Gateway functionality from `/plugins/faber/mcp-server/`

#### FR2: Workflow Orchestration Tools (6 tools)
- **FR2.1**: `fractary_faber_workflow_run` - Run FABER workflow for a work item
- **FR2.2**: `fractary_faber_workflow_status` - Get workflow status (by workflow_id or work_id)
- **FR2.3**: `fractary_faber_workflow_resume` - Resume a paused workflow
- **FR2.4**: `fractary_faber_workflow_pause` - Pause a running workflow
- **FR2.5**: `fractary_faber_workflow_recover` - Recover a failed workflow
- **FR2.6**: `fractary_faber_workflow_cleanup` - Clean up completed/failed workflow state

#### FR3: Event Gateway Tools (4 tools, migrated from plugins/faber/mcp-server)
- **FR3.1**: `fractary_faber_event_emit` - Emit a workflow event to a FABER run
- **FR3.2**: `fractary_faber_run_get` - Get run state and metadata
- **FR3.3**: `fractary_faber_run_list` - List runs with optional filters
- **FR3.4**: `fractary_faber_events_consolidate` - Consolidate run events to JSONL format

#### FR4: MCP Resources (migrated from Event Gateway)
- **FR4.1**: `faber://runs` - List all workflow runs
- **FR4.2**: `faber://runs/{run_id}` - Get specific run details
- **FR4.3**: `faber://runs/{run_id}/events` - Get events for a run

#### FR5: Tool Schema Requirements
- **FR5.1**: All tools must have JSON Schema-defined input parameters
- **FR5.2**: All tools must return structured JSON responses
- **FR5.3**: Tools must include descriptions for parameters
- **FR5.4**: Required vs optional parameters must be clearly defined

#### FR6: Configuration Management
- **FR6.1**: Read run storage path from `FABER_RUNS_PATH` env var (default: `.fractary/plugins/faber/runs`)
- **FR6.2**: Support environment variable overrides for configuration
- **FR6.3**: Maintain backward compatibility with existing Event Gateway configuration

### 3.2 Out of Scope (belongs to fractary/core)

The following tools are **NOT** included in this MCP server - they belong to `@fractary/core-mcp`:

- ❌ Work tracking tools (issue fetch, create, update, close, search, etc.)
- ❌ Repository tools (branch, commit, PR, tag operations)
- ❌ Specification tools (spec create, validate, list)
- ❌ Log management tools (capture, list, export)
- ❌ File storage tools
- ❌ Status tools
- ❌ Documentation tools

### 3.3 Non-Functional Requirements

#### NFR1: Performance
- **NFR1.1**: Tool response time < 100ms for simple operations (status, get_run)
- **NFR1.2**: Tool response time < 500ms for moderate operations (emit_event, list_runs)
- **NFR1.3**: Workflow run operations may take longer (async by nature)

#### NFR2: Compatibility
- **NFR2.1**: Compatible with MCP SDK v1.0+
- **NFR2.2**: Works with Claude Code, LangChain, n8n, and any MCP client
- **NFR2.3**: Node.js 18+ required
- **NFR2.4**: Backward compatible with existing Event Gateway clients

#### NFR3: Error Handling
- **NFR3.1**: MCP-compatible error responses
- **NFR3.2**: Structured error messages with codes
- **NFR3.3**: Helpful context for debugging
- **NFR3.4**: Distinguish recoverable vs critical errors (per Event Gateway pattern)

#### NFR4: Security
- **NFR4.1**: No credentials in logs or error messages
- **NFR4.2**: Path traversal protection for run_id validation
- **NFR4.3**: Input validation for all parameters using JSON schemas
- **NFR4.4**: Atomic file operations for concurrent safety (per Event Gateway pattern)

## 4. Technical Design

### 4.1 Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    MCP Client                                │
│  (Claude Code, LangChain, n8n, custom)                      │
└─────────────────────────────────────────────────────────────┘
                              │
                              │ MCP Protocol (stdio)
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                  @fractary/faber-mcp                         │
│  ┌─────────────────────────────────────────────────────┐   │
│  │                    server.ts                         │   │
│  │  - MCP server setup                                  │   │
│  │  - Tool + Resource registration                      │   │
│  │  - Error handling                                    │   │
│  └─────────────────────────────────────────────────────┘   │
│                              │                              │
│  ┌────────────────────┬─────────────────────────────────┐  │
│  │    workflow.ts     │          events.ts              │  │
│  │  (orchestration)   │  (event gateway, migrated)      │  │
│  │  - run             │  - emit_event                   │  │
│  │  - status          │  - get_run                      │  │
│  │  - resume          │  - list_runs                    │  │
│  │  - pause           │  - consolidate_events           │  │
│  │  - recover         │                                 │  │
│  │  - cleanup         │                                 │  │
│  └────────────────────┴─────────────────────────────────┘  │
│                              │                              │
│  ┌─────────────────────────────────────────────────────┐   │
│  │               backends/local-files.ts                │   │
│  │  (migrated from Event Gateway - run storage)        │   │
│  └─────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
                              │
                              │ SDK imports
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                    @fractary/faber                           │
│     FaberWorkflow  │  StateManager  │  AgentExecutor        │
└─────────────────────────────────────────────────────────────┘
```

### 4.2 Directory Structure

```
mcp/
└── server/                          # @fractary/faber-mcp
    ├── src/
    │   ├── tools/
    │   │   ├── index.ts             # Tool registry
    │   │   ├── workflow.ts          # Workflow orchestration tools (run, status, resume, pause, recover, cleanup)
    │   │   └── events.ts            # Event gateway tools (emit, get_run, list_runs, consolidate)
    │   ├── backends/
    │   │   ├── local-files.ts       # Local file storage (migrated from Event Gateway)
    │   │   └── s3-archive.ts        # Optional S3 archival (migrated from Event Gateway)
    │   ├── resources/
    │   │   └── runs.ts              # MCP resource handlers (faber://runs/*)
    │   ├── types.ts                 # Type definitions (migrated + new)
    │   ├── server.ts                # MCP server entry point
    │   └── index.ts                 # Package exports
    ├── __tests__/
    │   ├── tools/
    │   │   ├── workflow.test.ts
    │   │   └── events.test.ts
    │   └── server.test.ts
    ├── package.json
    ├── tsconfig.json
    └── README.md
```

### 4.3 Migration from Event Gateway

The existing Event Gateway (`/plugins/faber/mcp-server/`) will be migrated to `/mcp/server/`:

| Source (plugins/faber/mcp-server/) | Target (mcp/server/) |
|-----------------------------------|---------------------|
| `src/server.ts` | Merge into `src/server.ts` |
| `src/backends/local-files.ts` | `src/backends/local-files.ts` |
| `src/backends/s3-archive.ts` | `src/backends/s3-archive.ts` |
| `src/types.ts` | Merge into `src/types.ts` |
| Tool: `emit_event` | `fractary_faber_event_emit` |
| Tool: `get_run` | `fractary_faber_run_get` |
| Tool: `list_runs` | `fractary_faber_run_list` |
| Tool: `consolidate_events` | `fractary_faber_events_consolidate` |

**Post-migration cleanup**:
- Remove `/plugins/faber/mcp-server/` directory
- Update any references to `faber-event-gateway` to use `@fractary/faber-mcp`

### 4.4 Tool Definition Pattern

```typescript
// mcp/server/src/tools/workflow.ts
import { FaberWorkflow, StateManager } from '@fractary/faber';
import { ToolDefinition } from '../types';

export const workflowTools: ToolDefinition[] = [
  {
    name: 'fractary_faber_workflow_run',
    description: 'Run FABER workflow (Frame → Architect → Build → Evaluate → Release) for a work item',
    inputSchema: {
      type: 'object',
      required: ['work_id'],
      properties: {
        work_id: {
          type: 'string',
          description: 'Work item ID to process'
        },
        autonomy: {
          type: 'string',
          enum: ['supervised', 'assisted', 'autonomous', 'guarded', 'dry-run'],
          description: 'Autonomy level for workflow execution',
          default: 'supervised'
        },
        config: {
          type: 'object',
          description: 'Optional workflow configuration overrides'
        }
      }
    },
    handler: async (params) => {
      const workflow = new FaberWorkflow();
      const result = await workflow.run({
        workId: params.work_id,
        autonomy: params.autonomy,
        config: params.config
      });
      return {
        content: [{ type: 'text', text: JSON.stringify(result, null, 2) }]
      };
    }
  },
  {
    name: 'fractary_faber_workflow_status',
    description: 'Get workflow status by workflow ID or work item ID',
    inputSchema: {
      type: 'object',
      properties: {
        workflow_id: {
          type: 'string',
          description: 'Workflow ID to check'
        },
        work_id: {
          type: 'string',
          description: 'Work item ID to find active workflow'
        }
      }
    },
    handler: async (params) => {
      const stateManager = new StateManager();
      let state;
      if (params.workflow_id) {
        state = stateManager.getWorkflow(params.workflow_id);
      } else if (params.work_id) {
        state = stateManager.getActiveWorkflow(params.work_id);
      }
      return {
        content: [{ type: 'text', text: JSON.stringify(state, null, 2) }]
      };
    }
  },
  // ... resume, pause, recover, cleanup tools
];
```

### 4.5 Server Implementation

```typescript
// mcp/server/src/server.ts
#!/usr/bin/env node

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListResourcesRequestSchema,
  ListToolsRequestSchema,
  ReadResourceRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { workflowTools } from './tools/workflow.js';
import { eventTools } from './tools/events.js';
import { LocalFilesBackend } from './backends/local-files.js';

// Configuration from environment
const BASE_PATH = process.env.FABER_RUNS_PATH || '.fractary/plugins/faber/runs';

// Initialize backend for event storage
const backend = new LocalFilesBackend(BASE_PATH);

const server = new Server(
  {
    name: 'fractary-faber',
    version: '1.0.0',
  },
  {
    capabilities: {
      tools: {},
      resources: {},  // Include resources from Event Gateway
    },
  }
);

// Register all tools (workflow + events)
const allTools = [
  ...workflowTools,
  ...eventTools(backend),  // Pass backend to event tools
];

// List available tools
server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: allTools.map(t => ({
    name: t.name,
    description: t.description,
    inputSchema: t.inputSchema,
  })),
}));

// Handle tool calls
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;
  const tool = allTools.find(t => t.name === name);

  if (!tool) {
    throw new Error(`Unknown tool: ${name}`);
  }

  try {
    return await tool.handler(args);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      content: [{ type: 'text', text: JSON.stringify({ error: message }, null, 2) }],
      isError: true,
    };
  }
});

// List available resources (faber://runs/*)
server.setRequestHandler(ListResourcesRequestSchema, async () => {
  const runs = await backend.listRuns({ limit: 100 });
  const resources = [
    {
      uri: 'faber://runs',
      name: 'All FABER Runs',
      description: 'List of all workflow runs',
      mimeType: 'application/json',
    },
  ];

  for (const run of runs.runs) {
    resources.push({
      uri: `faber://runs/${run.run_id}`,
      name: `Run ${run.run_id.split('/').pop()}`,
      description: `Work #${run.work_id} - ${run.status}`,
      mimeType: 'application/json',
    });
  }

  return { resources };
});

// Read resource content
server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
  const { uri } = request.params;
  // Parse URI and return content (same as Event Gateway)
  // ... (implementation from Event Gateway)
});

// Start server
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('FABER MCP server started');
}

main().catch((error) => {
  console.error('Server error:', error);
  process.exit(1);
});
```

### 4.6 Package Configuration

```json
{
  "name": "@fractary/faber-mcp",
  "version": "1.0.0",
  "description": "MCP Server for FABER workflow orchestration - run, status, events, and run management",
  "type": "module",
  "main": "dist/index.js",
  "bin": {
    "fractary-faber-mcp": "./dist/server.js"
  },
  "files": [
    "dist",
    "README.md",
    "LICENSE"
  ],
  "scripts": {
    "dev": "tsx src/server.ts",
    "build": "tsc",
    "start": "node dist/server.js",
    "watch": "tsc --watch",
    "test": "vitest run",
    "test:watch": "vitest",
    "lint": "eslint src --ext .ts",
    "typecheck": "tsc --noEmit",
    "prepublishOnly": "npm run build"
  },
  "keywords": [
    "faber",
    "mcp",
    "model-context-protocol",
    "workflow",
    "orchestration",
    "events"
  ],
  "author": "Fractary Team",
  "license": "MIT",
  "publishConfig": {
    "access": "public"
  },
  "dependencies": {
    "@fractary/faber": "*",
    "@modelcontextprotocol/sdk": "^1.0.0",
    "ajv": "^8.12.0",
    "ajv-formats": "^2.1.1"
  },
  "devDependencies": {
    "@types/node": "^20.10.0",
    "tsx": "^4.7.0",
    "typescript": "^5.3.0",
    "vitest": "^1.0.0"
  },
  "engines": {
    "node": ">=18.0.0"
  },
  "repository": {
    "type": "git",
    "url": "git+https://github.com/fractary/faber.git",
    "directory": "mcp/server"
  }
}
```

**Note**: Dependencies include `ajv` for JSON schema validation (migrated from Event Gateway).

### 4.7 MCP Client Configuration

Users configure the server in their MCP client settings:

```json
{
  "mcpServers": {
    "fractary-faber": {
      "command": "npx",
      "args": ["-y", "@fractary/faber-mcp"],
      "env": {
        "FABER_RUNS_PATH": ".fractary/plugins/faber/runs"
      }
    }
  }
}
```

**Note**: Unlike the original plan, this MCP server does not need GitHub/Jira/Linear tokens directly - those are handled by the SDK managers which are configured separately. The MCP server primarily needs the runs storage path.

## 5. Implementation Plan

### Phase 1: Foundation & Migration Setup
**Objective**: Set up MCP server infrastructure and prepare Event Gateway migration

**Tasks**:
- [ ] Create `/mcp/server/` directory structure
- [ ] Initialize `package.json` with dependencies
- [ ] Create `tsconfig.json`
- [ ] Copy Event Gateway backends (`local-files.ts`, `s3-archive.ts`) to new location
- [ ] Copy Event Gateway types to `types.ts`
- [ ] Update root `package.json` workspaces to include `mcp/server`

**Scope**: Core infrastructure and file migration

### Phase 2: Event Gateway Tools
**Objective**: Migrate and rename Event Gateway tools

**Tasks**:
- [ ] Create `src/tools/events.ts` with migrated tools:
  - `fractary_faber_event_emit` (from `emit_event`)
  - `fractary_faber_run_get` (from `get_run`)
  - `fractary_faber_run_list` (from `list_runs`)
  - `fractary_faber_events_consolidate` (from `consolidate_events`)
- [ ] Migrate resource handlers (`faber://runs/*`)
- [ ] Write unit tests for event tools
- [ ] Verify backward compatibility with existing run data

**Scope**: 4 tools + 3 resources

### Phase 3: Workflow Orchestration Tools
**Objective**: Implement workflow orchestration tools using SDK

**Tasks**:
- [ ] Create `src/tools/workflow.ts` with tools:
  - `fractary_faber_workflow_run`
  - `fractary_faber_workflow_status`
  - `fractary_faber_workflow_resume`
  - `fractary_faber_workflow_pause`
  - `fractary_faber_workflow_recover`
  - `fractary_faber_workflow_cleanup`
- [ ] Write unit tests for workflow tools
- [ ] Integration testing with FaberWorkflow SDK

**Scope**: 6 tools

### Phase 4: Server Integration
**Objective**: Combine all tools and finalize server

**Tasks**:
- [ ] Create unified `server.ts` combining workflow + event tools
- [ ] Create tool registry (`tools/index.ts`)
- [ ] Implement error handling middleware
- [ ] End-to-end testing with MCP client
- [ ] Test with Claude Code

**Scope**: Server integration

### Phase 5: Cleanup & Documentation
**Objective**: Complete migration and document

**Tasks**:
- [ ] Remove `/plugins/faber/mcp-server/` directory
- [ ] Update any external references to `faber-event-gateway`
- [ ] Write comprehensive README.md
- [ ] Add usage examples
- [ ] Create tool reference documentation

**Scope**: Cleanup and documentation

**Total Tools**: 10 tools (6 workflow + 4 event)
**Total Resources**: 3 resources (faber://runs/*)

## 6. Files to Create/Modify

### New Files

| Path | Description |
|------|-------------|
| `/mcp/server/package.json` | Package configuration |
| `/mcp/server/tsconfig.json` | TypeScript configuration |
| `/mcp/server/README.md` | Documentation |
| `/mcp/server/src/server.ts` | MCP server entry point |
| `/mcp/server/src/index.ts` | Package exports |
| `/mcp/server/src/types.ts` | Type definitions (merged from Event Gateway) |
| `/mcp/server/src/tools/index.ts` | Tool registry |
| `/mcp/server/src/tools/workflow.ts` | Workflow orchestration tools (6 tools) |
| `/mcp/server/src/tools/events.ts` | Event gateway tools (4 tools, migrated) |
| `/mcp/server/src/backends/local-files.ts` | Local file storage (migrated from Event Gateway) |
| `/mcp/server/src/backends/s3-archive.ts` | S3 archival (migrated from Event Gateway) |
| `/mcp/server/src/resources/runs.ts` | MCP resource handlers |

### Modified Files

| Path | Description |
|------|-------------|
| `/package.json` | Add `mcp/server` to workspaces |

### Deleted Files (Post-Migration)

| Path | Description |
|------|-------------|
| `/plugins/faber/mcp-server/` | Entire directory removed after migration |

## 7. Testing Strategy

### Unit Tests
- Test individual tool handlers with mocked backends
- Test workflow tools with mocked FaberWorkflow
- Test event tools with mocked LocalFilesBackend
- Test input validation and error handling

### Integration Tests
- Test with actual MCP client library
- Test run storage operations through MCP layer
- Test error propagation from SDK to MCP response
- Verify backward compatibility with existing Event Gateway data

### E2E Tests
- Test complete workflow execution via MCP
- Test with Claude Code
- Test event emission + run querying sequence

### Migration Tests
- Verify existing runs are accessible after migration
- Verify tool renaming doesn't break functionality
- Test resource URI compatibility

## 8. Dependencies

### Runtime Dependencies
- `@fractary/faber` (workspace) - FaberWorkflow, StateManager SDK
- `@modelcontextprotocol/sdk` ^1.0.0 - MCP server implementation
- `ajv` ^8.12.0 - JSON schema validation (migrated from Event Gateway)
- `ajv-formats` ^2.1.1 - Schema format validators (migrated from Event Gateway)

### Dev Dependencies
- `typescript` ^5.3.0 - TypeScript compiler
- `tsx` ^4.7.0 - TypeScript execution for development
- `vitest` ^1.0.0 - Test framework (matching Event Gateway)

## 9. Risks and Mitigations

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| MCP SDK API changes | Low | High | Pin to stable version, monitor releases |
| Event Gateway migration breaks existing clients | Medium | High | Keep tool behavior identical, only rename; test thoroughly |
| Run data incompatibility | Low | High | Use same backend code, no data format changes |
| FaberWorkflow SDK interface changes | Low | Medium | Pin SDK version, coordinate releases |
| Cross-platform path issues | Low | Medium | Use Node.js path module, test on Windows/Mac/Linux |

## 10. Success Metrics

| Metric | Target |
|--------|--------|
| Tool coverage | 10 tools (6 workflow + 4 event) |
| Event Gateway migration | 100% backward compatible |
| Test coverage | >80% code coverage |
| Documentation completeness | All tools documented with examples |
| Integration success | Works with Claude Code, passes CI |
| Cleanup complete | `/plugins/faber/mcp-server/` removed |

## 11. Out of Scope

- **General primitive tools** (work, repo, spec, logs, docs, file, status) - These belong to `@fractary/core-mcp`
- MCP client implementation
- UI/UX changes
- SDK functionality changes (SDK remains unchanged)
- CLI modifications
- New FABER phases or workflow features

## 12. Future Considerations

- Prompt templates for common workflow operations
- Streaming support for long-running workflow operations
- WebSocket transport option for real-time event notifications
- Additional resource endpoints for phase-level details

## Appendix A: Complete Tool Reference

### Workflow Orchestration Tools (6 tools)

| Tool Name | Description | Required Params | Optional Params |
|-----------|-------------|-----------------|-----------------|
| `fractary_faber_workflow_run` | Run FABER workflow (Frame→Architect→Build→Evaluate→Release) | `work_id` | `autonomy`, `config` |
| `fractary_faber_workflow_status` | Get workflow status | - | `work_id`, `workflow_id` |
| `fractary_faber_workflow_resume` | Resume paused workflow | `workflow_id` | - |
| `fractary_faber_workflow_pause` | Pause running workflow | `workflow_id` | - |
| `fractary_faber_workflow_recover` | Recover failed workflow | `workflow_id` | - |
| `fractary_faber_workflow_cleanup` | Clean up old workflow state | - | `days`, `status` |

### Event Gateway Tools (4 tools, migrated)

| Tool Name | Description | Required Params | Optional Params |
|-----------|-------------|-----------------|-----------------|
| `fractary_faber_event_emit` | Emit workflow event to a run | `run_id`, `type` | `phase`, `step`, `status`, `message`, `metadata`, `artifacts`, `duration_ms`, `error` |
| `fractary_faber_run_get` | Get run state and metadata | `run_id` | `include_events` |
| `fractary_faber_run_list` | List runs with optional filters | - | `work_id`, `status`, `org`, `project`, `limit` |
| `fractary_faber_events_consolidate` | Consolidate events to JSONL | `run_id` | - |

### MCP Resources (3 resources)

| URI Pattern | Description | MIME Type |
|-------------|-------------|-----------|
| `faber://runs` | List all workflow runs | `application/json` |
| `faber://runs/{run_id}` | Get specific run details | `application/json` |
| `faber://runs/{run_id}/events` | Get events for a run | `application/json` |

### Event Types (from Event Gateway)

**Workflow Events**: `workflow_start`, `workflow_complete`, `workflow_error`, `workflow_cancelled`, `workflow_resumed`, `workflow_rerun`

**Phase Events**: `phase_start`, `phase_skip`, `phase_complete`, `phase_error`

**Step Events**: `step_start`, `step_complete`, `step_error`, `step_retry`

**Artifact Events**: `artifact_create`, `artifact_modify`

**Git Events**: `commit_create`, `branch_create`, `pr_create`, `pr_merge`

**Other Events**: `spec_generate`, `spec_validate`, `test_run`, `docs_update`, `checkpoint`, `skill_invoke`, `agent_invoke`, `decision_point`, `retry_loop_enter`, `retry_loop_exit`, `approval_request`, `approval_granted`, `approval_denied`, `hook_execute`
