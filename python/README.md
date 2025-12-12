# FABER Python SDK

AI-assisted development workflows powered by LangGraph.

FABER (Frame, Architect, Build, Evaluate, Release) provides enterprise-grade workflow orchestration for AI-assisted software development.

## Installation

```bash
# Basic installation
pip install -e .

# With all optional dependencies
pip install -e ".[all]"

# With specific backends
pip install -e ".[postgres]"  # PostgreSQL checkpointing
pip install -e ".[redis]"     # Redis checkpointing
```

## Quick Start

### Run a FABER Workflow

```bash
# Run workflow for issue #123
faber run 123

# Run with specific options
faber run 123 --autonomy assisted --max-retries 5 --budget 10.0

# Run without tracing
faber run 123 --no-trace
```

### Initialize Configuration

```bash
faber init
```

This creates `.faber/config.yaml` with default settings.

### Programmatic Usage

```python
import asyncio
from faber import create_faber_workflow, run_faber_workflow

# Run a workflow
async def main():
    result = await run_faber_workflow(work_id="123")
    print(f"Workflow completed: {result['workflow_id']}")
    print(f"PR URL: {result.get('pr_url')}")

asyncio.run(main())
```

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    Layer 5: FABER CLI / Studio                   │
│              User interfaces (CLI commands, visual builder)      │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Layer 4: FABER Workflow Definitions           │
│         Declarative YAML/JSON workflow configs + templates       │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Layer 3: FABER Phase Agents                   │
│         Middleware for Frame/Architect/Build/Evaluate/Release    │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Layer 2: FABER Tools                          │
│         LangChain @tool wrappers around FABER primitives         │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Layer 1: FABER Primitives                     │
│         WorkManager, RepoManager, SpecManager, LogManager        │
│         (Framework-agnostic, portable Python)                    │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Foundation: LangGraph + LangChain             │
│         Orchestration, state management, model providers         │
└─────────────────────────────────────────────────────────────────┘
```

## FABER Phases

1. **Frame** - Gather requirements and classify work type
2. **Architect** - Create detailed specification (human approval checkpoint)
3. **Build** - Implement the solution with semantic commits
4. **Evaluate** - Validate against spec (GO/NO-GO decision, may retry Build)
5. **Release** - Create PR and deliver (human approval checkpoint)

## Configuration

Create `.faber/config.yaml`:

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

  approval:
    notify_channels:
      - cli
      - github
    response_channels:
      - cli
      - github
    timeout_minutes: 60

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

## Environment Variables

```bash
# LangSmith tracing (optional)
export LANGSMITH_API_KEY=your-key

# Model providers
export ANTHROPIC_API_KEY=your-key
export OPENAI_API_KEY=your-key

# Database backends (optional)
export FABER_POSTGRES_URL=postgresql://...
export FABER_REDIS_URL=redis://...
```

## CLI Commands

```bash
# Run workflow
faber run <work_id> [options]
  --autonomy, -a    Autonomy level (assisted, guarded, autonomous)
  --max-retries, -r Maximum retry attempts
  --skip-phase, -s  Phases to skip
  --budget, -b      Budget limit in USD
  --trace/--no-trace Enable LangSmith tracing

# Initialize configuration
faber init [--force]

# List workflows
faber workflow list [--status <status>] [--limit <n>]

# View workflow details
faber workflow view <workflow_id>

# Show version
faber version
```

## API Reference

### Workflow Functions

```python
from faber import create_faber_workflow, run_faber_workflow

# Create workflow instance
workflow = create_faber_workflow(config=None)

# Run workflow (async)
result = await run_faber_workflow(
    work_id="123",
    config=None,           # Optional: WorkflowConfig
    workflow_id=None,      # Optional: Resume specific workflow
)

# Run workflow (sync)
from faber.workflows.graph import run_faber_workflow_sync
result = run_faber_workflow_sync(work_id="123", config=None)
```

### Primitives (Layer 1)

```python
from faber.primitives.work import WorkManager
from faber.primitives.repo import RepoManager
from faber.primitives.spec import SpecManager
from faber.primitives.logs import LogManager

# Work tracking
work = WorkManager()
issue = work.fetch_issue("123")
work_type = work.classify_work_type(issue)

# Repository operations
repo = RepoManager()
branch = repo.create_branch("feat/new-feature")
repo.commit("feat: add feature", files=["src/feature.py"])

# Specification management
spec = SpecManager()
spec_content = spec.create_specification(issue, work_type)
validation = spec.validate_specification(spec_content)

# Logging
logs = LogManager()
logs.log_phase_start("frame", workflow_id)
logs.log_phase_end("frame", workflow_id, result)
```

### Cost Tracking

```python
from faber.cost import CostTracker, CostConfig

config = CostConfig(
    budget_limit_usd=10.0,
    warning_threshold=0.8,
    require_approval_at=0.9,
)

tracker = CostTracker("workflow-123", config)
tracker.add_usage(
    model="claude-sonnet-4-20250514",
    input_tokens=10000,
    output_tokens=5000,
    phase="architect",
)

summary = tracker.get_summary()
print(f"Total cost: ${summary.total_cost_usd:.2f}")
```

### Approval Queue

```python
from faber.approval import ApprovalQueue, ApprovalType

queue = ApprovalQueue("workflow-123")

# Add approval request
request_id = queue.add_request(
    approval_type=ApprovalType.SPECIFICATION,
    title="Approve Specification",
    description="Please review the specification.",
    context={"spec_path": "/path/to/spec.md"},
)

# Wait for response
response = await queue.wait_for_approval(request_id, timeout=3600.0)
if response and response.approved:
    print("Approved!")
```

## Integration with TypeScript CLI

The Python SDK integrates with the TypeScript Claude Code plugin via subprocess:

```typescript
// From TypeScript plugin
import { spawn } from 'child_process';

const result = await new Promise((resolve, reject) => {
  const proc = spawn('faber', ['run', '123', '--autonomy', 'assisted']);
  // ... handle stdout/stderr
});
```

For detailed integration patterns, see: [Python SDK Integration Guide](../docs/python-sdk-integration.md)

## Development

```bash
# Install dev dependencies
pip install -e ".[dev]"

# Run tests
pytest

# Type checking
mypy faber

# Linting
ruff check faber
```

## Related Documentation

- [Integration Guide](../docs/python-sdk-integration.md) - TypeScript CLI integration
- [TypeScript SDK](../docs/integration-guide.md) - @fractary/faber TypeScript package
- [API Reference](../docs/api-reference.md) - Full API documentation
- [SPEC-00025](../specs/SPEC-00025-langgraph-integration.md) - Architecture specification

## License

MIT
