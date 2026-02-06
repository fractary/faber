# Python SDK Integration Guide

This guide covers how the FABER Python SDK (LangGraph-based) integrates with the TypeScript CLI plugin.

## Architecture Overview

FABER has a dual-language architecture:

```
┌─────────────────────────────────────────────────────────────────────┐
│                    Claude Code CLI Plugins                          │
│              (TypeScript: @fractary/faber-*)                        │
└─────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    TypeScript SDK (@fractary/faber)                 │
│         Skills, Commands, Agents in Claude Code context             │
└─────────────────────────────────────────────────────────────────────┘
                              │ IPC / subprocess
                              ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    Python SDK (faber)                               │
│         LangGraph workflows, checkpointing, observability           │
└─────────────────────────────────────────────────────────────────────┘
```

### When to Use Each SDK

| Use Case | SDK | Reason |
|----------|-----|--------|
| Claude Code skills/commands | TypeScript | Runs in Node.js plugin context |
| Programmatic workflow execution | Python | LangGraph orchestration |
| Workflow checkpointing | Python | LangGraph built-in support |
| Cost tracking & budgets | Python | Workflow-level tracking |
| LangSmith observability | Python | Native LangChain integration |
| Quick issue/PR operations | TypeScript | Direct gh CLI wrapper |

## Integration Methods

### Method 1: Subprocess Invocation (Recommended)

The TypeScript plugin invokes the Python CLI:

```typescript
// In TypeScript plugin
import { spawn } from 'child_process';

async function runFaberWorkflow(workId: string, options: WorkflowOptions): Promise<WorkflowResult> {
  return new Promise((resolve, reject) => {
    const args = ['run', workId];

    if (options.autonomy) args.push('--autonomy', options.autonomy);
    if (options.budget) args.push('--budget', options.budget.toString());
    if (options.maxRetries) args.push('--max-retries', options.maxRetries.toString());

    const proc = spawn('python', ['-m', 'faber.api', 'run', workId, ...args.slice(2)], {
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    let stdout = '';
    let stderr = '';

    proc.stdout.on('data', (data) => { stdout += data; });
    proc.stderr.on('data', (data) => { stderr += data; });

    proc.on('close', (code) => {
      if (code === 0) {
        resolve(JSON.parse(stdout));
      } else {
        reject(new Error(`Workflow failed: ${stderr}`));
      }
    });
  });
}
```

### Method 2: Shared State via Files

Both SDKs read/write to shared locations:

```
.fractary/
├── config.yaml           # Shared configuration
└── faber/
    ├── workflows/        # Workflow definitions
    └── runs/             # Workflow run state and artifacts
```

## Shared Contracts

### Workflow State Schema

Both SDKs use the same state schema:

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "type": "object",
  "properties": {
    "workflow_id": { "type": "string" },
    "work_id": { "type": "string" },
    "current_phase": {
      "type": "string",
      "enum": ["frame", "architect", "build", "evaluate", "release"]
    },
    "completed_phases": {
      "type": "array",
      "items": { "type": "string" }
    },
    "issue": { "$ref": "#/definitions/Issue" },
    "specification": { "$ref": "#/definitions/Specification" },
    "branch_name": { "type": "string" },
    "pr_url": { "type": "string" },
    "evaluation_result": {
      "type": "string",
      "enum": ["GO", "NO_GO", "RETRY"]
    },
    "retry_count": { "type": "integer" },
    "error": { "type": ["string", "null"] },
    "error_phase": { "type": ["string", "null"] }
  }
}
```

### Configuration Schema

Shared `.fractary/config.yaml`:

```yaml
workflow:
  autonomy: assisted  # assisted | guarded | autonomous
  max_retries: 3

  models:
    frame: anthropic:claude-3-5-haiku-20241022
    architect: anthropic:claude-sonnet-4-20250514
    build: anthropic:claude-sonnet-4-20250514
    evaluate: anthropic:claude-sonnet-4-20250514
    release: anthropic:claude-3-5-haiku-20241022

  human_approval:
    architect: true
    release: true

  checkpointing:
    backend: sqlite  # sqlite | postgres | redis
    sqlite:
      path: .faber/checkpoints.db

  cost:
    budget_limit_usd: 10.0
    warning_threshold: 0.8
    require_approval_at: 0.9

work:
  platform: github

repo:
  platform: github
  default_branch: main

observability:
  langsmith:
    enabled: true
    project: faber-workflows
```

## Claude Code Plugin Integration

### Using in a Skill

```typescript
// skills/workflow-runner.ts
import { spawn } from 'child_process';

interface WorkflowParams {
  workId: string;
  autonomy?: 'assisted' | 'guarded' | 'autonomous';
  budget?: number;
}

export async function execute(params: WorkflowParams): Promise<SkillResult> {
  const { workId, autonomy = 'assisted', budget } = params;

  // Build command
  const args = ['run', workId, '--autonomy', autonomy];
  if (budget) args.push('--budget', budget.toString());

  // Execute Python workflow
  const result = await new Promise<string>((resolve, reject) => {
    const proc = spawn('python', ['-m', 'faber.api', 'run', workId, ...args], { stdio: ['pipe', 'pipe', 'pipe'] });
    let output = '';
    proc.stdout.on('data', (d) => { output += d; });
    proc.on('close', (code) => {
      if (code === 0) resolve(output);
      else reject(new Error(`Exit code: ${code}`));
    });
  });

  const state = JSON.parse(result);

  return {
    success: !state.error,
    data: {
      workflow_id: state.workflow_id,
      phases_completed: state.completed_phases,
      pr_url: state.pr_url,
    },
    message: state.error || `Workflow completed: ${state.pr_url}`,
  };
}
```

### Using in a Command

```typescript
// commands/workflow.ts
import { Command } from 'commander';
import { spawn } from 'child_process';

export function registerWorkflowCommands(program: Command) {
  const workflow = program.command('workflow').description('FABER workflow commands');

  workflow
    .command('run <work_id>')
    .description('Run FABER workflow for a work item')
    .option('-a, --autonomy <level>', 'Autonomy level', 'assisted')
    .option('-b, --budget <amount>', 'Budget limit in USD')
    .option('-r, --max-retries <n>', 'Maximum retry attempts', '3')
    .action(async (workId: string, options) => {
      const args = ['run', workId];
      if (options.autonomy) args.push('--autonomy', options.autonomy);
      if (options.budget) args.push('--budget', options.budget);
      if (options.maxRetries) args.push('--max-retries', options.maxRetries);

      // Stream output
      const proc = spawn('python', ['-m', 'faber.api', ...args], { stdio: 'inherit' });

      proc.on('close', (code) => {
        process.exit(code ?? 1);
      });
    });

  workflow
    .command('list')
    .description('List workflow executions')
    .option('-s, --status <status>', 'Filter by status')
    .option('-l, --limit <n>', 'Maximum results', '20')
    .action(async (options) => {
      const args = ['workflow', 'list'];
      if (options.status) args.push('--status', options.status);
      if (options.limit) args.push('--limit', options.limit);

      spawn('python', ['-m', 'faber.api', ...args], { stdio: 'inherit' });
    });
}
```

## Installation Requirements

### TypeScript Plugin

```json
{
  "dependencies": {
    "@fractary/faber": "^1.0.0"
  }
}
```

### Python SDK

```bash
# In the project where workflows will run
pip install faber

# Or with optional backends
pip install "faber[postgres,redis]"
```

### Environment Setup

```bash
# Required for model providers
export ANTHROPIC_API_KEY=your-key

# Optional: LangSmith tracing
export LANGSMITH_API_KEY=your-key

# Optional: Database backends
export FABER_POSTGRES_URL=postgresql://...
export FABER_REDIS_URL=redis://...
```

## Workflow Lifecycle

### 1. TypeScript Initiates Workflow

```typescript
// User runs: /fractary-faber:workflow-run 123
const result = await runFaberWorkflow('123', { autonomy: 'assisted' });
```

### 2. Python Executes Phases

```
Frame → Architect → [Human Approval] → Build → Evaluate → [Retry?] → Release → [Human Approval]
```

### 3. Approval Handling

**CLI Mode** (default):
- Python prompts for approval in terminal
- User types `yes/no`

**GitHub Mode**:
- Python posts comment to issue
- Waits for reaction or comment response

### 4. TypeScript Receives Result

```typescript
interface WorkflowResult {
  workflow_id: string;
  work_id: string;
  status: 'completed' | 'failed';
  completed_phases: string[];
  pr_url?: string;
  error?: string;
  error_phase?: string;
  cost_usd: number;
}
```

## Error Handling

### Python Errors

```python
# Python SDK raises
class BudgetExceeded(Exception): ...
class BudgetApprovalRequired(Exception): ...
class WorkflowError(Exception): ...
```

### TypeScript Handling

```typescript
try {
  const result = await runFaberWorkflow('123', { budget: 5.0 });
} catch (error) {
  if (error.message.includes('Budget exceeded')) {
    console.error('Workflow exceeded budget limit');
  } else if (error.message.includes('approval required')) {
    console.log('Waiting for budget approval...');
  } else {
    throw error;
  }
}
```

## Observability

### LangSmith Integration

The Python SDK automatically traces to LangSmith when configured:

```yaml
# .fractary/config.yaml or Python SDK config
observability:
  langsmith:
    enabled: true
    project: faber-workflows
```

View traces at: https://smith.langchain.com/

### Workflow Logs

```bash
# Check workflow run status
fractary-faber run-inspect --work-id 123

# Inspect workflow details
fractary-faber workflow-inspect
```

## Migration from TypeScript-Only

If you're currently using only the TypeScript SDK:

### Before (TypeScript orchestration)

```typescript
// Manual phase execution
const issue = await workManager.fetchIssue('123');
const spec = await specManager.createSpec(issue.title, { ... });
// ... manual phase logic ...
const pr = await repoManager.createPR({ ... });
```

### After (Python orchestration)

```typescript
// Single workflow call
const result = await runFaberWorkflow('123', {
  autonomy: 'assisted',
  budget: 10.0,
});
// All phases handled automatically with checkpointing
```

Benefits:
- Automatic checkpointing and resume
- Built-in retry logic
- Cost tracking
- LangSmith observability
- Human-in-the-loop approval
