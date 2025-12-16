# SPEC-00027: FABER Python SDK Integration with @fractary/cli

| Field | Value |
|-------|-------|
| **Status** | Draft |
| **Author** | Claude Code |
| **Created** | 2025-12-13 |
| **Updated** | 2025-12-13 |
| **Version** | 1.0.0 |
| **Related Issues** | #5 |

## 1. Overview

This specification defines how the FABER Python SDK exposes its functionality to the unified `@fractary/cli` TypeScript project. The Python SDK will NOT have its own standalone CLI; all user-facing commands will be accessed via `fractary faber <command>`.

### 1.1 Goals

1. **Single CLI**: All Fractary tools accessed via `fractary <tool> <command>`
2. **No naming conflicts**: Avoid conflicts with common tool names (codex, helm, faber)
3. **Clean separation**: TypeScript handles CLI UX, Python handles workflow execution
4. **Minimal coupling**: Runtime integration without compile-time dependencies

### 1.2 Non-Goals

- Creating a standalone `faber` CLI entry point
- Embedding Python in the TypeScript CLI
- Requiring Python to be installed for basic `@fractary/cli` functionality

## 2. Architecture

### 2.1 Integration Model

```
┌─────────────────────────────────────────────────────────┐
│  @fractary/cli (TypeScript)                             │
│  Entry: fractary <tool> <command> [options]             │
│                                                         │
│  ┌───────────────────────────────────────────────────┐ │
│  │  fractary faber run <work_id> [--workflow] ...    │ │
│  │  fractary faber init [--force]                    │ │
│  │  fractary faber workflow list [--status]          │ │
│  │  fractary faber workflow view <workflow_id>       │ │
│  └───────────────────┬───────────────────────────────┘ │
└───────────────────────┼─────────────────────────────────┘
                        │
          ┌─────────────┴─────────────┐
          │   Integration Layer       │
          │   (Method Selection)      │
          └─────────────┬─────────────┘
                        │
        ┌───────────────┼───────────────┐
        ▼               ▼               ▼
   ┌─────────┐    ┌─────────┐    ┌─────────┐
   │ HTTP    │    │ Subproc │    │ Library │
   │ Server  │    │ Bridge  │    │ Import  │
   └─────────┘    └─────────┘    └─────────┘
        │               │               │
        └───────────────┼───────────────┘
                        ▼
┌─────────────────────────────────────────────────────────┐
│  FABER Python SDK                                       │
│  Package: faber                                         │
│                                                         │
│  ┌─────────────────────────────────────────────────┐   │
│  │  faber.api.run_workflow(work_id, options)       │   │
│  │  faber.api.init_config(force)                   │   │
│  │  faber.api.list_workflows(status, limit)        │   │
│  │  faber.api.view_workflow(workflow_id)           │   │
│  └─────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────┘
```

### 2.2 Integration Methods

The TypeScript CLI can invoke the Python SDK using one of three methods:

| Method | Use Case | Latency | Complexity |
|--------|----------|---------|------------|
| **HTTP Server** | Long-running workflows, streaming | Low (persistent) | Medium |
| **Subprocess Bridge** | Simple commands, one-shot | Medium (startup) | Low |
| **Library Import** | Tight integration (Pyodide) | Lowest | High |

**Recommended**: HTTP Server for workflow execution, Subprocess for init/list/view.

## 3. Python SDK API Surface

### 3.1 Public API Module

The Python SDK exposes a clean programmatic API in `faber/api/`:

```python
# faber/api/__init__.py

from faber.api.workflow import (
    run_workflow,
    list_workflows,
    view_workflow,
    cancel_workflow,
)
from faber.api.config import (
    init_config,
    load_config,
    validate_config,
)
from faber.api.server import (
    start_server,
    stop_server,
)

__all__ = [
    "run_workflow",
    "list_workflows",
    "view_workflow",
    "cancel_workflow",
    "init_config",
    "load_config",
    "validate_config",
    "start_server",
    "stop_server",
]
```

### 3.2 Workflow API

```python
# faber/api/workflow.py

from dataclasses import dataclass
from typing import Optional, AsyncIterator
from enum import Enum

class AutonomyLevel(str, Enum):
    ASSISTED = "assisted"
    GUARDED = "guarded"
    AUTONOMOUS = "autonomous"

@dataclass
class WorkflowOptions:
    """Options for workflow execution."""
    workflow_path: Optional[str] = None
    autonomy: AutonomyLevel = AutonomyLevel.ASSISTED
    max_retries: int = 3
    skip_phases: list[str] = None
    trace: bool = True
    budget_usd: Optional[float] = None

@dataclass
class WorkflowResult:
    """Result of workflow execution."""
    workflow_id: str
    work_id: str
    status: str  # "completed", "failed", "cancelled"
    completed_phases: list[str]
    pr_url: Optional[str] = None
    spec_path: Optional[str] = None
    branch_name: Optional[str] = None
    error: Optional[str] = None
    error_phase: Optional[str] = None

async def run_workflow(
    work_id: str,
    options: Optional[WorkflowOptions] = None,
) -> WorkflowResult:
    """Run FABER workflow for a work item.

    Args:
        work_id: Work item ID (e.g., "123", "PROJ-456")
        options: Workflow configuration options

    Returns:
        WorkflowResult with execution details
    """
    ...

async def run_workflow_streaming(
    work_id: str,
    options: Optional[WorkflowOptions] = None,
) -> AsyncIterator[dict]:
    """Run workflow with streaming progress updates.

    Yields:
        Progress updates as dictionaries with:
        - type: "phase_start", "phase_end", "progress", "approval_required", "complete"
        - phase: Current phase name
        - message: Human-readable status
        - data: Additional context
    """
    ...

def list_workflows(
    status: Optional[str] = None,
    limit: int = 20,
) -> list[dict]:
    """List workflow executions.

    Args:
        status: Filter by status ("running", "completed", "failed")
        limit: Maximum results

    Returns:
        List of workflow summary dictionaries
    """
    ...

def view_workflow(workflow_id: str) -> Optional[dict]:
    """Get detailed workflow execution info.

    Args:
        workflow_id: Workflow execution ID

    Returns:
        Workflow details or None if not found
    """
    ...

def cancel_workflow(workflow_id: str) -> bool:
    """Cancel a running workflow.

    Args:
        workflow_id: Workflow execution ID

    Returns:
        True if cancelled, False if not found/already complete
    """
    ...
```

### 3.3 Config API

```python
# faber/api/config.py

from pathlib import Path
from dataclasses import dataclass

@dataclass
class ConfigResult:
    """Result of config operation."""
    success: bool
    path: Optional[Path] = None
    message: Optional[str] = None
    error: Optional[str] = None

def init_config(
    path: Optional[Path] = None,
    force: bool = False,
) -> ConfigResult:
    """Initialize FABER configuration.

    Args:
        path: Directory for .faber/config.yaml (default: cwd)
        force: Overwrite existing config

    Returns:
        ConfigResult with operation status
    """
    ...

def load_config(path: Optional[Path] = None) -> dict:
    """Load FABER configuration.

    Args:
        path: Path to config file or directory containing .faber/

    Returns:
        Configuration dictionary

    Raises:
        FileNotFoundError: If config not found
        ValidationError: If config invalid
    """
    ...

def validate_config(config: dict) -> list[str]:
    """Validate configuration dictionary.

    Args:
        config: Configuration to validate

    Returns:
        List of validation errors (empty if valid)
    """
    ...
```

### 3.4 Server API

```python
# faber/api/server.py

from dataclasses import dataclass

@dataclass
class ServerInfo:
    """HTTP server information."""
    host: str
    port: int
    pid: int
    url: str

def start_server(
    host: str = "127.0.0.1",
    port: int = 8420,
    background: bool = True,
) -> ServerInfo:
    """Start FABER HTTP server.

    Args:
        host: Bind address
        port: Port number
        background: Run in background process

    Returns:
        ServerInfo with connection details
    """
    ...

def stop_server(port: int = 8420) -> bool:
    """Stop FABER HTTP server.

    Args:
        port: Port of server to stop

    Returns:
        True if stopped, False if not running
    """
    ...
```

## 4. HTTP Server Protocol

### 4.1 Endpoints

When running as an HTTP server, the Python SDK exposes:

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/health` | GET | Health check |
| `/workflows/run` | POST | Start workflow |
| `/workflows/{id}` | GET | Get workflow status |
| `/workflows/{id}/stream` | GET (SSE) | Stream workflow progress |
| `/workflows/{id}/cancel` | POST | Cancel workflow |
| `/workflows` | GET | List workflows |
| `/config/init` | POST | Initialize config |
| `/config` | GET | Get current config |

### 4.2 Request/Response Format

**Start Workflow**:
```http
POST /workflows/run
Content-Type: application/json

{
  "work_id": "123",
  "options": {
    "workflow_path": ".faber/workflows/custom.yaml",
    "autonomy": "assisted",
    "max_retries": 3,
    "trace": true,
    "budget_usd": 10.0
  }
}
```

**Response**:
```json
{
  "workflow_id": "WF-123-abc12345",
  "status": "running",
  "stream_url": "/workflows/WF-123-abc12345/stream"
}
```

**Stream Progress (SSE)**:
```
GET /workflows/WF-123-abc12345/stream
Accept: text/event-stream

event: phase_start
data: {"phase": "frame", "message": "Starting Frame phase"}

event: progress
data: {"phase": "frame", "message": "Fetching issue #123"}

event: phase_end
data: {"phase": "frame", "status": "completed", "duration_ms": 5420}

event: approval_required
data: {"phase": "architect", "prompt": "Review specification?", "spec_path": ".faber/specs/SPEC-123.md"}

event: complete
data: {"status": "completed", "pr_url": "https://github.com/org/repo/pull/456"}
```

## 5. Subprocess Bridge Protocol

### 5.1 Internal CLI

For subprocess invocation, the Python SDK provides an **internal** CLI (not user-facing):

```bash
# Internal command - NOT exposed to users
python -m faber.bridge run <work_id> [options]
python -m faber.bridge init [--force]
python -m faber.bridge list [--status] [--limit]
python -m faber.bridge view <workflow_id>
```

### 5.2 Output Format

All bridge commands output JSON to stdout:

```bash
$ python -m faber.bridge run 123 --autonomy assisted
{"workflow_id": "WF-123-abc", "status": "running"}
{"type": "phase_start", "phase": "frame"}
{"type": "progress", "phase": "frame", "message": "Fetching issue"}
{"type": "phase_end", "phase": "frame", "status": "completed"}
...
{"type": "complete", "status": "completed", "pr_url": "..."}
```

### 5.3 Error Handling

Errors are output as JSON with exit code 1:

```bash
$ python -m faber.bridge run invalid
{"error": "Work item not found: invalid", "code": "WORK_NOT_FOUND"}
$ echo $?
1
```

## 6. @fractary/cli Implementation

### 6.1 Command Registration

In `@fractary/cli`, register FABER commands:

```typescript
// packages/cli/src/commands/faber/index.ts

import { Command } from 'commander';
import { FaberBridge } from './bridge';

export function registerFaberCommands(program: Command): void {
  const faber = program
    .command('faber')
    .description('AI-assisted development workflows');

  faber
    .command('run <work_id>')
    .description('Run FABER workflow for a work item')
    .option('-w, --workflow <path>', 'Custom workflow YAML file')
    .option('-a, --autonomy <level>', 'Autonomy level', 'assisted')
    .option('-r, --max-retries <n>', 'Max retry attempts', '3')
    .option('-s, --skip-phase <phase>', 'Phases to skip', collectArray)
    .option('--no-trace', 'Disable LangSmith tracing')
    .option('-b, --budget <usd>', 'Budget limit in USD')
    .action(runWorkflow);

  faber
    .command('init')
    .description('Initialize FABER configuration')
    .option('-f, --force', 'Overwrite existing config')
    .action(initConfig);

  const workflow = faber
    .command('workflow')
    .description('Workflow management');

  workflow
    .command('list')
    .description('List workflow executions')
    .option('-s, --status <status>', 'Filter by status')
    .option('-l, --limit <n>', 'Max results', '20')
    .action(listWorkflows);

  workflow
    .command('view <workflow_id>')
    .description('View workflow details')
    .action(viewWorkflow);
}
```

### 6.2 Bridge Implementation

```typescript
// packages/cli/src/commands/faber/bridge.ts

import { spawn } from 'child_process';
import { EventEmitter } from 'events';

interface BridgeOptions {
  method: 'subprocess' | 'http';
  pythonPath?: string;
  serverUrl?: string;
}

export class FaberBridge extends EventEmitter {
  private options: BridgeOptions;

  constructor(options: BridgeOptions = { method: 'subprocess' }) {
    super();
    this.options = options;
  }

  async runWorkflow(workId: string, options: WorkflowOptions): Promise<void> {
    if (this.options.method === 'http') {
      return this.runViaHttp(workId, options);
    }
    return this.runViaSubprocess(workId, options);
  }

  private async runViaSubprocess(
    workId: string,
    options: WorkflowOptions
  ): Promise<void> {
    const args = ['run', workId];

    if (options.workflow) args.push('--workflow', options.workflow);
    if (options.autonomy) args.push('--autonomy', options.autonomy);
    if (options.maxRetries) args.push('--max-retries', String(options.maxRetries));
    if (!options.trace) args.push('--no-trace');
    if (options.budget) args.push('--budget', String(options.budget));

    const proc = spawn('python', ['-m', 'faber.bridge', ...args], {
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    proc.stdout.on('data', (data) => {
      const lines = data.toString().split('\n').filter(Boolean);
      for (const line of lines) {
        try {
          const event = JSON.parse(line);
          this.emit(event.type || 'data', event);
        } catch {
          this.emit('log', line);
        }
      }
    });

    proc.stderr.on('data', (data) => {
      this.emit('error', data.toString());
    });

    return new Promise((resolve, reject) => {
      proc.on('close', (code) => {
        if (code === 0) resolve();
        else reject(new Error(`Process exited with code ${code}`));
      });
    });
  }

  private async runViaHttp(
    workId: string,
    options: WorkflowOptions
  ): Promise<void> {
    const response = await fetch(`${this.options.serverUrl}/workflows/run`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ work_id: workId, options }),
    });

    const { workflow_id, stream_url } = await response.json();

    // Stream progress via SSE
    const eventSource = new EventSource(
      `${this.options.serverUrl}${stream_url}`
    );

    eventSource.onmessage = (event) => {
      const data = JSON.parse(event.data);
      this.emit(data.type || 'data', data);
    };

    eventSource.onerror = () => {
      eventSource.close();
    };
  }
}
```

### 6.3 Output Formatting

```typescript
// packages/cli/src/commands/faber/run.ts

import { FaberBridge } from './bridge';
import { createSpinner } from 'nanospinner';
import chalk from 'chalk';

export async function runWorkflow(workId: string, options: any): Promise<void> {
  const bridge = new FaberBridge();
  const spinner = createSpinner('Starting FABER workflow...').start();

  bridge.on('phase_start', ({ phase, message }) => {
    spinner.update({ text: `${chalk.cyan(phase)}: ${message}` });
  });

  bridge.on('progress', ({ phase, message }) => {
    spinner.update({ text: `${chalk.cyan(phase)}: ${message}` });
  });

  bridge.on('phase_end', ({ phase, status }) => {
    const icon = status === 'completed' ? chalk.green('✓') : chalk.red('✗');
    console.log(`${icon} ${phase}`);
  });

  bridge.on('approval_required', async ({ phase, prompt }) => {
    spinner.stop();
    // Handle approval UI
  });

  bridge.on('complete', ({ status, pr_url }) => {
    spinner.success({ text: `Workflow ${status}` });
    if (pr_url) {
      console.log(`\n${chalk.bold('PR URL:')} ${pr_url}`);
    }
  });

  bridge.on('error', (error) => {
    spinner.error({ text: error });
  });

  try {
    await bridge.runWorkflow(workId, options);
  } catch (error) {
    spinner.error({ text: error.message });
    process.exit(1);
  }
}
```

## 7. Migration Plan

### 7.1 Phase 1: Add Bridge Module (This SDK)

1. Create `faber/bridge/` module with JSON output CLI
2. Create `faber/api/` module with programmatic interface
3. Add HTTP server mode to `faber/api/server.py`

### 7.2 Phase 2: Deprecate Standalone CLI

1. Add deprecation warning to `faber` CLI entry point
2. Update documentation to point to `fractary faber`
3. Keep CLI working for transition period

### 7.3 Phase 3: Implement in @fractary/cli

1. Add `fractary faber` commands in TypeScript CLI
2. Implement FaberBridge for Python SDK communication
3. Add progress UI with spinners and formatting

### 7.4 Phase 4: Remove Standalone CLI

1. Remove `faber/cli/` directory
2. Remove CLI entry point from `pyproject.toml`
3. Update all documentation
4. Release major version bump

## 8. Configuration

### 8.1 Shared Configuration

Both CLIs read from the same `.faber/config.yaml`:

```yaml
workflow:
  autonomy: assisted
  max_retries: 3
  models:
    frame: anthropic:claude-3-5-haiku-20241022
    architect: anthropic:claude-sonnet-4-20250514
    build: anthropic:claude-sonnet-4-20250514
    evaluate: anthropic:claude-sonnet-4-20250514
    release: anthropic:claude-3-5-haiku-20241022

work:
  platform: github

repo:
  platform: github
  default_branch: main

# Python SDK specific
python:
  bridge_method: subprocess  # or "http"
  server_port: 8420
```

### 8.2 Environment Variables

| Variable | Description |
|----------|-------------|
| `FABER_BRIDGE_METHOD` | Override bridge method (subprocess/http) |
| `FABER_SERVER_URL` | HTTP server URL when using http method |
| `FABER_PYTHON_PATH` | Custom Python interpreter path |

## 9. Testing

### 9.1 Python SDK Tests

```python
# tests/test_api.py

import pytest
from faber.api import run_workflow, WorkflowOptions

@pytest.mark.asyncio
async def test_run_workflow():
    result = await run_workflow("123", WorkflowOptions(
        autonomy=AutonomyLevel.AUTONOMOUS,
        trace=False,
    ))
    assert result.status in ["completed", "failed"]
```

### 9.2 Bridge Tests

```python
# tests/test_bridge.py

import subprocess
import json

def test_bridge_run():
    result = subprocess.run(
        ["python", "-m", "faber.bridge", "run", "123", "--autonomy", "autonomous"],
        capture_output=True,
        text=True,
    )

    lines = result.stdout.strip().split("\n")
    events = [json.loads(line) for line in lines]

    assert any(e.get("type") == "complete" for e in events)
```

### 9.3 Integration Tests

```typescript
// packages/cli/tests/faber.test.ts

import { FaberBridge } from '../src/commands/faber/bridge';

describe('FaberBridge', () => {
  it('should run workflow via subprocess', async () => {
    const bridge = new FaberBridge({ method: 'subprocess' });
    const events: any[] = [];

    bridge.on('phase_start', (e) => events.push(e));
    bridge.on('complete', (e) => events.push(e));

    await bridge.runWorkflow('123', { autonomy: 'autonomous' });

    expect(events.some(e => e.type === 'complete')).toBe(true);
  });
});
```

## 10. Changelog

### Version 1.0.0 (2025-12-13)
- Initial specification
- Defined API surface for Python SDK
- Defined HTTP server protocol
- Defined subprocess bridge protocol
- Defined @fractary/cli integration
